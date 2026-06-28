// Dumps the production database, encrypts it (AES-256-GCM, see backup-crypto.js), and
// uploads the encrypted file to the super admin's Google Drive. This is a second,
// independent copy of the database backup - alongside the unencrypted one in R2
// (scripts/backup-db.js) - so losing access to Cloudflare doesn't also mean losing the
// only off-Railway copy of the database. Runs as its own job, independent of the R2
// backup job, so each one still succeeds even if the other fails.
//
// Talks to Google's APIs entirely via the plain `https` module rather than the
// `googleapis` package's own request transport (which uses Node's built-in fetch
// internally). That fetch path failed twice in this CI environment, on two different
// endpoints (the OAuth token endpoint, then the Drive files.list endpoint), with the
// identical 'Premature close' error both times - a reproducible transport bug, not
// transient flakiness. The manual https calls below proved reliable for the token
// exchange, so the same approach is used for every Drive call here too.
//
// Restore: node scripts/decrypt-backup.js <downloaded-file> <output-file>.dump
//          then pg_restore --clean --no-owner -d <target-db-url> <output-file>.dump
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { encryptBuffer } = require('./backup-crypto');

const RETENTION_COUNT = 30;
const BACKUP_NAME_PREFIX = 'css-rms-db-';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      resolve(stdout);
    });
  });
}

async function withRetry(label, fn, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) throw err;
      const delayMs = 1000 * 2 ** (i - 1);
      console.warn(`[drive-backup] ${label} failed (attempt ${i}/${attempts}): ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Generic raw HTTPS request - used for everything (token exchange, Drive list/delete/
// upload) so nothing in this script depends on googleapis's own fetch-based transport.
function request({ hostname, path: reqPath, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: reqPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }).toString();

  return request({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    body,
  }).then(({ statusCode, body: respBody }) => {
    if (statusCode !== 200) throw new Error(`Token refresh failed (${statusCode}): ${respBody.toString()}`);
    return JSON.parse(respBody.toString()).access_token;
  });
}

function listBackupFiles(accessToken, folderId) {
  const q = `name contains '${BACKUP_NAME_PREFIX}'` + (folderId ? ` and '${folderId}' in parents` : '');
  const params = new URLSearchParams({ q, fields: 'files(id, name)', orderBy: 'name', pageSize: '1000' });
  return request({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?${params.toString()}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(({ statusCode, body }) => {
    if (statusCode !== 200) throw new Error(`List failed (${statusCode}): ${body.toString()}`);
    return JSON.parse(body.toString()).files || [];
  });
}

function deleteFile(accessToken, fileId) {
  return request({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files/${fileId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(({ statusCode, body }) => {
    if (statusCode !== 204) throw new Error(`Delete failed (${statusCode}): ${body.toString()}`);
  });
}

function uploadFile(accessToken, { name, parents, mimeType, data }) {
  const boundary = `backup_${crypto.randomBytes(16).toString('hex')}`;
  const metadata = JSON.stringify({ name, parents });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, data, tail]);

  return request({
    hostname: 'www.googleapis.com',
    path: '/upload/drive/v3/files?uploadType=multipart',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length,
    },
    body,
  }).then(({ statusCode, body: respBody }) => {
    if (statusCode !== 200) throw new Error(`Upload failed (${statusCode}): ${respBody.toString()}`);
    return JSON.parse(respBody.toString());
  });
}

async function main() {
  const required = ['DATABASE_URL', 'BACKUP_ENCRYPTION_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  for (const name of required) {
    if (!process.env[name]) throw new Error(`${name} is not set.`);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const dumpPath = path.join(os.tmpdir(), `${BACKUP_NAME_PREFIX}${stamp}.dump`);
  const encryptedName = `${BACKUP_NAME_PREFIX}${stamp}.dump.enc`;

  console.log(`[drive-backup] Dumping database to ${dumpPath}...`);
  await run('pg_dump', ['--format=custom', '--file', dumpPath, process.env.DATABASE_URL]);

  console.log('[drive-backup] Encrypting dump...');
  const plaintext = fs.readFileSync(dumpPath);
  const encrypted = encryptBuffer(plaintext, process.env.BACKUP_ENCRYPTION_KEY);
  fs.unlinkSync(dumpPath);
  console.log(`[drive-backup] Encrypted size: ${(encrypted.length / 1024 / 1024).toFixed(1)} MB.`);

  console.log('[drive-backup] Refreshing access token...');
  const accessToken = await withRetry('Token refresh', getAccessToken);

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

  console.log(`[drive-backup] Uploading ${encryptedName} to Google Drive...`);
  await withRetry('Upload', () => uploadFile(accessToken, {
    name: encryptedName,
    parents: folderId ? [folderId] : undefined,
    mimeType: 'application/octet-stream',
    data: encrypted,
  }));
  console.log('[drive-backup] Upload complete.');

  console.log('[drive-backup] Pruning old backups beyond retention...');
  const files = await withRetry('List', () => listBackupFiles(accessToken, folderId));
  const toDelete = files.slice(0, Math.max(0, files.length - RETENTION_COUNT));
  for (const file of toDelete) {
    await withRetry(`Delete ${file.name}`, () => deleteFile(accessToken, file.id));
    console.log(`[drive-backup] Deleted old backup: ${file.name}`);
  }

  console.log(`[drive-backup] Done. ${files.length - toDelete.length} backup(s) retained.`);
}

main().catch((err) => {
  console.error('[drive-backup] FAILED:', err.message);
  process.exit(1);
});

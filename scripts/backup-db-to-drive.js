// Dumps the production database, encrypts it (AES-256-GCM, see backup-crypto.js), and
// uploads the encrypted file to the super admin's Google Drive. This is a second,
// independent copy of the database backup - alongside the unencrypted one in R2
// (scripts/backup-db.js) - so losing access to Cloudflare doesn't also mean losing the
// only off-Railway copy of the database. Runs as its own job, independent of the R2
// backup job, so each one still succeeds even if the other fails.
//
// Restore: node scripts/decrypt-backup.js <downloaded-file> <output-file>.dump
//          then pg_restore --clean --no-owner -d <target-db-url> <output-file>.dump
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { google } = require('googleapis');
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

// Google's token endpoint occasionally drops the connection mid-response in CI
// containers ('Invalid response body ... Premature close') - a transient network
// blip, not a logic error. This job runs unattended on a schedule, so retry rather
// than let one flaky request fail the whole backup.
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

// google-auth-library's automatic token refresh uses Node's built-in fetch, which has a
// reproducible 'Premature close' bug talking to oauth2.googleapis.com in this CI
// environment (confirmed: failed identically on 3 separate attempts, so it's not transient
// flakiness - it's this specific fetch implementation). Bypass it entirely by exchanging
// the refresh token for an access token ourselves with the plain https module, then hand
// that access token to the Drive client directly instead of letting the library refresh it.
function getAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`Token refresh failed (${res.statusCode}): ${data}`));
          try {
            resolve(JSON.parse(data).access_token);
          } catch (e) {
            reject(new Error(`Token refresh returned unparseable response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
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

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

  console.log(`[drive-backup] Uploading ${encryptedName} to Google Drive...`);
  const encPath = path.join(os.tmpdir(), encryptedName);
  fs.writeFileSync(encPath, encrypted);
  await withRetry('Upload', () => drive.files.create({
    requestBody: { name: encryptedName, parents: folderId ? [folderId] : undefined },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(encPath) },
  }));
  fs.unlinkSync(encPath);
  console.log('[drive-backup] Upload complete.');

  console.log('[drive-backup] Pruning old backups beyond retention...');
  const listQuery = `name contains '${BACKUP_NAME_PREFIX}'` + (folderId ? ` and '${folderId}' in parents` : '');
  const list = await withRetry('List', () => drive.files.list({
    q: listQuery,
    fields: 'files(id, name, createdTime)',
    orderBy: 'name', // names are date-stamped, so name order == chronological order
    pageSize: 1000,
  }));
  const files = list.data.files || [];
  const toDelete = files.slice(0, Math.max(0, files.length - RETENTION_COUNT));
  for (const file of toDelete) {
    await withRetry(`Delete ${file.name}`, () => drive.files.delete({ fileId: file.id }));
    console.log(`[drive-backup] Deleted old backup: ${file.name}`);
  }

  console.log(`[drive-backup] Done. ${files.length - toDelete.length} backup(s) retained.`);
}

main().catch((err) => {
  console.error('[drive-backup] FAILED:', err.message);
  process.exit(1);
});

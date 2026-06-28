// Dumps the production Postgres database and uploads it to the same Cloudflare R2
// bucket already used for file storage (lib/storage.js), under a backups/db/ prefix.
// Run on a schedule by .github/workflows/db-backup.yml - independent of Railway, so
// it still runs even if Railway itself is the thing that's down.
//
// Restore: `pg_restore --clean --no-owner -d <target-db-url> <downloaded-file>`
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const RETENTION_COUNT = 30; // keep the most recent 30 daily backups
const BACKUP_PREFIX = 'backups/db/';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${stderr || err.message}`));
      resolve(stdout);
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  for (const name of required) {
    if (!process.env[name]) throw new Error(`${name} is not set.`);
  }

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const localPath = path.join(os.tmpdir(), `css-rms-${stamp}.dump`);
  const key = `${BACKUP_PREFIX}css-rms-${stamp}.dump`;

  console.log(`[backup] Dumping database to ${localPath}...`);
  // Custom format (-Fc): compressed, supports selective/parallel restore via pg_restore.
  await run('pg_dump', ['--format=custom', '--file', localPath, databaseUrl]);

  const size = fs.statSync(localPath).size;
  console.log(`[backup] Dump complete (${(size / 1024 / 1024).toFixed(1)} MB). Uploading to R2 as ${key}...`);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fs.createReadStream(localPath),
    ContentType: 'application/octet-stream',
  }));
  fs.unlinkSync(localPath);
  console.log('[backup] Upload complete.');

  console.log('[backup] Pruning old backups beyond retention...');
  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: BACKUP_PREFIX,
  }));
  const objects = (listed.Contents || []).sort((a, b) => a.Key.localeCompare(b.Key)); // lexicographic == chronological (YYYY-MM-DD)
  const toDelete = objects.slice(0, Math.max(0, objects.length - RETENTION_COUNT));
  for (const obj of toDelete) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: obj.Key }));
    console.log(`[backup] Deleted old backup: ${obj.Key}`);
  }

  console.log(`[backup] Done. ${objects.length - toDelete.length} backup(s) retained.`);
}

main().catch((err) => {
  console.error('[backup] FAILED:', err.message);
  process.exit(1);
});

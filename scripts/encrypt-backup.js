// Encrypts an arbitrary file with the same AES-256-GCM scheme used for the Drive backups.
// Mainly useful if you've manually restored + inspected a backup locally and want to
// re-encrypt it before storing or moving it elsewhere - the daily automated backup job
// does this on its own and doesn't need this script.
//
// Usage: node scripts/encrypt-backup.js <input-file> <output-file.enc>
// Requires BACKUP_ENCRYPTION_KEY env var.
const fs = require('fs');
const { encryptBuffer } = require('./backup-crypto');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/encrypt-backup.js <input-file> <output-file.enc>');
  process.exit(1);
}
if (!process.env.BACKUP_ENCRYPTION_KEY) {
  console.error('BACKUP_ENCRYPTION_KEY is not set.');
  process.exit(1);
}

const plaintext = fs.readFileSync(inputPath);
const encrypted = encryptBuffer(plaintext, process.env.BACKUP_ENCRYPTION_KEY);
fs.writeFileSync(outputPath, encrypted);
console.log(`Encrypted to ${outputPath}.`);

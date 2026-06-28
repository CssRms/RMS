// Restore step 1 of 2: decrypts a backup downloaded from Google Drive back into a plain
// pg_dump file. Step 2 is `pg_restore --clean --no-owner -d <target-db-url> <output-file>`.
//
// Usage: node scripts/decrypt-backup.js <input-file.dump.enc> <output-file.dump>
// Requires BACKUP_ENCRYPTION_KEY env var (the same key from generate-backup-key.js).
const fs = require('fs');
const { decryptBuffer } = require('./backup-crypto');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/decrypt-backup.js <input-file.dump.enc> <output-file.dump>');
  process.exit(1);
}
if (!process.env.BACKUP_ENCRYPTION_KEY) {
  console.error('BACKUP_ENCRYPTION_KEY is not set.');
  process.exit(1);
}

const encrypted = fs.readFileSync(inputPath);
const decrypted = decryptBuffer(encrypted, process.env.BACKUP_ENCRYPTION_KEY);
fs.writeFileSync(outputPath, decrypted);
console.log(`Decrypted to ${outputPath}. Restore with:\n  pg_restore --clean --no-owner -d <target-db-url> ${outputPath}`);

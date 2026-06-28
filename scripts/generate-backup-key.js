// Run once: node scripts/generate-backup-key.js
// Prints a fresh random 256-bit key for the encrypted-Drive-backup pipeline. Save it
// somewhere durable (password manager) - it goes into the BACKUP_ENCRYPTION_KEY GitHub
// secret AND is the only thing that can ever decrypt these backups. Losing it makes
// every encrypted backup permanently unreadable; there is no recovery without it.
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));

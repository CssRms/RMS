// AES-256-GCM encrypt/decrypt for backup files. The key is a raw 32-byte secret (64 hex
// chars), generated once with `node scripts/generate-backup-key.js` and never derived from
// a human-memorable passphrase - a properly random key is strictly stronger, and "only you
// hold it" just means the key itself lives somewhere durable you control (password manager),
// not that it has to be something you can type from memory.
//
// Output file layout: [12-byte IV][16-byte auth tag][ciphertext]
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function loadKey(hexKey) {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new Error('Backup encryption key must be 32 bytes (64 hex characters).');
  return key;
}

function encryptBuffer(plaintext, hexKey) {
  const key = loadKey(hexKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

function decryptBuffer(encrypted, hexKey) {
  const key = loadKey(hexKey);
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encryptBuffer, decryptBuffer };

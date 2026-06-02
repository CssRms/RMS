const nodemailer = require('nodemailer');

// Strip accidental surrounding quotes (e.g. Railway users type "value" instead of value)
const clean = (v) => v ? String(v).trim().replace(/^["']|["']$/g, '') : null;

let cachedTransport = null;
let transportError = null;

function buildTransport() {
  const gmailUser = clean(process.env.GMAIL_USER);
  const gmailPass = clean(process.env.GMAIL_APP_PASSWORD);

  if (gmailUser && gmailPass) {
    console.log(`[MAIL] Building Gmail transport for ${gmailUser}`);
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });
  }

  const host  = clean(process.env.SMTP_HOST);
  const user  = clean(process.env.SMTP_USER);
  const pass  = clean(process.env.SMTP_PASS);
  if (host && user && pass) {
    const port   = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    console.log(`[MAIL] Building SMTP transport ${host}:${port}`);
    return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  }

  console.warn('[MAIL] No email transport configured — set GMAIL_USER + GMAIL_APP_PASSWORD in Railway Variables (no quotes).');
  return null;
}

function getTransport() {
  if (!cachedTransport) cachedTransport = buildTransport();
  return cachedTransport;
}

async function verifyTransport() {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.verify();
    transportError = null;
    console.log('[MAIL] ✅ Transport verified — email is ready.');
    return true;
  } catch (err) {
    transportError = err.message;
    console.error('[MAIL] ❌ Transport verify FAILED:', err.message);
    console.error('[MAIL]    Fix: ensure GMAIL_APP_PASSWORD is a 16-char App Password from');
    console.error('[MAIL]    myaccount.google.com/apppasswords (2FA must be enabled). No quotes.');
    return false;
  }
}

function getFromAddress() {
  const raw = clean(process.env.MAIL_FROM) || clean(process.env.GMAIL_USER) || clean(process.env.SMTP_USER) || 'no-reply@cssgroup.local';
  if (raw.includes('<')) return raw;
  const name = process.env.MAIL_FROM_NAME || 'CSS RMS';
  return `"${name}" <${raw}>`;
}

async function sendEmail({ to, subject, text, html, bcc, replyTo }) {
  const transport = getTransport();
  if (!transport) {
    console.warn(`[MAIL] SKIPPED (no transport): "${subject}" → ${to}`);
    return { skipped: true };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : to;
  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
    return { skipped: true };
  }

  try {
    const info = await transport.sendMail({
      from: getFromAddress(),
      to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
      bcc, replyTo, subject, text, html
    });
    console.log(`[MAIL] ✅ Sent "${subject}" → ${Array.isArray(recipients) ? recipients.join(', ') : recipients}`);
    return info;
  } catch (err) {
    console.error(`[MAIL] ❌ FAILED "${subject}" → ${to}: ${err.message}`);
    throw err;
  }
}

function getTransportStatus() {
  return { configured: !!getTransport(), error: transportError };
}

module.exports = { sendEmail, verifyTransport, getTransportStatus };

// Email transport — Resend HTTP API (port 443, works on Railway/all cloud platforms)
const clean = (v) => v ? String(v).trim().replace(/^["']|["']$/g, '') : null;

function getFromAddress() {
  // Support both RESEND_FROM and RESEND_FROM_EMAIL env var names
  const raw = clean(process.env.RESEND_FROM) || clean(process.env.RESEND_FROM_EMAIL) || 'CSS RMS <onboarding@resend.dev>';
  if (raw.includes('<')) return raw;
  const name = process.env.MAIL_FROM_NAME || 'CSS RMS';
  return `"${name}" <${raw}>`;
}

async function sendEmail({ to, subject, text, html }) {
  const apiKey = clean(process.env.RESEND_API_KEY);
  if (!apiKey) {
    console.warn(`[MAIL] SKIPPED (no RESEND_API_KEY): "${subject}" → ${to}`);
    return { skipped: true };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) return { skipped: true };

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: getFromAddress(), to: recipients, subject, html, text })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(`Resend ${resp.status}: ${data?.message || data?.name || JSON.stringify(data)}`);
    }
    console.log(`[MAIL] ✅ Sent "${subject}" → ${recipients.join(', ')} (id: ${data.id})`);
    return data;
  } catch (err) {
    console.error(`[MAIL] ❌ FAILED "${subject}" → ${recipients.join(', ')}: ${err.message}`);
    throw err;
  }
}

async function verifyTransport() {
  const apiKey = clean(process.env.RESEND_API_KEY);
  if (!apiKey) {
    console.warn('[MAIL] No RESEND_API_KEY set — email notifications disabled.');
    return false;
  }
  console.log(`[MAIL] ✅ Resend transport ready (from: ${getFromAddress()})`);
  return true;
}

function getTransportStatus() {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const fromAddr = clean(process.env.RESEND_FROM) || clean(process.env.RESEND_FROM_EMAIL);
  return {
    configured: !!apiKey,
    provider: apiKey ? 'resend' : 'none',
    error: null,
    fromAddress: fromAddr || null,
  };
}

module.exports = { sendEmail, verifyTransport, getTransportStatus };

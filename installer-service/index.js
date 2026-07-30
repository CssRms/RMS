/**
 * Standalone file host for CSS Quick Time desktop installers.
 *
 * Deliberately its own tiny Railway service (not a route bolted onto
 * serve.js) - large binary downloads to potentially many company
 * laptops should never share request/bandwidth budget with the main
 * business app. Actual file bytes are served by Cloudflare's edge via
 * short-lived presigned R2 URLs - this service only ever hands out a
 * signed link and steps aside, it never proxies the file itself.
 *
 * Reuses the exact same Cloudflare R2 storage pro-rms already uses
 * (see lib/storage.js) - same env var names (R2_ACCOUNT_ID,
 * R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME), so the same
 * Railway variables can be copied straight into this service. Files
 * live under an "installers/" key prefix so they never collide with
 * pro-rms's own HR photos/documents in the same bucket.
 *
 * GET / renders public/index.html as the product's real download page
 * (overview, download button, release notes, requirements, disclaimer)
 * - filled in from installers/latest.json, a small metadata object
 * written alongside the actual installer by POST /upload.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PREFIX = 'installers/';
const LATEST_KEY = `${PREFIX}latest.json`;
const PORT = process.env.PORT || 8080;
const PAGE_TEMPLATE = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');

const app = express();
app.set('trust proxy', 1); // behind Railway's edge/Cloudflare - needed for correct rate-limit IP detection
app.use(helmet({ contentSecurityPolicy: false })); // this page is fully self-contained (no external scripts/styles) - default CSP is unnecessary friction here
app.use(express.json());

const useR2 = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME
);

const s3 = useR2 ? new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;

function safeFilename(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9._-]+$/.test(name) && name.length <= 200;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function readLatestMeta() {
  if (!useR2) return null;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: LATEST_KEY }));
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return null; // not published yet, or storage not reachable - page just shows a friendly "not available" state
  }
}

async function writeLatestMeta(meta) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME, Key: LATEST_KEY,
    Body: Buffer.from(JSON.stringify(meta, null, 2)), ContentType: 'application/json',
  }));
}

// ── Public download page ────────────────────────────────────────────────
app.get('/', async (_req, res) => {
  const meta = await readLatestMeta();
  let fileSize = '';
  if (meta && useR2) {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: PREFIX + meta.filename }));
      fileSize = formatBytes(head.ContentLength);
    } catch { /* file listed in latest.json but missing from storage - show what we have anyway */ }
  }

  const downloadBlock = meta ? `
    <a class="download-btn" href="/download/latest">
      <span class="arrow">&#8595;</span> Download for Windows
    </a>
    <div class="download-meta">
      <strong>v${escapeHtml(meta.version)}</strong>${fileSize ? ` &middot; ${escapeHtml(fileSize)}` : ''}${meta.publishedAt ? ` &middot; Updated ${escapeHtml(new Date(meta.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }))}` : ''}
    </div>` : `
    <div class="no-release">No installer has been published yet — check back soon.</div>`;

  const releaseNotesBlock = meta ? `
    <div class="notes-card">
      <div class="version-line">Version ${escapeHtml(meta.version)}</div>
      ${meta.publishedAt ? `<div class="version-date">${escapeHtml(new Date(meta.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>` : ''}
      <div class="notes-body">${escapeHtml(meta.releaseNotes) || 'No release notes were provided for this version.'}</div>
    </div>` : `
    <div class="notes-card"><div class="notes-body">Nothing published yet.</div></div>`;

  const html = PAGE_TEMPLATE
    .replace('{{DOWNLOAD_BLOCK}}', downloadBlock)
    .replace('{{RELEASE_NOTES_BLOCK}}', releaseNotesBlock)
    .replace('{{YEAR}}', String(new Date().getFullYear()));

  res.type('html').send(html);
});

// Registered AFTER the dynamic "/" route above, so a request for "/"
// still matches that handler (the rendered page) rather than this
// middleware's own default index.html auto-serve behavior - index:false
// is a defensive second guard against that same mistake. Only serves
// the favicon/logo assets copied in from the desktop app's real icon.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, storageConfigured: useR2 });
});

const downloadLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

async function redirectToPresigned(res, filename) {
  const key = PREFIX + filename;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
  } catch {
    return res.status(404).json({ error: 'Not found' });
  }
  const url = await getSignedUrl(
    s3, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), { expiresIn: 3600 },
  );
  res.redirect(302, url);
}

// GET /download/latest - stable link that never needs updating in pro-rms's
// Download URL field even as new versions get published; always resolves
// to whatever installers/latest.json currently points at.
app.get('/download/latest', downloadLimiter, async (_req, res) => {
  if (!useR2) return res.status(503).json({ error: 'Storage not configured' });
  const meta = await readLatestMeta();
  if (!meta) return res.status(404).json({ error: 'No version published yet' });
  await redirectToPresigned(res, meta.filename);
});

// GET /download/:filename -> 302 to a 1-hour presigned R2 URL, for a
// specific historical version.
app.get('/download/:filename', downloadLimiter, async (req, res) => {
  if (!useR2) return res.status(503).json({ error: 'Storage not configured' });
  const { filename } = req.params;
  if (!safeFilename(filename)) return res.status(400).json({ error: 'Invalid filename' });
  await redirectToPresigned(res, filename);
});

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // generous headroom above today's ~82MB build
});

function requireUploadKey(req, res, next) {
  const configured = process.env.INSTALLER_UPLOAD_KEY;
  // A wrong/missing key gets a plain 404, not 401/403, so the route's
  // existence isn't advertised to anyone probing it - same pattern as
  // pro-rms's own DESKTOP_SYNC_KEY check on /api/sync/heartbeat.
  if (!configured || req.headers['x-upload-key'] !== configured) {
    return res.status(404).end();
  }
  next();
}

// GET /list - which installer files currently exist, gated the same way
// as /upload below (not linked anywhere, exists for your own convenience).
app.get('/list', downloadLimiter, requireUploadKey, async (_req, res) => {
  if (!useR2) return res.status(503).json({ error: 'Storage not configured' });
  const result = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: PREFIX }));
  const files = (result.Contents || [])
    .filter(obj => obj.Key !== LATEST_KEY)
    .map(obj => ({ filename: obj.Key.slice(PREFIX.length), size: obj.Size, lastModified: obj.LastModified }));
  res.json({ files });
});

// POST /upload (multipart field "file", optional "filename", "version",
// "releaseNotes", "setLatest") - lets you push a new installer here
// directly instead of using the R2/Cloudflare dashboard by hand each
// release. setLatest defaults to true: unless explicitly "false", this
// upload also becomes what GET /download/latest and the download page
// point to.
app.post('/upload', uploadLimiter, requireUploadKey, upload.single('file'), async (req, res) => {
  if (!useR2) return res.status(503).json({ error: 'Storage not configured' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  const filename = (req.body.filename || req.file.originalname || '').trim();
  if (!safeFilename(filename)) {
    return res.status(400).json({ error: 'Invalid filename - letters, numbers, dot, dash, underscore only' });
  }

  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: PREFIX + filename,
    Body: req.file.buffer,
    ContentType: req.file.mimetype || 'application/octet-stream',
  }));

  const downloadUrl = `${req.protocol}://${req.get('host')}/download/${encodeURIComponent(filename)}`;

  if (req.body.setLatest !== 'false') {
    if (!req.body.version) {
      return res.status(400).json({ error: 'version is required unless setLatest=false' });
    }
    await writeLatestMeta({
      version: req.body.version,
      filename,
      releaseNotes: req.body.releaseNotes || '',
      publishedAt: new Date().toISOString(),
    });
  }

  res.json({ ok: true, filename, downloadUrl, stableDownloadUrl: `${req.protocol}://${req.get('host')}/download/latest` });
});

app.use((err, _req, res, _next) => {
  const isMulterSizeError = err?.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE';
  res.status(isMulterSizeError ? 413 : (err?.status || 500)).json({
    error: isMulterSizeError ? 'File is too large.' : (err?.message || 'Server error'),
  });
});

app.listen(PORT, () => {
  console.log(`Installer service listening on port ${PORT} (R2 storage configured: ${useR2})`);
});

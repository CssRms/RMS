#!/usr/bin/env node
/**
 * CSS Group RMS — ZKTeco Biometric Sync Agent
 *
 * Run this on ANY PC that is on the same local network as the ZKTeco device.
 * It connects directly to the device via TCP, reads all attendance logs,
 * and uploads them to the Railway API.
 *
 * SETUP:
 *   1. Copy this file to your PC.
 *   2. Create a .env file in the same folder (see REQUIRED VARIABLES below).
 *   3. Install dependencies:  npm install node-zklib dotenv
 *   4. Run once manually:     node zk-sync-agent.js
 *   5. Or schedule it:        node zk-sync-agent.js --schedule 30  (every 30 min)
 *
 * REQUIRED VARIABLES in .env:
 *   ZKTECO_IP=192.168.1.100       # IP address of your ZKTeco device
 *   RAILWAY_API_URL=https://your-app.up.railway.app
 *   ZKTECO_SYNC_SECRET=your-secret-from-railway-env
 *
 * OPTIONAL VARIABLES:
 *   ZKTECO_PORT=4370              # default 4370
 *   ZKTECO_TIMEOUT=5000           # connection timeout ms (default 5000)
 *   LAST_SYNC_FILE=.last_sync     # file to track last sync timestamp
 */

'use strict';
require('dotenv').config();
const ZKLib  = require('node-zklib');
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const ZKTECO_IP      = process.env.ZKTECO_IP;
const ZKTECO_PORT    = parseInt(process.env.ZKTECO_PORT || '4370', 10);
const ZKTECO_TIMEOUT = parseInt(process.env.ZKTECO_TIMEOUT || '5000', 10);
const API_URL        = process.env.RAILWAY_API_URL?.replace(/\/$/, '');
const SYNC_SECRET    = process.env.ZKTECO_SYNC_SECRET || '';
const LAST_SYNC_FILE = process.env.LAST_SYNC_FILE || path.join(__dirname, '.last_sync');
const SCHEDULE_MIN   = parseInt(process.argv.find(a => a.startsWith('--schedule'))?.split('=')[1] || '0', 10)
                    || (process.argv.indexOf('--schedule') !== -1 ? 30 : 0);

if (!ZKTECO_IP) { console.error('ERROR: ZKTECO_IP not set in .env'); process.exit(1); }
if (!API_URL)   { console.error('ERROR: RAILWAY_API_URL not set in .env'); process.exit(1); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(...args) { console.log(new Date().toISOString(), ...args); }

function readLastSync() {
  try {
    const raw = fs.readFileSync(LAST_SYNC_FILE, 'utf8').trim();
    return raw ? new Date(raw) : null;
  } catch { return null; }
}

function saveLastSync(ts) {
  fs.writeFileSync(LAST_SYNC_FILE, ts.toISOString(), 'utf8');
}

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(API_URL + endpoint);
    const lib     = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization':  `Bearer ${SYNC_SECRET}`,
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`API ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Core sync ─────────────────────────────────────────────────────────────────
async function runSync() {
  log(`Connecting to ZKTeco at ${ZKTECO_IP}:${ZKTECO_PORT} …`);
  const zk = new ZKLib(ZKTECO_IP, ZKTECO_PORT, ZKTECO_TIMEOUT, 4000);

  try {
    await zk.createSocket();
    log('Connected. Reading device info …');

    const info = await zk.getInfo().catch(() => ({}));
    log('Device:', info?.deviceName || 'Unknown', '| SN:', info?.serialNumber || 'Unknown');

    log('Reading attendance logs …');
    const { data: logs = [] } = await zk.getAttendances();
    log(`${logs.length} total punch records on device.`);

    if (logs.length === 0) {
      log('Nothing to sync.');
      await zk.disconnect();
      return;
    }

    const lastSync = readLastSync();
    const newLogs  = lastSync
      ? logs.filter(l => new Date(l.attendanceTime) > lastSync)
      : logs;

    log(`${newLogs.length} new records since last sync (${lastSync?.toISOString() ?? 'never'}).`);

    if (newLogs.length === 0) {
      log('All records already synced.');
      await zk.disconnect();
      return;
    }

    // Build punch payload — staffId is the enrollNumber from the device
    const punches = newLogs.map(l => ({
      staffId:    String(l.deviceUserId || l.userId || '').trim().toUpperCase(),
      punchTime:  new Date(l.attendanceTime).toISOString(),
      punchType:  l.type ?? 0,
      verifyType: l.verifyType ?? 1,
    })).filter(p => p.staffId && p.punchTime);

    log(`Uploading ${punches.length} punches to ${API_URL} …`);

    // Upload in chunks of 500 to avoid timeouts
    const CHUNK = 500;
    let totalSaved = 0, totalDups = 0, totalFlagged = 0, totalErrors = 0;
    for (let i = 0; i < punches.length; i += CHUNK) {
      const chunk  = punches.slice(i, i + CHUNK);
      const result = await apiPost('/api/hr/zkteco/upload', {
        punches:      chunk,
        deviceSerial: info?.serialNumber || ZKTECO_IP,
      });
      totalSaved   += result.saved   || 0;
      totalDups    += result.duplicates || 0;
      totalFlagged += result.flagged || 0;
      totalErrors  += result.errors  || 0;
      log(`  Chunk ${Math.floor(i/CHUNK)+1}: saved=${result.saved} dups=${result.duplicates} flagged=${result.flagged}`);
    }

    log(`Sync complete. saved=${totalSaved} duplicates=${totalDups} flagged=${totalFlagged} errors=${totalErrors}`);
    if (totalFlagged > 0) {
      log(`⚠  ${totalFlagged} punches flagged for review (possible conspiracy burst). Check the ZKTeco panel in the portal.`);
    }

    // Record timestamp of the latest punch we just sent
    const latestTs = punches.reduce((m, p) => new Date(p.punchTime) > m ? new Date(p.punchTime) : m, new Date(0));
    saveLastSync(latestTs);
    log(`Last sync saved: ${latestTs.toISOString()}`);

    await zk.disconnect();
    log('Disconnected from device.');

  } catch (err) {
    log('ERROR:', err.message);
    try { await zk.disconnect(); } catch {}
    throw err;
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (SCHEDULE_MIN > 0) {
  log(`Running in scheduled mode — syncing every ${SCHEDULE_MIN} minute(s).`);
  (async function loop() {
    try { await runSync(); } catch {}
    setTimeout(loop, SCHEDULE_MIN * 60_000);
  })();
} else {
  runSync().catch(err => { log('Fatal:', err.message); process.exit(1); });
}

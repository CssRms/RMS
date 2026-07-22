# Admin User Manual: API Security & Authorization

## Security model overview

The Pro-RMS API enforces three layers of protection on every request:

1. **Authentication** — every protected route requires a valid JWT token issued at login. Requests without a valid token receive `401 Unauthorized`. Tokens carry the user's `id`, `role`, `deptId`, and `tokenVersion` — if the token version is stale (e.g. after a password change), the request is also rejected.
2. **Role authorization** — operations are gated by role (`global_admin` vs `department`) checked via `normalizeRole(req.user.role)`. Admin-only routes return `403` for department users.
3. **Object-level ownership / BOLA protection** — every route that fetches a resource by ID verifies the requesting user has legitimate access to that specific record. This is enforced via:
   - The `canReadRequisition(requisition, user)` helper for all requisition-related routes — it checks department membership, forwarding chain, vetting chain, sub-account privileges, and ICC observer status
   - Direct ownership checks (`notification.userId === userId || notification.departmentId === deptId`) for user-specific records
   - Department self-check (`user.deptId === requestedDeptId`) for department data

## What BOLA is and why it matters

BOLA (Broken Object Level Authorization) is OWASP API Security #1 — the most common real-world API vulnerability. It occurs when an API verifies that a user is logged in but does not verify that the specific record they requested belongs to them or their department.

Example of the vulnerability (before fix):
```
GET /api/attachments/789/download   ← dept A is logged in, attachment 789 belongs to dept B's requisition
Server: ✅ token valid → streams dept B's confidential file  ← WRONG
```

After fix:
```
GET /api/attachments/789/download   ← dept A is logged in
Server: ✅ token valid → canReadRequisition(attachment.requisition, deptA) → ❌ false → 403 Access denied
```

## Routes hardened (July 2026)

| Route | Vulnerability fixed | Fix applied |
|---|---|---|
| `PUT /api/notifications/:id/read` | Any authenticated user could mark any notification as read | Fetch notification first; verify `userId` or `departmentId` matches requesting user before update |
| `GET /api/departments/:id/activation` | Any authenticated user could view any department's head name and email | Department users can only view their own department; admins can view any |
| `GET /api/attachments/:id/download` | Any authenticated user could download attachments from any requisition | Added `canReadRequisition(attachment.requisition, req.user)` check before streaming |
| `GET /api/attachments/:id/preview` | Same as download | Same fix |
| `GET /api/requisitions/:id/signed-pdf` | Any authenticated user could download the signed PDF of any requisition | Added `canReadRequisition(requisition, req.user)` check |
| `GET /api/requisitions/:id/dynamic-pdf` | Any authenticated user could generate the PDF of any requisition | Added `canReadRequisition(requisition, req.user)` check |

## The canReadRequisition helper

`canReadRequisition(requisition, user)` is the central access-control function for all requisition data. A user/department passes if **any** of these are true:

- Role is `global_admin`
- Department is the **creator** (`departmentId`)
- Department is the **target** (`targetDepartmentId`)
- Department is the **current vetting dept**, **final approver**, or **treating dept**
- Department appears anywhere in the **forwarding chain** (ForwardEvent)
- Department participated in **vetting** (VettingEvent)
- Department has been **tagged** on the requisition (RequisitionTag)
- Department is the **ICC** (global observer)
- Sub-account has the appropriate **cash/memo/material privilege** for the target dept

This means the fix for attachments and PDFs does not block legitimate approval-chain access — it only blocks departments with no relationship to the requisition.

---

# Admin User Manual: Mobile Navigation

## Overview
The mobile navigation bar has been updated to reflect the full functional suite available on the desktop sidebar.

## Usage
- **Bottom Navigation**: Use the floating glass bar to switch between main views like Dashboard and Requisitions.
- **Role-Based Menus**:
  - **Departments**: Access "Management" directly from the bar.
  - **Admins**: Access "Control" (System Studio) from the bar.
- **Dashboard Control**:
  - The "Strategic Management" and "Operational Units" overviews are now restricted to Super Admin accounts to simplify the interface for department users.
- **Log Out**: On mobile devices, the Log Out button is located in the top-right corner of the application for quick access.

# Admin User Manual: Database Backups & Disaster Recovery

## Overview

The system's data lives in two places that are NOT under our own control: the database is hosted on Railway, and uploaded files (attachments, signatures, stamps) are hosted on Cloudflare R2. If either Railway or Cloudflare ever had an outage, locked the account, or simply went away, the data behind it could be lost permanently unless an independent copy existed somewhere else.

This system maintains that independent copy automatically. Every day, the entire database is copied out to two completely separate places, neither of which depends on Railway:

1. **Cloudflare R2** (`backups/db/` folder in the same bucket files are already stored in) - a plain, unencrypted snapshot of the database.
2. **The super admin's personal Google Drive** - the same snapshot, but encrypted (AES-256) so that even Google, or anyone who somehow accessed that Drive, would only see unreadable scrambled data. Only someone holding the encryption key can ever read it.

Files (attachments, signatures, stamps) are already stored on Cloudflare R2 rather than on Railway's own disk, so they already survive a Railway outage or redeploy on their own - they are not part of this daily backup job, only the database is.

**Why two separate destinations?** If only R2 held the backup, losing access to Cloudflare would mean losing the backup too - the exact same single-point-of-failure problem we're trying to avoid. By keeping a second, independent copy on a completely different provider (Google), no single company going down, locking an account, or having an outage can take out both copies at once.

## Architecture

```
                     ┌─────────────────────────┐
                     │   Railway Postgres DB   │  ← the live, working database
                     └───────────┬─────────────┘
                                 │  pg_dump (daily, 02:00 UTC,
                                 │  via GitHub Actions - runs on
                                 │  infrastructure independent of
                                 │  Railway, so it still works even
                                 │  if Railway itself is down)
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
   ┌───────────────────────┐       ┌───────────────────────────┐
   │  Cloudflare R2         │       │  Google Drive              │
   │  backups/db/*.dump     │       │  *.dump.enc (AES-256       │
   │  (plain, unencrypted)  │       │  encrypted - unreadable    │
   │  Keeps last 30 days    │       │  without the key)          │
   │                        │       │  Keeps last 30 backups     │
   └───────────────────────┘       └───────────────────────────┘
```

- **`.github/workflows/db-backup.yml`** - the GitHub Actions workflow that runs both backup jobs daily, and can also be triggered manually any time from the **Actions** tab.
- **`scripts/backup-db.js`** - dumps the database and uploads the plain copy to R2.
- **`scripts/backup-db-to-drive.js`** - dumps the database, encrypts it, and uploads the encrypted copy to Google Drive. Talks to Google's APIs directly over plain HTTPS rather than through a heavier client library, because that library's own networking layer turned out to be unreliable inside GitHub's CI containers - this version is the one actually proven to work.
- **`scripts/backup-crypto.js`** - the AES-256-GCM encrypt/decrypt logic shared by the Drive backup and the restore script.
- **`scripts/decrypt-backup.js`** - decrypts a backup downloaded from Drive, for restoring.
- **`scripts/generate-backup-key.js`** / **`scripts/get-google-refresh-token.js`** - one-time setup helpers (see below), not part of the daily run.

Both backup jobs run independently of each other - if one fails, the other still runs and still succeeds.

## How encryption works

The Drive backup is encrypted using **AES-256-GCM** — a modern, authenticated encryption algorithm. The implementation lives in `scripts/backup-crypto.js`.

**Encryption process (what happens every day automatically):**
1. `pg_dump` produces a plain `.dump` file in the GitHub Actions runner's temp directory.
2. A fresh random **12-byte IV (initialisation vector)** is generated — unique per backup run, so the same database content produces different ciphertext every time.
3. The dump is encrypted with AES-256-GCM using the `BACKUP_ENCRYPTION_KEY` and that IV.
4. GCM mode produces a **16-byte authentication tag** alongside the ciphertext — this tag is what makes decryption fail loudly with an error if the file is tampered with or the wrong key is used, rather than silently producing corrupt output.
5. The final `.dump.enc` file layout: `[12-byte IV][16-byte auth tag][ciphertext]` — all three pieces must be present and correct to decrypt.
6. The plain `.dump` file is deleted from temp immediately after encryption. It never leaves the runner unencrypted.

**What the key is:**
- A randomly generated 256-bit value stored as a 64-character hex string.
- It is the **only thing** that can decrypt these backups. There is no password reset, no copy held anywhere else — if it is lost, every Drive backup becomes permanently unreadable.
- It lives in the `BACKUP_ENCRYPTION_KEY` GitHub Actions secret and in your password manager — nowhere else.

**Decryption process (only needed during a restore):**
1. Download the `.dump.enc` file from Drive.
2. Run `node scripts/decrypt-backup.js` with `BACKUP_ENCRYPTION_KEY` set in your shell.
3. The script reads the IV from the first 12 bytes, the auth tag from the next 16 bytes, and the ciphertext from the rest.
4. It verifies the auth tag — wrong key or modified file causes an immediate error (correct behaviour, not a bug).
5. If the key is correct, it writes a plain `.dump` file ready for `pg_restore`.

## One-time setup (only needed once, already done for this project)

A new admin would never normally need to redo this, but here is what's required if the Drive backup ever needs to be reconnected to a different Google account:

1. **Generate an encryption key**, run once on your own computer inside the project folder:
   ```
   node scripts/generate-backup-key.js
   ```
   This prints a random 64-character key. Save it somewhere durable (a password manager) - it is the ONLY thing that can ever decrypt the Drive backups. If it is lost, every encrypted backup becomes permanently unreadable; there is no way to recover it without this key.

2. **Create a Google OAuth client**, in [Google Cloud Console](https://console.cloud.google.com):
   - Create a project (or use an existing one).
   - Enable the **Google Drive API** for it (Settings → APIs & Services → Library).
   - Under APIs & Services → Credentials, create an **OAuth Client ID** of type **Desktop app**. This gives you a Client ID and Client Secret.
   - Under APIs & Services → Google Auth Platform → Audience, add the Google account that should own the backups as a **Test user** (this stays in "Testing" mode rather than going through full Google verification, since this is for one trusted internal account, not the public).

3. **Get a refresh token**, run once on your own computer:
   ```
   $env:GOOGLE_CLIENT_ID="<client id from step 2>"
   $env:GOOGLE_CLIENT_SECRET="<client secret from step 2>"
   node scripts/get-google-refresh-token.js
   ```
   This opens a browser consent screen automatically - sign in with the Google account that should own the backups and approve access. The script then prints a refresh token in the terminal. This token does not expire on its own (only if revoked or unused for a long time), so this is a one-time step.

4. **Add 5 secrets to the GitHub repository** (Settings → Secrets and variables → Actions → New repository secret):

   | Secret | Where it comes from |
   |---|---|
   | `BACKUP_ENCRYPTION_KEY` | Step 1 |
   | `GOOGLE_CLIENT_ID` | Step 2 |
   | `GOOGLE_CLIENT_SECRET` | Step 2 |
   | `GOOGLE_REFRESH_TOKEN` | Step 3 |
   | `GOOGLE_DRIVE_FOLDER_ID` | The ID of the Drive folder where backups should land — get it from the folder's URL (`https://drive.google.com/drive/folders/<ID>`). If left unset, backups go to the root of Drive. |

   The R2 backup job uses the same `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` secrets that already exist for it (same values as the ones already configured on Railway - note: `DATABASE_URL` here must be the *external* `ballast.proxy.rlwy.net` address, not the `postgres.railway.internal` one, since GitHub Actions runs outside Railway's private network entirely).

## Checking that backups are running

Go to the repository's **Actions** tab → **Database Backup**. Each run shows two jobs, `backup-to-r2` and `backup-to-drive` - both should show a green checkmark. You can also click **Run workflow** at any time to trigger an immediate backup rather than waiting for the daily 02:00 UTC schedule.

## Finding a backup in Cloudflare R2

Cloudflare's R2 dashboard works like a simple file browser - this walks through finding a specific day's backup.

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and log in.
2. In the left sidebar, click **R2 Object Storage** (under "Storage" - if you don't see it immediately, it may be under a "More" or "Storage" submenu depending on the current dashboard layout).
3. Click the bucket configured as **`R2_BUCKET_NAME`** in the GitHub secrets - this is the single bucket used for everything: uploaded attachments, signatures, stamps, AND database backups, all organized into different folders inside it.
4. Click into the **`backups`** folder, then the **`db`** folder. You'll see one file per day it ran, named like `css-rms-2026-06-28.dump` - the date in the filename tells you which day's snapshot it is.
5. Click on the specific file you want, then click **Download** (top right, or in the file's detail panel). It downloads as a plain `.dump` file - this one is NOT encrypted, so it's ready to restore directly, no decryption step needed.
6. Only the most recent 30 days are kept - older ones are automatically deleted by the backup job itself to avoid the bucket growing forever. If you need something older than 30 days and it's not there anymore, check Google Drive instead (see below) - it keeps its own separate rolling 30, so the two don't necessarily expire on exactly the same files.

## Finding a backup in Google Drive

1. Go to [drive.google.com](https://drive.google.com) and sign in with the Google account that was used as the backup owner (the one you approved access for during setup).
2. Open the folder configured via `GOOGLE_DRIVE_FOLDER_ID` in GitHub secrets, or look in **My Drive** if no folder was set. Files are named like `css-rms-db-2026-06-28.dump.enc` - the `.enc` at the end means this one IS encrypted, unlike the R2 copy.
3. Google Drive cannot preview or open this file - if you click it, you'll see "No preview available." **This is expected and correct** - it's proof the file is genuinely encrypted gibberish to anyone without the key, not a sign something is broken.
4. Click **Download** (or right-click → Download) to save it to your computer.
5. Same 30-day retention as R2 - older ones get cleaned up automatically by the backup job.

## Restoring from a backup, step by step

There are two stages: **decrypting** (only needed for the Google Drive copy, since the R2 copy was never encrypted in the first place), and **restoring** (turning the dump file back into a live, working database) - which is the same final step either way.

### Stage 1 — Decrypt (Google Drive copy only - skip this entirely if restoring from R2)

On your own computer, open PowerShell and run:

```powershell
cd "C:\Users\USER\Downloads\Pro-RMS"
$env:BACKUP_ENCRYPTION_KEY="<paste the key from wherever you saved it>"
node scripts/decrypt-backup.js "<path to the downloaded .dump.enc file>" restored.dump
```

For example, if you downloaded it to your Downloads folder:

```powershell
node scripts/decrypt-backup.js "C:\Users\USER\Downloads\css-rms-db-2026-06-28.dump.enc" restored.dump
```

If the key you typed is correct, this creates a plain `restored.dump` file in the project folder - that's the real database snapshot, now readable. If the key is wrong, it fails immediately with an error rather than quietly producing a corrupted file - that's the encryption's built-in tamper/error check working as intended, not a bug.

If you downloaded the **R2** copy instead, you already have a plain `.dump` file - there's nothing to decrypt, skip straight to Stage 2.

### Stage 2 — Restore into a real database

This step needs a tool called `pg_restore`, which is part of PostgreSQL's client tools. As of this writing it is **not installed** on the admin's own PC - if this is ever actually needed, either:
- Install PostgreSQL's client tools on the PC doing the restore (just the client component, not a full server install), or
- Run the restore command from any machine that already has it - a temporary cloud shell, a fresh server, anywhere with `pg_restore` available and network access to the target database.

Once `pg_restore` is available, run:

```
pg_restore --clean --no-owner -d <target-database-url> restored.dump
```

Where `<target-database-url>` is the connection string for wherever the database is being rebuilt - this can be:
- A brand-new Postgres database on Railway (if Railway itself is fine, but the data needs rolling back to an earlier point),
- A Postgres database on a completely different host (if leaving Railway entirely, or Railway itself is unavailable),
- Anywhere else Postgres can run.

This is the detail that makes the system genuinely portable, not just "recoverable on Railway": the application code already lives in GitHub, the uploaded files already live in R2, and now the database can be rebuilt from either backup copy onto any new host - nothing permanently ties this system to Railway specifically.

## Full command reference - every script, what it does, and when to use it

All of these are run from PowerShell, inside the project folder (`cd "C:\Users\USER\Downloads\Pro-RMS"` first). None of them need to be run regularly - the daily backup itself is fully automatic via GitHub Actions; everything below is for setup, testing, or an actual recovery.

| Command | What it does | When you'd run it |
|---|---|---|
| `node scripts/generate-backup-key.js` | Prints a brand-new random 256-bit encryption key. | Once, during initial setup. Only run again if you intend to **rotate** the key (see below) - running it does not change anything by itself, it just prints a new value; nothing uses it until you save it as the `BACKUP_ENCRYPTION_KEY` GitHub secret. |
| `$env:GOOGLE_CLIENT_ID="..."` then `$env:GOOGLE_CLIENT_SECRET="..."` then `node scripts/get-google-refresh-token.js` | Opens a Google sign-in screen in your browser, then prints a `GOOGLE_REFRESH_TOKEN` once you approve access. | Once, during initial setup, or if the existing refresh token ever stops working (Google revokes tokens that go unused for a long time, or if access is manually revoked at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)). |
| `node scripts/backup-db.js` | Dumps the live database and uploads the plain copy to R2. This is exactly what the scheduled job runs. | Only to test locally - normally this runs automatically. Needs `DATABASE_URL` and the `R2_*` variables set as env vars first if run by hand. |
| `node scripts/backup-db-to-drive.js` | Dumps the live database, encrypts it, uploads to Google Drive. This is exactly what the scheduled job runs. | Same as above - only for local testing. Needs `DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`, and the `GOOGLE_*` variables set first. |
| `node scripts/decrypt-backup.js <input.dump.enc> <output.dump>` | Decrypts a `.dump.enc` file from Drive back into a plain `.dump` file. | Whenever you need to read or restore a Drive backup. Requires `BACKUP_ENCRYPTION_KEY` to be set first. |
| `node scripts/encrypt-backup.js <input> <output.enc>` | The reverse: encrypts any file with the same scheme. | Rarely needed - mainly if you've manually inspected/edited a restored dump and want to re-encrypt it before storing or moving it elsewhere. The automated job already does its own encryption; you don't need this for the normal daily flow. Requires `BACKUP_ENCRYPTION_KEY` to be set first. |
| `pg_restore -l restored.dump` | Lists the *contents* of a dump file (table names, sizes) **without** actually restoring anything - a safe way to peek inside and confirm it looks like a real, complete backup. | Right after decrypting, as a sanity check, before committing to a full restore. |
| `pg_restore --clean --no-owner -d <target-database-url> restored.dump` | Actually restores the dump into a live, working Postgres database - the real recovery step. | Only when actually recovering from data loss, or deliberately rolling back / migrating to a new host. `--clean` drops existing objects first so the restore isn't blocked by leftover tables; `--no-owner` avoids failing on role/ownership mismatches between the original and target database. |

### Example: the full local round trip, start to finish

```powershell
cd "C:\Users\USER\Downloads\Pro-RMS"

# 1. Set the key (from wherever you saved it - a password manager, not memory)
$env:BACKUP_ENCRYPTION_KEY="<your saved key>"

# 2. Decrypt a file downloaded from Drive
node scripts/decrypt-backup.js "C:\Users\USER\Downloads\css-rms-db-2026-06-28.dump.enc" restored.dump

# 3. Peek inside without restoring anything, as a sanity check
pg_restore -l restored.dump

# 4. Only if you actually need to restore it somewhere:
pg_restore --clean --no-owner -d "postgresql://user:pass@host:port/dbname" restored.dump

# 5. Clean up the plain decrypted file when done - don't leave it lying around
Remove-Item restored.dump
```

## Viewing what's actually inside a backup

A `.dump` file (PostgreSQL's "custom format") is **binary**, not plain text - opening it in Notepad or VS Code shows unreadable characters, that's normal and not a sign of corruption. There are two levels of "viewing":

**Just checking what tables/data exist, without restoring anything:**
```powershell
pg_restore -l restored.dump
```
This prints a table of contents (every table, sequence, and constraint in the dump) instantly, with no database needed at all.

**Actually browsing the real data (rows, values, etc.):** this requires restoring the dump into a real Postgres database first (see Stage 2 above - even a temporary, throwaway one works fine for just looking), then connecting to that database with a proper database browser. Recommended tools, easiest first:

- **Prisma Studio** (already part of this project, zero extra installation): from the project folder, run
  ```powershell
  npx prisma studio --schema=rms_backend/prisma/schema.prisma
  ```
  with `DATABASE_URL` pointed at the restored database. Opens a clean web UI in your browser showing every table with familiar names (Requisition, Department, User, etc.) - this is the easiest option since it already understands this exact project's schema.
- **pgAdmin** (free, official PostgreSQL tool) - a full desktop GUI for browsing/querying any Postgres database, useful if you want to run custom SQL queries against the restored data, not just browse tables.
- **DBeaver** (free, works with many database types) - similar to pgAdmin, a good alternative if you ever need to work with other database types too, not just Postgres.

For routine "did the backup work, does it look complete" checks, `pg_restore -l` is enough and needs nothing extra installed. Reach for Prisma Studio or pgAdmin only when actually investigating specific data after a real restore.

## Rotating credentials - what changes, what breaks

If the encryption key or Google refresh token are ever regenerated (security precaution, suspected compromise, or just routine hygiene), be clear about what happens to old backups:

- **Rotating `BACKUP_ENCRYPTION_KEY`**: every *future* backup will be encrypted with the new key. Every backup already sitting in Drive, encrypted with the *old* key, becomes permanently unreadable unless you **keep the old key archived somewhere** (e.g., labelled "RMS backup key - retired 2026-06-28" in your password manager) alongside the new one. Don't just discard the old key the moment you generate a new one if any old backups are still worth keeping access to.
- **Rotating `GOOGLE_REFRESH_TOKEN`**: this only affects *future* uploads (whether the backup job can still log in to Drive). It has no effect on files already uploaded - those aren't touched, and don't need re-uploading just because the token changed.
- **After rotating either one**, update the corresponding GitHub secret (Settings → Secrets and variables → Actions) immediately - until you do, the scheduled job is still using the *old* value, not the one you just generated. Generating a new key or token locally does nothing on its own; it only takes effect once it's saved as the GitHub secret.
- **A simple way to confirm a rotation actually took effect**: go to Actions → Database Backup → Run workflow manually right after updating the secret, and check that `backup-to-drive` still succeeds.

---

# Admin User Manual: Cloudflare Turnstile (Bot & Human Verification)

## What is Cloudflare Turnstile?

Cloudflare Turnstile is the bot-detection layer on the RMS login page. It silently analyses browser signals — IP reputation, Cloudflare cookies, device fingerprint, and session behaviour — and decides in real time whether the person logging in is human or a bot.

Unlike old-style CAPTCHAs (clicking fire hydrants, reading distorted text), Turnstile is **non-interactive for legitimate users**. A real person using a normal browser on a clean IP will almost always see the widget auto-resolve to a green **"✅ Success!"** checkmark within one to two seconds, with no action required from them. The widget only presents a visible challenge when it is genuinely uncertain — which is rare in practice.

**This is expected, correct behaviour — not a malfunction.** If staff report "the green tick appeared on its own", that is the system working as designed.

| What the user sees | What it means |
|---|---|
| Green checkmark appears automatically | Cloudflare is confident the user is human — no action needed |
| Widget spins briefly then resolves | Turnstile running its silent checks — resolves within a second or two |
| "Verify you are human" prompt appears | Unusual browser or IP signals — user taps/clicks to confirm |
| Widget stays in loading state | Network connectivity issue or misconfigured site key — see troubleshooting below |

## How Turnstile is enforced in RMS

Turnstile is enforced **per department**, not globally. When a department has Turnstile enabled:

1. The login page loads the Cloudflare widget as soon as that department is selected from the dropdown.
2. The widget runs its silent verification and produces a one-time token (valid for ~5 minutes).
3. When the user submits the login form, the server calls Cloudflare's API to verify the token.
4. If verification fails (bot-like signals, token reused, or token missing), the server returns `400 Human verification failed` and the login is blocked.
5. If verification passes, login proceeds normally.

Departments without Turnstile enabled skip all of the above — login works with just the access code and optional MFA PIN.

## Enabling or disabling Turnstile per department (Admin only)

Turnstile is configured from the **Workflow Builder** screen (Admin → System Studio → Workflow Builder).

1. Open the **Cloudflare Turnstile** card. It lists every department in the system with a toggle next to each name.
2. Toggle the departments that should require Turnstile verification at login.
3. Click **Save** at the top-right of the card.
4. Changes take effect immediately — no restart required.

**Recommendation:** Enable Turnstile on departments with access to sensitive financial or approval data (Accounts, Procurement, Management). Low-risk operational departments can be left without it to reduce any friction.

> **Important:** If no departments have Turnstile enabled, the widget never appears on the login page at all — the `VITE_TURNSTILE_SITE_KEY` environment variable is still required for the widget to work when departments are enabled. If you enable a department but the widget does not appear, check that `VITE_TURNSTILE_SITE_KEY` is set in Railway under the production environment variables.

## How the server verifies the token

When a login request arrives at `POST /api/auth/dept-login`, the server:

1. Looks up `turnstile_required_depts` from the `SystemSetting` table.
2. If the requested department is in that list, it calls Cloudflare's Siteverify API (`https://challenges.cloudflare.com/turnstile/v0/siteverify`) with the token from the login request and the server-side `TURNSTILE_SECRET_KEY`.
3. Cloudflare returns `{ success: true/false }`. The server only allows login if `success` is `true`.
4. If the token is missing, expired, reused, or was generated for a different domain, Cloudflare returns `success: false` and the server returns `400 Human verification failed`.

The activation flow (first-time password set) is exempt from this check — the activation endpoint issues the auth cookie directly, so it never calls `dept-login` and Turnstile is not required during activation.

## Required environment variables

| Variable | Where it lives | What it does |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Railway (production env) — frontend build | Public key loaded into the browser widget. Safe to expose — it identifies the site but cannot verify tokens. |
| `TURNSTILE_SECRET_KEY` | Railway (production env) — server | Private key used by the server to verify tokens with Cloudflare's API. Never expose this to the frontend. |

Both keys come from the Cloudflare dashboard: **Turnstile → your site → Site key / Secret key**.

## Cloudflare dashboard setup

The site key must be configured for the exact domain where the login page is served. If the site key was created for `localhost` only, Cloudflare will reject tokens from `cssgrouprms.com` with error **300010 (hostname not allowed)**.

To check or update allowed hostnames:
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Turnstile** in the left sidebar.
3. Click the site name.
4. Under **Allowed hostnames**, confirm `cssgrouprms.com` (and any staging domain) is listed.
5. Save changes — they take effect within a few minutes.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Console error **300010** | Domain not in Cloudflare's allowed hostnames for this site key | Add `cssgrouprms.com` to allowed hostnames in Turnstile dashboard |
| Widget never appears even after enabling a department | `VITE_TURNSTILE_SITE_KEY` not set in Railway, or frontend not rebuilt after adding it | Set the variable in Railway → redeploy the frontend |
| Login returns **400 Human verification failed** | Token expired (>5 min since widget loaded), or user submitted the form before the widget finished | Refresh the page and submit within a few seconds of the green checkmark appearing |
| Widget spins indefinitely | Network cannot reach `challenges.cloudflare.com` (e.g. heavy corporate firewall) | Whitelist Cloudflare Turnstile endpoints, or disable Turnstile for affected departments |
| Staff report they had to "click something" | Normal — rare challenge shown when browser or IP signals are unusual | No action needed; Turnstile showed a challenge as designed |

---

# Admin User Manual: Code Updates — GitHub Push & Merge Guide

## Why this guide exists

Every time a developer (or Claude) makes changes to the system, those changes need to reach two places:

1. **Ephraimraxy/Pro-RMS** — your personal GitHub fork. Railway watches this repo and auto-deploys every push to `main`. This is what your live users see at `cssgrouprms.com`.
2. **CssRms/RMS** — the organisation's official repo. This is the protected "source of truth" copy. Changes reach it through a Pull Request (PR) that must pass automated tests before merging.

The live site is driven by the fork. CssRms/RMS is kept in sync so the codebase is never lost if something happens to the fork.

---

## How the two-repo flow works

```
Developer makes change on local machine
        │
        ├──▶  git push fork main          (Ephraimraxy/Pro-RMS)
        │         └──▶ Railway detects push → auto-deploys to cssgrouprms.com  ✅
        │
        └──▶  git push CssRms dev         (CssRms/RMS — dev branch only)
                  └──▶ You open a Pull Request: dev → main
                            └──▶ GitHub runs CI (Build & Test, ~1–2 min)
                                      └──▶ You click "Merge pull request"  ✅
```

**Key point:** the live site updates immediately when the fork is pushed. The PR to CssRms/RMS is a safety step — you do not need to merge it for the site to work, but you should merge it to keep the org repo in sync.

---

## Step-by-step: how to merge pending changes into CssRms/RMS

Do this whenever you are told "changes have been pushed to the dev branch."

### Step 1 — Go to the compare page

Open your browser and go to:
```
https://github.com/CssRms/RMS/compare
```

You will see a page titled **"Compare changes"** with a list of recent branches at the bottom.

### Step 2 — Select the dev branch

In the example comparisons list at the bottom, click **`dev`**.

The page reloads and now shows:
- **base: main** ← **compare: dev**
- A list of all commits that are in `dev` but not yet in `main`
- A green **"Create pull request"** button in the top-right

### Step 3 — Create the pull request

Click the green **"Create pull request"** button.

A form opens. The title and description are pre-filled. You do not need to change anything. Scroll down and click **"Create pull request"** again (the green button at the bottom of the form).

### Step 4 — Wait for CI to pass

GitHub will run two automated checks (called "Build & Test"). This takes about **1–2 minutes**.

You will see orange spinning circles next to each check. Wait until they turn into **green ticks** ✅.

If a check turns into a red ✗, do not merge — contact your developer to fix the failing test first.

### Step 5 — Merge the pull request

Once both checks are green, a **"Merge pull request"** button appears. Click it, then click **"Confirm merge"**.

The `dev` branch is now merged into `main`. CssRms/RMS is fully up to date.

---

## How to check what is currently deployed vs what is pending

### Check what is live on Railway

1. Go to [railway.app](https://railway.app) and open your **RMS** project.
2. Click the **RMS** service.
3. Under **Deployments**, the top entry shows the latest deploy. Click it to see the commit hash and timestamp.
4. Compare that commit hash to `github.com/Ephraimraxy/Pro-RMS/commits/main` — if they match, everything is live.

### Check if CssRms/RMS is behind

1. Go to `github.com/CssRms/RMS`.
2. Near the top it will say something like **"This branch is N commits behind Ephraimraxy:main"** if it is out of date.
3. If you see that message, follow the merge steps above.

### Check what commits are pending (not yet on main)

Go to:
```
https://github.com/CssRms/RMS/compare/main...dev
```

This shows every commit in `dev` that has not yet been merged to `main`. If the page says "There isn't anything to compare" — you are fully in sync.

---

## Removing the branch protection restriction (optional — for advanced admins)

By default, CssRms/RMS requires a PR + CI check before anything can be merged to `main`. This is intentional to prevent untested code reaching the org repo. However, if you want to allow direct pushes (e.g. to avoid the PR step), you can change this:

1. Go to `github.com/CssRms/RMS/settings/branches`.
2. Under **Branch protection rules**, click **Edit** next to the `main` rule.
3. Uncheck **"Do not allow bypassing the above settings"**.
4. Click **Save changes**.

After this, organisation admins can push directly to `main` without a PR. **Note:** CI will no longer run automatically, so be careful — only do this if you trust every push being made.

---

## Quick-reference cheat sheet

| Task | Where to go |
|---|---|
| See what is live | railway.app → RMS project → Deployments |
| See pending commits (dev vs main) | `github.com/CssRms/RMS/compare/main...dev` |
| Open a PR (dev → main) | `github.com/CssRms/RMS/compare` → click `dev` → Create pull request |
| See all open PRs | `github.com/CssRms/RMS/pulls` |
| See CI results | `github.com/CssRms/RMS/actions` |
| See recent deployments on fork | `github.com/Ephraimraxy/Pro-RMS/commits/main` |
| Turn off branch protection | `github.com/CssRms/RMS/settings/branches` |

---

## What "CI" means and what it checks

CI stands for **Continuous Integration** — automated tests that run on every PR to make sure the code compiles and passes basic checks before it can be merged. For this project, CI runs three things:

1. **Backend syntax check** — confirms `serve.js` has no JavaScript syntax errors.
2. **Backend tests** — runs any test files in `rms_backend/` (currently minimal).
3. **Frontend build** — runs `npm run build` on the React app to confirm it compiles without errors.

If all three pass, the PR can be merged. If any fail, the error must be fixed first. To see what failed, click **"Details"** next to the failing check on the PR page — it opens the full log showing exactly which line caused the problem.

---

# Admin User Manual: ZKTeco Biometric Attendance

## Overview

The RMS portal integrates with ZKTeco fingerprint/face-recognition attendance devices. Every punch a staff member makes on the device is recorded in the portal automatically. No manual entry is needed for days where the device is running.

There are **two ways the device can sync with the portal** — you can use either one, or both at the same time:

| Method | How it works | When to use |
|---|---|---|
| **ADMS / Cloud Push** | The device itself calls the portal URL over the internet every time someone punches | Best option when the device has an internet connection or SIM card |
| **Local Sync Agent** | A script runs on your PC, connects to the device over your office LAN, and uploads all logs to the portal | Use this when the device has no internet access, or as a manual on-demand option |

---

## Navigating the Attendance Tracker

The Attendance Tracker is inside **HR Portal → Attendance Tracker**. It has three tabs:

### Tab 1: Daily Biometric

This is the main daily view. It shows every active employee for a selected date and whether they were present or absent based on biometric punches.

**What you see:**
- A date picker at the top — defaults to today. Use it to view any past date.
- A department filter — select "All Departments" or filter to a specific one.
- A table showing:
  - **Staff ID** and **full name** (First, Last, Other)
  - **Department**
  - **Status** — a green "Present" badge or a red "Absent" badge
  - **Check-In** — time of first punch that day
  - **Check-Out** — time of last punch that day
  - **Hours** — calculated from first to last punch
  - **Punches** — total punch count that day (a staff who punches in and out for lunch will show 4)
  - A yellow "Flagged" badge if the system detected unusual activity (see conspiracy detection below)
- Summary pills at the top showing total Present / Absent / Flagged counts
- **Export CSV** button to download the day's full attendance list

**How to use it:**
1. Open **HR Portal** → **Attendance Tracker**
2. The "Daily Biometric" tab opens by default
3. Change the date if you want a past day
4. Use the department dropdown to narrow by team
5. Click "Refresh" to reload if you expect new punches

**Staff ID must match the device enroll number.** If a staff punches on the device but is not in the portal's Employee Directory (or their Staff ID doesn't match), they will not appear in the daily table. Add them first in the Employee Directory using their exact device enroll number as the Staff ID.

---

### Tab 2: Monthly Calendar

The manual attendance grid — same as the original tracker. Use this for:
- Marking holidays, leave days, or late arrivals that the biometric device cannot capture
- Reviewing a full month at a glance
- Downloading a full monthly CSV

Click any cell to mark it P (Present), L (Late), A (Absent), H (Holiday), or LV (On Leave). Weekend cells are locked automatically.

**Note:** Manual marks on this tab set a "manual override" status. The daily biometric tab shows the biometric data (punch times). Both are stored separately — a manual "H" on a public holiday does not erase the biometric record, it just adds a label HR can see.

---

### Tab 3: ZKTeco / Sync

This is the device control panel. It shows:
- **Last Punch Received** — timestamp of the most recent punch the portal received from any device
- **Today's Punches** — total biometric punches received today
- **Flagged Punches** — punches the system marked as suspicious

It also has the setup guides for both sync methods (see sections below).

---

## Setting Up the Device — Method A: ADMS Cloud Push (Recommended)

This is the easiest option if the ZKTeco device has internet access (via Ethernet cable, Wi-Fi, or a SIM card data plan).

**One-time configuration on the device:**

1. On the ZKTeco device, go to **Comm → Cloud Server** (exact menu name varies by model — may also be labelled "ADMS", "Web Server", or "HTTP Server")
2. Set **Server Address** to: the URL shown in the "ZKTeco / Sync" tab under "Option A — Cloud Push". It looks like:
   ```
   https://your-app.up.railway.app/iclock/cdata
   ```
3. Set **Port** to `443` (for HTTPS) or `80` (for HTTP)
4. Enable **Real-time Upload** (or "Real-time Push")
5. Save and restart the device if prompted

**That is the entire setup.** Once configured, every fingerprint or face scan on the device sends a punch to the portal within seconds. No PC needs to be running. The device works even at night or on weekends.

**The enroll number on the device is the Staff ID.** When enrolling a new staff member's fingerprint, the device asks for an "Enroll Number" or "User ID". Enter the staff member's Staff ID (e.g. `CSS001`) exactly as it appears in the portal's Employee Directory. If they don't match, the punch arrives at the portal but cannot be linked to any employee — it will be stored but won't appear in the daily table.

---

## Setting Up the Sync Agent — Method B: Local Network (from any PC)

Use this if the device has no internet connection, or if you want to do a one-time bulk upload from historical device memory.

**You can run this from any PC that is connected to the same network (office LAN, or your phone's hotspot) as the device.** It connects to the device directly, reads all attendance logs, and uploads them to Railway.

### First time setup

1. Copy the file `zk-sync-agent.js` from the project root to a folder on your PC (e.g. `C:\CSS-Sync\`)
2. In that same folder, create a file named `.env` with the following content:
   ```
   ZKTECO_IP=192.168.1.100
   RAILWAY_API_URL=https://your-app.up.railway.app
   ZKTECO_SYNC_SECRET=your-secret-value
   ```
   - Replace `192.168.1.100` with the actual IP address of your ZKTeco device (find it on the device under Comm → Ethernet or Network Settings)
   - Replace the Railway URL with your actual app URL
   - `ZKTECO_SYNC_SECRET` must match the value of `ZKTECO_SYNC_SECRET` in your Railway environment variables (set it once in Railway, use the same value here)
3. Install Node.js on the PC if not already installed (nodejs.org — free download)
4. Open a terminal (Command Prompt or PowerShell) in that folder and run:
   ```
   npm install node-zklib dotenv
   ```

### Running a sync

**Scenario 1: Run once right now (manual)**
```
node zk-sync-agent.js
```
This connects to the device, reads all records since the last sync, and uploads them. It prints a summary at the end: how many punches were saved, how many were duplicates, and how many were flagged.

**Scenario 2: Auto-sync every 30 minutes (runs in the background)**
```
node zk-sync-agent.js --schedule=30
```
Keep this terminal window open. The agent will sync automatically every 30 minutes. Change `30` to any number of minutes you prefer.

**Scenario 3: Using your phone's hotspot**
If you're not in the office and need to sync from home:
1. Connect the ZKTeco device to your phone hotspot (or bring a laptop that has been connected to the device's LAN before)
2. Confirm the device is reachable from your laptop (try `ping 192.168.x.x` from terminal)
3. Connect your laptop to the same hotspot
4. Run `node zk-sync-agent.js` as normal

**The agent only uploads NEW records each run.** It saves a `.last_sync` file in its folder tracking the timestamp of the last-uploaded punch. The next run only reads records newer than that timestamp, so re-running it repeatedly doesn't cause duplicates.

---

## Duplicate & Conspiracy Detection

The portal automatically protects against two types of false data:

### Duplicate Punches (30-second rule)
If the same staff member punches more than once within 30 seconds (e.g. accidentally taps the device twice), the second punch is marked as a duplicate and **not counted** in the daily attendance record. It is stored in the database but does not change the check-in/check-out time or punch count.

### Conspiracy Detection (burst rule)
If **10 or more different employees** all punch within a 60-second window, the system flags all of those punches as suspicious. This detects the scenario where one person is swiping multiple colleagues' cards or pressing multiple enrolled fingers rapidly. Flagged punches are still saved and the staff are still shown as present — but a yellow "Flagged" badge appears on their row in the daily table, and the count appears in the ZKTeco / Sync tab under "Flagged Punches."

**What to do when punches are flagged:**
1. Go to the "Daily Biometric" tab for that date
2. Look for the yellow "Flagged" badges — hover over them to see the reason
3. Verify with the staff involved whether they actually attended that day
4. If attendance is confirmed, no further action is needed (present = present)
5. If you suspect misconduct, investigate through normal HR channels

---

## Required Railway Environment Variables

Set these once in Railway → your service → Variables:

| Variable | Purpose |
|---|---|
| `ZKTECO_SYNC_SECRET` | Secret token the sync agent must send when uploading. Can be any random string — just keep it secret. Leave blank to disable authentication (not recommended). |

The ADMS device push endpoint (`/iclock/cdata`) does NOT require a secret — ZKTeco devices cannot send custom headers. Keep your Railway URL private to prevent unauthorised punch submissions.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Punches arrive but employee shows "Absent" in daily tab | Staff ID in portal doesn't match device enroll number | Edit the employee in the directory; set Staff ID to the exact number enrolled on the device |
| Sync agent says "Connection refused" or "ECONNREFUSED" | PC and device are not on the same network | Confirm both are on the same Wi-Fi/LAN; try pinging the device IP |
| Sync agent says "API 401" | `ZKTECO_SYNC_SECRET` in `.env` doesn't match Railway | Copy the exact value from Railway env vars into the agent's `.env` |
| Device says "Server Error" after configuring ADMS | URL entered incorrectly on device | Copy the URL exactly from the "ZKTeco / Sync" tab; no trailing slash |
| Daily tab shows 0 employees | No active employees in the Employee Directory | Add employees under HR Portal → Employee Directory |
| Flagged punches every morning | All staff arrive and punch within 60 seconds | Normal for small teams — ignore the flags, or they can stagger arrival by 1–2 minutes |
| "Last Punch Received: Never" in sync tab | No punches have been received yet | Confirm device ADMS config or run the sync agent |

---

# Admin User Manual: ZKTeco Desktop Attendance Monitor (Local Capture App)

## What is the Desktop Monitor?

The ZKTeco Desktop Attendance Monitor is a Windows desktop application that turns any office PC into a local attendance server. Instead of the ZKTeco device pushing punches directly to Railway over the internet, it pushes to the PC on your office LAN — the PC captures every punch locally and lets you review, export, and sync to Railway at any time.

**Use this approach when:**
- The ZKTeco device cannot reach the internet directly (no SIM card, no direct WAN access)
- You want a full offline buffer — attendance is safe on the PC even if Railway is down
- You want a live dashboard on an office screen showing who is present right now
- You want to export Excel reports without logging into the web portal

The app runs silently in the Windows system tray and starts automatically with Windows once configured. No terminal or Python knowledge is needed after first setup.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Windows PC (Windows 10 or 11) | The PC that will act as the local attendance server. Must stay on during attendance hours. |
| Python 3.10 or newer | Download free from [python.org](https://python.org). During install, check **"Add Python to PATH"**. |
| Office network access | The PC and the ZKTeco device must be on the same office LAN (connected to the same router/switch). |
| Administrator rights | Port 80 requires running the app as Administrator. |
| Railway URL | Your live RMS portal URL (e.g. `https://cssgrouprms.com`) — needed only for the Railway sync step. |

---

## Step 1 — Get the App Files

The Desktop Monitor lives inside the main RMS project repository at `desktop/`. You do not need the entire repo if you only want to run the app — copy just this folder.

**Option A — From the repo (if you have the project files):**
1. Navigate to `C:\Users\USER\Downloads\Pro-RMS\desktop\`
2. Copy the entire `desktop\` folder to a permanent location, e.g. `C:\CSS-Attendance\`

**Option B — Fresh install on a new PC:**
1. Download or clone the `CssRms/RMS` GitHub repository
2. Copy the `desktop\` folder to `C:\CSS-Attendance\` (or any permanent folder)

The folder contains:
```
desktop\
  app.py              ← tray application entry point
  server.py           ← Flask attendance server
  database.py         ← SQLite database models
  config_util.py      ← settings/path helpers
  seed.py             ← one-time employee loader (optional)
  requirements.txt    ← Python dependencies list
  build.bat           ← builds a standalone .exe (optional)
  templates\
    dashboard.html    ← live web dashboard
```

---

## Step 2 — Install Python Dependencies

Open **PowerShell as Administrator** (right-click Start → Windows PowerShell (Admin)) and run:

```powershell
cd C:\CSS-Attendance
python -m pip install -r requirements.txt
```

> **Important:** Always use `python -m pip` (not bare `pip`) to avoid issues if multiple Python versions are installed.

This installs Flask, SQLite tools, openpyxl (for Excel export), pystray (tray icon), and all other required packages. Takes about 1–2 minutes the first time.

---

## Step 3 — Register Your Employees

Before attendance can be recorded, the app needs to know which Staff IDs belong to which employees. The Staff ID here **must exactly match the Enroll Number stored on the ZKTeco device** for that person.

**Option A — Use the dashboard (easiest):**
1. Start the app (Step 4 below), open the dashboard
2. Go to the **Employees** section
3. Click **Add Employee** and fill in Staff ID, Name, Department, and Position
4. Repeat for each staff member

**Option B — Bulk load via seed file (faster for many staff):**
1. Open `C:\CSS-Attendance\seed.py` in Notepad or any text editor
2. Edit the `STAFF` list with your real employees:
   ```python
   STAFF = [
       {"staff_id": "CSS001", "name": "John Doe",   "department": "Finance",   "position": "Accountant"},
       {"staff_id": "CSS002", "name": "Jane Smith", "department": "HR",        "position": "HR Manager"},
       # Add as many lines as needed
   ]
   ```
3. Save and run in PowerShell:
   ```powershell
   cd C:\CSS-Attendance
   python seed.py
   ```
   The script skips any Staff IDs already in the database, so it is safe to re-run.

**The golden rule:** the Staff ID in this list must be identical to what is enrolled on the ZKTeco device. If a staff member's device enroll number is `11112222`, their Staff ID here must be `11112222` — not `CSS001` or anything else. Check the device's user list under **Menu → User Management** to confirm the exact enroll numbers.

---

## Step 4 — Configure the ZKTeco Device

The device needs to be told to send attendance to the PC's local IP address instead of (or in addition to) Railway.

**Find your PC's LAN IP address:**
```powershell
ipconfig
```
Look for `IPv4 Address` under your active network adapter. It will look like `192.168.1.45` or `192.168.10.178`. This is the address you will enter on the device.

**On the ZKTeco device:**
1. Go to **Comm → Cloud Server** (may be labelled "ADMS", "Web Server", or "HTTP Server" depending on model)
2. Set **Enable Domain Name** to **OFF** (when off, the separate Port field becomes visible)
3. Set **Server Address** to your PC's LAN IP (e.g. `192.168.1.45`)
4. Set **Server Port** to `80`
5. Set **Proxy Server** to **Disabled**
6. Save and restart the device if prompted

The device will now send a heartbeat `GET` request every 30 seconds, and a punch record immediately after each fingerprint or face scan.

> **Note:** If you later want to switch back to direct Railway cloud push, go back to the device settings, turn **Enable Domain Name ON**, set Server Address to `cssgrouprms.com`, and Port to `443`.

---

## Step 5 — Start the App

Open **PowerShell as Administrator** (right-click Start → Windows PowerShell (Admin)) and run:

```powershell
cd C:\CSS-Attendance
python app.py
```

A green fingerprint icon will appear in the **Windows system tray** (bottom-right corner, near the clock). The dashboard will open automatically in your browser.

If the dashboard does not open automatically, right-click the tray icon and select **Open Dashboard**, or visit `http://localhost` in any browser on the same PC.

---

## Step 6 — Run Diagnostics Before First Use

Before taking attendance, always confirm everything is working. Right-click the tray icon and select **Run Diagnostics**, or click the **Diagnostics** tab in the dashboard.

The diagnostics panel checks:

| Check | What it confirms |
|---|---|
| **Device heartbeat** | Whether the ZKTeco device has contacted the server in the last 2 minutes — confirms the device is alive and pointed at the right IP |
| **Laptop IP** | Shows the current LAN IP so you can confirm it matches what is entered on the device |
| **Employees registered** | Confirms at least one employee exists in the local database |
| **Railway reachability** | Tests whether the PC can reach the Railway URL (needed for later sync) |
| **Excel export library** | Confirms openpyxl is installed so Excel export will work |

All five should show green ticks before you start capturing attendance. If the device heartbeat shows red, double-check the IP address on the device and confirm the PC's firewall allows inbound connections on port 80.

---

## Daily Attendance Workflow

Once the app is running and the device is configured:

1. **The app runs in the background.** No action needed — punches appear in the dashboard automatically as staff scan their fingerprints.
2. **The live dashboard** shows:
   - A **hero tile** with the most recent punch (name, time, photo if available)
   - An **employee status list** — green dot = present today, grey dot = not yet punched
   - A full **attendance log** with timestamps for every punch
3. **To view a specific day**, use the date picker at the top of the attendance log.
4. **No PC restart needed** — the app auto-starts with Windows once you enable it (Step 8).

---

## Exporting to Excel

From the dashboard, click the **Export Excel** button. A date-range picker lets you choose a start and end date. Click **Download** to get a `.xlsx` file with:

- One row per punch record
- Columns: Staff ID, Name, Department, Date, Time, Status, Verified
- A summary sheet showing total Present / Absent per day

This file can be opened directly in Microsoft Excel or uploaded to any HR system that accepts `.xlsx`.

---

## Syncing to Railway

After capturing local attendance, upload it to Railway so the main portal reflects the data.

**Manual sync:**
1. Open the dashboard and click the **Sync to Railway** button
2. The app formats all unsynced records and sends them to Railway's attendance endpoint
3. A progress bar and result summary appear — it shows how many records were uploaded and whether any failed

**What syncs:** only records not yet uploaded (the app tracks a `synced` flag internally). Re-running sync is safe — Railway stores each record by `(staffId, punchTime)` and will not create duplicates.

**After sync**, the punches appear in the RMS portal under HR Portal → Attendance Tracker → Daily Biometric, linked to employees by Staff ID.

**Sync status:** the tray icon tooltip shows the timestamp of the last successful sync. You can also check the Sync tab in the dashboard for a detailed history.

---

## Step 8 — Enable Auto-Start with Windows (Recommended)

So the app runs every time the PC is turned on without any manual steps:

1. Right-click the green tray icon
2. Select **Start with Windows**
3. A tick appears next to the menu item — the setting is saved

This writes a registry entry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. To remove it, right-click and select **Start with Windows** again (the tick disappears).

> The app must always be run as Administrator for port 80. If you use the auto-start registry entry, ensure the shortcut it creates has **"Run as administrator"** enabled, or create the registry entry manually pointing to a shortcut with elevated permissions.

---

## Settings

Right-click the tray icon and select **Settings** to open the settings dialog:

| Setting | Default | Description |
|---|---|---|
| **Port** | `80` | The port the local server listens on. Port 80 requires Administrator rights. Use `8080` if you cannot run as Administrator, then set the device's Server Port to `8080` too. |
| **Railway URL** | `https://cssgrouprms.com` | The Railway deployment to sync punches to. Must be the full URL with no trailing slash. |
| **Auto-open dashboard** | On | Whether the browser opens automatically when the app starts. Turn off for headless/background operation. |

Settings are saved immediately to `%APPDATA%\ZKTecoAttendance\settings.json`.

---

## Building a Standalone .exe (Optional)

If you want to distribute the app to other PCs without requiring Python to be installed, you can build a single-file Windows executable:

1. Make sure `requirements.txt` is installed (Step 2)
2. Double-click `build.bat` inside the `desktop\` folder (or run it from PowerShell)
3. Wait about 2–3 minutes — PyInstaller packages everything
4. The output file appears at `desktop\dist\ZKAttendance.exe`

Copy `ZKAttendance.exe` to any Windows PC. Double-click to run — no Python, no pip, no dependencies needed on the target machine.

> The first run on a new PC may be slower (Windows Defender scanning the new executable). Subsequent runs are instant.

---

## Where Data is Stored

| Location | What's there |
|---|---|
| `%APPDATA%\ZKTecoAttendance\attendance.db` | SQLite database — all employees and punch records |
| `%APPDATA%\ZKTecoAttendance\settings.json` | Port, Railway URL, and other settings |

`%APPDATA%` expands to `C:\Users\<YourName>\AppData\Roaming\` on most Windows installs.

**Backup:** copy `attendance.db` to a safe location regularly. The file is a standard SQLite database and can be opened with any SQLite viewer (e.g. DB Browser for SQLite, free download).

---

## Updating the App

When a new version is released:

1. Pull the latest changes from GitHub (`git pull` in the project folder, or re-download the `desktop\` folder)
2. Re-run `python -m pip install -r requirements.txt` in case any Python package versions changed
3. Restart the app (`python app.py`)

If you built a `.exe`, run `build.bat` again to rebuild it with the updated code.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `python app.py` fails: "Access is denied" / port 80 blocked | Not running as Administrator | Right-click PowerShell → Run as administrator, then re-run |
| Tray icon appears but dashboard shows "connection refused" | App is still starting (takes ~2 seconds) | Wait 3 seconds and refresh the browser |
| Device heartbeat shows red in diagnostics | Device not reaching the PC | Confirm the IP on the device matches `ipconfig` output; check Windows Firewall allows port 80 inbound |
| `ModuleNotFoundError: No module named 'pystray'` | Dependencies not installed, or installed in the wrong Python | Run `python -m pip install -r requirements.txt` (note: `python -m pip`, not bare `pip`) |
| Punches arrive but no employee name shows | Staff ID on device does not match local database | Check device enroll number in device's User Management; update the employee's Staff ID in the dashboard to match |
| Sync fails with 401 error | Railway URL incorrect, or Railway service is down | Confirm Railway URL in Settings; check `cssgrouprms.com` is reachable in a browser |
| Excel export button does nothing / error | openpyxl not installed | Run `python -m pip install openpyxl` |
| `pip install` fails with "Fatal error in launcher" | Multiple Python installations conflict | Always use `python -m pip install` instead of bare `pip install` |

---

## FAQ

**Q: Does the PC need to stay on all day?**
Yes — the app must be running to receive punches from the device in real time. If the PC is shut down while staff are still clocking in, those punches will be buffered on the device and will only appear in the local database after the PC comes back on and the device reconnects. (ZKTeco devices buffer unsent records internally and re-send them automatically.)

**Q: Can two PCs run the app at the same time?**
No — the ZKTeco device can only push to one ADMS server address at a time. Designate one PC as the attendance server.

**Q: What happens if Railway is down during a sync?**
The sync will fail and show an error. Punches stay in the local database with `synced = 0`. Run sync again when Railway is back — it will upload exactly the records that were not sent before.

**Q: How do I add a new employee after the device is already running?**
Add them in the dashboard (or run `seed.py` again with the new entry). On the ZKTeco device, enroll their fingerprint under **Menu → User Management → New User**, and enter the exact same Staff ID as their device Enroll Number. No restart of the local app is needed.

**Q: The device shows the correct IP but still doesn't connect. What else can I check?**
1. On the PC, open Windows Defender Firewall → Advanced Settings → Inbound Rules → confirm there is a rule allowing TCP on port 80 (or create one: New Rule → Port → TCP → 80 → Allow)
2. Confirm the PC and device are on the same subnet (first three numbers of their IPs should match, e.g. both `192.168.1.x`)
3. Try pinging the device from the PC: `ping 192.168.1.100` (replace with the device IP) — if it times out, there is a network-layer issue between the two devices

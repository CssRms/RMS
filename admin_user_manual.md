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

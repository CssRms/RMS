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
   | `GOOGLE_DRIVE_FOLDER_ID` | optional - leave unset to store backups in the root of Drive |

   The R2 backup job uses the same `DATABASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` secrets that already exist for it (same values as the ones already configured on Railway - note: `DATABASE_URL` here must be the *external* `ballast.proxy.rlwy.net` address, not the `postgres.railway.internal` one, since GitHub Actions runs outside Railway's private network entirely).

## Checking that backups are running

Go to the repository's **Actions** tab → **Database Backup**. Each run shows two jobs, `backup-to-r2` and `backup-to-drive` - both should show a green checkmark. You can also click **Run workflow** at any time to trigger an immediate backup rather than waiting for the daily 02:00 UTC schedule.

## Restoring from a backup

**From R2** (plain dump):
1. Download the relevant `.dump` file from the `backups/db/` folder in the R2 bucket.
2. Run: `pg_restore --clean --no-owner -d <target-database-url> <downloaded-file>.dump`

**From Google Drive** (encrypted dump):
1. Download the relevant `.dump.enc` file from Drive.
2. Decrypt it first: `BACKUP_ENCRYPTION_KEY=<the saved key> node scripts/decrypt-backup.js <downloaded-file>.dump.enc <output-file>.dump`
3. Then restore exactly as above: `pg_restore --clean --no-owner -d <target-database-url> <output-file>.dump`

`<target-database-url>` can be any fresh Postgres instance - on Railway, on a different host entirely, anywhere. This is what makes the system genuinely portable rather than only "recoverable on Railway": the code already lives in GitHub, the files already live in R2, and now the database can be rebuilt from either backup on any new host, with nothing tying the system permanently to Railway.

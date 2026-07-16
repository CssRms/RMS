# CSS RMS — Architecture & Operations Guide

> **Who this is for:** anyone touching this codebase for the first time — a new developer with no memory of past sessions, or the project owner coming back after months away. Assume zero prior context.
>
> **How this file stays useful:** this file is maintained by hand as part of normal development — there is no automated process that rewrites it from code changes. The in-app Documentation page always renders whatever is *currently* in this file (read live from disk, no caching), so once this file is updated and deployed, the change shows up immediately with no extra step. If you make a structural change and don't see it reflected here, it means the person/assistant who made the change forgot to update this file — treat that as a bug in the change, not in the page.

---

## 1. What this system is

**CSS RMS** ("Requisition Management System") is the internal operations portal for CSS Group. It runs:
- **Requisitions** — Cash and Material spending requests that move through a multi-department approval/vetting chain before money or materials are released.
- **Memos** — Internal documents routed between departments, separate from the spending workflow.
- **Document Studio** — An in-browser Word/Excel/PowerPoint-equivalent for drafting memos and requisition content, with offline autosave and export to real Office file formats.
- **HR Portal** — Employee directory, leave, attendance, payroll, recruitment (a largely separate module under the same login).
- **Departments & Sub-Accounts** — Every login is a "Department" record (including the Super Admin, which is itself a Department row named "Super Admin" — see §6 gotcha). Departments can spawn Sub-Accounts (delegated sub-units with restricted privileges).
- **ICC (Internal Control & Compliance) Oversight** — A department with special global-observer powers that can freeze/vet any requisition regardless of normal routing.
- **Audit Override / Re-approval Escalation** — Audit or ICC can revise a requisition's price before approval; if the revision pushes the amount above the original approver's authority, the system force-routes it to a higher authority tier automatically.

---

## 2. Tech stack

### Backend
| Piece | What | Why it matters |
|---|---|---|
| Runtime | Node.js ≥ 20 | — |
| Framework | Express 5 | Single server, all routes in one file (`serve.js`) |
| Database | PostgreSQL | Hosted on Railway |
| ORM | Prisma 6 | Schema at `rms_backend/prisma/schema.prisma` |
| Auth | `jsonwebtoken` + `bcryptjs` | JWT in an httpOnly cookie (`cookie-parser`) |
| File storage | AWS S3 (`@aws-sdk/client-s3`) | Attachments, signatures |
| PDF generation | `pdf-lib` | Requisition/memo print records, generated server-side |
| Email | `nodemailer` | Notifications |
| SMS | Termii or Twilio (switchable in System Settings) | Activation codes, notifications |
| AI | OpenAI (`openai`) | Draft refinement, grammar/metadata extraction |
| Security | `helmet`, `express-rate-limit`, `xss`, `zod` (validation) | — |
| Logging | `pino` / `pino-http` | — |
| Hosting | Railway | `css-rms.up.railway.app` |

### Frontend
| Piece | What | Why it matters |
|---|---|---|
| Framework | React 19 + Vite | `rms_frontend/` |
| Styling | Tailwind CSS | Utility classes everywhere, no CSS-in-JS |
| Routing | Custom — `window.location.hash` + a `views` object map in `App.jsx` | Not React Router. See §6 gotcha. |
| Word editor | **TipTap** (ProseMirror-based) | Migrated from raw `contentEditable` + `execCommand` — see §7 |
| Spreadsheet editor | **`@fortune-sheet/react`** | A full Excel-clone engine — ships its **own** complete toolbar (formulas, conditional formatting, sort/filter, etc.) out of the box. Don't rebuild what it already has. |
| Presentation editor | **Quill** | Rich-text only — no shapes/canvas/object model. Don't expect PowerPoint-style Drawing/Arrange features without a full engine swap (Fabric.js/Konva). |
| Office exports | `xlsx` (SheetJS), `pptxgenjs`, `jspdf` + `html2canvas`, `file-saver` | Real `.doc`/`.xlsx`/`.csv`/`.pptx`/`.pdf` downloads |
| Offline storage | `localforage` (IndexedDB) | Document Studio drafts persist offline |
| Markdown rendering | `react-markdown` | Used by the in-app Documentation page (this file) |
| Notifications | `react-hot-toast` | — |
| Icons | `lucide-react` | — |
| PWA | `vite-plugin-pwa` | Service worker, installable |

### Deployment
- **Railway**, single service running `npm start` from the repo root, which now runs `prisma migrate deploy && node serve.js` (see §5 — this changed recently).
- The frontend is built (`vite build`) into `rms_frontend/dist` and served as static files by the same Express server in production.
- No CI pipeline exists yet. No staging environment exists yet. Pushing to `main` is effectively "deploy" once Railway picks up the change.

---

## 3. Project structure

```
Pro-RMS/
├── serve.js                     ← THE backend. ~9,000 lines, every API route lives here.
├── package.json                 ← root scripts: build / start / seed / deploy-sync
├── .env                         ← secrets (DATABASE_URL, JWT secret, API keys) — gitignored, never commit
├── .env.example                 ← template showing what .env needs
├── ARCHITECTURE.md              ← this file
│
├── rms_backend/
│   └── prisma/
│       ├── schema.prisma        ← THE database schema, source of truth for structure
│       ├── seed.js               ← initial data seeding script
│       └── migrations/           ← versioned migration history (see §5) — DO commit this folder
│
└── rms_frontend/
    ├── src/
    │   ├── App.jsx               ← top-level router: hash-based view switching, role gating
    │   ├── index.css             ← global styles, Tailwind base + custom overrides
    │   ├── components/           ← ~33 components, one file per page/major feature (flat, no subfolders)
    │   │   ├── Layout.jsx         ← sidebar nav, top bar, mobile bottom nav — ~1,900+ lines
    │   │   ├── Dashboard.jsx      ← "Oversight Command" home screen
    │   │   ├── RequisitionsPage.jsx  ← the requisition list + detail modal — ~5,600 lines, the biggest single feature file
    │   │   ├── DocumentStudio.jsx ← Document Studio orchestrator only (drafts, tab switching) — ~390 lines
    │   │   ├── documentStudio/    ← the three editors, each lazy-loaded as its own bundle chunk (shared.jsx, RichTextEditor.jsx [TipTap], SpreadsheetEditor.jsx [Fortune-sheet], PresentationEditor.jsx [Quill+pptxgenjs], SendToWorkflowModal.jsx)
    │   │   ├── DepartmentManager.jsx, SubAccountsPanel.jsx, WorkflowBuilder.jsx, AuditLogs.jsx, IccOversightPage.jsx, ...
    │   │   └── (HR module) HRDashboard.jsx, EmployeeDirectory.jsx, LeaveManagement.jsx, AttendanceTracker.jsx, PayrollOverview.jsx, RecruitmentPipeline.jsx
    │   ├── lib/
    │   │   ├── store.jsx          ← frontend data layer: wraps API calls, caches to localforage, normalizes records
    │   │   ├── api.js             ← raw fetch wrappers per API resource
    │   │   ├── templates.js       ← Document Studio's Memo/Material Request templates
    │   │   ├── tiptapFindReplace.js ← custom TipTap extension (Find & Replace, built on ProseMirror decorations)
    │   │   └── featureFlag.js     ← cached feature-flag loader (fails to last-known-good, not fail-open)
    │   └── context/               ← React context providers (AI features toggle, etc.)
    └── public/                    ← static assets (logo, manifest, etc.)
```

**Where to look for X:**
- A bug in how a requisition is displayed/listed → `RequisitionsPage.jsx` first, but check `Dashboard.jsx` too — **the same display logic is currently duplicated across both files**, not shared (see §8).
- A bug in an API response → `serve.js`, search for the route path string.
- A bug in the Word/Excel/PowerPoint editors → `DocumentStudio.jsx`. Word = `RichTextEditor` (TipTap), Excel = `SpreadsheetEditor` (Fortune-sheet), PowerPoint = `PresentationEditor` (Quill) — all three are components inside this one file.
- A database field that doesn't seem to exist → check `schema.prisma` first, then check if the API route actually `select`s it (a recurring bug class this project has had: a field exists in the schema but a specific endpoint's Prisma `select` clause forgot to include it, so the frontend silently receives `undefined` for it).

---

## 4. The core domain model (how a Requisition actually moves)

A `Requisition` is Cash, Material, or (for the Memo subtype) just a routed document. Key fields and what they mean:

| Field | Meaning |
|---|---|
| `status` | Coarse lifecycle: `draft`, `pending`, `approved`, `rejected` |
| `finalApprovalStatus` | Fine-grained stage: `none` → `vetting` → `approved` → `treated`/`published` (or `rejected` at any point) |
| `targetDepartmentId` | Where the request was last **forwarded** through the normal approval chain |
| `currentVettingDeptId` | Where the request **actually is right now** if it's gone through an ICC/Audit vetting detour. **This is different from `targetDepartmentId` and the two can disagree** — see the gotcha in §6. |
| `hasAuditOverride` / `auditAmount` | Audit revised the amount pre-approval |
| `hasIccOverride` / `iccOverrideAmount` | ICC revised the amount post-approval — **takes priority over Audit's figure when both exist**. On the **frontend**, this precedence is centralized in `rms_frontend/src/lib/requisitionDisplay.js`'s `getEffectiveAmount(req)` — every component that needs to show "what's the real amount" should call this, not re-derive it. On the **backend**, the equivalent logic still lives inline in the PDF generator in `serve.js` (not yet unified with the frontend helper — different runtime, can't literally share the JS module, but the *rule* must stay in sync if it ever changes). |
| `needsReapproval` / `reapprovalAuthority` | Set when a price revision pushes the amount above the original approver's authority tier — blocks treatment until a higher authority confirms |
| `treatedByDeptId` / `treatedAt` | Final disbursement/fulfillment recorded |

**The vetting detour, explained simply:** normally a requisition flows Creator → Department A → Department B → ... → Final Approver → Treated. ICC (and Audit, for price checks) can intercept this at any point and pull the request into a side-loop for verification. While it's in that loop, `currentVettingDeptId` tracks its real location, but `targetDepartmentId` stays frozen at whatever it was before the detour started. **Any UI that shows "where is this request right now" must check `currentVettingDeptId` first and only fall back to `targetDepartmentId` if the request isn't currently in a vetting detour and hasn't been treated/published.** This exact bug (showing the frozen `targetDepartmentId` instead of the live location) was found and fixed independently in three different places before being unified — see `getLiveTrailDepartment(req, departments)` in `rms_frontend/src/lib/requisitionDisplay.js`, which is now the single source of truth for this on the frontend.

---

## 5. Database changes — the migration workflow (read this before touching `schema.prisma`)

**This changed recently.** It used to be: edit `schema.prisma`, deploy, and `prisma db push --accept-data-loss` would silently force the live database to match — no history, no warnings, just "make it so." That's gone.

**Current process — every single time you change `schema.prisma`:**

1. Make sure `.env` at the repo root has a working `DATABASE_URL` pointing at the **real** database (get it from Railway → Postgres service → Variables tab). Never commit this file — it's gitignored.
2. Edit `schema.prisma`.
3. Run, from the repo root:
   ```
   npx prisma migrate dev --schema=rms_backend/prisma/schema.prisma --name describe_your_change
   ```
   This connects to the real database, diffs it against your schema change, generates a new timestamped folder under `rms_backend/prisma/migrations/`, and applies it immediately to the database you're connected to.
4. Commit the new migration folder along with your `schema.prisma` change — **in the same commit**. A schema change without its migration file is a broken commit.
5. Deploy normally (push to `main`). Railway will run `prisma migrate deploy` (via the `start` script) which applies only the new migration(s) — it never tries to guess or force anything.

**If `migrate dev` ever reports unexpected drift** (says there are changes you didn't make), stop and figure out why before proceeding — it usually means someone changed the live database directly (e.g. via a SQL console) without going through this process. Don't blindly accept whatever Prisma proposes in that situation.

**The migration logbook:** every applied migration is recorded by Prisma itself in a special table (`_prisma_migrations`) inside the database. The in-app admin Documentation page's "Migration Logbook" tab reads this table directly and shows it read-only — that part of the page is **fully automatic**, no maintenance needed, it always reflects database reality.

---

## 6. Structural gotchas — things that look like bugs but are deliberate, and things that actually are landmines

These are the ones worth knowing before you go looking for a "bug" that's actually expected behavior, or before you accidentally trip a real landmine:

1. **Super Admin is a Department row.** The Super Admin login is backed by a real `Department` named "Super Admin." Any logic that gates on `!userDeptId` to mean "this is the admin" is wrong — admin has a `deptId` like everyone else. Gate on `role === 'global_admin'` instead.
2. **Departments are partly identified by name-pattern regex, not a type field.** HR, Store, and ICC departments are detected in places via `/\bhr\b/i.test(name)`-style regex against the department's *name string*, not a dedicated `departmentType` column. Renaming "HR" department to something without "hr" in it would silently break HR-specific access logic. This is fragile by design — be careful renaming departments in production.
3. **`targetDepartmentId` ≠ "where the request is now."** Covered in §4. Always prefer `currentVettingDeptId` when a vetting detour is active.
4. **ICC's override beats Audit's override, not the reverse.** If both `hasAuditOverride` and `hasIccOverride` are set, the effective amount is ICC's, because ICC acts later (post-approval) in the real-world process.
5. **Routing uses `window.location.hash` + a hand-rolled view map, not React Router.** `App.jsx`'s `VALID_VIEWS` array and `views` object are the entire router. Adding a new top-level page means adding it to both, plus a nav entry in `Layout.jsx`, plus (if admin-only) adding it to the `isAdminView` check.
6. **Tailwind's preflight CSS sets `img { display: block }` globally.** A parent's `text-align: center` does nothing for an `<img>` because of this — center images with `display:block; margin:0 auto` directly on the `<img>` itself, not via a wrapping container's `text-align`.
7. **A lingering CSS `transform` on any ancestor traps `position: fixed` descendants inside it instead of the real viewport.** This has bitten multiple modals (Edit Department, Document Studio's template-replace confirmation). The fix pattern: either don't use `animation-fill-mode: forwards` on ancestor animations, or render the modal through a React portal to `document.body` (the more bulletproof fix — see `ConfirmModal.jsx`).
8. **TipTap's Table extension takes over *any* `<table>` tag** in HTML you feed it via `setContent`/paste — it coerces it into its own structured table-node schema, which only preserves `colspan`/`rowspan`/`colwidth` on cells and **silently strips other inline styles** (custom borders, text-align, widths). If you need a `<table>`-looking layout that *isn't* meant to be a real editable data grid (e.g. a letterhead's field rows), build it with flex/grid `<div>`s instead — see `lib/templates.js`.
9. **TipTap v3's `setContent(content, options)` takes an options *object* as the second argument, not a boolean.** `setContent(html, false)` does not do what it looks like it does (it gets destructured against a non-object and silently falls back to defaults). Use `setContent(html, { emitUpdate: false })`.
10. **`prisma db push` is gone — see §5.** If you're reading old conversation history or old docs that mention it, that information is stale.
11. **TipTap's Image node only preserves `src`/`alt`/`title`/`width`/`height` — not arbitrary inline `style`.** Same lesson as #8 but for images: any unrecognized HTML tag (no registered extension) gets silently dropped entirely during `setContent` parsing, and even recognized nodes only keep the attributes their extension explicitly tracks. Center/size images via real HTML attributes + global CSS (`.editor-paper img { ... }`), not inline `style`.
12. **`authenticateToken` does a DB lookup for every department-role request, not just admin/User-table logins.** This is deliberate: `Department.tokenVersion` is embedded in every department/sub-account JWT at sign time and checked against the live DB value on each request, so a Security Reset (Department Manager → the rose KeyRound icon) can force-log-out every device that department is signed into instantly, without tracking individual tokens. The check fails *open* on a transient DB error (a connectivity blip shouldn't lock out every department session at once) — this is defense-in-depth layered on top of the JWT signature check, not a replacement for it. If you add a new way to issue a department JWT, you must include `tokenVersion: dept.tokenVersion || 0` in its payload, or that login path will silently bypass force-logout (the comparison falls back to `0` and never matches a department that's ever been reset).

---

## 7. Notable past architectural decisions (so you don't re-litigate or accidentally undo them)

- **Document Studio's Word editor was migrated from raw `contentEditable` + `document.execCommand` to TipTap.** This was deliberate: `execCommand` is deprecated, can't reliably reflect active formatting state at the cursor, and made building real Find & Replace / Clear Formatting impractical. Don't migrate it back.
- **The Spreadsheet and Presentation editors were deliberately left on their existing engines** (Fortune-sheet, Quill) rather than also being rewritten, because Fortune-sheet already ships a complete Excel-equivalent toolbar natively, and a true PowerPoint-style rebuild of the Presentation editor (shapes, canvas, Arrange, Design themes, Animations) would require swapping Quill for a canvas engine entirely — a much bigger, separately-scoped project that hasn't been started.
- **Offline drafts use `localforage`, not direct server saves**, so Document Studio works without a network connection; autosave persists to IndexedDB and only reaches the server when the user explicitly sends it into the workflow.
- **Feature flags fail to "last known good value" (cached), not fail-open to `true`.** A network blip must never silently re-expose a Super-Admin-disabled feature.

---

## 8. Known weak spots (be honest with yourself about these before assuming the code is correct)

- **An automated test suite exists, but only covers a thin slice so far.** Vitest is set up in both the root (backend) and `rms_frontend/` (frontend) — run `npm test` in either directory. Currently covered: the pure business-rule functions in `rms_backend/lib/businessRules.js` (authority-tier bands, override precedence — 20 tests) and `rms_frontend/src/lib/requisitionDisplay.js` (effective amount, live trail location — 15 tests). **Not yet covered:** anything touching the database (no integration tests exist yet), the vetting/approval state machine end-to-end, any React component rendering, and the vast majority of `serve.js`'s ~9,000 lines (most of it is still inline route handlers, not extracted into testable pure functions). Before this, every fix in this project's history was verified by `node --check` (syntax only), `npm run build` (compiles), and then the user manually finding the next bug in production — that's still true for anything outside the two files above. Treat anything not covered by an actual test as unverified, no matter how confident a past commit message sounds. **When you extract more business logic out of `serve.js` or a frontend component, write its test in the same commit** — that's how this slice grows instead of staying frozen at "the two files someone happened to touch on one particular day."
- **Business display logic was duplicated, not shared — now fixed.** "What's the effective amount for this requisition," "where is this requisition right now," and the per-record field-flattening helper (`normalizeReq`) used to be implemented independently across `RequisitionsPage.jsx` (list table + detail modal) and `Dashboard.jsx` (two places) — five separate copies of three rules, each needing its own bugfix, and `normalizeReq`'s two copies had already drifted apart (one had four extra fields the other lacked). All three are now unified into `rms_frontend/src/lib/requisitionDisplay.js` (`getEffectiveAmount`, `getLiveTrailDepartment`, `normalizeReq`) and every call site imports from there instead of re-deriving it. **General rule going forward:** when you fix a display bug involving these two files, grep for the same pattern in the other before assuming you're done — and check `requisitionDisplay.js` first, since the answer to "how do I compute X" may already live there.
- **`serve.js` (~9,000 lines) and `RequisitionsPage.jsx` (~5,600 lines) are both still monolithic files.** No service/repository layering on the backend; routes call Prisma directly. `DocumentStudio.jsx` was split this way (see §3, `documentStudio/`) as a proof of pattern, but `serve.js` and `RequisitionsPage.jsx` have NOT been — they're larger and riskier to split safely without more test coverage than currently exists. Be cautious about large refactors here until the test suite covers more of their behavior.
- **CI pipeline exists** (`.github/workflows/ci.yml`) — runs backend syntax check + both test suites + a full frontend build on every push/PR to `main`. **No staging environment yet**, and this repo currently pushes straight to `main` with no PR/review step, so CI runs as a notification (red X if something breaks) rather than a hard gate — branch protection + a PR-based workflow would be needed to make it an actual gate.
- **The `DocumentStudio` bundle was split** (see §3) — `RichTextEditor`/`SpreadsheetEditor`/`PresentationEditor` now lazy-load as separate chunks instead of one ~3.8MB bundle for all three. Opening Word or PowerPoint now downloads ~520KB instead of 3.8MB; Excel still pulls Fortune-sheet's own ~2.7MB bundle on its own merits (that engine is genuinely large), but no longer drags the other two along with it. Other large chunks (`RequisitionsPage`, `WorkflowBuilder`, etc.) have not been similarly split yet.

---

## 9. Backup & disaster recovery

The database and uploaded files live on Railway and Cloudflare respectively — neither is under this project's own control. If either had an outage, locked the account, or simply disappeared, anything that only lived there would be gone. Files are already safe from this (they're on Cloudflare R2, not Railway's disk — see §2/§3), but the database had no independent copy anywhere until this was added.

**Two independent, automated daily backups**, neither depending on the other or on Railway:

1. **Cloudflare R2** (`backups/db/` in the same bucket files already use) — a plain `pg_dump` snapshot.
2. **The super admin's personal Google Drive** — the same snapshot, but AES-256 encrypted first, so it's unreadable to anyone (including Google) without the encryption key.

Both run via `.github/workflows/db-backup.yml`, daily at 02:00 UTC, on GitHub's own infrastructure — deliberately independent of Railway, so the backup still runs even if Railway itself is the thing that's down. Either destination alone is enough to fully reconstruct the database from scratch on any fresh Postgres instance, anywhere — that's what makes this a real disaster-recovery story rather than just "Railway has its own snapshot feature."

- `scripts/backup-db.js` — dumps + uploads the plain copy to R2.
- `scripts/backup-db-to-drive.js` — dumps, encrypts (`scripts/backup-crypto.js`, AES-256-GCM), uploads to Drive. Talks to Google's REST APIs directly over plain `https` rather than through the `googleapis` package's own request layer — that layer's internal use of Node's built-in `fetch` produced a reproducible `Premature close` error on two different Google endpoints when run inside GitHub Actions' containers (not transient flakiness — it failed identically every time on the affected endpoint). Confirmed fix: bypass that transport entirely.
- `scripts/decrypt-backup.js`, `scripts/encrypt-backup.js`, `scripts/generate-backup-key.js`, `scripts/get-google-refresh-token.js` — restore and one-time setup helpers, not part of the daily run.

**Full setup instructions, the architecture diagram, and exact restore commands for both destinations are in `admin_user_manual.md`** (the "Database Backups & Disaster Recovery" section) — written for a new admin with zero prior context.

One gotcha if this is ever touched again: GitHub Actions runs *outside* Railway's private network, so its `DATABASE_URL` secret must be the external `ballast.proxy.rlwy.net` proxy address — `postgres.railway.internal` only resolves from inside Railway's own network and will silently fail to connect from anywhere else (including GitHub Actions or a local machine).

---

## 10. Quick reference — common commands

```bash
# Install everything (run from repo root)
npm run build              # generates Prisma client + installs/builds frontend

# Run the backend locally (needs .env with a real DATABASE_URL)
node serve.js

# Run the frontend dev server (separate terminal, from rms_frontend/)
npm run dev

# Apply a schema change safely (see §5 for the full procedure)
npx prisma migrate dev --schema=rms_backend/prisma/schema.prisma --name your_change_name

# Check what migrations exist / are pending
npx prisma migrate status --schema=rms_backend/prisma/schema.prisma

# Seed initial data
npm run seed

# Run backend tests (root) — pure business-rule functions, no DB needed
npm test

# Run frontend tests (from rms_frontend/) — shared display logic, no DB needed
npm test
```

---

## 11. Cloudflare R2 + Railway Setup Guide

> **cssgrouprms.com | RMS Project | Storage & Custom Domain Configuration**

### Part 1 — Cloudflare R2 Storage Setup

**Goal:** obtain five environment variables (`R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_SECRET_ACCESS_KEY`) and add them to Railway.

#### Step 1 — Create the R2 bucket

Cloudflare Dashboard → R2 Object Storage → Create bucket. Bucket created and named **cssrms**. This name is used directly as `R2_BUCKET_NAME`.

#### Step 2 — Get the Account ID

On the R2 Overview page, the Account Details panel (bottom right) shows the Account ID with a copy icon. This value is `R2_ACCOUNT_ID`.

#### Step 3 — Create an Account API Token

R2 → Manage API Tokens → **Account API Tokens** section (chosen over "User API Tokens" because account-level tokens stay active even if a team member leaves the organisation — better suited for production).

- Clicked **Create Account API Token**
- Token name: `railway-cssrms-access`
- Permissions: **Object Read & Write**
- Specify bucket(s): Apply to specific buckets only → selected **cssrms**
- TTL: **Forever**
- Client IP filtering: left blank
- Clicked **Create API Token**

Cloudflare displayed the following values **one time only** (copied immediately):

| Variable | Source |
|---|---|
| `R2_ACCESS_KEY_ID` | Access Key ID shown after token creation |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key shown after token creation |

#### Step 4 — Note (not used): the S3 API endpoint

Found under the bucket's General settings tab:

```
https://6b7b15a3c6f5f6cc60c8b57919fc8f96.r2.cloudflarestorage.com/cssrms
```

This is the S3-compatible API endpoint used internally by SDKs. It is **not** one of the five required variables and is **not** the same as the public URL — it can be reconstructed from `R2_ACCOUNT_ID` if ever needed in code.

#### Step 5 — Enable the Public Development URL

Bucket **cssrms** → Settings → Public Development URL → clicked **Enable** → confirmed the public-access warning. Cloudflare generated a URL in the form `https://pub-xxxxxxxx.r2.dev`. This is `R2_PUBLIC_URL`.

#### Result — All five R2 variables

```
R2_ACCESS_KEY_ID=<from Step 3>
R2_ACCOUNT_ID=<from Step 2>
R2_BUCKET_NAME=cssrms
R2_PUBLIC_URL=<from Step 5>
R2_SECRET_ACCESS_KEY=<from Step 3>
```

#### Step 6 — Add variables to Railway

- Open the project in Railway → select the service
- Go to the **Variables** tab
- Use **Raw Editor** to paste all five lines at once, or add them individually
- Click **Deploy** to redeploy the service with the new variables active

---

### Part 2 — Railway Custom Domain (`rms.cssgrouprms.com`)

**Goal:** point the subdomain `rms.cssgrouprms.com` to the Railway-hosted app, verified through DNS records added at the domain registrar (Smart Web).

#### Step 1 — Request a custom domain in Railway

In the Railway service → Settings → Networking / Custom Domain → entered `rms.cssgrouprms.com`. Railway generated two DNS records that must be added at the domain's DNS provider.

| Type | Name | Value |
|---|---|---|
| CNAME | `rms` | `yz51hg3b.up.railway.app` |
| TXT | `_railway-verify.rms` | `railway-verify=53118dcce2ace7333164...` (full value from Railway) |

#### Step 2 — Add the records at Smart Web (registrar) DNS Management

`cssgrouprms.com` was purchased through Smart Web, whose client portal uses a WHMCS-style DNS Management page (Host Name / Record Type / Address / Priority). The domain's DNS is managed here rather than in Cloudflare, so records are entered directly in this panel.

**Record 1 — CNAME:**
- Host Name: `rms`
- Record Type: `CNAME`
- Address: `yz51hg3b.up.railway.app`
- Priority: left blank (N/A)

**Record 2 — TXT:**
- Host Name: `_railway-verify.rms`
- Record Type: `TXT`
- Address: full `railway-verify=...` value copied exactly from Railway
- Priority: left blank (N/A)

Click **Save Changes** in Smart Web after both records are entered. Copy the TXT value directly from Railway's popup rather than typing it — it is long and must match exactly for verification to succeed.

#### Step 3 — Wait for verification

DNS propagation can take anywhere from a few minutes to a few hours. Railway will show a green checkmark / verified status on both records once propagation completes and the domain is confirmed.

#### Notes for the future

- `cssgrouprms.com` currently manages DNS through Smart Web's own panel, **not** through Cloudflare nameservers. This is fine for the Railway custom domain (a simple CNAME/TXT add), but if a branded custom domain is later wanted for R2 storage itself (e.g. `cdn.cssgrouprms.com`) instead of the free `pub-xxxx.r2.dev` URL, the same approach applies: get the CNAME from Cloudflare's Custom Domains section and add it in Smart Web the same way.

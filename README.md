# Disha-Unis Dashboard

A role-based university data dashboard. Admins upload CSV files that are stored as Google Sheets tabs; users see only the data assigned to their university — with search, filter, sort, and export (CSV + XLSX).

**Stack:** React + Vite (TypeScript) · Clerk (auth + roles) · Google Apps Script (data store) · Vercel (hosting + serverless API)

---

## Table of Contents

1. [Architecture](#architecture)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Google Apps Script Setup](#google-apps-script-setup)
6. [Local Development](#local-development)
7. [Deploying to Vercel](#deploying-to-vercel)
8. [Clerk Configuration](#clerk-configuration)
9. [How It Works — Feature Walkthrough](#how-it-works)
10. [GAS API Reference](#gas-api-reference)
11. [Recreating From Scratch](#recreating-from-scratch)

---

## Architecture

```
Browser (React Vite SPA)
│
├── Clerk SDK          → handles sign-in UI, session tokens, publicMetadata
│
├── /admin/*           → role="admin" only (ProtectedRoute)
│   ├── Upload CSV     → PapaParse → POST /api/gas-proxy → GAS (importSheet)
│   └── Manage Users   → GET /api/list-users → Clerk API
│                        POST /api/set-user-meta → Clerk API (PATCH publicMetadata)
│
└── /dashboard         → any authenticated user
    └── DataTable      → GET /api/gas-proxy?action=getSheets → GAS
                         GET /api/gas-proxy?action=getSheetData → GAS
```

```
Vercel Serverless Functions (/api/)
│
├── gas-proxy.ts       → proxies all GAS requests (solves CORS — GAS never sends CORS headers)
├── list-users.ts      → calls Clerk API to list all users (needs secret key, server-side only)
└── set-user-meta.ts   → PATCHes Clerk publicMetadata for a user (role + universitySlug)
```

```
Google Sheets (via Apps Script Web App)
│
└── One tab per universitySlug (e.g. "iimahmedabad")
    ├── Row 1 = headers (from CSV)
    └── Rows 2+ = data
    Script Properties store sheets_meta[] (JSON) for fast listing
```

> **Why proxy GAS through Vercel?**  
> Google Apps Script `ContentService` never sends `Access-Control-Allow-Origin` headers. Direct browser → GAS requests are always CORS-blocked. The Vercel serverless function calls GAS server-to-server, which has no CORS restriction.

---

## Project Structure

```
uni-view-disha/
│
├── api/                          # Vercel serverless functions
│   ├── gas-proxy.ts              # Proxies all GET/POST to Google Apps Script
│   ├── list-users.ts             # Lists Clerk users (uses secret key)
│   └── set-user-meta.ts          # Updates Clerk publicMetadata (role + universitySlug)
│
├── src/
│   ├── components/
│   │   ├── DataTable.tsx         # Full-featured table: search, column filters,
│   │   │                         #   sort, pagination, CSV export, XLSX export
│   │   └── ProtectedRoute.tsx    # Auth + role guard (wraps any route)
│   │
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminLayout.tsx   # Sidebar shell for admin pages
│   │   │   ├── UploadCSV.tsx     # Drag-and-drop CSV → preview → push to GAS
│   │   │   └── ManageUsers.tsx   # List all Clerk users, assign role + slug
│   │   └── UserDashboard.tsx     # Sidebar with sheet tabs + DataTable
│   │
│   ├── App.tsx                   # Top-level router + role-based redirects
│   ├── main.tsx                  # ClerkProvider + BrowserRouter bootstrap
│   └── index.css                 # Design system (dark slate + indigo, Inter font)
│
├── appscript.gs                  # Google Apps Script source (deploy manually to GAS)
├── vercel.json                   # Vercel routing config
├── .env                          # Local env vars (never commit)
└── package.json
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | LTS recommended |
| npm | ≥ 9 | Comes with Node |
| Google Account | — | For Google Sheets + Apps Script |
| Clerk Account | — | Free tier works |
| Vercel Account | — | Free tier works |

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Clerk — get from clerk.com → Your App → API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Google Apps Script Web App URL (see GAS Setup below)
# NOTE: no VITE_ prefix — this is server-side only (used by gas-proxy.ts)
GAS_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

> `VITE_` prefix makes a var available in the browser bundle.  
> `GAS_URL` deliberately has **no** `VITE_` prefix — it lives only in Vercel serverless functions.

### Vercel Environment Variables (production)

In your Vercel project dashboard → Settings → Environment Variables, add all three:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Production |
| `CLERK_SECRET_KEY` | `sk_live_...` | Production |
| `GAS_URL` | `https://script.google.com/...` | Production |

---

## Google Apps Script Setup

This is the most important manual step — the dashboard won't function without it.

### Step 1 — Open your Google Sheet

Create a new Google Sheet (or use an existing one). This is where all university data will be stored as tabs.

### Step 2 — Open Apps Script

In the Sheet: **Extensions → Apps Script**

### Step 3 — Paste the script

Delete all existing code and paste the entire contents of `appscript.gs` from this repo.

### Step 4 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the ⚙ gear icon next to "Type" → choose **Web app**
3. Configure:
   ```
   Description:      disha-unis v1
   Execute as:       Me
   Who has access:   Anyone          ← IMPORTANT: not "Anyone with Google Account"
   ```
4. Click **Deploy**
5. Authorize the script when prompted (allow it to access Spreadsheets)
6. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### Step 5 — Add to `.env`

```env
GAS_URL=https://script.google.com/macros/s/AKfycby.../exec
```

### Updating the script later

If you change `appscript.gs`, you must **create a new version** of the deployment:  
**Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy**

The Web App URL stays the same after an update.

---

## Local Development

### Install dependencies

```bash
npm install
```

### Run with API functions (recommended)

```bash
npm run dev:full
# runs: vercel dev
# serves both Vite frontend AND /api/* serverless functions
# URL: http://localhost:3000
```

First run will prompt you to log in to Vercel and link/create a project. Follow the prompts:
- Link to existing project? **No** (first time)
- Project name: `uni-view-disha` (or anything)
- Directory: `./`
- Auto-detected settings for Vite: **Yes, accept defaults**

After the first run, authentication is cached and subsequent `npm run dev:full` starts instantly.

### Run Vite only (UI work, no API calls)

```bash
npm run dev
# URL: http://localhost:5173
# /api/* routes will 404 — use only for pure UI development
```

---

## Deploying to Vercel

### Option A — Vercel CLI (from terminal)

```bash
npm run dev:full   # this also links the project on first run
# then when ready:
npx vercel --prod
```

### Option B — GitHub integration (recommended for teams)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select the repo
4. Vercel auto-detects Vite settings
5. Add environment variables (see table above)
6. Click **Deploy**

All subsequent `git push` to `main` will auto-deploy.

### vercel.json

The `vercel.json` at the repo root configures routing so `/api/*` hits the serverless functions:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

---

## Clerk Configuration

### Create a Clerk application

1. Go to [clerk.com](https://clerk.com) → Create application
2. Choose sign-in methods (Email recommended)
3. Copy **Publishable Key** and **Secret Key** → add to `.env`

### Allowed origins (for local dev)

In Clerk Dashboard → Your App → Settings → Domains:
- Add `http://localhost:3000` (for `vercel dev`)
- Add your Vercel production URL (e.g. `https://uni-view-disha.vercel.app`)

### User roles and university assignment

Roles and university access are stored in **Clerk `publicMetadata`** — not in a database. This makes them instantly available in the frontend via `useUser()`.

```json
{
  "role": "admin",
  "universitySlug": "iimahmedabad"
}
```

**Admin users** must have `role: "admin"` set.  
**Regular users** need `universitySlug` set to see their data.

#### Setting metadata manually (Clerk Dashboard)

1. Clerk Dashboard → Users → click a user
2. Scroll to **Public Metadata**
3. Edit and save:
   ```json
   { "role": "admin" }
   ```

#### Setting metadata via the dashboard (Admin panel)

Admin users can assign roles and slugs to any user via the **Manage Users** page at `/admin/users`. This calls the `/api/set-user-meta` serverless function which PATCHes the Clerk API.

### universitySlug naming convention

The `universitySlug` **must exactly match** the Google Sheet tab name created during CSV upload. Use lowercase, no spaces:

| University | Slug |
|-----------|------|
| IIM Ahmedabad | `iimahmedabad` |
| IIM Bangalore | `iimbangalore` |
| XLRI Jamshedpur | `xlri` |
| FMS Delhi | `fms` |

---

## How It Works

### Admin: Upload CSV

1. Admin signs in → redirected to `/admin/upload`
2. Drags a `.csv` file into the drop zone (or clicks to browse)
3. PapaParse parses it client-side → preview of first 5 rows shown
4. Admin enters the **university slug** (e.g. `iimahmedabad`)
5. Clicks **Upload to Google Sheets**
6. Frontend POSTs to `/api/gas-proxy` → which POSTs to GAS `importSheet` action
7. GAS creates/replaces a sheet tab named after the slug, writes all rows, updates `sheets_meta` in Script Properties
8. Success message shown with row count

### Admin: Manage Users

1. Admin navigates to `/admin/users`
2. Page calls `/api/list-users` → Clerk API → returns all users with their `publicMetadata`
3. Admin sees a table of users with their current role and slug
4. Admin changes the dropdown / input and clicks **Save**
5. Page calls `/api/set-user-meta` with `{ userId, role, universitySlug }`
6. Serverless function GETs current metadata, merges the patch, PATCHes Clerk API
7. Optimistic UI update shown immediately

### User: View Data

1. User signs in → redirected to `/dashboard`
2. `universitySlug` is read from `user.publicMetadata.universitySlug`
3. Page calls `/api/gas-proxy?action=getSheets&targetSlug=<slug>` → gets sheet metadata
4. Page calls `/api/gas-proxy?action=getSheetData&sheetName=<slug>` → gets all rows
5. DataTable renders with:
   - **Global search** across all columns
   - **Per-column filters** (first 6 columns)
   - **Sortable headers** (click to sort asc/desc/off)
   - **Pagination** with configurable rows per page (10/25/50/100)
   - **Export CSV** — downloads current filtered+sorted view
   - **Export XLSX** — downloads as Excel with auto-sized columns

---

## GAS API Reference

All actions are exposed through the deployed Web App URL.

### GET Actions

| Action | Params | Returns |
|--------|--------|---------|
| `getSheets` | `targetSlug` (optional) | `SheetMeta[]` — metadata for matching slugs |
| `getSheetData` | `sheetName` | `Row[]` — all rows as objects with `_rowIndex` |
| `getSlugs` | — | `string[]` — all unique university slugs |
| `getRow` | `sheetName`, `rowIndex` | Single row object |

### POST Actions (body as JSON)

| Action | Body | Effect |
|--------|------|--------|
| `importSheet` | `{ data: { targetSlug, headers[], rows[], name, uploadedAt } }` | Creates/replaces tab, upserts meta |
| `createRow` | `{ sheetName, row: {} }` | Appends a row |
| `updateRow` | `{ sheetName, rowIndex, row: {} }` | Overwrites a row by 1-based index |
| `deleteRow` | `{ sheetName, rowIndex }` | Deletes a row by 1-based index |
| `deleteSheet` | `{ sheetName }` | Deletes the tab and removes from meta |

> `rowIndex` is **1-based** and does **not** count the header row. The `_rowIndex` field returned in `getSheetData` rows is ready to use directly.

---

## Recreating From Scratch

Follow these steps to rebuild this project from zero:

```bash
# 1. Scaffold a Vite React TypeScript app
npm create vite@latest uni-view-disha -- --template react-ts
cd uni-view-disha

# 2. Install all dependencies
npm install @clerk/clerk-react react-router-dom papaparse xlsx
npm install --save-dev @types/papaparse @vercel/node vercel

# 3. Create directory structure
mkdir -p src/components src/pages/admin api

# 4. Create .env (fill in values from Clerk dashboard and GAS deployment)
cat > .env << 'EOF'
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
GAS_URL=https://script.google.com/macros/s/.../exec
EOF

# 5. Copy all source files from this repo:
#    src/index.css               — design system
#    src/main.tsx                — ClerkProvider + BrowserRouter
#    src/App.tsx                 — router + role redirect
#    src/components/ProtectedRoute.tsx
#    src/components/DataTable.tsx
#    src/pages/admin/AdminLayout.tsx
#    src/pages/admin/UploadCSV.tsx
#    src/pages/admin/ManageUsers.tsx
#    src/pages/UserDashboard.tsx
#    api/gas-proxy.ts
#    api/list-users.ts
#    api/set-user-meta.ts
#    appscript.gs
#    vercel.json

# 6. Set up Google Apps Script (see GAS Setup section above)

# 7. Run locally
npm run dev:full       # http://localhost:3000

# 8. Deploy
npx vercel --prod
```

### Checklist

- [ ] Clerk app created, publishable key + secret key copied to `.env` and Vercel env vars
- [ ] Google Sheet created
- [ ] `appscript.gs` pasted into GAS editor and saved
- [ ] GAS deployed as Web App: **Execute as: Me | Who has access: Anyone**
- [ ] GAS Web App URL copied to `.env` (`GAS_URL=...`) and Vercel env vars
- [ ] At least one user has `{ "role": "admin" }` in Clerk publicMetadata
- [ ] Vercel project linked (`npm run dev:full` first run) or GitHub repo connected
- [ ] Production env vars set in Vercel dashboard

---

## Notes & Known Limitations

- **No row-level security on GAS** — any request with the Web App URL can read/write all sheets. Security is enforced at the Clerk/dashboard layer only.
- **GAS rate limits** — Google Apps Script has [quotas](https://developers.google.com/apps-script/guides/services/quotas): 6 min/execution, 90 min/day total for free accounts. For large CSV uploads, consider chunking.
- **Clerk publicMetadata** can only be written server-side (requires the secret key). Reading it client-side via `useUser()` is fine.
- **XLSX export** uses SheetJS (community edition). Column widths are auto-calculated from content length.
- **`vercel dev` required locally** for `/api/*` routes. Plain `npm run dev` (Vite only) will 404 on all API calls.

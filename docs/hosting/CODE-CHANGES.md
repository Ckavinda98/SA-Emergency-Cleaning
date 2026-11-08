# Code changes for free hosting (8 Nov 2026)

A copy of every file **before** these changes is in
`backups/before-free-hosting-2026-11-08/project-snapshot.tgz`.

All **80 tests pass** on PostgreSQL 16 (73 old + 7 new in `tests/api/hosting.test.js`), and `npm run build`
works. I also checked in a real browser, with the API in production mode: logging in from the built website,
opening a page link directly, and adding a photo (it was shrunk from 3000 px and uploaded to a stand-in
Supabase server).

## Database: SQLite → PostgreSQL

| File | Change |
| :--- | :--- |
| `prisma/schema.prisma` | `provider = "postgresql"`, `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_DATABASE_URL")`. New `FileAttachment` table. |
| `server/config/loadEnv.js` *(new)* | Reads `.env` on your PC (with `dotenv`). Render's dashboard settings win over the file. |
| `server/index.js`, `server/db/prisma.js` | Load `.env` first. Start message shows the storage type and the allowed websites. |
| `server/modules/logs/logs.service.js` | Activity search uses `mode: 'insensitive'`, because PostgreSQL's `contains` cares about upper/lower case and SQLite's did not. |
| `prisma/seed.js` | Demo password comes from `SEED_PASSWORD` (default `Password123!`). |
| `tests/globalSetup.js`, `vitest.config.js` | Tests use `TEST_DATABASE_URL` (wiped every run) instead of `prisma/test.db`. They refuse to run against your `DATABASE_URL`. |
| `package.json` | `prisma` moved to `dependencies`. New: `@supabase/supabase-js`, `multer`, `express-rate-limit`, `dotenv`. New scripts: `start`, `postinstall` (prisma generate), `db:push`, `db:seed`, `db:reset`, `db:studio`. |

## API settings for hosting

| File | Change |
| :--- | :--- |
| `server/config/env.js` | New settings: `CORS_ORIGIN`, `STORAGE_DRIVER`, `SUPABASE_*`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB`, `JSON_LIMIT`, `LOGIN_LIMIT_PER_15_MIN`. In production the API refuses to start without the JWT secrets, `DATABASE_URL`, `CORS_ORIGIN` (and the Supabase keys when storage is `supabase`). |
| `server/app.js` | `trust proxy` (real visitor IP behind Render). CORS only for `CORS_ORIGIN`. Login limited to 10 tries per 15 minutes per IP. `/api/health` no longer claims a database connection and never touches the database. New `/api/health/storage` for the daily Supabase ping. New `/api/files` route. |
| `server/middleware/authenticate.js` | `/api/health/storage` is public. |
| `server/middleware/errorHandler.js` | Clear messages for "file too large" and "request too large". |

## Files: photos and videos go to storage, the job keeps only the link

| File | Change |
| :--- | :--- |
| `server/lib/storage.js` *(new)* | The only file that knows where files live. `inline` = data URL (as before, no set-up). `supabase` = upload to the bucket. Also reads images for the PDF, makes 1-hour links for a private bucket, and checks storage health. Azure Blob is added here later. |
| `server/modules/files/` *(new)* | `POST /api/files` (logged-in users): one file, max 5 MB for photos/PDF, 25 MB for video, JPG/PNG/WebP/MP4/WebM/MOV/PDF only. Saves a `FileAttachment` row and an `AuditLog` `FILE_UPLOADED` entry. |
| `server/modules/jobs/jobs.service.js` | When a request or on-site record is saved, its uploaded files are linked to the job (`FileAttachment.jobId`). Private-bucket links are saved back as `storage://` paths. Jobs returned to the browser get fresh links when the bucket is private. |
| `server/modules/reports/reportPdf.js`, `reports.service.js`, `server/lib/jobs.js` | The service report PDF now reads photos and the signature from storage links too, not only data URLs. |
| `src/shared/api/files.js` *(new)* | `uploadFile()`: shrinks photos to 1600 px JPEG (80%) and sends them to `/api/files`. |
| `src/features/customer/pages/RequestFormPage.jsx` | Photos and videos upload as soon as they are picked. Shows "Uploading…", shows errors, and the Send button waits for uploads. |
| `src/features/technician/components/OnSiteRecord.jsx` | Before/after photos and the missed-access entrance photo upload the same way. The signature stays a small PNG inside the job. |

## Hosting files

| File | What it is |
| :--- | :--- |
| `public/_redirects`, `netlify.toml` | Netlify build settings, and the rule that makes page links like `/admin/jobs/123` work on refresh. |
| `render.yaml` | Render Blueprint: one free web service in Singapore with all the settings listed. |
| `.env.example` | Every setting, with comments. Copy to `.env`. |
| `.gitignore` | Adds `backups/`. |
| `README.md` | Local set-up now needs PostgreSQL; links to these guides. |

## Not changed (on purpose)

- The admin "add technician" photo and the technician profile photo are still read in the browser only; the
  server does not save avatars yet, so there was nothing to move.
- `startsWith` checks on technician names and report numbers compare values the app writes itself, so case does not matter.
- The JSON-as-text columns (`photosJson`, `configValue`, …) stay text, so nothing that reads them changes.

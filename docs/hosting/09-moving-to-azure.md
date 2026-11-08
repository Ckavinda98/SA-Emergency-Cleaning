# 09 · Later: moving from the free stack to Azure

Because the free stack already uses PostgreSQL and keeps all file handling in one file, the move to Azure is
mostly **settings**, not code.

| Part | Free (now) | Azure (production) | What you change |
| :--- | :--- | :--- | :--- |
| Database | Neon PostgreSQL | **Azure Database for PostgreSQL – Flexible Server**, Australia East | `DATABASE_URL`, `DIRECT_DATABASE_URL` |
| Files | Supabase Storage | **Azure Blob Storage** (private container) | Add an `azure` branch in `server/lib/storage.js`; `STORAGE_DRIVER=azure` |
| API | Render | **Azure App Service** (Linux, Node 22, "Always On") | Same start command, same settings |
| Website | Netlify | **Azure Static Web Apps** | `VITE_API_BASE`; add `staticwebapp.config.json` |
| Keep-alive | cron-job.org | Not needed | Delete the cron jobs |

## Step 1 · Switch from `db push` to migrations (do this before real data)

`db push` is fine for a demo. For production, every database change should be a recorded migration.

```bat
:: on a fresh, empty dev database
npx prisma migrate dev --name init
git add prisma/migrations
git commit -m "Baseline migration"

:: the Neon demo database already has these tables, so mark the baseline as done there
npx prisma migrate resolve --applied <the folder name it created, e.g. 20261201093000_init>
```

From then on, the API build runs `npx prisma migrate deploy` instead of `db push`.

## Step 2 · Database

1. Azure Portal → **Azure Database for PostgreSQL flexible servers** → **Create**: region **Australia East**,
   PostgreSQL **16**, an admin user and password. Networking: allow your App Service (or "Allow Azure services").
2. Create a database `sacc`.
3. Settings (both can be the same; use PgBouncer on port 6432 for `DATABASE_URL` if you enable it):
   ```ini
   DATABASE_URL="postgresql://sacc_admin:<password>@<server>.postgres.database.azure.com:5432/sacc?sslmode=require"
   DIRECT_DATABASE_URL="postgresql://sacc_admin:<password>@<server>.postgres.database.azure.com:5432/sacc?sslmode=require"
   ```
4. Create the tables with `npx prisma migrate deploy`. To copy the test data across (optional):
   ```bat
   pg_dump "<NEON DIRECT STRING>" --no-owner --no-acl -Fc -f sacc.dump
   pg_restore --no-owner --no-acl -d "<AZURE STRING>" sacc.dump
   ```

## Step 3 · Files

1. Create a Storage Account (Australia East) and a **private** container `incident-media`.
2. `npm install @azure/storage-blob`
3. In `server/lib/storage.js`, add an `azure` branch next to the `supabase` one in `putFile`, `signedUrl` and
   `storageHealth` (upload with `BlockBlobClient.uploadData`, return `storage://<path>`, and make 1-hour read-only
   SAS links in `signedUrl`). Nothing else in the app needs to change: the rest of the code only sees URLs.
4. Settings: `STORAGE_DRIVER=azure`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`.
5. Copy the Supabase files with `azcopy`, then update the old links in the job rows.

## Step 4 · API and website

- **App Service:** Linux, Node 22, Australia East. Build `npm ci && npx prisma migrate deploy`, start
  `node server.js`, health check `/api/health`, **Always On** = On. Copy all the Render settings across,
  with new JWT secrets and the Azure database/storage values.
- **Static Web Apps:** build `npm run build`, output `dist`, setting `VITE_API_BASE`. Add
  `staticwebapp.config.json` in `public/`:
  ```json
  { "navigationFallback": { "rewrite": "/index.html", "exclude": ["/assets/*", "*.{png,jpg,webp,svg,ico}"] } }
  ```
- Add your domain (for example `app.saemergencycleaning.com.au`) and set `CORS_ORIGIN` to it.

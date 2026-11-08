# 01 · Database on Neon (and your PC set-up)

**Goal:** a free PostgreSQL database in the cloud, with three separate copies ("branches"):

| Branch | Used by | What is in it |
| :--- | :--- | :--- |
| `main` | Render (the hosted API) — this is what the **client** sees | Demo data |
| `dev` | You, when you run the app on your PC | Your own test data |
| `test` | `npm test` | Wiped and refilled on every test run |

⏱️ About 20 minutes.

---

## Part A · Create the Neon project

1. Go to **https://neon.com** and click **Sign up**. Choose **Continue with GitHub** (or Google). No credit card is needed.
2. Neon asks you to create your first project. Fill in:
   - **Project name:** `sa-emergency-cleaning`
   - **Postgres version:** `16` (or 17 — either works)
   - **Region:** **AWS Asia Pacific (Singapore)**
     > Why Singapore and not Sydney? Render (where the API runs) has no Australian region; its closest is
     > Singapore. If the database were in Sydney, every query would travel Singapore ↔ Sydney and pages
     > would be up to a second slower. Keep the database next to the API.
3. Click **Create project**. You land on the project dashboard.

## Part B · Copy the two connection strings for `main`

The app needs **two** strings for each branch:

- **Pooled** (goes in `DATABASE_URL`): used by the running app. Its address contains `-pooler`.
- **Direct** (goes in `DIRECT_DATABASE_URL`): used by `npx prisma db push` to create tables.

1. On the project dashboard click the **Connect** button (top right).
2. In the window that opens, check: **Branch** `main`, **Database** `neondb`, **Role** `neondb_owner`.
3. Make sure **Connection pooling** is switched **ON**. Click **Show password**, then **Copy snippet** / copy the
   line that starts with `postgresql://`. Paste it in your notepad file under the heading `MAIN POOLED`.
   It looks like:
   ```
   postgresql://neondb_owner:AbC123xyz@ep-cool-name-12345-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Switch **Connection pooling OFF**. Copy again. Paste under `MAIN DIRECT`. It is the same but **without** `-pooler`.
5. Add these endings (copy exactly, including the `&`):
   - to the **pooled** string add: `&pgbouncer=true&connect_timeout=15`
   - to the **direct** string add: `&connect_timeout=15`

   > If your string has `&channel_binding=require` in it, that is fine, leave it there.

## Part C · Create the `dev` and `test` branches

1. In the left menu click **Branches**.
2. Click **Create branch** (or **New branch**). Name: `dev`. Parent: `main`. Click **Create**.
3. Do it again with the name `test`.
4. For **each** of `dev` and `test`, click **Connect** again, choose that branch in the **Branch** box, and copy the
   pooled and direct strings into your notepad (`DEV POOLED`, `DEV DIRECT`, `TEST DIRECT`), adding the same endings
   as in Part B step 5.

> Leave **Settings → Compute** as it is ("scale to zero" after 5 minutes). That is what keeps you inside the
> free 100 compute-hours a month: the database sleeps when nobody is using it and wakes in under a second.

## Part D · Create the `.env` file on your PC

1. Open the project folder in VS Code (`C:\Shared_Folder\CLEAN_AUS_PRJ01\Mahima_Proect\SA-Emergency-Cleaning`).
2. Open a terminal (**Terminal → New Terminal**) and copy the example file:
   ```bat
   copy .env.example .env
   ```
3. Open `.env` and replace the three database lines with **your** strings:
   ```ini
   DATABASE_URL="<DEV POOLED>&pgbouncer=true&connect_timeout=15"
   DIRECT_DATABASE_URL="<DEV DIRECT>&connect_timeout=15"
   TEST_DATABASE_URL="<TEST DIRECT>&connect_timeout=15"
   ```
   Keep the quotes `"` around each value.
4. Leave `STORAGE_DRIVER="inline"` for now (photos stay inside the database on your PC; guide 02 changes it).
5. Save the file.

> `.env` is listed in `.gitignore`, so Git will never upload it. Do not rename it.

## Part E · Install and create the tables in `dev`

In the terminal, run these one at a time:

```bat
npm install
npx prisma db push
node prisma/seed.js
```

- `npm install` installs the new packages (Supabase, multer, rate limit, dotenv) and runs `prisma generate`.
- `npx prisma db push` creates all 13 tables in the `dev` branch.
- `node prisma/seed.js` adds demo companies, users (password `Password123!` unless you set `SEED_PASSWORD`), plans and jobs.

Now start the app the usual way, in two terminals:

```bat
node server.js
```
```bat
npm run dev
```

Open http://localhost:3000 and log in as `mahima@mahimaenterprises.com.au` / `Password123!`.

## Part F · Check the tests

```bat
npm test
```

You should see **80 tests passed**. The tests use the `test` branch only.

## Part G · Fill the `main` branch (what the client will see)

Do this once now; you can redo it any time to reset the demo.

1. Choose the password you will give the client, e.g. `Sacc-Demo-2026!` (at least 8 characters, a capital, a number, a symbol).
2. In `.env`, **temporarily** put the `main` strings in the first two lines and set the password:
   ```ini
   DATABASE_URL="<MAIN POOLED>&pgbouncer=true&connect_timeout=15"
   DIRECT_DATABASE_URL="<MAIN DIRECT>&connect_timeout=15"
   SEED_PASSWORD="Sacc-Demo-2026!"
   ```
3. Run:
   ```bat
   npx prisma db push
   node prisma/seed.js
   ```
4. **Put the `dev` strings back** in `.env` and save. (Otherwise your own testing would change the client's data.)

## ✅ Check

- [ ] `npx prisma studio` opens http://localhost:5555 and shows tables like `User`, `EmergencyRequest`, `FileAttachment`.
- [ ] You can log in on http://localhost:3000.
- [ ] `npm test` says 80 passed.
- [ ] Your notepad has `MAIN POOLED`, `MAIN DIRECT` (with the endings) — you need them in guide 04.

---

### Option: PostgreSQL in Docker instead of the Neon `dev` branch

If you have Docker Desktop and want to work offline:

```bat
docker run --name sacc-pg -e POSTGRES_PASSWORD=sacc -e POSTGRES_DB=sacc -p 5432:5432 -d postgres:16
docker exec sacc-pg createdb -U postgres sacc_test
```
```ini
DATABASE_URL="postgresql://postgres:sacc@localhost:5432/sacc"
DIRECT_DATABASE_URL="postgresql://postgres:sacc@localhost:5432/sacc"
TEST_DATABASE_URL="postgresql://postgres:sacc@localhost:5432/sacc_test"
```

### What about my old `prisma/dev.db` data?

It is not copied. The new database is filled by `node prisma/seed.js`, which is what you want for a clean
client demo. The old file stays on your PC, untouched; you can delete it once you are happy.

Next: **[02 · File storage on Supabase](02-file-storage-supabase.md)**

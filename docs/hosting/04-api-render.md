# 04 · API on Render

**Goal:** the API (`node server.js`) runs on the internet at an address like
`https://sa-emergency-cleaning-api.onrender.com`, connected to Neon (database) and Supabase (files).

⏱️ About 20 minutes. You need from your notepad: `MAIN POOLED`, `MAIN DIRECT`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`.

> **Free plan facts:** 512 MB memory, sleeps after 15 minutes with no visitors, and the first visit after
> that takes about a minute. Guide 06 keeps it awake during the day.

---

## Part A · Sign up

1. Go to **https://render.com** → **Get Started** → **GitHub**. No credit card is needed.
2. When GitHub asks which repositories Render may see, choose **Only select repositories** and pick
   `SA-Emergency-Cleaning`.

## Part B · Create the web service

You can do this in **one of two ways**. Way 1 is easiest.

### Way 1 · Blueprint (uses the `render.yaml` file in the project)

1. In Render click **New +** → **Blueprint**.
2. Pick the `SA-Emergency-Cleaning` repository, branch `main`.
3. Render reads `render.yaml` and shows one service `sa-emergency-cleaning-api` (Free, Singapore). It asks you for
   the values it does not know. Fill them in (see the table in Part C) and click **Apply** / **Deploy Blueprint**.

### Way 2 · By hand

1. **New +** → **Web Service** → pick the repository.
2. Fill in:

   | Field | Value |
   | :--- | :--- |
   | Name | `sa-emergency-cleaning-api` |
   | Region | **Singapore** |
   | Branch | `main` |
   | Root Directory | *(leave empty)* |
   | Runtime / Language | **Node** |
   | Build Command | `npm ci --include=dev && npx prisma generate` |
   | Start Command | `node server.js` |
   | Instance Type | **Free** |

3. Open **Advanced** → **Health Check Path**: `/api/health`.
4. Add the environment variables from Part C, then click **Create Web Service**.

## Part C · Environment variables

In the service → **Environment** → **Add Environment Variable**. Add each row:

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | your **MAIN POOLED** string, ending `&pgbouncer=true&connect_timeout=15` |
| `DIRECT_DATABASE_URL` | your **MAIN DIRECT** string, ending `&connect_timeout=15` |
| `JWT_SECRET` | click **Generate** (or a 64+ character random text) |
| `JWT_REFRESH_SECRET` | click **Generate** (must be different from `JWT_SECRET`) |
| `CORS_ORIGIN` | `http://localhost:3000` *(for now — you change it in guide 05)* |
| `STORAGE_DRIVER` | `supabase` |
| `SUPABASE_URL` | from notepad |
| `SUPABASE_SERVICE_ROLE_KEY` | from notepad |
| `SUPABASE_BUCKET` | `sacc-files` |
| `SUPABASE_PUBLIC_BUCKET` | `true` |
| `JSON_LIMIT` | `2mb` |

Do **not** add `PORT`; Render sets it.

> To make a random secret yourself, run this in your terminal and copy the result:
> ```bat
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

**Paste values without quotes.** (Quotes are only for the `.env` file.)

## Part D · Watch the first deploy

1. Open the service → **Logs**. The build takes 2–4 minutes.
2. You want to see, near the end:
   ```
   SACC Emergency Membership Backend API Server Running
   File storage: supabase · Allowed websites: http://localhost:3000
   ```
3. If it stops with `Missing settings for production: ...`, add the settings it names (Part C) and click
   **Manual Deploy → Deploy latest commit**.
4. Copy your service address from the top of the page (e.g. `https://sa-emergency-cleaning-api.onrender.com`).
   Notepad: `API ADDRESS`.

## ✅ Check

Open these in your browser (replace with your address):

- [ ] `https://sa-emergency-cleaning-api.onrender.com/api/health` → `{"status":"ONLINE","storage":"supabase",...}`
- [ ] `https://sa-emergency-cleaning-api.onrender.com/api/health/storage` → `{"status":"ONLINE","driver":"supabase",...}`
- [ ] `https://sa-emergency-cleaning-api.onrender.com/api/config` → a long block of JSON (this one reads the Neon database).

From now on, **every push to `main` redeploys the API automatically.**

Next: **[05 · Website on Netlify](05-website-netlify.md)**

# 02 · File storage on Supabase

**Goal:** a free "bucket" where photos and videos are kept. The database then stores only a short link to
each file, instead of the whole photo.

> **Why this matters:** the app refreshes the job list every 30 seconds. If photos stay inside the job rows,
> one open admin screen can use all of Render's free 5 GB monthly bandwidth in a couple of hours.

⏱️ About 10 minutes.

---

## Part A · Create the project

1. Go to **https://supabase.com** → **Start your project** → **Continue with GitHub**. No credit card is needed.
2. Click **New project**:
   - **Organization:** your personal one (Free plan)
   - **Project name:** `sacc-files`
   - **Database password:** click **Generate a password** and save it in your notepad. (We do not use Supabase's
     database, but a password is required.)
   - **Region:** **Sydney** (shown as "Oceania (Sydney)" or `ap-southeast-2`) — the client's browser loads photos straight from here, so close to
     Adelaide is best.
3. Click **Create new project** and wait about 1 minute.

## Part B · Create the bucket

1. Left menu → **Storage** (the folder icon).
2. Click **New bucket**:
   - **Name:** `sacc-files` (exactly this)
   - **Public bucket:** **ON**
     > Public means: anyone with the exact link can see the photo. Every file name is a long random code, so links
     > cannot be guessed. This is fine for **test data**. Before real customers, see "Private bucket" below.
   - **Restrict file upload size:** ON, `25 MB`
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp, video/mp4, video/webm, video/quicktime, application/pdf`
3. Click **Create bucket** (or **Save**).
4. **Do not add any policies.** Only our API uploads files, using a secret key that does not need policies. With no
   upload policy, nobody else can upload.

## Part C · Copy the URL and the secret key

1. Left menu → **Project Settings** (the gear icon at the bottom).
2. **Data API** (or **API**): copy the **Project URL**, e.g. `https://abcdefghijkl.supabase.co`.
   Notepad: `SUPABASE_URL`.
3. **API Keys**: find the **service_role** key (it may say "secret"). Click **Reveal**, copy it.
   Notepad: `SUPABASE_SERVICE_ROLE_KEY`.

> 🔒 The **service_role** key can do anything in this Supabase project. Put it **only** in your `.env` and on
> **Render**. Never in Netlify, never in a setting that starts with `VITE_`, never in GitHub.

## Part D · Try it from your PC

1. In `.env` set:
   ```ini
   STORAGE_DRIVER="supabase"
   SUPABASE_URL="https://abcdefghijkl.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi...."
   SUPABASE_BUCKET="sacc-files"
   SUPABASE_PUBLIC_BUCKET="true"
   ```
2. Stop `node server.js` (Ctrl+C) and start it again. The start message should say `File storage: supabase`.
3. Open http://localhost:5000/api/health/storage — you should see `"status":"ONLINE","driver":"supabase"`.
4. Log in at http://localhost:3000 as the customer, click **New request**, and add a photo. When the small picture
   appears, the photo has already been uploaded.
5. In Supabase → **Storage → sacc-files → uploads** you will see a folder with your photo in it.

You can switch back to `STORAGE_DRIVER="inline"` any time for offline work.

## ✅ Check

- [ ] `/api/health/storage` shows `"driver":"supabase"`.
- [ ] A photo you added appears in the Supabase bucket.
- [ ] Notepad has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

### Private bucket (before real customer data)

1. In Supabase, edit the bucket and switch **Public bucket OFF**.
2. Set `SUPABASE_PUBLIC_BUCKET="false"` (in `.env` and on Render).

The code already handles this: files are saved as `storage://...` and the API gives each allowed viewer a link
that expires after 1 hour. (Files uploaded while the bucket was public keep their public links; reset the demo
after switching if you want everything private.)

### The free plan pauses after 7 quiet days

Guide 06 sets a daily ping to `/api/health/storage`, which lists one file and keeps the project active.

Next: **[03 · GitHub](03-github.md)**

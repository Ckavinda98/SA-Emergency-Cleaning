# 05 · Website on Netlify

**Goal:** the React website is online at `https://sa-emergency-cleaning-demo.netlify.app` and talks to your
Render API. Then we lock the API so only this website may use it.

⏱️ About 15 minutes. You need: `API ADDRESS` from guide 04.

---

## Part A · Sign up and import the project

1. Go to **https://netlify.com** → **Sign up** → **GitHub**. No credit card is needed.
2. Click **Add new site** (or **Add new project**) → **Import an existing project** → **GitHub**.
3. Allow Netlify to see the `SA-Emergency-Cleaning` repository and pick it.
4. Netlify reads `netlify.toml` from the project, so the build settings are already filled in:

   | Setting | Value |
   | :--- | :--- |
   | Branch to deploy | `main` |
   | Base directory | *(empty)* |
   | Build command | `npm run build` |
   | Publish directory | `dist` |

## Part B · Tell the website where the API is

Before you click deploy, open **Add environment variables** (or after: **Site configuration → Environment variables**):

| Key | Value |
| :--- | :--- |
| `VITE_API_BASE` | your `API ADDRESS` + `/api`, e.g. `https://sa-emergency-cleaning-api.onrender.com/api` |

- No slash at the end.
- **Do not add `NODE_ENV`** here. It would make the build fail.
- Optional: `VITE_GOOGLE_MAPS_API_KEY` if you use Google address lookup (see the end of this guide).

Click **Deploy**. It takes 1–2 minutes.

> Values starting with `VITE_` are baked into the website when it is **built**. If you change one later,
> go to **Deploys → Trigger deploy → Clear cache and deploy site**.

## Part C · Choose the website name

1. **Site configuration → General → Site details → Change site name**.
2. Type `sa-emergency-cleaning-demo` → **Save**. (If it is taken, pick another and use that name everywhere below.)
3. Your link is now **https://sa-emergency-cleaning-demo.netlify.app**. Notepad: `WEBSITE ADDRESS`.
4. Optional: in the same area turn off the small "Powered by Netlify" badge.

## Part D · Lock the API to this website (CORS)

Right now the API only allows `http://localhost:3000`, so the website cannot log in yet. Fix that:

1. Go back to **Render** → your service → **Environment**.
2. Edit `CORS_ORIGIN` to your website address, **exactly**, with no slash at the end:
   ```
   https://sa-emergency-cleaning-demo.netlify.app
   ```
   If you will also test the Android app against this API, use:
   ```
   https://sa-emergency-cleaning-demo.netlify.app,https://localhost,capacitor://localhost
   ```
3. Click **Save, rebuild, and deploy** (or **Save changes** and then **Manual Deploy**). Wait for "Live".

## ✅ Check

- [ ] Open `https://sa-emergency-cleaning-demo.netlify.app`. The login page shows **Server: Online**
      (the first time may take up to a minute while Render wakes up).
- [ ] Log in as `admin@sacleaning.com.au` with the password you used for `SEED_PASSWORD` in guide 01 Part G.
- [ ] Open `https://sa-emergency-cleaning-demo.netlify.app/admin` directly and press **F5**. You see the app, not
      "Page not found". (That is the `public/_redirects` file working.)

---

### Optional: Google Maps address lookup

Without a key the address boxes are normal text boxes and everything works. To turn it on:

1. https://console.cloud.google.com → create a project → **APIs & Services → Library** → enable **Places API (New)**
   and **Maps JavaScript API**.
2. **Credentials → Create credentials → API key**. Edit the key: **Application restrictions → Websites**, add
   `https://sa-emergency-cleaning-demo.netlify.app/*` and `http://localhost:3000/*`.
3. Add it in Netlify as `VITE_GOOGLE_MAPS_API_KEY` and redeploy (Clear cache and deploy).

The key is visible in the browser, which is why the website restriction is important.

Next: **[06 · Keep it awake with cron-job.org](06-keep-awake-cron-job-org.md)**

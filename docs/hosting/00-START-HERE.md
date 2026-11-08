# Free hosting: start here

This folder walks you through putting **SA Emergency Cleaning** online for free, so your client can open a
link and test it. Every save goes to a real database, and every photo goes to a real file store.

Read the guides **in number order**. Each one ends with a "✅ Check" so you know it worked before you go on.

## The big picture

```
Client's browser ──► Netlify (the website) ──► Render (the API, node server.js) ──► Neon (PostgreSQL database)
                                                       │
                                                       └──► Supabase Storage (photos, videos)
cron-job.org pings Render every 10 minutes so it does not fall asleep while the client is testing.
```

| Service | What it does for us | Cost | Guide |
| :--- | :--- | :--- | :--- |
| **Neon** | The database (replaces the old `prisma/dev.db` SQLite file) | Free | [01-database-neon.md](01-database-neon.md) |
| **Supabase** | Stores photos and videos | Free | [02-file-storage-supabase.md](02-file-storage-supabase.md) |
| **GitHub** | Holds the code; Render and Netlify copy it from here | Free | [03-github.md](03-github.md) |
| **Render** | Runs the API (`node server.js`) | Free | [04-api-render.md](04-api-render.md) |
| **Netlify** | Shows the website to the client | Free | [05-website-netlify.md](05-website-netlify.md) |
| **cron-job.org** | Keeps Render awake during the day | Free | [06-keep-awake-cron-job-org.md](06-keep-awake-cron-job-org.md) |
| | Test everything and send the link | | [07-test-and-share.md](07-test-and-share.md) |
| | When something goes wrong | | [08-troubleshooting.md](08-troubleshooting.md) |
| | Later: the real production move to Azure | | [09-moving-to-azure.md](09-moving-to-azure.md) |

What was changed in the code to make this possible: [CODE-CHANGES.md](CODE-CHANGES.md).

## ⚠️ Important: the app now needs PostgreSQL on your PC too

The code no longer uses the `prisma/dev.db` SQLite file. Until you finish **guide 01**, `node server.js` and
`npm test` will stop with a message about `DATABASE_URL`. That is expected. Guide 01 takes about 20 minutes.

Why PostgreSQL and not "SQLite now, PostgreSQL later"? Your production database on Azure is **Azure Database
for PostgreSQL**. So PostgreSQL is not a temporary change: it is the engine you will use for real. Only
**Neon** (the free host) is temporary. Moving to Azure later means changing two lines in the settings.

## Before you start

You need:

1. **Node.js 20 or newer** on your PC. Check: open a terminal and type `node -v`.
2. **A GitHub account** (you already have one: the code is on GitHub).
3. **An email address** for the free sign-ups (Neon, Supabase, Render, Netlify, cron-job.org).
   You can use "Sign in with GitHub" on all of them, which is easiest.
4. **A notepad file outside the project folder** (for example `C:\Users\<you>\Documents\sacc-hosting-keys.txt`).
   You will copy several addresses and secret keys. **Never put this file in the project folder**, so it can
   never be pushed to GitHub.

## How long it takes

| Step | Time |
| :--- | :--- |
| 01 Neon database + your PC | 20 min |
| 02 Supabase storage | 10 min |
| 03 GitHub push | 10 min |
| 04 Render API | 20 min |
| 05 Netlify website | 15 min |
| 06 cron-job.org | 10 min |
| 07 Test and share | 45 min |
| **Total** | **about 2½ hours** |

## Words you will see

| Word | Meaning |
| :--- | :--- |
| **Terminal** | The black command window. In VS Code: menu **Terminal → New Terminal**. It must be "in" the project folder (the one with `package.json`). |
| **`.env` file** | A text file in the project folder that holds your secret settings. It is never uploaded to GitHub. |
| **Connection string** | One long line that tells the app where the database is and the password, e.g. `postgresql://user:pass@host/db`. |
| **Environment variable** | A setting with a name and a value, like `CORS_ORIGIN = https://...`. On your PC they live in `.env`; on Render and Netlify you type them into the website. |
| **Deploy** | Render/Netlify copy the latest code from GitHub, build it and put it online. |
| **CORS** | A browser safety rule. The API only answers websites on its allowed list. |

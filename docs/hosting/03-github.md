# 03 · Put the code on GitHub

**Goal:** the latest code (with the hosting changes) is on GitHub, in a **private** repository. Render and
Netlify read the code from there and update the site automatically every time you push.

⏱️ About 10 minutes.

---

## Part A · Pick the repository and make sure it is private

Your project already has two GitHub repositories connected:

| Name in Git | Address |
| :--- | :--- |
| `origin` | https://github.com/mahimasithuruwan/SA-Emergency-Cleaning |
| `upstream` | https://github.com/Ckavinda98/SA-Emergency-Cleaning |

Choose **one** to host from — normally the one **you** own and can give Render/Netlify access to.
In the steps below it is called `origin`; if you choose the other one, write `upstream` instead.

1. Open the repository on github.com → **Settings** → **General** → scroll to **Danger Zone**.
2. It must say **This repository is currently private**. If it is public, click **Change visibility → Make private**.

## Part B · Check no secrets are in Git

In the terminal (project folder):

```bat
git status
```

- `.env` must **not** be in the list. (It is ignored by `.gitignore`.)
- `prisma/dev.db` must **not** be in the list.

And check the history never had them:

```bat
git log --all --oneline -- .env prisma/dev.db
```

This must print **nothing**.

## Part C · Commit and push the changes on a new branch

```bat
git checkout -b free-hosting
git add -A
git status
```

Look at the list once more: you should see files like `server/lib/storage.js`, `render.yaml`, `netlify.toml`,
`docs/hosting/...`. **No `.env`.** Then:

```bat
git commit -m "Free hosting: PostgreSQL, file storage, CORS, login limit, Netlify/Render settings"
git push -u origin free-hosting
```

> The `backups/` folder is listed in `.gitignore`, so local snapshots stay on your PC only.

## Part D · Merge into `main`

1. GitHub shows a yellow bar **"free-hosting had recent pushes" → Compare & pull request**. Click it.
2. Check the changes, click **Create pull request**, then **Merge pull request → Confirm merge**.

Render and Netlify will deploy from `main`.

## ✅ Check

- [ ] The repository is **Private**.
- [ ] On github.com, the `main` branch has `render.yaml`, `netlify.toml` and `docs/hosting/`.
- [ ] There is **no** `.env` file on github.com.

Next: **[04 · API on Render](04-api-render.md)**

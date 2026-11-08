# 08 · Troubleshooting

Find the message you see, then do the fix.

## On your PC

| You see | Why | Fix |
| :--- | :--- | :--- |
| `Environment variable not found: DATABASE_URL` (or `DIRECT_DATABASE_URL`) | No `.env`, or the line is missing | Guide 01 Part D. The file must be called exactly `.env` and sit next to `package.json`. |
| `P1001: Can't reach database server` | Neon was asleep and the first try timed out, or the string is wrong | Check both strings end with `connect_timeout=15` and contain `sslmode=require`. Run the command again. |
| `P1000: Authentication failed` | Wrong password in the string | Copy the string again from Neon → **Connect** (click **Show password** first). |
| `prepared statement "s0" already exists` | Pooled string without `pgbouncer=true` | Add `&pgbouncer=true` to `DATABASE_URL`. |
| `npm test`: `Set TEST_DATABASE_URL in .env` | No test database | Guide 01 Part C and D. |
| `npm test`: `TEST_DATABASE_URL must be a different database` | You pointed tests at your dev database | Use the `test` branch string. |
| `The table "public.FileAttachment" does not exist` | Tables are older than the code | `npx prisma db push` |
| Photo upload says `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set` | `STORAGE_DRIVER=supabase` but keys missing | Add them to `.env`, or set `STORAGE_DRIVER="inline"`. Restart `node server.js`. |
| Photo upload says `File storage: Bucket not found` | Bucket name differs | The bucket must be called `sacc-files` (or change `SUPABASE_BUCKET`). |

## On Render (Logs tab)

| You see | Why | Fix |
| :--- | :--- | :--- |
| `Missing settings for production: ...` | A setting is not added | Add the names listed (guide 04 Part C) → **Manual Deploy**. |
| `prisma: not found` | Build command changed | Build command must be `npm ci --include=dev && npx prisma generate`. |
| `Can't reach database server` | Wrong `DATABASE_URL`, or pasted with quotes | Paste the value **without** quotes. |
| Deploy shows "Timed out" on health check | Health check path wrong | **Settings → Health Check Path** = `/api/health`. |
| `JavaScript heap out of memory` | 512 MB limit | Make sure `JSON_LIMIT` is `2mb`; videos are limited to 25 MB. |

## In the browser (press F12 → Console)

| You see | Why | Fix |
| :--- | :--- | :--- |
| `blocked by CORS policy` | `CORS_ORIGIN` on Render does not match the website address exactly | `https://`, exact name, **no slash at the end**. Save and redeploy on Render. |
| Login page says "Server: Offline" for more than 2 minutes | API asleep or crashed | Open the `/api/health` link; check Render Logs. |
| Requests go to `localhost:5000` | `VITE_API_BASE` added after the build | Netlify → **Deploys → Trigger deploy → Clear cache and deploy site**. |
| "Page not found" after pressing F5 on a page | Redirect rule missing | `public/_redirects` and `netlify.toml` must be in the repository. |
| Netlify build: `Cannot find module '@tailwindcss/vite'` | `NODE_ENV=production` set on Netlify | Delete `NODE_ENV` from Netlify's environment variables. |
| "Too many sign-in attempts" | 10 wrong tries in 15 minutes from one address | Wait 15 minutes. (Change `LOGIN_LIMIT_PER_15_MIN` on Render if you need more.) |
| "The file is too large" | Photo/PDF over 5 MB or video over 25 MB | Photos are shrunk automatically; for videos raise `MAX_VIDEO_MB` on Render **and** the bucket limit in Supabase. |
| PDF report has empty photo boxes | The photo is not JPEG/PNG, or the link is broken | Open the photo link from the job; re-add the photo. |

## Still stuck?

Copy the exact error text (Render **Logs**, or browser **Console**) and send it to me with the step you were on.

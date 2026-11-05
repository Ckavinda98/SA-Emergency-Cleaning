# SA Emergency Cleaning

24/7 emergency cleaning membership platform for commercial businesses in Adelaide, South Australia.
Businesses subscribe to a monthly plan, raise emergency requests, and an admin dispatches a technician
who completes the job and produces a service report.

- **Web app:** React 19 + Vite 6 + Tailwind CSS 4 (`src/`, one folder per feature)
- **API:** Node.js + Express 5 (`server/`, one module per domain; start it with `node server.js`)
- **Shared rules:** `shared/` (job statuses, roles, plans, address check, Zod request schemas), used by both
- **Tests:** Vitest + Supertest (`tests/`, run with `npm test`)
- **Database:** Prisma 6 ORM over SQLite (`prisma/dev.db`) for local development
- **Mobile:** Capacitor 7 Android project (`android/`)

---

## 1. Prerequisites

| Tool | Version | Check with |
| :--- | :--- | :--- |
| Node.js | 18 or newer (tested on 22) | `node -v` |
| npm | 9 or newer | `npm -v` |
| Android Studio | only for the mobile app | |

No database server is needed. SQLite is a single file that Prisma creates for you.

---

## 2. Run the project locally (first time)

Open a terminal in the project folder (the one that contains `package.json`), for example:

```bash
cd C:\Shared_Folder\CLEAN_AUS_PRJ01\Mahima_Proect\SA-Emergency-Cleaning
```

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Create the database tables

```bash
npx prisma db push
```

This reads `prisma/schema.prisma`, creates or updates the tables in `prisma/dev.db`, and generates the
Prisma client. It keeps existing data. **Run it again every time `schema.prisma` changes.**

### Step 3: Load the demo data

```bash
node prisma/seed.js
```

This adds the demo companies, technicians, admin users, plans and a few sample jobs.
It is safe to run more than once: existing records are left as they are.

### Step 4: Start the API server (terminal 1)

```bash
node server.js
```

You should see `Port: http://localhost:5000`. Check it at <http://localhost:5000/api/health>.

### Step 5: Start the web app (terminal 2)

```bash
npm run dev
```

Open <http://localhost:3000>. Keep both terminals running.

---

## 3. Demo logins

All demo users have the password **`Password123!`**.

| Role | Email | Lands on |
| :--- | :--- | :--- |
| Customer | `mahima@mahimaenterprises.com.au` | Customer dashboard (Mahima Commercial Enterprises) |
| Customer | `dross@adelaidetower.com.au` | Customer dashboard (Adelaide Corporate Tower) |
| Technician | `dave@sacleaning.com.au` | Technician app |
| Technician | `chris@sacleaning.com.au` | Technician app |
| Admin | `admin@sacleaning.com.au` | Admin dispatch desk (can also open every other workspace) |
| Config | `config@sacleaning.com.au` | Dynamic Configuration Studio |

You can also register a new business from the login screen and choose your own password
(at least 8 characters). The address must be in Adelaide / SA (postcodes 5000–5199).

In `npm run dev` the login screen shows a **Dev Demo Login** bar (Customer / Tech / Admin) that fills in
the demo accounts. A production build (`npm run build`) never shows it and never prefills credentials.

When an admin adds a customer or a technician, the server creates a random **temporary password** and
shows it to the admin once, in a pop-up. Pass it on to the person; they can change it in their profile.

---

## 4. How login works

- Login is checked against the `User` table: the email must exist and the password must match its
  bcrypt hash. There are no built-in or fallback users.
- A successful login returns a 15-minute access token and a 7-day refresh token. The web app stores them
  with Capacitor Preferences and refreshes them automatically.
- Every `/api` route needs a valid token, except: `GET /api/health`, `GET /api/config`,
  `POST /api/auth/register`, `POST /api/auth/login` and `POST /api/auth/refresh`.
- The printable report `GET /api/jobs/:id/pdf-report` opens in a new tab, so the app passes the token as
  `?token=...`. Without a valid token it returns `401`.
- Customers only see their own company, jobs, sites, invoices and redemptions. Technicians can only move
  jobs assigned to them, one step at a time (Accepted → Travelling → Arrived → In progress → Completed).
  Admin-only actions (add/edit/delete technicians, add customers, approve points, create invoices,
  reset jobs, read logs) return `403` for other roles. The menu only lists the screens your role can open.

### What is recorded in the database

| Table | What it stores |
| :--- | :--- |
| `LoginLog` | Every login success, failed login (with reason: `UNKNOWN_EMAIL`, `WRONG_PASSWORD`, `MISSING_FIELDS`), logout and rejected refresh token, with IP address and browser |
| `AuditLog` | Every change made through the API: who, what action, which record, and the before/after values (`diffJson`). Covers job creation, edits, assignment and status changes, plan/profile/password changes, cancellations, config changes, sites, points redemptions and approvals, invoices, technician create/edit/status/delete and customer create/delete |
| `JobStatusEvent` | Every status change of every job, with who made it and when. The service report timeline, response time and SLA result are built from it. `EmergencyRequest.workStartedAt` and `completedAt` give the labour time |

Admins can read them through the API:

- `GET /api/login-logs?limit=100&email=someone@example.com`
- `GET /api/audit-logs?limit=100&entityType=EmergencyRequest&entityId=<job id>`

---

## 5. Look inside the database

```bash
npx prisma studio
```

This opens a browser table editor at <http://localhost:5555> where you can view `User`, `LoginLog`,
`AuditLog`, `EmergencyRequest` and every other table.

---

## 6. Useful commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Start the web app with hot reload on port 3000 |
| `node server.js` (or `npm run server`) | Start the API on port 5000 |
| `npm test` | Run the API and shared-rules tests (uses its own `prisma/test.db`, so `dev.db` is not touched) |
| `npm run test:watch` | Re-run the tests on every save |
| `npm run build` | Build the web app into `dist/` |
| `npm run preview` | Serve the built `dist/` folder |
| `npx prisma db push` | Apply `schema.prisma` changes to the database |
| `npx prisma studio` | Browse and edit the database |
| `node prisma/seed.js` | Load demo data |
| `node clear_all_requests.js` | Delete all emergency requests and reset call-out counters |
| `npm run cap:build` | Build the web app and copy it into the Android project |
| `npm run cap:open` | Open the Android project in Android Studio |

### Start again with a clean database

Stop the API server, then:

```bash
del prisma\dev.db          # Windows (macOS/Linux: rm prisma/dev.db)
npx prisma db push
node prisma/seed.js
```

---

## 7. Configuration

| Setting | Default | How to change |
| :--- | :--- | :--- |
| API port | `5000` | `PORT` environment variable |
| JWT secrets | development defaults in `server/config/env.js` | `JWT_SECRET` and `JWT_REFRESH_SECRET` environment variables. **Always set these outside local development.** |
| Web app port | `3000` | `vite.config.js` |
| API address used by the web app | `http://localhost:5000/api` | `VITE_API_BASE` in a `.env.local` file (read by `src/shared/config/env.js`), then restart `npm run dev` |

Setting an environment variable for one run:

```bash
# PowerShell
$env:PORT=5050; node server.js
# Command Prompt
set PORT=5050 && node server.js
# macOS / Linux
PORT=5050 node server.js
```

---

## 8. Android app

```bash
npm run cap:build     # build + sync into android/
npm run cap:open      # open in Android Studio, then Run
```

On a phone or emulator, `localhost` means the device itself, so the app cannot reach the API on your PC.
Set `VITE_API_BASE` in `.env.local` to your PC's address (for example
`VITE_API_BASE=http://192.168.1.20:5000/api`; for the Android emulator use `http://10.0.2.2:5000/api`) and rebuild.

---

## 9. Project structure

```text
SA-Emergency-Cleaning/
├── server.js                  Starts the API (just imports server/index.js)
├── server/
│   ├── index.js               Checks production secrets, then listens on PORT
│   ├── app.js                 createApp(): middleware, routers, error handler (used by the tests too)
│   ├── config/env.js          PORT, JWT secrets, token lifetimes
│   ├── db/prisma.js           The one PrismaClient
│   ├── middleware/            authenticate (token + public routes), requireRole, validate (Zod), errorHandler
│   ├── lib/                   HttpError, audit and login logs, passwords, access checks, request helpers
│   └── modules/               One folder per domain: auth, config, customers, jobs, technicians,
│                              redemptions, invoices, analytics, logs, reports
│                              Each has *.routes.js -> *.controller.js -> *.service.js
├── shared/                    Rules used by BOTH the API and the web app
│   ├── jobStatus.js           Job statuses and the technician's allowed steps
│   ├── roles.js               Roles, which screens each role may open
│   ├── config.js              Default plans, call-outs per plan, points maths
│   ├── location.js            Adelaide / SA address check
│   └── schemas.js             Zod request schemas
├── src/
│   ├── main.jsx               React entry: installs the API client, renders <App />
│   ├── app/                   App.jsx (session, routing, top bar) and layout/NavigationSidebarDrawer.jsx
│   ├── features/              One folder per area; each index.js lists what other folders may import
│   │   ├── auth/              LoginPortal, CompanyRegistrationModal
│   │   ├── customer/          CustomerPortal, plan, profile, sites, cancel, points modals
│   │   ├── jobs/              New / edit emergency request, hotline booking
│   │   ├── technician/        TechnicianApp, TechnicianProfileModal
│   │   ├── admin/             AdminOperationsHub, dispatch, technician and job-detail modals, live map
│   │   └── config/            DynamicConfigStudio
│   ├── reports/serviceReport.js   jsPDF download and printable report
│   ├── shared/                api/client.js (token + refresh), config/env.js, constants/demoData.js
│   └── index.css              Tailwind + custom styles
├── tests/                     Vitest: tests/api (Supertest against createApp), tests/shared
├── prisma/
│   ├── schema.prisma          Database models
│   ├── seed.js                Demo data
│   └── dev.db                 Local SQLite database (created by db push)
├── android/                   Capacitor Android project
├── public/                    Static files (logo)
├── docs/                      Project map, tech spec, development plan, history
├── clear_all_requests.js      Reset script for emergency requests
├── capacitor.config.json      Mobile app id and settings
├── vitest.config.js           Test setup (test database, @ and @shared aliases)
└── vite.config.js             Vite + React + Tailwind, aliases @ -> src and @shared -> shared
```

### Where to put new code

- **A new API endpoint:** add it to the right `server/modules/<domain>/` folder: the route in `*.routes.js`
  (with `requireRole` and `validate(schema)`), a thin handler in `*.controller.js`, and the database work in
  `*.service.js`. Throw `HttpError` (for example `notFound('Job not found.')`) instead of writing responses.
- **A rule both sides need** (a status, a limit, a validation): put it in `shared/` and import it from the
  API and from the web app (`@shared/...`).
- **A new screen or modal:** put it in the feature folder it belongs to and export it from that folder's
  `index.js`. Other features import from `@/features/<name>`, never from a file deep inside another feature.

---

## 10. Troubleshooting

| Problem | Fix |
| :--- | :--- |
| Login fails with a server error mentioning `lastLoginAt`, `LoginLog` or `AuditLog` | The database is older than the schema. Run `npx prisma db push`, then restart `node server.js` |
| Login always says "Cannot reach the server" | The API is not running. Start `node server.js` and check <http://localhost:5000/api/health> |
| Login says "Invalid email or password" for a demo user | Run `node prisma/seed.js`. If you changed the password in the app, use the new one |
| `EADDRINUSE: address already in use :::5000` | Another copy of the server is running. Close it, or start with a different `PORT` |
| `npm install` fails with `ERESOLVE` | Make sure `package.json` has `@capacitor/preferences` at `^7.0.0` (it must match Capacitor 7), delete `node_modules`, run `npm install` again |
| Changes to `schema.prisma` not showing | Run `npx prisma db push` (it regenerates the Prisma client) and restart the server |

---

© 2026 SA Emergency Cleaning Pty Ltd. All rights reserved.

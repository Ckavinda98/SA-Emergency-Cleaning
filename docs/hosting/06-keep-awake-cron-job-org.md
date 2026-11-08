# 06 · Keep it awake with cron-job.org

**Goal:** two free scheduled "pings":

1. Every 10 minutes during the day, so Render does not fall asleep while the client is testing.
2. Once a day, so the Supabase project does not pause after 7 quiet days.

⏱️ About 10 minutes. You need: `API ADDRESS`.

> The ping uses `/api/health`, which does **not** touch the database. So Neon can still sleep and you do not
> use up its free compute-hours.

---

## Part A · Sign up

1. Go to **https://console.cron-job.org/signup** and create a free account. Confirm your email.
2. Click your name (top right) → **Settings** → **Time zone**: `Australia/Adelaide` → **Save**.

## Part B · Ping 1: keep the API awake (07:00–22:00)

1. **Cronjobs** → **Create cronjob**.
2. Fill in:

   | Field | Value |
   | :--- | :--- |
   | Title | `SACC API awake` |
   | URL | `https://sa-emergency-cleaning-api.onrender.com/api/health` |
   | Execution schedule | **Custom** |
   | Minutes | `0, 10, 20, 30, 40, 50` (every 10 minutes) |
   | Hours | `7` to `22` (select 7, 8, 9 … 22) |
   | Days of month / Months / Days of week | **Every** |

3. Open **Advanced**: **Request timeout** `30` seconds (the first call after a sleep is slow).
4. **Notifications**: tick **notify me when execution fails**.
5. **Create**.

> Why not 24 hours? Render gives 750 free hours a month, so it could run all month. But nobody tests at night,
> and letting it sleep saves free hours for anything else you host.

## Part C · Ping 2: keep Supabase active (daily)

1. **Create cronjob** again:

   | Field | Value |
   | :--- | :--- |
   | Title | `SACC storage daily` |
   | URL | `https://sa-emergency-cleaning-api.onrender.com/api/health/storage` |
   | Execution schedule | **Every day at** `09:00` |

2. **Create**.

## ✅ Check

- [ ] After 10 minutes, cronjob 1 shows a green **200** in its history.
- [ ] Use **Test run** on cronjob 2: it shows **200** and the response contains `"driver":"supabase"`.

Next: **[07 · Test everything and share](07-test-and-share.md)**

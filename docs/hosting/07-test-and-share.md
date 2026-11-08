# 07 · Test everything, then send the link

⏱️ About 45 minutes. Use a **private / incognito** browser window so you start like a new visitor.

## Part A · Test every role

Use the password you set as `SEED_PASSWORD` (guide 01 Part G).

| # | Log in as | Do this | You should see |
| :--- | :--- | :--- | :--- |
| 1 | — | Open the website after it has been quiet for 20+ minutes | Login page; "Server: Online" within about a minute |
| 2 | Customer `mahima@mahimaenterprises.com.au` | **New request**, add 2 photos and fill the form, **Send** | The request appears in **Requests** with the photos |
| 3 | — | Supabase → Storage → `sacc-files` → `uploads` | Your 2 photos |
| 4 | Customer `dross@adelaidetower.com.au` | Open **Requests** | Mahima's request is **not** there |
| 5 | Admin `admin@sacleaning.com.au` | Open the new request, acknowledge, assign **Dave** | Status changes |
| 6 | Technician `dave@sacleaning.com.au` | Accept → Travelling → Arrived → In progress; add before/after photos and a signature; Completed | Each step saves |
| 7 | Customer Mahima | Open the request → download the **service report PDF** | The PDF shows the photos and signature |
| 8 | Config `config@sacleaning.com.au` | Change a plan price, save | Saved |
| 9 | Admin | **Activity** log, search `plan` and then `PLAN` | Both find the change |
| 10 | — | Type a wrong password 11 times on the login page | The 11th says "Too many sign-in attempts" |

Then check the data really is in the cloud:

- **Neon** → your project → **Tables** (branch `main`): rows in `EmergencyRequest`, `JobStatusEvent`, `AuditLog`,
  `LoginLog`, `FileAttachment`.
- **Render** → service → **Metrics**: bandwidth is a few MB, not hundreds.

## Part B · Send the link to the client

Send the link and the logins in **two separate messages** (for example the link by email and the password by SMS).

> Hi *client name*,
>
> The test version of the SA Emergency Cleaning system is ready: **https://sa-emergency-cleaning-demo.netlify.app**
>
> Logins (one per role):
> - Customer: mahima@mahimaenterprises.com.au
> - Technician: dave@sacleaning.com.au
> - Admin: admin@sacleaning.com.au
> - Config: config@sacleaning.com.au
>
> (I'll text you the password separately.)
>
> A good path to try: log in as the customer and raise an emergency request with a photo. Log in as admin and
> assign Dave. Log in as Dave and move the job through to Completed. Then go back to the customer and download
> the service report.
>
> This runs on free test servers, so the first page can take up to a minute to wake up after a quiet period.
> Please use test data only. Everything you enter is saved, and I can reset it at any time.

Every login is recorded in the `LoginLog` table, so you can see when the client has tried it.

## Part C · Watch the free limits (first week)

| Where | What to look at | Free limit |
| :--- | :--- | :--- |
| Render → Metrics | Bandwidth | 5 GB / month |
| Neon → Billing / Usage | Compute hours, storage | 100 h, 0.5–1 GB |
| Supabase → Usage | Storage, egress | 1 GB, 5 GB / month |
| Netlify → Usage | Credits | 300 / month |

## Part D · Reset the demo later

From your PC, put the `main` strings in `.env` (as in guide 01 Part G), then:

```bat
npm run db:reset
```

This deletes everything in `main` and loads the demo data again (with your `SEED_PASSWORD`).
Then Supabase → Storage → `sacc-files` → select the `uploads` folder → **Delete**.

**Put the `dev` strings back in `.env` afterwards**, so your own testing never touches the client's data.

> Undo a mistake: Neon keeps 6 hours of history on the free plan. Neon → **Branches** → `main` → **Restore**
> lets you go back to a time within those 6 hours.

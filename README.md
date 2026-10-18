# Events

An event registration app. People browse events, register, and get a QR ticket. Organizers create events, see who's coming, and check people in at the door by scanning tickets with their phone.

It's a portfolio project, so the people and events are made up and the data resets every day. You can sign in as a sample attendee or organizer from the login page without making an account.

## What it does

**For attendees**
- Browse upcoming events, search by title or city, and filter by category or date
- Register in one click. When an event is full you join the waitlist and see your place in line
- Get a ticket with a QR code. Online events only show the meeting link once you have a confirmed spot
- Cancel or leave the waitlist. If you give up a spot, the next person in line gets it automatically
- An inbox page shows every email the app would send you (confirmations, waitlist updates, reminders, cancellations)

**For organizers**
- Create events as drafts or publish right away, edit them, cancel them
- A dashboard with going, waitlist, checked-in, and cancelled counts, plus a chart of sign-ups per day
- Attendee list with filters and search, and a CSV export
- A check-in page that scans QR tickets with the phone camera, or takes the code typed in by hand. It catches tickets that were already used, cancelled, still waitlisted, or for a different event
- Raising the capacity moves people off the waitlist. Changing the time or place emails everyone

## How it's built

- **Next.js 16** (App Router, React Server Components) and **Tailwind CSS**
- **Hono** for the API, mounted at `/api` inside Next. The pages call it in process from the server and over HTTP from the browser, through Hono's typed client, so the UI and the API share one set of types
- **PostgreSQL** with **Drizzle ORM** and SQL migrations. Locally and in tests it runs on **PGlite** (Postgres compiled to WebAssembly), so there's nothing to install
- **Zod** for request validation, **Vitest** for tests, **GitHub Actions** for CI
- Auth is written by hand: scrypt password hashes, random session tokens stored as SHA-256 hashes, httpOnly cookies

```text
src/
  app/                  pages, plus app/api/[[...route]] which hands requests to Hono
  components/           UI pieces; organizer/ holds the dashboard, form, and scanner
  lib/                  typed API clients, date helpers (all times are Manila time)
  server/
    app.ts              the Hono app: middleware, routes, error handling
    routes/             auth, events, organizer, me, cron
    services/           the actual logic: registrations, waitlist, check-in, stats, emails
    db/                 schema and database connections
    seed.ts             the sample data
    test/               API tests
drizzle/                generated SQL migrations
```

## Parts worth a closer look

**No overselling.** Registering locks the event row (`SELECT ... FOR UPDATE`) before counting seats, so two people can't both take the last one. A test fires 20 registrations at a 5-seat event at the same time and checks that exactly 5 are confirmed and the other 15 are waitlisted in order. CI runs it against a real Postgres server too.

**Waitlist order.** The waitlist is ordered by a database sequence, not a timestamp. Timestamps can tie when people sign up at the same moment, and a sequence can't.

**Emails saved with the change that caused them.** Emails are written to an `emails` table in the same transaction as the registration or cancellation, then sent after it commits. If the transaction rolls back, no email goes out. Without a Resend key they just stay in the table, which is what the demo inbox reads.

**CSV export that's safe to open.** Names starting with `=`, `+`, `-`, or `@` get a leading apostrophe so spreadsheet apps don't run them as formulas. There's a test with a `=HYPERLINK(...)` name.

**Tests hit the real API.** The tests send HTTP requests to the Hono app backed by a fresh Postgres per test file: auth, rate limiting, CSRF, waitlist promotion, permissions, check-in rules, stats, and the export. Run them with `npm test`.

## Running it locally

Needs Node 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first request creates a local database in `.data/` and loads the sample data. To start over, stop the dev server and run `npm run db:reset`.

Other commands:

```bash
npm test            # API tests
npm run typecheck
npm run lint
npm run db:generate # new migration after editing src/server/db/schema.ts
```

## Deploying for free

Import the repo on [Vercel](https://vercel.com) (Hobby plan) and add `CRON_SECRET` (any long random string) as an environment variable. Two daily cron jobs reset the demo at midnight Manila time and send reminders for the next day's events.

**Without a database.** If `DATABASE_URL` isn't set, the API runs an in-memory Postgres (PGlite) and loads the sample data when it starts, booting from a snapshot the build saves. Pages get their data from the API over HTTP in this mode, since Vercel runs them as separate functions that would otherwise each have their own copy. It's the quickest way to get a live demo, but anything visitors add disappears whenever Vercel restarts the instance.

**With a database.** Create a free Postgres database on [Neon](https://neon.tech), copy the pooled connection string, and add it as `DATABASE_URL`. On the next deploy the build applies migrations and loads the sample data if the database is empty (see `vercel.json`). From then on, data stays put until the daily reset.

To send real emails, add `RESEND_API_KEY` and `EMAIL_FROM` from a free [Resend](https://resend.com) account. Resend only delivers to domains you've verified, so the made-up sample addresses still only show up in the inbox page.

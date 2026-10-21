# The Grass Wiz — Job Calendar

A web app for scheduling landscaping jobs, managing the team, tracking attendance and producing payslips.
It is a static site (plain HTML/CSS/JS) that talks directly to [Supabase](https://supabase.com) for the
database, file storage and login. There is no server to run.

## What it does
- **Calendar** — monthly view, daily job list, upcoming jobs, search, recurring jobs (weekly, every 2 weeks, monthly, last Thursday/Friday).
- **Stat boxes** — click Jobs Completed, Upcoming, Recurring or Due for Next Service to open the list behind the number, with a month slider for completed jobs. From there: **Book Again** (new job pre-filled from an old one), **Make Recurring**, Print, Edit, Reschedule, Complete, Cancel.
- **Customers (phone number first)** — the phone number identifies the customer. Type a known number in the Add form (any format: `876-555-1234`, `8765551234`, `+1 876 555 1234`, or a 7-digit local number) and the name, address, directions and zone fill in. Changing a name, number or address on a customer updates the customer for **new** bookings; old jobs keep the details they were booked with, and the old values stay searchable. Click a name in the search dropdown to open the customer (edit details, see the change history, Schedule Job / Book Inspection).
- **Customer filter** — the dropdown above the stat boxes lists every customer with their job count (jobs only; inspections and cancelled jobs are not counted). Pick one to see just their bookings on the calendar and sidebar.
- **Customers tab** — everyone grouped by tier (Royal Reserve, Prestige, Select, then Seedling for customers under 3 jobs), each with a colour badge and progress to the next tier. The search box filters by name, phone (any format, old numbers too) or address; click a card to open the customer, or Schedule Job.
- **Membership tiers** — customers earn a discount by completed jobs (inspections and cancelled jobs do not count): **Select** (Bermuda) 3–5 jobs = 5%, **Prestige** (Zoysia) 6–11 = 10%, **Royal Reserve** (St. Augustine) 12+ = 20%. The tier shows on job cards, the booking form, the customer window, the customer filter and the printed job order. To change tiers or percentages edit the list at the top of `js/membership.js`.
- **Site inspections** — the Add form has a **Schedule Job / Site Inspection** switch (same fields, no recurring options). Inspections show on the calendar (purple, 🔍) and have their own **Inspections** tab (Upcoming / Past due / Completed / All) with Complete, Reschedule, **Schedule Job** (turns it into a job) and a short printable inspection sheet. They are not counted in the job stat boxes.
- **Jobs** — customer, address, zone, services, technician, remarks; complete / reschedule / cancel; printable job order.
- **Team & Payroll** — employee records and documents, attendance calendar, payslips with history ([how pay is calculated](docs/PAYROLL.md)).
- **Login** — email + password; every page and all data require a signed-in user.

## Project layout
```
grass_wiz_calendar/        <- the website (this folder is what you deploy)
  index.html               the app
  login.html               sign-in / forgot password
  reset-password.html      page the reset-email link opens
  css/                     styles (base, header, components, calendar, team, modals, responsive, auth)
  js/
    supabase-client.js     Supabase URL + public key
    db.js                  every database / storage call
    auth.js                session check, sign in / out
    utils.js, state.js     helpers (dates, escaping, recurrence) and shared state
    theme.js, calendar.js, actions.js, inspections.js, membership.js, customers-tab.js, customers.js, customer-ui.js, jobs.js, team.js, attendance.js, payroll.js, print.js   one file per feature
    app.js                 start-up (runs last)
    login.js, reset-password.js
  sql/                     database scripts, run in order (see docs/SETUP.md)
docs/                      SETUP.md, PAYROLL.md, LEGACY_SERVER.md
server.js, package.json    OLD Express/MySQL API — not used by the app (see docs/LEGACY_SERVER.md)
legacy/                    archived older copy of the server
```

## Getting started
Follow [docs/SETUP.md](docs/SETUP.md): create the Supabase project, run the SQL scripts, create user accounts, deploy to Netlify.

## Changing the code
No build step. Edit the files in `grass_wiz_calendar/` and reload. To try it locally, serve that folder
(for example `python3 -m http.server` inside it) and open `http://localhost:8000/login.html`.
Script order matters in `index.html`; `js/app.js` must stay last.

# Setup

Do these once, in order. You need a free Supabase account and (to publish) a Netlify account.

## 1. Create the Supabase project
1. [supabase.com](https://supabase.com) → **New project**. Pick a region near Jamaica and save the database password.
2. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
3. Put both into `grass_wiz_calendar/js/supabase-client.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
   The anon key is meant to be public; what protects your data is the login plus the policies in step 3.

## 2. Create the database
**SQL Editor → New query**, paste and run each file from `grass_wiz_calendar/sql/` in this order:

| File | What it does | When |
|---|---|---|
| `01-schema.sql` | Creates the tables and access rules (signed-in users only) | New project |
| `02-auth-policies.sql` | Replaces any old "allow everyone" rules with signed-in-only rules and makes the `documents` storage bucket private | Existing project that was set up before the login existed (harmless to run on a new one) |
| `03-payslip-gross.sql` | Adds the `gross_pay` column used for year-to-date gross | Existing project created before this column existed |
| `04-customers-inspections.sql` | Adds `customers`, the customer change log and site inspections (`jobs.kind`, `jobs.customer_id`), and turns your existing jobs into customer records | Needed for the phone-number lookup and Site Inspections |

All of them can be re-run safely.

**Already have a working database?** Skip the table above and run just `apply-all-updates.sql`. It does steps 02, 03 and 04 in one go and prints a check of the result.

## 3. Storage and accounts
1. **Storage**: if `02-auth-policies.sql` was not run, create a **private** bucket named `documents` (employee IDs and contracts go here).
2. **Authentication → Users → Add user → Create new user**: one per person, tick *Auto Confirm User*. There is no public sign-up.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up". Otherwise anyone could register using the public key.
4. **Authentication → URL Configuration**: set **Site URL** to your Netlify address and add `https://YOUR-SITE/reset-password.html` to **Redirect URLs** (needed for "Forgot password").

## 4. Deploy
**Drag and drop:** at [app.netlify.com/drop](https://app.netlify.com/drop), drop the whole `grass_wiz_calendar` folder.
**From GitHub:** Add new site → Import project; Base directory and Publish directory both `grass_wiz_calendar`; no build command.

## 5. Check it works
Open the site → you land on the sign-in page → sign in → add a job, add an employee, upload a document. Press F12 and check the Console for red errors if something fails.

## Troubleshooting
- **"Incorrect email or password"** — check the user exists and is confirmed (Authentication → Users).
- **Red banner "permission denied" / error 42501 / empty calendar** — the tables are missing permissions for signed-in users. Run `sql/apply-all-updates.sql` (it includes the fix), then reload.
- **Signed in but no data / errors in the console** — the SQL scripts were not run, or the URL/key in `js/supabase-client.js` belong to a different project.
- **Document won't open** — confirm the `documents` bucket exists and the storage policies from `02-auth-policies.sql` are present.
- **Forgot-password link says invalid or expired** — the Redirect URL in step 3.4 is missing, or the link was already used. Request a new one.
- **Reset someone's password yourself** — Authentication → Users → the user → Send password recovery.

## Good to know
- Every signed-in user can see everything, including Team & Payroll. Per-role access (for example, admins only) would be a future change.
- The code inside the app that unlocks past attendance uses a fixed password stored in `js/attendance.js`. Treat it as a speed bump, not security, and change it if staff should not know it.

## Customers and inspections (what the upgrade does)
- Run `sql/apply-all-updates.sql` **before** deploying this version. Until then the app still saves ordinary jobs (without the customer link), but Site Inspections will say the database needs the upgrade.
- Inspections live in the `jobs` table with `kind = 'inspection'`; ordinary jobs have `kind = 'job'`.
- Existing jobs are grouped into customers by phone number (jobs with no phone are grouped by name). If one number appears under several names, the most recent job's details become the customer record; every old job keeps its own name/address.
- Two people sharing a phone number are one customer record. Edit the name in the customer window or when booking if the household changes.
- The check query at the end of the script shows how many customers were created and how many jobs are not linked (should be 0).

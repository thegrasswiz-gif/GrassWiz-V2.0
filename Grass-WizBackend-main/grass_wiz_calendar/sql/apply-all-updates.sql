-- ============================================================
-- THE GRASS WIZ — ONE-STEP DATABASE UPDATE
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once. It does not delete any data.
--
-- What it does
--   0. Gives the signed-in role permission to use the tables (fixes
--      "permission denied for table jobs")
--   1. Only signed-in users can read or change jobs, employees,
--      attendance and payslips (removes the old "allow everyone" rules)
--   2. Makes the 'documents' bucket private, signed-in users only
--   3. Adds payslips.gross_pay (used for year-to-date gross) and
--      payslips.details (full breakdown so history can reprint a payslip)
--   4. Adds customers (found by phone number), the customer change log and
--      site inspections (jobs.kind), and links existing jobs to customers
--   5. Restricts attendance edits older than 7 days to admin accounts
--
-- Run it AFTER you have created at least one user under
-- Authentication > Users, otherwise nobody can sign in to see the data.
-- ============================================================


-- 0) TABLE PERMISSIONS FOR SIGNED-IN USERS --------------------------------
-- Row Level Security decides WHICH rows a user may touch; GRANT decides whether the
-- signed-in role may touch the table at all. Newer Supabase projects do not grant this
-- automatically, which shows up as: "permission denied for table jobs" (error 42501).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs, public.technicians, public.attendance, public.payslips TO authenticated;
-- Visitors who are not signed in get nothing
REVOKE ALL ON public.jobs, public.technicians, public.attendance, public.payslips FROM anon;


-- 1) TABLE ACCESS: SIGNED-IN USERS ONLY ---------------------------------
ALTER TABLE jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to jobs"        ON jobs;
DROP POLICY IF EXISTS "Allow all access to technicians" ON technicians;
DROP POLICY IF EXISTS "Allow all access to attendance"  ON attendance;
DROP POLICY IF EXISTS "Allow all access to payslips"    ON payslips;

DROP POLICY IF EXISTS "Authenticated access to jobs"        ON jobs;
DROP POLICY IF EXISTS "Authenticated access to technicians" ON technicians;
DROP POLICY IF EXISTS "Authenticated access to attendance"  ON attendance;
DROP POLICY IF EXISTS "Authenticated access to payslips"    ON payslips;

CREATE POLICY "Authenticated access to jobs"        ON jobs        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to technicians" ON technicians FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to attendance"  ON attendance  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to payslips"    ON payslips    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2) EMPLOYEE DOCUMENTS: PRIVATE BUCKET, SIGNED-IN USERS ONLY ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated read documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documents" ON storage.objects;

CREATE POLICY "Authenticated read documents"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated update documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated delete documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');


-- 3) PAYSLIPS: GROSS PAY + BREAKDOWN COLUMNS ----------------------------
-- gross_pay = basic pay + bonus, before deductions. Older payslips stay NULL
-- and the app uses their net pay when adding up year-to-date.
-- details = JSON snapshot of the payslip at generation time, so the history
-- view can reprint the full slip instead of a summary.
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS gross_pay DECIMAL(10,2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS details JSONB;


-- 4) CUSTOMERS + SITE INSPECTIONS ---------------------------------------
--    customers table (looked up by phone), change log, jobs.kind ('job' | 'inspection'),
--    jobs.customer_id, and a backfill that turns existing jobs into customer records.
--    Jobs keep their own copy of name/phone/address, so old records never change.

-- 4a) Phone number -> comparison key (digits only; matches the app) -----
--    876-555-1234, 8765551234 and +1 876 555 1234 all become 8765551234.
--    A leading 1 on an 11-digit number is dropped; 7-digit local numbers are treated as 876.
CREATE OR REPLACE FUNCTION public.gw_phone_key(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d = '' THEN NULL
    WHEN length(d) = 11 AND left(d, 1) = '1' THEN substr(d, 2)
    WHEN length(d) = 7 THEN '876' || d
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS d) s
$$;

-- 4b) Tables --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    phone_key TEXT,
    email TEXT,
    address TEXT,
    directions TEXT,
    zone TEXT,
    yard_size TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- one customer per phone number
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_key_uq ON customers(phone_key) WHERE phone_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_changes (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    field TEXT NOT NULL,            -- 'name' | 'phone' | 'address'
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_customer_changes_customer ON customer_changes(customer_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'job' CHECK (kind IN ('job', 'inspection'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_kind ON jobs(kind);

-- 4c) Permissions: signed-in users only -----------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.customer_changes TO authenticated;
REVOKE ALL ON public.customers, public.customer_changes FROM anon;

ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access to customers"        ON customers;
DROP POLICY IF EXISTS "Authenticated access to customer_changes" ON customer_changes;
CREATE POLICY "Authenticated access to customers"        ON customers        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to customer_changes" ON customer_changes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4d) Backfill: one customer per phone number from existing jobs ----------
--    Jobs without a phone number are grouped by customer name instead.
--    When one number appears under several names, the most recent job wins.
WITH ranked AS (
    SELECT j.*,
           public.gw_phone_key(j.phone) AS pk,
           COALESCE(public.gw_phone_key(j.phone), 'name:' || lower(trim(j.customer))) AS grp,
           row_number() OVER (
               PARTITION BY COALESCE(public.gw_phone_key(j.phone), 'name:' || lower(trim(j.customer)))
               ORDER BY j.job_date DESC, j.created_at DESC
           ) AS rn
    FROM jobs j
    WHERE j.customer_id IS NULL
)
INSERT INTO customers (id, name, phone, phone_key, email, address, directions, zone, yard_size)
SELECT 'c_' || md5(grp), customer, phone, pk, email, address, directions, zone, yard_size
FROM ranked WHERE rn = 1
ON CONFLICT DO NOTHING;

-- 4e) Link existing jobs to their customer ---------------------------------
UPDATE jobs
SET customer_id = 'c_' || md5(COALESCE(public.gw_phone_key(phone), 'name:' || lower(trim(customer))))
WHERE customer_id IS NULL
  AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = 'c_' || md5(COALESCE(public.gw_phone_key(jobs.phone), 'name:' || lower(trim(jobs.customer))))
  );


-- 5) ATTENDANCE: ONLY ADMINS EDIT RECORDS OLDER THAN 7 DAYS ------------
--    admins table (emails only), gw_is_admin() helper, and per-action policies.
CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- deliberately no policies on admins: it is only read through gw_is_admin()
-- (SECURITY DEFINER), so the admin list is not visible in the app

-- The admin accounts. Add more rows for other admins.
INSERT INTO admins (email) VALUES ('thegrasswizz@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gw_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email'));
$$;

DROP POLICY IF EXISTS "Authenticated access to attendance" ON attendance;

CREATE POLICY "Signed-in users read attendance" ON attendance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Recent attendance insert" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7);

CREATE POLICY "Recent attendance update" ON attendance
  FOR UPDATE TO authenticated
  USING (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7)
  WITH CHECK (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7);

CREATE POLICY "Admins delete attendance" ON attendance
  FOR DELETE TO authenticated USING (public.gw_is_admin());


-- 6) CHECK THE RESULT (shows in the results panel) ----------------------
SELECT 'tables'  AS area, tablename AS name, policyname AS detail
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('jobs','technicians','attendance','payslips','customers','customer_changes')
UNION ALL
SELECT 'admins', 'admin accounts', count(*)::text FROM admins
UNION ALL
SELECT 'storage', 'documents bucket is public = ' || public::text, ''
FROM storage.buckets WHERE id = 'documents'
UNION ALL
SELECT 'payslips', 'gross_pay column', data_type
FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'gross_pay'
UNION ALL
SELECT 'payslips', 'details column', data_type
FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'details'
UNION ALL
SELECT 'customers', 'customers created', count(*)::text FROM customers
UNION ALL
SELECT 'customers', 'jobs not linked to a customer', count(*)::text FROM jobs WHERE customer_id IS NULL
ORDER BY 1, 2;

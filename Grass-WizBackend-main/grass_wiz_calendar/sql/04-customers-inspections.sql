-- ============================================================
-- CUSTOMERS + SITE INSPECTIONS
-- Run once in Supabase > SQL Editor. Safe to run more than once.
--
--  * customers          one row per customer, looked up by phone number
--  * customer_changes   log of every change to a customer's name / phone / address
--                       (so old numbers still find the customer, and history is kept)
--  * jobs.kind          'job' (default) or 'inspection' - site inspections share the jobs table
--  * jobs.customer_id   links each job / inspection to its customer
-- Existing jobs are turned into customer records automatically (step 5).
-- Jobs and inspections keep their OWN copy of name / phone / address, so changing
-- a customer later never rewrites old records.
-- ============================================================

-- 1) Phone number -> comparison key (digits only; matches the app) -----
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

-- 2) Tables --------------------------------------------------------------
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

-- 3) Permissions: signed-in users only -----------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.customer_changes TO authenticated;
REVOKE ALL ON public.customers, public.customer_changes FROM anon;

ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access to customers"        ON customers;
DROP POLICY IF EXISTS "Authenticated access to customer_changes" ON customer_changes;
CREATE POLICY "Authenticated access to customers"        ON customers        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to customer_changes" ON customer_changes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Backfill: one customer per phone number from existing jobs ----------
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

-- 5) Link existing jobs to their customer ---------------------------------
UPDATE jobs
SET customer_id = 'c_' || md5(COALESCE(public.gw_phone_key(phone), 'name:' || lower(trim(customer))))
WHERE customer_id IS NULL
  AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = 'c_' || md5(COALESCE(public.gw_phone_key(jobs.phone), 'name:' || lower(trim(jobs.customer))))
  );

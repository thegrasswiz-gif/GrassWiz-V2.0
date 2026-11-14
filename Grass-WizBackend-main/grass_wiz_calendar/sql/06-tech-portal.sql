-- ============================================
-- TECH PORTAL: technicians sign in and see only their own jobs
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- A technician's login is a normal Supabase Auth user whose email matches
-- the Email on their employee record. This script:
--   1. Adds gw_my_tech_name(): the signed-in user's technician name,
--      or NULL for office accounts (anyone not on the team list)
--   2. Adds gw_complete_my_job(): lets a technician mark one of THEIR OWN
--      jobs Completed with closing remarks — nothing else can be changed
--   3. Re-scopes the access rules:
--      - jobs: techs READ only their own; writing/deleting is staff only
--      - technicians, attendance, payslips, customers, customer_changes:
--        staff only — techs cannot see payroll or other people's records
--      - staff = admin (admins table) or any account not on the team list,
--        so every existing office login keeps full access unchanged
-- ============================================

-- Admin accounts (kept here too so this file works on a database that never
-- ran sql/05-attendance-admin-lock.sql — the inserts are skipped if present)
CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
INSERT INTO admins (email) VALUES ('thegrasswizz@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gw_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE email = (auth.jwt() ->> 'email'));
$$;

-- 1) WHO IS THIS USER ON THE TEAM LIST? -----------------------------------
-- Returns the technician's name for the signed-in email, NULL for office staff.
-- jobs.technician holds the technician's name, so this links login -> jobs.
CREATE OR REPLACE FUNCTION public.gw_my_tech_name() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name FROM public.technicians
  WHERE email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email')
  LIMIT 1;
$$;

-- Staff = admin, or an account that is not linked to any technician
CREATE OR REPLACE FUNCTION public.gw_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.gw_is_admin() OR public.gw_my_tech_name() IS NULL;
$$;

-- 2) THE ONLY WRITE A TECHNICIAN GETS --------------------------------------
-- Completes one of the caller's own open jobs. Can set status + closing
-- remarks and nothing else, and only on a job assigned to them.
CREATE OR REPLACE FUNCTION public.gw_complete_my_job(p_job_id text, p_remarks text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.jobs
  SET status = 'Completed', closing_remarks = nullif(trim(p_remarks), '')
  WHERE id = p_job_id
    AND technician = public.gw_my_tech_name()
    AND status <> 'Cancelled';
  RETURN FOUND;
END;
$$;

-- 3) ACCESS RULES ----------------------------------------------------------

-- jobs: techs read only their own; all writing is staff-only
DROP POLICY IF EXISTS "Authenticated access to jobs" ON jobs;
DROP POLICY IF EXISTS "Staff read all jobs, techs read own" ON jobs;
DROP POLICY IF EXISTS "Staff insert jobs" ON jobs;
DROP POLICY IF EXISTS "Staff update jobs" ON jobs;
DROP POLICY IF EXISTS "Staff delete jobs" ON jobs;

CREATE POLICY "Staff read all jobs, techs read own" ON jobs
  FOR SELECT TO authenticated
  USING (public.gw_is_staff() OR technician = public.gw_my_tech_name());

CREATE POLICY "Staff insert jobs" ON jobs
  FOR INSERT TO authenticated WITH CHECK (public.gw_is_staff());

CREATE POLICY "Staff update jobs" ON jobs
  FOR UPDATE TO authenticated
  USING (public.gw_is_staff()) WITH CHECK (public.gw_is_staff());

CREATE POLICY "Staff delete jobs" ON jobs
  FOR DELETE TO authenticated USING (public.gw_is_staff());

-- attendance: the rules from 05-attendance-admin-lock.sql, now staff-only
DROP POLICY IF EXISTS "Authenticated access to attendance" ON attendance;
DROP POLICY IF EXISTS "Signed-in users read attendance" ON attendance;
DROP POLICY IF EXISTS "Recent attendance insert" ON attendance;
DROP POLICY IF EXISTS "Recent attendance update" ON attendance;
DROP POLICY IF EXISTS "Admins delete attendance" ON attendance;

CREATE POLICY "Staff read attendance" ON attendance
  FOR SELECT TO authenticated USING (public.gw_is_staff());

CREATE POLICY "Staff insert recent attendance" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.gw_is_admin()
              OR (public.gw_my_tech_name() IS NULL
                  AND date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7));

CREATE POLICY "Staff update recent attendance" ON attendance
  FOR UPDATE TO authenticated
  USING (public.gw_is_admin()
         OR (public.gw_my_tech_name() IS NULL
             AND date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7))
  WITH CHECK (public.gw_is_admin()
              OR (public.gw_my_tech_name() IS NULL
                  AND date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7));

CREATE POLICY "Admins delete attendance" ON attendance
  FOR DELETE TO authenticated USING (public.gw_is_admin());

-- payroll, team records and customers: staff only
DROP POLICY IF EXISTS "Authenticated access to technicians" ON technicians;
DROP POLICY IF EXISTS "Authenticated access to payslips" ON payslips;
DROP POLICY IF EXISTS "Authenticated access to customers" ON customers;
DROP POLICY IF EXISTS "Authenticated access to customer_changes" ON customer_changes;

CREATE POLICY "Staff access to technicians" ON technicians
  FOR ALL TO authenticated USING (public.gw_is_staff()) WITH CHECK (public.gw_is_staff());
CREATE POLICY "Staff access to payslips" ON payslips
  FOR ALL TO authenticated USING (public.gw_is_staff()) WITH CHECK (public.gw_is_staff());
CREATE POLICY "Staff access to customers" ON customers
  FOR ALL TO authenticated USING (public.gw_is_staff()) WITH CHECK (public.gw_is_staff());
CREATE POLICY "Staff access to customer_changes" ON customer_changes
  FOR ALL TO authenticated USING (public.gw_is_staff()) WITH CHECK (public.gw_is_staff());

-- employee documents bucket: staff only
DROP POLICY IF EXISTS "Authenticated read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documents" ON storage.objects;

CREATE POLICY "Staff read documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents' AND public.gw_is_staff());
CREATE POLICY "Staff upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.gw_is_staff());
CREATE POLICY "Staff update documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND public.gw_is_staff());
CREATE POLICY "Staff delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.gw_is_staff());

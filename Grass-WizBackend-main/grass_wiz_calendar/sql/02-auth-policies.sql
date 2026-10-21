-- ============================================
-- LOCK THE DATABASE TO SIGNED-IN USERS
-- Run once in the Supabase SQL Editor after adding the login.
-- Safe to re-run.
--
-- Before this, the "Allow all access" policies let ANYONE with the public
-- anon key (it is visible in the page source) read and change every job,
-- employee record (TRN/NIS) and payslip. After this, only signed-in users can.
-- ============================================

-- 0) Table permissions FOR SIGNED-IN USERS --------------------------------
-- Row Level Security decides WHICH rows a user may touch; GRANT decides whether the
-- signed-in role may touch the table at all. Newer Supabase projects do not grant this
-- automatically, which shows up as: "permission denied for table jobs" (error 42501).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs, public.technicians, public.attendance, public.payslips TO authenticated;
-- Visitors who are not signed in get nothing
REVOKE ALL ON public.jobs, public.technicians, public.attendance, public.payslips FROM anon;

-- 1) Tables --------------------------------------------------------------
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

-- 2) Employee documents bucket: private, signed-in users only ------------
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

-- NOTE: if you created other policies on storage.objects for the 'documents'
-- bucket earlier (e.g. a public-read or anon-upload policy), delete them under
-- Storage > Policies, otherwise they still apply.

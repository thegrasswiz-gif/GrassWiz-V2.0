-- ============================================
-- ATTENDANCE: only admins may change records older than 7 days
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Creates an admins table (just the admin emails), a gw_is_admin()
-- helper the app and the policies can call, and replaces the attendance
-- access rules:
--   - every signed-in user can READ attendance
--   - any signed-in user can mark attendance for the last 7 days
--   - only admins can add or change older records, or delete any record
-- The app's "Unlock Past" button calls gw_is_admin() instead of asking
-- for a password.
-- ============================================

CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- deliberately no policies: the table is only read through gw_is_admin()
-- below (SECURITY DEFINER), so even the list of admins is not visible in the app

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

-- 7 days, counted in Jamaica time (the app's own cut-off; no DST there)
CREATE POLICY "Recent attendance insert" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7);

CREATE POLICY "Recent attendance update" ON attendance
  FOR UPDATE TO authenticated
  USING (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7)
  WITH CHECK (public.gw_is_admin() OR date >= (now() AT TIME ZONE 'America/Jamaica')::date - 7);

CREATE POLICY "Admins delete attendance" ON attendance
  FOR DELETE TO authenticated USING (public.gw_is_admin());

-- ============================================
-- PAYSLIPS: store the full payslip breakdown so history can reprint it
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- details = JSON snapshot of the payslip at generation time: employee
-- name, department, NIS, TRN, basic pay, bonus, tax, salary advance,
-- absences and days worked. Payslips saved before this change have NULL
-- here, and the app still shows them in the old summary format.
-- ============================================
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS details JSONB;

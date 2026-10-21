-- ============================================
-- PAYSLIPS: store gross pay so year-to-date gross is calculated correctly
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- gross_pay = basic pay + bonus, before deductions.
-- Payslips saved before this change have NULL here; the app treats them as
-- net_pay when adding up the year-to-date figure.
-- ============================================
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS gross_pay DECIMAL(10,2);

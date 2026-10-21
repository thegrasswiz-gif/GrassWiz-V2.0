-- ============================================
-- SUPABASE DATABASE SETUP
-- Run this in your Supabase SQL Editor
-- ============================================

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    directions TEXT,
    technician TEXT,
    property_areas TEXT,
    services_required TEXT,
    other_service TEXT,
    zone TEXT,
    yard_size TEXT,
    garden_count INT,
    job_date DATE NOT NULL,
    start_time VARCHAR(10),
    duration INT,
    status VARCHAR(20) DEFAULT 'Scheduled',
    reminder INT,
    repeat_schedule VARCHAR(20),
    repeat_until DATE,
    closing_remarks TEXT,
    customer_remarks TEXT,
    recommendations TEXT,
    supervisor_remarks TEXT,
    reminded JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technicians table
CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    department TEXT,
    employment_status VARCHAR(20) DEFAULT 'Trial',
    base_monthly_rate DECIMAL(10,2) DEFAULT 100000.00,
    hire_date DATE,
    probation_end_date DATE,
    nis TEXT,
    trn TEXT,
    license_number TEXT,
    notes TEXT,
    document_path TEXT,
    termination_reason TEXT,
    termination_date DATE,
    rehire_eligible BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    tech_id TEXT REFERENCES technicians(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tech_id, date)
);

-- Payslips table
CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    tech_id TEXT REFERENCES technicians(id) ON DELETE CASCADE,
    period_end DATE,
    period_num INT,
    gross_pay DECIMAL(10,2),
    net_pay DECIMAL(10,2),
    ytd_gross DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Permissions: only the signed-in role may use the tables (newer Supabase projects need this explicitly)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs, public.technicians, public.attendance, public.payslips TO authenticated;
REVOKE ALL ON public.jobs, public.technicians, public.attendance, public.payslips FROM anon;

-- Access policies: signed-in users only.
-- (Already have data and the old "allow all" policies? Run 02-auth-policies.sql instead.)
CREATE POLICY "Authenticated access to jobs" ON jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to technicians" ON technicians FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated access to payslips" ON payslips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(job_date);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(technician);
CREATE INDEX IF NOT EXISTS idx_attendance_tech ON attendance(tech_id);
CREATE INDEX IF NOT EXISTS idx_payslips_tech ON payslips(tech_id);

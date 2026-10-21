require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// LEGACY API. The calendar app now talks to Supabase directly and does not use
// this server. It is kept for reference / existing deployments, and locked down:
// every /api and /uploads request needs the X-API-Key header.
// ---------------------------------------------------------------------------
const crypto = require('crypto');

const API_KEY = process.env.API_KEY;
if (!API_KEY || API_KEY.length < 16) {
  console.error('Refusing to start: set API_KEY (16+ characters) in the environment / .env file.');
  process.exit(1);
}
if (!process.env.DB_PASSWORD) {
  console.error('Refusing to start: set DB_PASSWORD in the environment / .env file.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// Only the origins listed in ALLOWED_ORIGINS (comma separated) may call this API from a browser
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: '1mb' }));

function requireApiKey(req, res, next) {
  const given = Buffer.from(String(req.get('x-api-key') || ''));
  const wanted = Buffer.from(API_KEY);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
app.use('/api', requireApiKey);
app.use('/uploads', requireApiKey);

// Log the real error, send the client a generic one (messages can expose table/column names)
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^A-Za-z0-9._-]+/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },                    // 10 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'))
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET all jobs (aliased to match frontend field names)
app.get('/api/jobs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, customer, phone, email, address, directions, technician,
        property_areas AS propertyAreas,
        services_required AS servicesRequired,
        other_service AS otherService,
        zone,
        yard_size AS yardSize,
        garden_count AS gardenCount,
        job_date AS date,
        COALESCE(start_time, '') AS time,
        duration, status, reminder,
        repeat_schedule AS \`repeat\`,
        repeat_until AS repeatUntil,
        closing_remarks AS closingRemarks,
        customer_remarks AS customerRemarks,
        recommendations,
        supervisor_remarks AS supervisorRemarks,
        reminded
      FROM jobs
      ORDER BY job_date, start_time
    `);
    res.json(rows);
  } catch (err) { fail(res, err); }
});

// POST create job
app.post('/api/jobs', async (req, res) => {
  const { id, customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, repeatUntil, closingRemarks, customerRemarks, recommendations, supervisorRemarks, reminded } = req.body;
  try {
    await pool.query(
      `INSERT INTO jobs (id, customer, phone, email, address, directions, technician, property_areas, services_required, other_service, zone, yard_size, garden_count, job_date, start_time, duration, status, reminder, repeat_schedule, repeat_until, closing_remarks, customer_remarks, recommendations, supervisor_remarks, reminded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, repeatUntil, closingRemarks, customerRemarks, recommendations, supervisorRemarks, JSON.stringify(reminded || [])]
    );
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// PUT update job
app.put('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const { customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, repeatUntil, closingRemarks, customerRemarks, recommendations, supervisorRemarks, reminded } = req.body;
  try {
    await pool.query(
      `UPDATE jobs SET customer=?, phone=?, email=?, address=?, directions=?, technician=?, property_areas=?, services_required=?, other_service=?, zone=?, yard_size=?, garden_count=?, job_date=?, start_time=?, duration=?, status=?, reminder=?, repeat_schedule=?, repeat_until=?, closing_remarks=?, customer_remarks=?, recommendations=?, supervisor_remarks=?, reminded=? WHERE id=?`,
      [customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, repeatUntil, closingRemarks, customerRemarks, recommendations, supervisorRemarks, JSON.stringify(reminded || []), id]
    );
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// DELETE job
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM jobs WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// GET all technicians
app.get('/api/technicians', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM technicians ORDER BY name ASC');
    res.json(rows);
  } catch (err) { fail(res, err); }
});

// POST create technician
app.post('/api/technicians', upload.single('document'), async (req, res) => {
  const { id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, termination_reason, termination_date, rehire_eligible } = req.body;
  const document_path = req.file ? req.file.filename : null;
  try {
    await pool.query(
      `INSERT INTO technicians (id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, document_path, termination_reason, termination_date, rehire_eligible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, document_path, termination_reason, termination_date, rehire_eligible]
    );
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// PUT update technician
app.put('/api/technicians/:id', upload.single('document'), async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, termination_reason, termination_date, rehire_eligible } = req.body;
  try {
    let updateQuery = `UPDATE technicians SET name=?, email=?, phone=?, address=?, department=?, employment_status=?, base_monthly_rate=?, hire_date=?, probation_end_date=?, nis=?, trn=?, license_number=?, notes=?, termination_reason=?, termination_date=?, rehire_eligible=?`;
    let params = [name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, termination_reason, termination_date, rehire_eligible];
    if (req.file) {
      updateQuery += `, document_path=? WHERE id=?`;
      params.push(req.file.filename, id);
    } else {
      updateQuery += ` WHERE id=?`;
      params.push(id);
    }
    await pool.query(updateQuery, params);
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// POST attendance (create or update)
app.post('/api/attendance', async (req, res) => {
  const { id, tech_id, date, status } = req.body;
  try {
    await pool.query(
      `INSERT INTO attendance (id, tech_id, date, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [id, tech_id, date, status]
    );
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// GET attendance for one tech
app.get('/api/attendance/:tech_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM attendance WHERE tech_id = ?', [req.params.tech_id]);
    res.json(rows);
  } catch (err) { fail(res, err); }
});

// POST payslip
app.post('/api/payslips', async (req, res) => {
  const { id, tech_id, period_end, period_num, net_pay, ytd_gross } = req.body;
  try {
    await pool.query(
      `INSERT INTO payslips (id, tech_id, period_end, period_num, net_pay, ytd_gross) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tech_id, period_end, period_num, net_pay, ytd_gross]
    );
    res.json({ success: true });
  } catch (err) { fail(res, err); }
});

// GET payslips for one tech
app.get('/api/payslips/:tech_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payslips WHERE tech_id = ?', [req.params.tech_id]);
    res.json(rows);
  } catch (err) { fail(res, err); }
});

// Root health check
app.get('/', (req, res) => { res.send('OK'); });

// One-time database setup — runs each CREATE TABLE as its own query (POST, needs the API key)
app.post('/api/setup', async (req, res) => {
    const statements = [
        `CREATE TABLE IF NOT EXISTS jobs (
            id VARCHAR(50) PRIMARY KEY,
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
            reminded JSON
        )`,
        `CREATE TABLE IF NOT EXISTS technicians (
            id VARCHAR(50) PRIMARY KEY,
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
            rehire_eligible BOOLEAN
        )`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id VARCHAR(50) PRIMARY KEY,
            tech_id VARCHAR(50),
            date DATE NOT NULL,
            status VARCHAR(20) NOT NULL,
            UNIQUE KEY unique_attendance (tech_id, date)
        )`,
        `CREATE TABLE IF NOT EXISTS payslips (
            id VARCHAR(50) PRIMARY KEY,
            tech_id VARCHAR(50),
            period_end DATE,
            period_num INT,
            net_pay DECIMAL(10,2),
            ytd_gross DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];
    try {
        for (const stmt of statements) {
            await pool.query(stmt);
        }
        res.send("Database tables created successfully!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error creating tables");
    }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => { console.log(`Backend running on port ${port}`); });
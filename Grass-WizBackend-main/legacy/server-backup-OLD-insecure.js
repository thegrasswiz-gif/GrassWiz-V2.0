require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'grasswiz_admin',
  password: process.env.DB_PASSWORD || 'YOUR_DB_PASSWORD_HERE',
  database: process.env.DB_NAME || 'grasswiz_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/api/jobs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM jobs ORDER BY job_date, start_time');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/jobs', async (req, res) => {
  const { id, customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, closingRemarks, customerRemarks, recommendations, supervisorRemarks, reminded } = req.body;
  try {
    await pool.query(
      `INSERT INTO jobs (id, customer, phone, email, address, directions, technician, property_areas, services_required, other_service, zone, yard_size, garden_count, job_date, start_time, duration, status, reminder, repeat_schedule, closing_remarks, customer_remarks, recommendations, supervisor_remarks, reminded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, closingRemarks, customerRemarks, recommendations, supervisorRemarks, JSON.stringify(reminded || [])]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const { customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, closingRemarks, customerRemarks, recommendations, supervisorRemarks, reminded } = req.body;
  try {
    await pool.query(
      `UPDATE jobs SET customer=?, phone=?, email=?, address=?, directions=?, technician=?, property_areas=?, services_required=?, other_service=?, zone=?, yard_size=?, garden_count=?, job_date=?, start_time=?, duration=?, status=?, reminder=?, repeat_schedule=?, closing_remarks=?, customer_remarks=?, recommendations=?, supervisor_remarks=?, reminded=? WHERE id=?`,
      [customer, phone, email, address, directions, technician, propertyAreas, servicesRequired, otherService, zone, yardSize, gardenCount, date, time, duration, status, reminder, repeat, closingRemarks, customerRemarks, recommendations, supervisorRemarks, JSON.stringify(reminded || []), id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/jobs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM jobs WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/technicians', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM technicians ORDER BY name ASC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/technicians', upload.single('document'), async (req, res) => {
  const { id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, termination_reason, termination_date, rehire_eligible } = req.body;
  const document_path = req.file ? req.file.filename : null;
  try {
    await pool.query(
      `INSERT INTO technicians (id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, document_path, termination_reason, termination_date, rehire_eligible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, phone, address, department, employment_status, base_monthly_rate, hire_date, probation_end_date, nis, trn, license_number, notes, document_path, termination_reason, termination_date, rehire_eligible]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance', async (req, res) => {
  const { id, tech_id, date, status } = req.body;
  try {
    await pool.query(
      `INSERT INTO attendance (id, tech_id, date, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [id, tech_id, date, status]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance/:tech_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM attendance WHERE tech_id = ?', [req.params.tech_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payslips', async (req, res) => {
  const { id, tech_id, period_end, period_num, net_pay, ytd_gross } = req.body;
  try {
    await pool.query(
      `INSERT INTO payslips (id, tech_id, period_end, period_num, net_pay, ytd_gross) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tech_id, period_end, period_num, net_pay, ytd_gross]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/payslips/:tech_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payslips WHERE tech_id = ?', [req.params.tech_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => { res.send('Grass Wiz API is running perfectly!'); });

app.get('/api/setup', async (req, res) => {
    const sql = `
        CREATE TABLE IF NOT EXISTS jobs (id VARCHAR(50) PRIMARY KEY, customer TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, directions TEXT, technician TEXT, property_areas TEXT, services_required TEXT, other_service TEXT, zone TEXT, yard_size TEXT, garden_count INT, job_date DATE NOT NULL, start_time VARCHAR(10), duration INT, status VARCHAR(20) DEFAULT 'Scheduled', reminder INT, repeat_schedule VARCHAR(20), closing_remarks TEXT, customer_remarks TEXT, recommendations TEXT, supervisor_remarks TEXT, reminded JSON);
        CREATE TABLE IF NOT EXISTS technicians (id VARCHAR(50) PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, department TEXT, employment_status VARCHAR(20) DEFAULT 'Trial', base_monthly_rate DECIMAL(10,2) DEFAULT 100000.00, hire_date DATE, probation_end_date DATE, nis TEXT, trn TEXT, license_number TEXT, notes TEXT, document_path TEXT, termination_reason TEXT, termination_date DATE, rehire_eligible BOOLEAN);
        CREATE TABLE IF NOT EXISTS attendance (id VARCHAR(50) PRIMARY KEY, tech_id VARCHAR(50), date DATE NOT NULL, status VARCHAR(20) NOT NULL, UNIQUE KEY unique_attendance (tech_id, date));
        CREATE TABLE IF NOT EXISTS payslips (id VARCHAR(50) PRIMARY KEY, tech_id VARCHAR(50), period_end DATE, period_num INT, net_pay DECIMAL(10,2), ytd_gross DECIMAL(10,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `;
    try {
        await pool.query(sql);
        res.send("Database tables created successfully!");
    } catch (err) {
        res.status(500).send("Error creating tables: " + err.message);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => { console.log(`Backend running on port ${port}`); });
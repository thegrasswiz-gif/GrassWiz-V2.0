// ============================================
// DATABASE HELPER FUNCTIONS
// These replace the old fetch() calls to your Express API
// ============================================

// JOBS
function dateOnly(value) {
  return value ? String(value).split('T')[0] : '';
}

async function sbFetchJobs() {
  // The API returns at most 1000 rows per request, so read in pages (recurring jobs add up fast)
  const PAGE = 1000;
  let data = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await sb
      .from('jobs')
      .select('*')
      .order('job_date', { ascending: true })
      .order('id', { ascending: true })        // stable order across pages
      .range(from, from + PAGE - 1);
    if (error) throw error;
    data = data.concat(page || []);
    if (!page || page.length < PAGE) break;
  }

  // Map database columns to frontend field names
  return data.map(row => ({
    id: row.id,
    kind: row.kind || 'job',
    customerId: row.customer_id || null,
    customer: row.customer,
    phone: row.phone,
    email: row.email,
    address: row.address,
    directions: row.directions,
    technician: row.technician,
    propertyAreas: row.property_areas,
    servicesRequired: row.services_required,
    otherService: row.other_service,
    zone: row.zone,
    yardSize: row.yard_size,
    gardenCount: row.garden_count,
    date: dateOnly(row.job_date),
    time: row.start_time || '',
    duration: row.duration,
    status: row.status,
    reminder: row.reminder,
    repeat: row.repeat_schedule,
    repeatUntil: dateOnly(row.repeat_until),
    closingRemarks: row.closing_remarks,
    customerRemarks: row.customer_remarks,
    recommendations: row.recommendations,
    supervisorRemarks: row.supervisor_remarks,
    reminded: row.reminded || []
  }));
}

function jobToRow(jobData) {
  return {
    id: jobData.id,
    kind: jobData.kind || 'job',
    customer_id: jobData.customerId || null,
    customer: jobData.customer,
    phone: jobData.phone,
    email: jobData.email,
    address: jobData.address,
    directions: jobData.directions,
    technician: jobData.technician,
    property_areas: jobData.propertyAreas,
    services_required: jobData.servicesRequired,
    other_service: jobData.otherService,
    zone: jobData.zone,
    yard_size: jobData.yardSize,
    garden_count: jobData.gardenCount,
    job_date: jobData.date,
    start_time: jobData.time,
    duration: jobData.duration,
    status: jobData.status,
    reminder: jobData.reminder,
    repeat_schedule: jobData.repeat,
    repeat_until: jobData.repeatUntil || null,
    closing_remarks: jobData.closingRemarks,
    customer_remarks: jobData.customerRemarks,
    recommendations: jobData.recommendations,
    supervisor_remarks: jobData.supervisorRemarks,
    reminded: jobData.reminded || []
  };
}

// Database not yet upgraded with sql/04-customers-inspections.sql: save without the new columns
// rather than fail (plain jobs keep working; inspections need the upgrade).
function isMissingNewColumn(error) {
  return !!error && /\b(kind|customer_id)\b/i.test(error.message || '');
}
function stripNewColumns(row) {
  const { kind, customer_id, ...legacy } = row;
  return legacy;
}

async function sbSaveJob(jobData, isEdit = false) {
  const dbData = jobToRow(jobData);
  const run = (row) => isEdit
    ? sb.from('jobs').update(row).eq('id', jobData.id)
    : sb.from('jobs').insert(row);
  let { error } = await run(dbData);
  if (isMissingNewColumn(error)) {
    if (jobData.kind === 'inspection') throw new Error('Site inspections need the database upgrade: run sql/apply-all-updates.sql in Supabase.');
    console.warn('jobs.kind / customer_id missing - run sql/apply-all-updates.sql');
    ({ error } = await run(stripNewColumns(dbData)));
  }
  if (error) throw error;
}

// Insert many jobs in one request (recurring copies)
async function sbSaveJobs(jobList) {
  const rows = jobList.map(jobToRow);
  let { error } = await sb.from('jobs').insert(rows);
  if (isMissingNewColumn(error)) {
    ({ error } = await sb.from('jobs').insert(rows.map(stripNewColumns)));
  }
  if (error) throw error;
}

async function sbDeleteJob(jobId) {
  const { error } = await sb.from('jobs').delete().eq('id', jobId);
  if (error) throw error;
}

// CUSTOMERS (looked up by phone number)
function rowToCustomer(r) {
  return {
    id: r.id, name: r.name, phone: r.phone || '', phoneKey: r.phone_key || '',
    email: r.email || '', address: r.address || '', directions: r.directions || '',
    zone: r.zone || '', yardSize: r.yard_size || ''
  };
}
function customerToRow(c) {
  return {
    id: c.id, name: c.name, phone: c.phone || null, phone_key: c.phoneKey || null,
    email: c.email || null, address: c.address || null, directions: c.directions || null,
    zone: c.zone || null, yard_size: c.yardSize || null, updated_at: new Date().toISOString()
  };
}

async function sbFetchAll(table, orderCol) {
  const PAGE = 1000;
  let data = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await sb.from(table).select('*').order(orderCol, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    data = data.concat(page || []);
    if (!page || page.length < PAGE) break;
  }
  return data;
}

async function sbFetchCustomers() {
  return (await sbFetchAll('customers', 'name')).map(rowToCustomer);
}

async function sbFetchCustomerChanges() {
  return (await sbFetchAll('customer_changes', 'changed_at')).map(r => ({
    id: r.id, customerId: r.customer_id, field: r.field,
    oldValue: r.old_value || '', newValue: r.new_value || '', changedAt: r.changed_at
  }));
}

async function sbSaveCustomer(customer, isEdit = false) {
  const row = customerToRow(customer);
  const { error } = isEdit
    ? await sb.from('customers').update(row).eq('id', customer.id)
    : await sb.from('customers').insert(row);
  if (error) throw error;
}

async function sbLogCustomerChanges(changes) {
  if (!changes.length) return;
  const rows = changes.map(c => ({
    id: c.id, customer_id: c.customerId, field: c.field,
    old_value: c.oldValue, new_value: c.newValue,
    changed_at: c.changedAt, changed_by: c.changedBy || null
  }));
  const { error } = await sb.from('customer_changes').insert(rows);
  if (error) throw error;
}

// TECHNICIANS
async function sbFetchTechnicians() {
  const { data, error } = await sb
    .from('technicians')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

async function sbSaveTechnician(techData, file = null, isEdit = false) {
  // Handle file upload if present
  if (file && file.size > 0) {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    const { error: uploadError } = await sb.storage
      .from('documents')
      .upload(fileName, file);
    if (uploadError) throw uploadError;
    techData.document_path = fileName;
  }

  if (isEdit) {
    const { error } = await sb.from('technicians').update(techData).eq('id', techData.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('technicians').insert(techData);
    if (error) throw error;
  }
}

async function sbDeleteTechnician(techId) {
  const { error } = await sb.from('technicians').delete().eq('id', techId);
  if (error) throw error;
}

// Employee documents live in a private bucket; hand out short-lived signed links.
async function sbGetDocumentUrl(documentPath) {
  const { data, error } = await sb.storage.from('documents').createSignedUrl(documentPath, 60);
  if (error) throw error;
  return data.signedUrl;
}

// ATTENDANCE
async function sbFetchAttendance(techId) {
  const { data, error } = await sb
    .from('attendance')
    .select('*')
    .eq('tech_id', techId);
  
  if (error) throw error;
  return data || [];
}

async function sbSaveAttendance(attData) {
  const { error } = await sb
    .from('attendance')
    .upsert(attData, { onConflict: 'tech_id,date' });
  if (error) throw error;
}

// PAYSLIPS
async function sbFetchPayslips(techId) {
  const { data, error } = await sb
    .from('payslips')
    .select('*')
    .eq('tech_id', techId);
  
  if (error) throw error;
  return data || [];
}

async function sbSavePayslip(payslipData) {
  let { error } = await sb.from('payslips').insert(payslipData);
  // Database not yet upgraded with sql/03-payslip-gross.sql: save without the new column rather than fail
  if (error && /gross_pay/i.test(error.message || '')) {
    console.warn('payslips.gross_pay column missing - run sql/03-payslip-gross.sql');
    const { gross_pay, ...legacyData } = payslipData;
    ({ error } = await sb.from('payslips').insert(legacyData));
  }
  if (error) throw error;
}

// Export for use
window.sbFetchJobs = sbFetchJobs;
window.sbSaveJob = sbSaveJob;
window.sbSaveJobs = sbSaveJobs;
window.sbDeleteJob = sbDeleteJob;
window.sbFetchCustomers = sbFetchCustomers;
window.sbFetchCustomerChanges = sbFetchCustomerChanges;
window.sbSaveCustomer = sbSaveCustomer;
window.sbLogCustomerChanges = sbLogCustomerChanges;
window.sbFetchTechnicians = sbFetchTechnicians;
window.sbSaveTechnician = sbSaveTechnician;
window.sbDeleteTechnician = sbDeleteTechnician;
window.sbGetDocumentUrl = sbGetDocumentUrl;
window.sbFetchAttendance = sbFetchAttendance;
window.sbSaveAttendance = sbSaveAttendance;
window.sbFetchPayslips = sbFetchPayslips;
window.sbSavePayslip = sbSavePayslip;

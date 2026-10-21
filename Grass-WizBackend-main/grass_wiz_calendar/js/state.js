// Shared application state (globals used across modules)
let jobs = [], technicians = [], currentTechAttendance = [], techPayslips = [];
let viewDate = new Date(), selectedDate = todayISO(), editingJobId = null;
let activeEmployee = null, completingJobId = null, reschedulingJobId = null;
let sidebarMode = 'upcoming';
let selectedAttDate = null, selectedAttRecordId = null;
let currentPayPeriod = { start: null, end: null };
let jobToPrintId = null;
let attViewDate = new Date(); 
let isAttUnlocked = false;
let searchTerm = '';
let customers = [], customerChanges = [], customersAvailable = true;
let formKind = 'job';            // 'job' | 'inspection' (the switch inside the Add form)
let formCustomerId = null;       // customer the open form is linked to (from lookup / editing)
let customerFilterId = '';        // '' = everyone, otherwise a customerKey()

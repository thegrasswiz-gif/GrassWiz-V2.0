// Payslip calculation, preview, generation and history


window.viewHistoricalPayslip = (slipId) => {
  let slip = techPayslips.find(s => s.id === slipId);
  if(!slip) return;
  
  var html = '<html><head><title>Payslip History - ' + esc(activeEmployee.name) + '</title>';
  html += '<style>body { font-family: Arial, sans-serif; padding: 20px; color: #000; } .payslip-doc { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; } .payslip-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; } .payslip-header h1 { margin: 0; font-size: 24px; text-transform: uppercase; } .payslip-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; } .meta-row { display: flex; justify-content: space-between; } .net-pay-box { background: #f0f0f0; padding: 10px; margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; border: 1px solid #000; }</style></head><body>';
  
  html += '<div class="payslip-doc"><div class="payslip-header"><h1>THE GRASS WIZ</h1><p>Historical Record</p></div>';
  html += '<div class="payslip-meta"><div>';
  html += '<div class="meta-row"><strong>Employee:</strong> <span>' + esc(activeEmployee.name) + '</span></div>';
  html += '<div class="meta-row"><strong>Department:</strong> <span>' + esc(activeEmployee.department || 'Landscape') + '</span></div>';
  html += '</div><div>';
  html += '<div class="meta-row"><strong>Per. End:</strong> <span>' + fmtDate(slip.period_end) + '</span></div>';
  html += '<div class="meta-row"><strong>Per. No:</strong> <span>' + slip.period_num + '</span></div>';
  html += '</div></div>';
  
  html += '<div class="net-pay-box">NET PAY: $' + Number(slip.net_pay).toLocaleString(undefined, {minimumFractionDigits:2}) + '</div>';
  html += '<div style="margin-top:20px; font-size:12px;"><strong>Year-to-Date Gross at time of payment:</strong> $' + Number(slip.ytd_gross).toLocaleString(undefined, {minimumFractionDigits:2}) + '</div></div>';
  html += '</body></html>';
  
  openPrintWindow(html);
};

// One calculation used by the live totals, the preview and the saved payslip
function computePayroll() {
  const HOURLY_RATE = Number(activeEmployee.base_monthly_rate) / 188.4;
  const WEEKDAY_PAY = 8 * HOURLY_RATE;
  const SATURDAY_PAY = 5 * HOURLY_RATE * 1.5;

  let period = currentPayPeriod;
  let weekdaysWorked = 0, satsWorked = 0, absences = 0;

  currentTechAttendance.forEach(rec => {
    let recDate = parseDateSafe(rec.date);
    if(recDate >= period.start && recDate <= period.end) {
      let dayOfWeek = recDate.getDay();
      if(rec.status.startsWith('Present')) {
        if (dayOfWeek >= 1 && dayOfWeek <= 5) weekdaysWorked++;
        else if (dayOfWeek === 6 && !isOffSaturday(recDate)) satsWorked++;
      } else if (rec.status.startsWith('Absent')) {
        absences++;
      }
    }
  });

  let gross = (weekdaysWorked * WEEKDAY_PAY) + (satsWorked * SATURDAY_PAY);
  let bonus = $('cbBonus').checked ? Number($('inputBonus').value || 0) : 0;
  let tax = $('cbTax').checked ? Number($('inputTax').value || 0) : 0;
  let advance = $('cbAdvance').checked ? Number($('inputAdvance').value || 0) : 0;
  let netPay = (gross + bonus) - tax - advance;
  return { weekdaysWorked, satsWorked, absences, gross, bonus, tax, advance, netPay };
}

function calculatePayslip() {
  if (!activeEmployee) return;
  
  const { weekdaysWorked, satsWorked, absences, gross, netPay } = computePayroll();

  $('calcDaysWorked').textContent = weekdaysWorked + satsWorked;
  $('calcAbsences').textContent = absences;
  $('calcGrossPay').textContent = gross.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  $('calcLiveNetPay').textContent = netPay.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
}

function generatePayslipHTML(isPreview = false) {
  const { weekdaysWorked, satsWorked, absences, gross, bonus, tax, advance, netPay } = computePayroll();
  
  // Year-to-date GROSS: earnings (basic pay + bonus, before deductions) from payslips in the same
  // calendar year as this period's end date. Older payslips saved before gross_pay existed fall back to net_pay.
  const totalEarnings = gross + bonus;
  const slipYear = currentPayPeriod.end.getFullYear();
  const pastYtd = techPayslips
    .filter(sl => parseDateSafe(sl.period_end).getFullYear() === slipYear)
    .reduce((sum, sl) => sum + Number(sl.gross_pay != null ? sl.gross_pay : sl.net_pay), 0);
  const newYtd = pastYtd + totalEarnings;

  let periodEnd = toISODate(currentPayPeriod.end);
  // Pay periods run 26th-25th, one per month: the period ending in January is No. 1 ... December is No. 12
  let periodNum = currentPayPeriod.end.getMonth() + 1;

  var html = '<html><head><title>Payslip - ' + esc(activeEmployee.name) + '</title>';
  html += '<style>body { font-family: Arial, sans-serif; padding: 20px; color: #000; } .payslip-doc { max-width: 800px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; } .payslip-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; } .payslip-header h1 { margin: 0; font-size: 24px; text-transform: uppercase; } .payslip-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; } .meta-row { display: flex; justify-content: space-between; } .payslip-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; } .payslip-table th { text-align: left; border-bottom: 1px solid #000; padding: 8px 4px; } .payslip-table td { padding: 8px 4px; border-bottom: 1px solid #eee; } .payslip-table .amount { text-align: right; } .payslip-totals { display: flex; justify-content: flex-end; font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; } .net-pay-box { background: #f0f0f0; padding: 10px; margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; border: 1px solid #000; }</style></head><body>';
  
  html += '<div class="payslip-doc"><div class="payslip-header"><h1>THE GRASS WIZ</h1></div>';
  html += '<div class="payslip-meta"><div>';
  html += '<div class="meta-row"><strong>Employee:</strong> <span>' + esc(activeEmployee.name) + '</span></div>';
  html += '<div class="meta-row"><strong>Department:</strong> <span>' + esc(activeEmployee.department || 'Landscape') + '</span></div>';
  html += '<div class="meta-row"><strong>NIS:</strong> <span>' + esc(activeEmployee.nis) + '</span></div>';
  html += '</div><div>';
  html += '<div class="meta-row"><strong>Per. End:</strong> <span>' + fmtDate(periodEnd) + '</span></div>';
  html += '<div class="meta-row"><strong>Per. No:</strong> <span>' + periodNum + '</span></div>';
  html += '<div class="meta-row"><strong>TRN:</strong> <span>' + esc(activeEmployee.trn) + '</span></div>';
  html += '</div></div>';
  
  html += '<table class="payslip-table"><thead><tr><th>Earnings</th><th class="amount">AMOUNT</th><th>Deductions</th><th class="amount">AMOUNT</th></tr></thead><tbody>';
  
  html += '<tr><td>Basic Pay</td><td class="amount">$' + gross.toLocaleString(undefined, {minimumFractionDigits:2}) + '</td><td>Salary Advance</td><td class="amount">$' + advance.toLocaleString(undefined, {minimumFractionDigits:2}) + '</td></tr>';
  
  if (absences > 0) {
      html += '<tr><td></td><td class="amount"></td><td>Absent ' + absences + ' Days</td><td class="amount">$0.00</td></tr>';
  }
  if (bonus > 0) { 
      html += '<tr><td>Bonus</td><td class="amount">$' + bonus.toLocaleString(undefined, {minimumFractionDigits:2}) + '</td><td></td><td></td></tr>'; 
  }
  if (tax > 0) { 
      html += '<tr><td></td><td class="amount"></td><td>Tax</td><td class="amount">$' + tax.toLocaleString(undefined, {minimumFractionDigits:2}) + '</td></tr>'; 
  }
  
  html += '</tbody></table>';
  html += '<div class="payslip-totals"><div style="margin-right: 20px;">TOTALS: $' + (gross + bonus).toLocaleString(undefined, {minimumFractionDigits:2}) + '</div>';
  html += '<div>DEDUCTIONS: $' + (tax + advance).toLocaleString(undefined, {minimumFractionDigits:2}) + '</div></div>';
  html += '<div class="net-pay-box">NET PAY: $' + netPay.toLocaleString(undefined, {minimumFractionDigits:2}) + '</div>';
  html += '<div style="margin-top:20px; font-size:12px;"><strong>Year-to-Date Gross:</strong> $' + newYtd.toLocaleString(undefined, {minimumFractionDigits:2}) + '</div></div>';
  
  if(!isPreview) {
      html += '<script>window.onload = function() { window.print(); }<\/script>';
  }
  html += '</body></html>';
  
  return { html, netPay, totalEarnings, newYtd, periodEnd, periodNum };
}

// Event wiring — called once from app.js after the user is signed in.
function initPayroll() {

  $('profPayrollBtn').onclick = () => {
    $('profileModalBack').classList.remove('open');
    $('payslipModalBack').classList.add('open');
    
    currentPayPeriod = getCurrentPayPeriod();
    $('displayPayCycle').textContent = `${fmtDate(currentPayPeriod.start)} to ${fmtDate(currentPayPeriod.end)}`;
    
    $('cbBonus').checked = false; $('inputBonus').classList.add('hidden'); $('inputBonus').value = '';
    $('cbTax').checked = false; $('inputTax').classList.add('hidden'); $('inputTax').value = '';
    $('cbAdvance').checked = false; $('inputAdvance').classList.add('hidden'); $('inputAdvance').value = '';
    
    const historyList = $('payslipHistoryList');
    historyList.innerHTML = '';
    if (techPayslips.length > 0) {
        $('payslipHistorySection').classList.remove('hidden');
        techPayslips.sort((a,b) => parseDateSafe(b.period_end) - parseDateSafe(a.period_end)).forEach(slip => {
            let row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border); font-size:13px;";
            row.innerHTML = `
                <span>Period Ending: <strong>${fmtDate(slip.period_end)}</strong></span> 
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>Net: <strong>$${Number(slip.net_pay).toLocaleString(undefined, {minimumFractionDigits:2})}</strong></span>
                    <button class="small secondary" onclick="viewHistoricalPayslip('${slip.id}')"><i class="fas fa-eye"></i> View</button>
                </div>
            `;
            historyList.appendChild(row);
        });
    } else {
        $('payslipHistorySection').classList.add('hidden');
    }

    calculatePayslip();
  };

  $('cbBonus').onchange = (e) => { $('inputBonus').classList.toggle('hidden', !e.target.checked); calculatePayslip(); };
  $('cbTax').onchange = (e) => { $('inputTax').classList.toggle('hidden', !e.target.checked); calculatePayslip(); };
  $('cbAdvance').onchange = (e) => { $('inputAdvance').classList.toggle('hidden', !e.target.checked); calculatePayslip(); };
  $('inputBonus').oninput = calculatePayslip;
  $('inputTax').oninput = calculatePayslip;
  $('inputAdvance').oninput = calculatePayslip;

  $('btnPreviewPayslip').onclick = () => {
    if (!activeEmployee) return;
    let result = generatePayslipHTML(true);
    openPrintWindow(result.html);
  };

  $('btnGeneratePayslip').onclick = async () => {
    if (!activeEmployee) return;

    let result = generatePayslipHTML(false);

    // Saving twice for the same period would double-count it in year-to-date
    const dup = techPayslips.some(sl => String(sl.period_end).split('T')[0] === result.periodEnd);
    if (dup && !confirm('A payslip for the period ending ' + fmtDate(result.periodEnd) + ' has already been saved for ' + activeEmployee.name + '. Save another one anyway?')) return;

    let slipId = makeId();
    try {
      await sbSavePayslip({ id: slipId, tech_id: activeEmployee.id, period_end: result.periodEnd, period_num: result.periodNum, gross_pay: result.totalEarnings, net_pay: result.netPay, ytd_gross: result.newYtd });
    } catch (e) {
      console.error("Could not save payslip", e);
      alert('The payslip could NOT be saved to the system. It will still open so you can print it, but it will not appear in the history.');
    }

    openPrintWindow(result.html);

    $('payslipModalBack').classList.remove('open');
    fetchTechnicians();
  };
}

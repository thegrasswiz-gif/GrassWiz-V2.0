// Printable job order


function printJobOrder(jobId) {
  const j = jobs.find(x => x.id === jobId);
  if (!j) return;
  
  var html = '<html><head><title>Job Order</title>';
  html += '<style>';
  html += 'body { font-family: Arial, sans-serif; padding: 20px; color: #000; font-size: 12px; }';
  html += '.header { text-align: center; margin-bottom: 20px; }';
  html += '.header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }';
  html += '.header p { margin: 5px 0; font-size: 12px; }';
  html += '.section { margin-bottom: 15px; border: 1px solid #000; padding: 10px; }';
  html += '.section-title { font-weight: bold; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }';
  html += 'table { width: 100%; border-collapse: collapse; }';
  html += 'td { padding: 4px; border-bottom: 1px solid #ccc; vertical-align: top; }';
  html += '.label { font-weight: bold; width: 100px; }';
  html += '.checkbox { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; }';
  html += '.checkbox.checked::after { content: "✔"; }';
  html += '.grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 5px; }';
  html += '.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }';
  html += '.signature-table td { border: 1px solid #000; height: 40px; }';
  html += '@media print { body { padding: 0; } .section { page-break-inside: avoid; } }';
  html += '</style></head><body>';
  
  html += '<div class="header"><h1>THE GRASS WIZ</h1><p>Landscaping Services</p><p>38 Cassia Park Road, Kingston 11 | 876-229-8462</p></div>';
  
  html += '<div class="section">';
  html += '<div class="section-title">Customer Details</div>';
  html += '<table>';
  html += '<tr><td class="label">Client Name:</td><td>' + esc(j.customer) + '</td><td class="label">Date:</td><td>' + fmtDate(j.date) + '</td></tr>';
  html += '<tr><td class="label">Phone:</td><td>' + esc(j.phone) + '</td><td class="label">Email:</td><td>' + esc(j.email) + '</td></tr>';
  html += '<tr><td class="label">Address:</td><td colspan="3">' + esc(j.address) + '</td></tr>';
  { const m = membershipForJob(j); if (m.tier) html += '<tr><td class="label">Member:</td><td colspan="3">' + esc(m.tier.name) + ' — ' + m.tier.discount + '% discount</td></tr>'; }
  html += '<tr><td class="label">Directions:</td><td colspan="3">' + esc(j.directions) + '</td></tr>';
  html += '</table>';
  html += '</div>';
  
  // Technician Details
  html += '<div class="section">';
  html += '<div class="section-title">Technician Details</div>';
  html += '<table><tr><td class="label">Name of Technician:</td><td>' + esc(j.technician) + '</td></tr></table>';
  html += '</div>';
  
  // Property Areas
  html += '<div class="section">';
  html += '<div class="section-title">Property Areas</div>';
  const areas = ['Front', 'Back', 'Left Side', 'Right Side', 'Sidewalk Left', 'Sidewalk Right', 'Driveway'];
  html += '<div class="grid-4">';
  areas.forEach(area => {
      let checked = (j.propertyAreas && j.propertyAreas.includes(area)) ? 'checked' : '';
      html += '<div><span class="checkbox ' + checked + '"></span>' + area + '</div>';
  });
  html += '</div>';
  html += '<div style="margin-top: 5px;">';
  let gardenChecked = (j.propertyAreas && j.propertyAreas.includes('Garden')) ? 'checked' : '';
  html += '<span class="checkbox ' + gardenChecked + '"></span>Garden: ';
  const gardens = ['1', '2', '3', '4', '5'];
  gardens.forEach(g => {
      let checked = (j.propertyAreas && j.propertyAreas.includes('Garden ' + g)) ? 'checked' : '';
      html += '<span style="margin-right: 10px;"><span class="checkbox ' + checked + '"></span>' + g + '</span>';
  });
  html += '</div>';
  html += '</div>';
  
  // Services Required
  html += '<div class="section">';
  html += '<div class="section-title">Services Required</div>';
  const services = ['Lawn Mowing', 'Edging', 'Weed Removal', 'Hedge Trimming', 'Tree Trimming', 'Mulching', 'Fertilizing', 'Yard Clean-Up', 'Planting', 'Sod Installation', 'Irrigation Repair', 'Pressure Washing', 'Yard-cut', 'Garbage Disposal', 'Pest Control', 'Hardscaping'];
  html += '<div class="grid-4">';
  services.forEach(svc => {
      let checked = (j.servicesRequired && j.servicesRequired.includes(svc)) ? 'checked' : '';
      html += '<div><span class="checkbox ' + checked + '"></span>' + svc + '</div>';
  });
  html += '</div>';
  html += '<div style="margin-top: 5px;"><strong>Other Services:</strong> ' + esc(j.otherService) + '</div>';
  html += '</div>';
  
  // Remarks
  html += '<div class="section">';
  html += '<div class="section-title">Remarks</div>';
  html += '<table>';
  html += '<tr><td class="label">Technician Recommendations:</td><td>' + esc(j.recommendations) + '</td></tr>';
  html += '<tr><td class="label">Supervisor Remarks:</td><td>' + esc(j.supervisorRemarks) + '</td></tr>';
  html += '</table>';
  html += '</div>';
  
  // Signatures
  html += '<div class="section">';
  html += '<table class="signature-table">';
  html += '<tr><td class="label" style="width: 20%;">Customer Signature:</td><td style="width: 30%;"></td><td class="label" style="width: 15%;">Technician:</td><td style="width: 35%;"></td></tr>';
  html += '</table>';
  html += '<table class="signature-table" style="margin-top: 10px;">';
  html += '<tr><td class="label" style="width: 20%;">Supervisor:</td><td></td></tr>';
  html += '</table>';
  html += '</div>';
  
  html += '<script>window.onload = function() { window.print(); }<\/script></body></html>';
  
  openPrintWindow(html);
}

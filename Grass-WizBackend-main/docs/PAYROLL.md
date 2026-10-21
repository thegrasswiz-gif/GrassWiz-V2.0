# How pay is calculated

These are the rules the app currently applies (see `js/payroll.js`, `js/attendance.js`, `js/utils.js`).

**Rates.** Hourly rate = base monthly rate ÷ 188.4.
- Weekday (Mon–Fri) present: 8 hours × hourly rate.
- Saturday present: 5 hours × hourly rate × 1.5.

**Days off.** Sundays are always off. Saturdays alternate between working and off, anchored on 10 Oct 2026 (an off Saturday). Attendance on an off Saturday earns nothing.

**Pay period.** 26th of one month to the 25th of the next, inclusive of both days. The period ending in a month is numbered by that month: the period ending 25 January is **Per. No. 1**, 25 December is **12**.

**Payslip.**
- Basic pay = weekdays present × weekday pay + working Saturdays present × Saturday pay.
- Totals (earnings) = basic pay + bonus.
- Deductions = tax + salary advance. Absences are listed but do not deduct anything extra (absent days simply earn nothing).
- Net pay = totals − deductions.
- **Year-to-date gross** = total earnings of every saved payslip whose period ends in the same calendar year, plus this payslip. It restarts each January.

**Older payslips.** Payslips saved before the `gross_pay` column existed (`sql/03-payslip-gross.sql`) have no gross figure, so their *net* pay is used when adding up the year-to-date total. Their own stored YTD figures are shown unchanged in the history view.

**Saving the same period twice** asks for confirmation, because both copies would count towards year-to-date.

"use client";

import { useState } from "react";

type PayrollItem = {
  id: string;
  totalShifts: number;
  totalHours: string;
  basePay: string;
  adjustmentsTotal: string;
  netPay: string;
  employee: { employeeId: string; fullName: string };
};

export function PayrollClient({ canFinalize }: { canFinalize: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [runId, setRunId] = useState("");
  const [rows, setRows] = useState<PayrollItem[]>([]);

  async function compute() {
    const res = await fetch(`/api/payroll/compute?month=${month}&year=${year}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Unable to compute");
      return;
    }
    setRunId(data.run.id);
    setRows(data.items);
  }

  async function finalizeRun() {
    const res = await fetch("/api/payroll/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollRunId: runId }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Unable to finalize");
      return;
    }
    alert("Payroll finalized");
  }

  function exportCsv() {
    window.location.href = `/api/payroll/export?month=${month}&year=${year}`;
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm">Month</label>
          <input className="field" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm">Year</label>
          <input className="field" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <button className="btn-primary" onClick={compute}>Compute</button>
        <button className="btn-secondary" onClick={exportCsv}>Export CSV</button>
        {canFinalize ? <button className="btn-primary" onClick={finalizeRun} disabled={!runId}>Finalize</button> : null}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2">Employee</th>
              <th className="py-2">Shifts</th>
              <th className="py-2">Hours</th>
              <th className="py-2">Base</th>
              <th className="py-2">Adjustments</th>
              <th className="py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2">{r.employee.employeeId} - {r.employee.fullName}</td>
                <td className="py-2">{r.totalShifts}</td>
                <td className="py-2">{r.totalHours}</td>
                <td className="py-2">${Number(r.basePay).toFixed(2)}</td>
                <td className="py-2">${Number(r.adjustmentsTotal).toFixed(2)}</td>
                <td className="py-2">${Number(r.netPay).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

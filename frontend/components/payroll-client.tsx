"use client";

import { useEffect, useState } from "react";

type PayrollItem = {
  id: string;
  totalShifts: number;
  totalHours: string;
  basePay: string;
  adjustmentsTotal: string;
  netPay: string;
  employee: { employeeId: string; firstName: string; lastName: string };
};

type EmployeeOption = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status?: string;
};

export function PayrollClient({ canFinalize }: { canFinalize: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [runId, setRunId] = useState("");
  const [rows, setRows] = useState<PayrollItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      const res = await fetch("/api/employees");
      if (!res.ok) return;
      const data = (await res.json()) as EmployeeOption[];
      if (cancelled) return;
      setEmployees(data.filter((e) => e.status !== "INACTIVE"));
    }

    loadEmployees();
    return () => {
      cancelled = true;
    };
  }, []);

  async function compute() {
    const query = new URLSearchParams({
      month: String(month),
      year: String(year),
      ...(employeeId ? { employeeId } : {}),
    });

    const res = await fetch(`/api/payroll/compute?${query.toString()}`, { method: "POST" });
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
    const query = new URLSearchParams({
      month: String(month),
      year: String(year),
      ...(employeeId ? { employeeId } : {}),
    });

    window.location.href = `/api/payroll/export?${query.toString()}`;
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
        <div>
          <label className="text-sm">Employee</label>
          <select className="field" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {employee.employeeId} - {`${employee.firstName} ${employee.lastName}`.trim()}
              </option>
            ))}
          </select>
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
                <td className="py-2">{r.employee.employeeId} - {`${r.employee.firstName} ${r.employee.lastName}`.trim()}</td>
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

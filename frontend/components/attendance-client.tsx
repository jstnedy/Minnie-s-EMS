"use client";

import { useEffect, useState } from "react";

type AttendanceRow = {
  id: string;
  timeIn: string;
  timeOut: string | null;
  employee: { employeeId: string; firstName: string; lastName: string };
};

export function AttendanceClient() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  async function load() {
    const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    const res = await fetch(`/api/attendance${query}`);
    const data = await res.json();
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveEdit(id: string, timeIn: string, timeOut: string | null) {
    const res = await fetch(`/api/attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeIn, timeOut, editReason: "Manual correction" }),
    });

    if (!res.ok) {
      alert("Unable to save");
      return;
    }
    await load();
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <input className="field max-w-44" placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <button className="btn-secondary" onClick={load}>Filter</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2">Employee</th>
              <th className="py-2">Time In</th>
              <th className="py-2">Time Out</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const timeIn = new Date(r.timeIn).toISOString().slice(0, 16);
              const timeOut = r.timeOut ? new Date(r.timeOut).toISOString().slice(0, 16) : "";

              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2">{r.employee.employeeId} - {`${r.employee.firstName} ${r.employee.lastName}`.trim()}</td>
                  <td className="py-2">{new Date(r.timeIn).toLocaleString()}</td>
                  <td className="py-2">{r.timeOut ? new Date(r.timeOut).toLocaleString() : "Open"}</td>
                  <td className="py-2">
                    <button className="btn-secondary" onClick={() => saveEdit(r.id, new Date(timeIn).toISOString(), timeOut ? new Date(timeOut).toISOString() : null)}>
                      Quick Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type AttendanceRow = {
  id: string;
  timeIn: string;
  timeOut: string | null;
  hasTimeInPhoto: boolean;
  hasTimeOutPhoto: boolean;
  employee: { employeeId: string; firstName: string; lastName: string };
};

export function AttendanceClient({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { timeIn: string; timeOut: string }>>({});

  function toLocalInputValue(value: string) {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  async function load() {
    setError("");
    const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    const res = await fetch(`/api/attendance${query}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.error ? `${data.error}${data.detail ? `: ${data.detail}` : ""}` : "Unable to load attendance records";
      setError(message);
      setRows([]);
      return;
    }
    const safeRows = Array.isArray(data) ? data : [];
    setRows(safeRows);
    setDrafts(
      Object.fromEntries(
        safeRows.map((row) => [
          row.id,
          {
            timeIn: toLocalInputValue(row.timeIn),
            timeOut: row.timeOut ? toLocalInputValue(row.timeOut) : "",
          },
        ]),
      ),
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function saveEdit(id: string) {
    const draft = drafts[id];
    if (!draft?.timeIn) {
      alert("Time In is required");
      return;
    }

    const res = await fetch(`/api/attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeIn: new Date(draft.timeIn).toISOString(),
        timeOut: draft.timeOut ? new Date(draft.timeOut).toISOString() : null,
        editReason: "Manual correction",
      }),
    });

    if (!res.ok) {
      alert("Unable to save");
      return;
    }
    await load();
  }

  async function deleteRecord(id: string) {
    const confirmed = window.confirm("Delete this attendance record?");
    if (!confirmed) return;

    const res = await fetch(`/api/attendance/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Unable to delete record");
      return;
    }

    await load();
  }

  return (
    <div className="card space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
              <th className="py-2">In Photo</th>
              <th className="py-2">Out Photo</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const draft = drafts[r.id] ?? { timeIn: toLocalInputValue(r.timeIn), timeOut: r.timeOut ? toLocalInputValue(r.timeOut) : "" };

              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2">{r.employee.employeeId} - {`${r.employee.firstName} ${r.employee.lastName}`.trim()}</td>
                  <td className="py-2">
                    {canDelete ? (
                      <input
                        className="field mt-0 min-w-48"
                        type="datetime-local"
                        value={draft.timeIn}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, timeIn: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      new Date(r.timeIn).toLocaleString()
                    )}
                  </td>
                  <td className="py-2">
                    {canDelete ? (
                      <input
                        className="field mt-0 min-w-48"
                        type="datetime-local"
                        value={draft.timeOut}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, timeOut: e.target.value },
                          }))
                        }
                      />
                    ) : r.timeOut ? (
                      new Date(r.timeOut).toLocaleString()
                    ) : (
                      "Open"
                    )}
                  </td>
                  <td className="py-2">
                    {r.hasTimeInPhoto ? <img src={`/api/attendance/${r.id}?photo=timeIn`} alt="Time in proof" className="h-10 w-14 rounded object-cover" /> : "-"}
                  </td>
                  <td className="py-2">
                    {r.hasTimeOutPhoto ? <img src={`/api/attendance/${r.id}?photo=timeOut`} alt="Time out proof" className="h-10 w-14 rounded object-cover" /> : "-"}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {canDelete ? (
                        <button className="btn-secondary" onClick={() => saveEdit(r.id)}>
                          Save
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button className="btn-secondary" onClick={() => deleteRecord(r.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
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

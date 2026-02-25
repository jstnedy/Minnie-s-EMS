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

type CorrectionRow = {
  id: string;
  reason: string;
  createdAt: string;
  requestedTimeIn: string;
  requestedTimeOut: string | null;
  requester: { email: string | null; role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE" };
  attendanceLog: {
    id: string;
    timeIn: string;
    timeOut: string | null;
    employee: { employeeId: string; firstName: string; lastName: string };
  };
};

export function AttendanceClient({
  canDelete,
  canEdit,
  canReviewCorrections,
}: {
  canDelete: boolean;
  canEdit: boolean;
  canReviewCorrections: boolean;
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { timeIn: string; timeOut: string }>>({});
  const [highlightedCorrectionId, setHighlightedCorrectionId] = useState<string | null>(null);

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

  async function loadCorrections() {
    if (!canEdit) return;
    const res = await fetch("/api/attendance/corrections", { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) return;
    setCorrections(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
    loadCorrections();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const correctionId = params.get("correctionId");
    if (!correctionId) return;
    setHighlightedCorrectionId(correctionId);
  }, []);

  useEffect(() => {
    if (!highlightedCorrectionId || corrections.length === 0) return;
    const target = document.getElementById(`correction-${highlightedCorrectionId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedCorrectionId, corrections]);

  async function saveEdit(id: string) {
    const draft = drafts[id];
    if (!draft?.timeIn) {
      alert("Time In is required");
      return;
    }

    const reason = window.prompt("Enter correction reason:");
    if (!reason?.trim()) {
      alert("Correction reason is required");
      return;
    }

    const res = await fetch(`/api/attendance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeIn: new Date(draft.timeIn).toISOString(),
        timeOut: draft.timeOut ? new Date(draft.timeOut).toISOString() : null,
        editReason: reason.trim(),
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      alert(data?.error || "Unable to save");
      return;
    }

    if (res.status === 202) {
      alert(data?.message || "Correction submitted for admin approval");
      await loadCorrections();
      return;
    }

    await load();
    alert("Attendance record saved");
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

  async function reviewCorrection(id: string, action: "approve" | "reject") {
    const reviewNotes = window.prompt(
      action === "approve" ? "Optional approval note:" : "Optional rejection note:",
      "",
    );

    const res = await fetch(`/api/attendance/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNotes: reviewNotes ?? "" }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error || "Unable to review correction");
      return;
    }

    await load();
    await loadCorrections();
    alert(action === "approve" ? "Correction approved and attendance updated" : "Correction rejected");
  }

  return (
    <div className="space-y-4">
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
                      {canEdit ? (
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
                      {canEdit ? (
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
                        {canEdit ? (
                          <button className="btn-secondary" onClick={() => saveEdit(r.id)}>
                            {canReviewCorrections ? "Save" : "Submit Correction"}
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

      {canEdit ? (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Pending Corrections</h2>
          {corrections.length === 0 ? (
            <p className="text-sm text-slate-600">No pending correction requests.</p>
          ) : (
            <div className="space-y-3">
              {corrections.map((row) => (
                <div
                  id={`correction-${row.id}`}
                  key={row.id}
                  className={`rounded-lg border p-3 text-sm ${
                    highlightedCorrectionId === row.id ? "border-orange-400 bg-orange-50" : "border-slate-200"
                  }`}
                >
                  <p className="font-medium">
                    {row.attendanceLog.employee.employeeId} - {`${row.attendanceLog.employee.firstName} ${row.attendanceLog.employee.lastName}`.trim()}
                  </p>
                  <p className="text-slate-600">Requested by: {row.requester.email ?? "Unknown"} ({row.requester.role})</p>
                  <p className="text-slate-600">Current: {new Date(row.attendanceLog.timeIn).toLocaleString()} / {row.attendanceLog.timeOut ? new Date(row.attendanceLog.timeOut).toLocaleString() : "Open"}</p>
                  <p className="text-slate-600">Requested: {new Date(row.requestedTimeIn).toLocaleString()} / {row.requestedTimeOut ? new Date(row.requestedTimeOut).toLocaleString() : "Open"}</p>
                  <p className="text-slate-700">Reason: {row.reason}</p>
                  {canReviewCorrections ? (
                    <div className="mt-2 flex gap-2">
                      <button className="btn-secondary" onClick={() => reviewCorrection(row.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn-secondary" onClick={() => reviewCorrection(row.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

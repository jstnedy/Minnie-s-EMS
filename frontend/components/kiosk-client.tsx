"use client";

import { useEffect, useState } from "react";

type Employee = {
  employeeId: string;
  fullName: string;
};

export function KioskClient({ employeeId }: { employeeId: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [passkey, setPasskey] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!employeeId) return;
    fetch(`/api/employees?employeeId=${encodeURIComponent(employeeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setEmployee({ employeeId: data[0].employeeId, fullName: data[0].fullName });
        }
      });
  }, [employeeId]);

  async function runAction(action: "time-in" | "time-out") {
    const res = await fetch(`/api/attendance/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, passkey }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed");
      return;
    }

    setStatus(action === "time-in" ? "Time In recorded" : "Time Out recorded");
    setPasskey("");
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-orange-700">Attendance Kiosk</h1>
      <p className="text-center text-sm text-slate-600">{employee ? employee.fullName : "Unknown employee"}</p>
      <input
        className="field text-center text-lg tracking-[0.3em]"
        maxLength={6}
        pattern="\d{6}"
        placeholder="000000"
        value={passkey}
        onChange={(e) => setPasskey(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={() => runAction("time-in")}>Time In</button>
        <button className="btn-secondary" onClick={() => runAction("time-out")}>Time Out</button>
      </div>
      <p className="text-center text-sm text-slate-700">{status}</p>
    </div>
  );
}

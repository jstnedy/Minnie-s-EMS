"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Log = {
  id: string;
  timeIn: string;
  timeOut: string | null;
  source: string;
  timeInPhoto: string | null;
  timeOutPhoto: string | null;
};

type EmployeeDetailProps = {
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    role: { id: string; name: string };
    status: string;
    hourlyRate: string | number;
    attendanceLogs: Log[];
  };
  appBaseUrl: string;
};

export function EmployeeDetailClient({ employee, appBaseUrl }: EmployeeDetailProps) {
  const [passkey, setPasskey] = useState("000000");
  const [qrValue, setQrValue] = useState(`${appBaseUrl}/kiosk?employeeId=${encodeURIComponent(employee.employeeId)}`);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function resetPasskey() {
    const res = await fetch(`/api/employees/${employee.id}/reset-passkey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempPasskey: passkey }),
    });

    if (!res.ok) {
      alert("Reset failed");
      return;
    }
    alert("Passkey reset successful");
  }

  useEffect(() => {
    let stopped = false;

    async function refreshQr() {
      const res = await fetch(`/api/kiosk/qr?employeeId=${encodeURIComponent(employee.employeeId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (stopped) return;
      setQrValue(data.qrValue);
      setExpiresAt(data.expiresAt ?? null);
    }

    refreshQr();
    const timer = window.setInterval(refreshQr, 60 * 1000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [employee.employeeId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm">ID: {employee.employeeId}</p>
          <p className="text-sm">Name: {`${employee.firstName} ${employee.lastName}`.trim()}</p>
          <p className="text-sm">Role: {employee.role.name}</p>
          <p className="text-sm">Status: {employee.status}</p>
          <p className="text-sm">Rate: ₱{Number(employee.hourlyRate).toFixed(2)} / hr</p>
        </div>
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">QR Kiosk</h2>
          <QRCodeCanvas value={qrValue} size={180} includeMargin />
          <p className="break-all text-xs text-slate-600">{qrValue}</p>
          {expiresAt ? <p className="text-xs text-slate-600">Rotates every 30 mins. Expires at: {new Date(expiresAt).toLocaleTimeString()}</p> : null}
          <div className="flex gap-2">
            <input className="field" value={passkey} onChange={(e) => setPasskey(e.target.value)} pattern="\d{6}" />
            <button className="btn-primary" onClick={resetPasskey}>Reset Passkey</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-semibold">Recent Attendance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2">Time In</th>
                <th className="py-2">Time Out</th>
                <th className="py-2">In Photo</th>
                <th className="py-2">Out Photo</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {employee.attendanceLogs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2">{new Date(l.timeIn).toLocaleString()}</td>
                  <td className="py-2">{l.timeOut ? new Date(l.timeOut).toLocaleString() : "Open"}</td>
                  <td className="py-2">{l.timeInPhoto ? <img src={l.timeInPhoto} alt="Time in proof" className="h-12 w-16 rounded object-cover" /> : "-"}</td>
                  <td className="py-2">{l.timeOutPhoto ? <img src={l.timeOutPhoto} alt="Time out proof" className="h-12 w-16 rounded object-cover" /> : "-"}</td>
                  <td className="py-2">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

type RoleOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type EmployeeDetailProps = {
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    contactNumber?: string | null;
    role: { id: string; name: string };
    status: string;
    hourlyRate: string | number;
    attendanceLogs: Log[];
  };
  appBaseUrl: string;
};

export function EmployeeDetailClient({ employee, appBaseUrl }: EmployeeDetailProps) {
  const [passkey, setPasskey] = useState("000000");
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState({
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email ?? "",
    contactNumber: employee.contactNumber ?? "",
    roleId: employee.role.id,
    status: employee.status,
    hourlyRate: String(employee.hourlyRate),
  });
  const [qrValue, setQrValue] = useState(`${appBaseUrl}/kiosk?employeeId=${encodeURIComponent(employee.employeeId)}`);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const currentEmployeeId = form.employeeId || employee.employeeId;

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

  async function saveProfile() {
    setSaving(true);
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: form.employeeId.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        roleId: form.roleId,
        status: form.status,
        hourlyRate: form.hourlyRate,
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      alert(data?.error || "Unable to save profile");
      return;
    }
    alert("Employee profile updated");
  }

  useEffect(() => {
    let stopped = false;

    async function refreshQr() {
      const res = await fetch(`/api/kiosk/qr?employeeId=${encodeURIComponent(currentEmployeeId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (stopped) return;
      setQrValue(data.qrValue);
      setExpiresAt(data.expiresAt ?? null);
    }

    async function loadRoles() {
      const res = await fetch("/api/roles?includeInactive=true");
      if (!res.ok) return;
      const data = await res.json();
      if (stopped) return;
      setRoles(Array.isArray(data.roles) ? data.roles : []);
    }

    refreshQr();
    loadRoles();
    const timer = window.setInterval(refreshQr, 60 * 1000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [currentEmployeeId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Profile (Editable)</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input className="field" placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm((v) => ({ ...v, employeeId: e.target.value }))} />
            <input className="field" placeholder="First name" value={form.firstName} onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))} />
            <input className="field" placeholder="Last name" value={form.lastName} onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))} />
            <input className="field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
            <input className="field" placeholder="Contact number" value={form.contactNumber} onChange={(e) => setForm((v) => ({ ...v, contactNumber: e.target.value }))} />
            <input className="field" type="number" min={0} step="0.01" placeholder="Hourly rate" value={form.hourlyRate} onChange={(e) => setForm((v) => ({ ...v, hourlyRate: e.target.value }))} />
            <select className="field" value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} {role.isActive ? "" : "(Inactive)"}
                </option>
              ))}
            </select>
            <select className="field" value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
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

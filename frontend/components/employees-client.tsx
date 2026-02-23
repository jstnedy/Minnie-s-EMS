"use client";

type Employee = {
  id: string;
  employeeId: string;
  fullName: string;
  role: "ADMIN" | "SUPERVISOR" | "EMPLOYEE";
  status: "ACTIVE" | "INACTIVE";
  hourlyRate: string;
};

import Link from "next/link";
import { useEffect, useState } from "react";

export function EmployeesClient() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    fullName: "",
    email: "",
    contactNumber: "",
    role: "EMPLOYEE",
    hourlyRate: "12.00",
    passkey: "000000",
    status: "ACTIVE",
  });

  async function load() {
    const res = await fetch(`/api/employees?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const sorted = Array.isArray(data)
      ? [...data].sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId), undefined, { numeric: true }))
      : [];
    setRows(sorted);
  }

  useEffect(() => {
    load();
  }, []);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hourlyRate: Number(form.hourlyRate) }),
    });

    setLoading(false);
    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const message = errorBody?.error
        ? `${errorBody.error}${errorBody.detail ? `: ${errorBody.detail}` : ""}`
        : "Unable to create employee";
      alert(message);
      return;
    }

    setForm({
      employeeId: "",
      fullName: "",
      email: "",
      contactNumber: "",
      role: "EMPLOYEE",
      hourlyRate: "12.00",
      passkey: "000000",
      status: "ACTIVE",
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Add Employee</h2>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={createEmployee}>
          <input className="field" placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm((v) => ({ ...v, employeeId: e.target.value }))} required />
          <input className="field" placeholder="Full Name" value={form.fullName} onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))} required />
          <input className="field" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
          <input className="field" placeholder="Contact Number" value={form.contactNumber} onChange={(e) => setForm((v) => ({ ...v, contactNumber: e.target.value }))} />
          <input className="field" placeholder="Hourly Rate" type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm((v) => ({ ...v, hourlyRate: e.target.value }))} required />
          <input className="field" placeholder="Initial 6-digit passkey" pattern="\d{6}" value={form.passkey} onChange={(e) => setForm((v) => ({ ...v, passkey: e.target.value }))} required />
          <select className="field" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}>
            <option value="EMPLOYEE">Staff</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select className="field" value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Create"}</button>
        </form>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Employee List</h2>
          <div className="flex gap-2">
            <input className="field min-w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-secondary" onClick={load}>Filter</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2">Employee ID</th>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Rate</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2">{e.employeeId}</td>
                  <td className="py-2">{e.fullName}</td>
                  <td className="py-2">{e.role}</td>
                  <td className="py-2">${Number(e.hourlyRate).toFixed(2)}</td>
                  <td className="py-2">{e.status}</td>
                  <td className="py-2">
                    <Link className="text-orange-700 underline" href={`/employees/${e.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

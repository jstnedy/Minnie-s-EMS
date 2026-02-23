"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Role = {
  id: string;
  name: string;
  isActive: boolean;
};

type Employee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE";
  hourlyRate: string;
  role: Role;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  roleId: string;
  hourlyRate: string;
  passkey: string;
  status: "ACTIVE" | "INACTIVE";
};

function formatPhp(value: string | number) {
  return `?${Number(value).toFixed(2)}`;
}

function validateForm(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";

  if (form.email.trim()) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email.trim())) errors.email = "Invalid email format.";
  }

  if (!form.roleId) errors.roleId = "Role is required.";

  const rate = form.hourlyRate.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(rate)) {
    errors.hourlyRate = "Use a valid amount with up to 2 decimals.";
  } else if (Number(rate) < 0) {
    errors.hourlyRate = "Hourly rate must be at least 0.";
  }

  if (!/^\d{6}$/.test(form.passkey)) errors.passkey = "Passkey must be 6 digits.";

  return errors;
}

export function EmployeesClient() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    roleId: "",
    hourlyRate: "12.00",
    passkey: "000000",
    status: "ACTIVE",
  });

  const hasRows = rows.length > 0;

  async function loadRoles(includeInactive = false) {
    const res = await fetch(`/api/roles${includeInactive ? "?includeInactive=true" : ""}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Unable to load roles");
      return;
    }

    setRoles(Array.isArray(data.roles) ? data.roles : []);
    setCanManageRoles(Boolean(data.canManageRoles));

    if (!form.roleId && Array.isArray(data.roles) && data.roles.length > 0) {
      const firstActive = data.roles.find((r: Role) => r.isActive);
      if (firstActive) {
        setForm((prev) => ({ ...prev, roleId: firstActive.id }));
      }
    }
  }

  async function loadEmployees() {
    const res = await fetch(`/api/employees?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Unable to load employees");
      setRows([]);
      return;
    }

    const sorted = Array.isArray(data)
      ? [...data].sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId), undefined, { numeric: true }))
      : [];

    setRows(sorted);
  }

  useEffect(() => {
    void loadRoles(true);
    void loadEmployees();
  }, []);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      roleId: form.roleId,
      hourlyRate: form.hourlyRate,
      passkey: form.passkey,
      status: form.status,
    };

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      const message = data?.error ? `${data.error}${data.detail ? `: ${data.detail}` : ""}` : "Unable to create employee";
      alert(message);
      return;
    }

    alert(`Employee created. Generated ID: ${data.generatedEmployeeId}`);

    setForm({
      firstName: "",
      lastName: "",
      email: "",
      contactNumber: "",
      roleId: roles.find((r) => r.isActive)?.id || "",
      hourlyRate: "12.00",
      passkey: "000000",
      status: "ACTIVE",
    });
    setFormErrors({});

    await loadEmployees();
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRole.trim()) return;

    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRole.trim() }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error || "Unable to create role");
      return;
    }

    setNewRole("");
    await loadRoles(true);
  }

  async function toggleRoleActive(role: Role) {
    setRoleBusyId(role.id);
    const res = await fetch(`/api/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !role.isActive }),
    });

    const data = await res.json().catch(() => null);
    setRoleBusyId(null);

    if (!res.ok) {
      alert(data?.error || "Unable to update role");
      return;
    }

    await loadRoles(true);
  }

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive), [roles]);

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Add Employee</h2>

        <form className="space-y-4" onSubmit={createEmployee}>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Identity</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <input
                  className="field"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))}
                  required
                />
                {formErrors.firstName ? <p className="mt-1 text-xs text-red-600">{formErrors.firstName}</p> : null}
              </div>
              <div>
                <input
                  className="field"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))}
                  required
                />
                {formErrors.lastName ? <p className="mt-1 text-xs text-red-600">{formErrors.lastName}</p> : null}
              </div>
              <div>
                <input
                  className="field"
                  type="email"
                  placeholder="Email (optional)"
                  value={form.email}
                  onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                />
                {formErrors.email ? <p className="mt-1 text-xs text-red-600">{formErrors.email}</p> : null}
              </div>
              <div>
                <input
                  className="field"
                  type="tel"
                  placeholder="Contact Number"
                  value={form.contactNumber}
                  onChange={(e) => setForm((v) => ({ ...v, contactNumber: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Employment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <select className="field" value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))}>
                  <option value="">Select role</option>
                  {activeRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {formErrors.roleId ? <p className="mt-1 text-xs text-red-600">{formErrors.roleId}</p> : null}
              </div>
              <div>
                <select className="field" value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as FormState["status"] }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">?</span>
                  <input
                    className="field pl-7"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="12.00"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((v) => ({ ...v, hourlyRate: e.target.value }))}
                    required
                  />
                </div>
                {formErrors.hourlyRate ? <p className="mt-1 text-xs text-red-600">{formErrors.hourlyRate}</p> : null}
              </div>
              <div>
                <input
                  className="field"
                  placeholder="Initial 6-digit passkey"
                  pattern="\d{6}"
                  value={form.passkey}
                  onChange={(e) => setForm((v) => ({ ...v, passkey: e.target.value }))}
                  required
                />
                {formErrors.passkey ? <p className="mt-1 text-xs text-red-600">{formErrors.passkey}</p> : null}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary min-w-32" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>

      {canManageRoles ? (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Role Management</h2>
          <form className="flex gap-2" onSubmit={createRole}>
            <input className="field max-w-sm" placeholder="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
            <button className="btn-primary">Add Role</button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-lg border border-slate-200 p-3">
                <p className="font-medium">{role.name}</p>
                <p className="text-xs text-slate-600">{role.isActive ? "Active" : "Inactive"}</p>
                <button className="btn-secondary mt-2" disabled={roleBusyId === role.id} onClick={() => toggleRoleActive(role)}>
                  {roleBusyId === role.id ? "Saving..." : role.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Employee List</h2>
          <div className="flex gap-2">
            <input className="field min-w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn-secondary" onClick={loadEmployees}>Filter</button>
          </div>
        </div>

        {!hasRows ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
            No employees yet. Create one using the form above.
          </div>
        ) : (
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
                {rows.map((employee) => (
                  <tr key={employee.id} className="border-b border-slate-100">
                    <td className="py-2">{employee.employeeId}</td>
                    <td className="py-2">{`${employee.firstName} ${employee.lastName}`.trim()}</td>
                    <td className="py-2">{employee.role?.name ?? "-"}</td>
                    <td className="py-2">{formatPhp(employee.hourlyRate)}/hr</td>
                    <td className="py-2">{employee.status}</td>
                    <td className="py-2">
                      <Link className="text-orange-700 underline" href={`/employees/${employee.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

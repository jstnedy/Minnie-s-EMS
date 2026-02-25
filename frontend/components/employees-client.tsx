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
  confirmPasskey: string;
  status: "ACTIVE" | "INACTIVE";
};

function formatPhp(value: string | number) {
  return `PHP ${Number(value).toFixed(2)}`;
}

function validateForm(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  const weakPasskeys = new Set(["000000", "111111", "123456"]);
  const contactNumberRegex = /^[0-9+\-\s()]{7,20}$/;

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!form.contactNumber.trim()) errors.contactNumber = "Contact number is required.";
  else if (!contactNumberRegex.test(form.contactNumber.trim())) errors.contactNumber = "Contact number must be 7-20 characters and contain valid phone symbols.";

  if (form.email.trim()) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email.trim())) errors.email = "Invalid email format.";
  }

  if (!form.roleId) errors.roleId = "Position is required.";

  const rate = form.hourlyRate.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(rate)) {
    errors.hourlyRate = "Use a valid amount with up to 2 decimals.";
  } else if (Number(rate) <= 0) {
    errors.hourlyRate = "Hourly rate must be greater than 0.";
  } else if (Number(rate) > 100000) {
    errors.hourlyRate = "Hourly rate exceeds allowed maximum.";
  }

  if (!/^\d{6}$/.test(form.passkey)) {
    errors.passkey = "Passkey must be exactly 6 digits.";
  } else if (weakPasskeys.has(form.passkey)) {
    errors.passkey = "Passkey is too common.";
  }

  if (!form.confirmPasskey) {
    errors.confirmPasskey = "Confirm passkey is required.";
  } else if (form.confirmPasskey !== form.passkey) {
    errors.confirmPasskey = "Passkeys do not match.";
  }

  return errors;
}

export function EmployeesClient({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPasskeys, setShowPasskeys] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    roleId: "",
    hourlyRate: "12.00",
    passkey: "",
    confirmPasskey: "",
    status: "ACTIVE",
  });
  const formErrors = useMemo(() => validateForm(form), [form]);
  const canSubmit = Object.keys(formErrors).length === 0;

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
    setSubmitAttempted(true);

    if (!canSubmit) {
      alert("Please complete all required fields correctly.");
      return;
    }

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
      passkey: "",
      confirmPasskey: "",
      status: "ACTIVE",
    });
    setSubmitAttempted(false);

    await loadEmployees();
  }

  function cancelCreateForm() {
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      contactNumber: "",
      roleId: roles.find((r) => r.isActive)?.id || "",
      hourlyRate: "12.00",
      passkey: "",
      confirmPasskey: "",
      status: "ACTIVE",
    });
    setSubmitAttempted(false);
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

  async function deleteRole(role: Role) {
    if (!canDelete) return;
    const confirmed = window.confirm(`Delete role "${role.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setRoleBusyId(role.id);
    const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setRoleBusyId(null);

    if (!res.ok) {
      alert(data?.error || "Unable to delete role");
      return;
    }

    await loadRoles(true);
    if (form.roleId === role.id) {
      setForm((prev) => ({ ...prev, roleId: roles.find((r) => r.isActive && r.id !== role.id)?.id || "" }));
    }
  }

  async function deleteEmployee(id: string) {
    const confirmed = window.confirm("Delete this employee record?");
    if (!confirmed) return;

    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      alert(data?.error || "Unable to delete employee");
      return;
    }

    await loadEmployees();
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
                <label className="mb-1 block text-sm font-medium text-slate-700">First Name *</label>
                <input
                  className="field"
                  placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))}
                  required
                />
                {(submitAttempted || form.firstName) && formErrors.firstName ? <p className="mt-1 text-xs text-red-600">{formErrors.firstName}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last Name *</label>
                <input
                  className="field"
                  placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))}
                  required
                />
                {(submitAttempted || form.lastName) && formErrors.lastName ? <p className="mt-1 text-xs text-red-600">{formErrors.lastName}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
                <input
                  className="field"
                  type="email"
                  placeholder="Email (optional)"
                  value={form.email}
                  onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                />
                {(submitAttempted || form.email) && formErrors.email ? <p className="mt-1 text-xs text-red-600">{formErrors.email}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Contact Number *</label>
                <input
                  className="field"
                  type="tel"
                  placeholder="Contact Number"
                  value={form.contactNumber}
                  onChange={(e) => setForm((v) => ({ ...v, contactNumber: e.target.value }))}
                  required
                />
                {(submitAttempted || form.contactNumber) && formErrors.contactNumber ? <p className="mt-1 text-xs text-red-600">{formErrors.contactNumber}</p> : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Employment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Position *</label>
                <select className="field" value={form.roleId} onChange={(e) => setForm((v) => ({ ...v, roleId: e.target.value }))}>
                  <option value="">Select role</option>
                  {activeRoles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {submitAttempted && formErrors.roleId ? <p className="mt-1 text-xs text-red-600">{formErrors.roleId}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
                <select className="field" value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as FormState["status"] }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Hourly Rate (PHP) *</label>
                <div className="mt-1 flex w-full overflow-hidden rounded-lg border border-slate-300 focus-within:border-orange-500">
                  <span className="flex items-center bg-slate-50 px-3 text-sm text-slate-600">PHP</span>
                  <input
                    className="w-full px-3 py-2 text-right text-sm outline-none"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100000}
                    placeholder="12.00"
                    value={form.hourlyRate}
                    onChange={(e) => setForm((v) => ({ ...v, hourlyRate: e.target.value }))}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) return;
                      const value = Number(e.target.value);
                      if (!Number.isNaN(value)) {
                        setForm((v) => ({ ...v, hourlyRate: value.toFixed(2) }));
                      }
                    }}
                    required
                  />
                </div>
                {(submitAttempted || form.hourlyRate) && formErrors.hourlyRate ? <p className="mt-1 text-xs text-red-600">{formErrors.hourlyRate}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Employee Passkey (6-digit PIN) *</label>
                <input
                  className="field"
                  type={showPasskeys ? "text" : "password"}
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN"
                  value={form.passkey}
                  onChange={(e) => setForm((v) => ({ ...v, passkey: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  required
                />
                {(submitAttempted || form.passkey) && formErrors.passkey ? <p className="mt-1 text-xs text-red-600">{formErrors.passkey}</p> : null}
              </div>
              <div className="md:col-start-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Passkey *</label>
                <input
                  className="field"
                  type={showPasskeys ? "text" : "password"}
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="Re-enter 6-digit PIN"
                  value={form.confirmPasskey}
                  onChange={(e) => setForm((v) => ({ ...v, confirmPasskey: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  required
                />
                {(submitAttempted || form.confirmPasskey) && formErrors.confirmPasskey ? <p className="mt-1 text-xs text-red-600">{formErrors.confirmPasskey}</p> : null}
              </div>
              <div className="md:col-start-2">
                <button className="btn-secondary" type="button" onClick={() => setShowPasskeys((v) => !v)}>
                  {showPasskeys ? "Hide PIN" : "Show PIN"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-secondary min-w-24" type="button" onClick={cancelCreateForm} disabled={submitting}>
              Cancel
            </button>
            <button className="btn-primary min-w-32" type="submit" disabled={submitting}>
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
                <div className="mt-2 flex gap-2">
                  <button className="btn-secondary" disabled={roleBusyId === role.id} onClick={() => toggleRoleActive(role)}>
                    {roleBusyId === role.id ? "Saving..." : role.isActive ? "Deactivate" : "Activate"}
                  </button>
                  {canDelete ? (
                    <button className="btn-secondary" disabled={roleBusyId === role.id} onClick={() => deleteRole(role)}>
                      {roleBusyId === role.id ? "Saving..." : "Delete"}
                    </button>
                  ) : null}
                </div>
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
                      <div className="flex gap-3">
                        <Link className="text-orange-700 underline" href={`/employees/${employee.id}`}>
                          View
                        </Link>
                        {canDelete ? (
                          <button className="text-red-700 underline" onClick={() => deleteEmployee(employee.id)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
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

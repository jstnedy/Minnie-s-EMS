"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserRole } from "@prisma/client";

export function AppNav({ role }: { role: UserRole }) {
  const links = [
    { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "SUPERVISOR"] },
    { href: "/employees", label: "Employees", roles: ["ADMIN", "SUPERVISOR", "EMPLOYEE"] },
    { href: "/attendance", label: "Attendance", roles: ["ADMIN", "SUPERVISOR"] },
    { href: "/payroll", label: "Payroll", roles: ["ADMIN", "SUPERVISOR"] },
  ].filter((l) => l.roles.includes(role));

  return (
    <div className="sticky top-0 z-10 border-b border-orange-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="text-lg font-semibold text-orange-700">Minnie&apos;s Cakes & Pastries</div>
        <nav className="flex items-center gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-700 hover:text-orange-700">
              {l.label}
            </Link>
          ))}
          <button className="btn-secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}

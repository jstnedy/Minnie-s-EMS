"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  employeeId: string;
  firstName: string;
  lastName: string;
};

export function KioskClient({
  employeeId,
  qrSlot,
  qrSig,
}: {
  employeeId: string;
  qrSlot: string;
  qrSig: string;
}) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [passkey, setPasskey] = useState("");
  const [status, setStatus] = useState("");
  const [activeQrSlot, setActiveQrSlot] = useState(qrSlot);
  const [activeQrSig, setActiveQrSig] = useState(qrSig);
  const [isTimedIn, setIsTimedIn] = useState(false);
  const [openShiftTimeIn, setOpenShiftTimeIn] = useState<string | null>(null);
  const [passkeyVerified, setPasskeyVerified] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);

  function passkeyStorageKey(id: string) {
    return `kiosk-passkey:${id}`;
  }

  async function loadKioskStatus() {
    if (!employeeId) return;
    const res = await fetch(`/api/kiosk/status?employeeId=${encodeURIComponent(employeeId)}`);
    if (!res.ok) return;
    const data = await res.json();
    setEmployee(data.employee);
    setIsTimedIn(Boolean(data.isTimedIn));
    setOpenShiftTimeIn(data.openShiftTimeIn ?? null);
  }

  async function ensureQrToken() {
    if (!employeeId) return;
    if (activeQrSlot && activeQrSig) {
      return { slot: activeQrSlot, sig: activeQrSig };
    }

    const res = await fetch(`/api/kiosk/qr?employeeId=${encodeURIComponent(employeeId)}`);
    if (!res.ok) return;
    const data = await res.json();
    const slot = String(data.slot ?? "");
    const sig = String(data.signature ?? "");
    setActiveQrSlot(slot);
    setActiveQrSig(sig);
    return { slot, sig };
  }

  useEffect(() => {
    loadKioskStatus();
    ensureQrToken();

    const timer = window.setInterval(() => {
      loadKioskStatus();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, [employeeId]);

  async function verifyPasskey() {
    const token = await ensureQrToken();
    const slot = token?.slot || activeQrSlot;
    const sig = token?.sig || activeQrSig;
    if (!employeeId || !slot || !sig) {
      setStatus("Invalid or expired QR code. Please rescan.");
      return;
    }

    if (!/^\d{6}$/.test(passkey)) {
      setStatus("Enter a valid 6-digit passkey first.");
      setPasskeyVerified(false);
      return;
    }

    setVerifyingPasskey(true);
    const res = await fetch("/api/attendance/verify-passkey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        passkey,
        qrSlot: Number(slot),
        qrSig: sig,
      }),
    });
    setVerifyingPasskey(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPasskeyVerified(false);
      setStatus(data?.error || "Passkey verification failed");
      return;
    }

    if (!isTimedIn) {
      sessionStorage.setItem(passkeyStorageKey(employeeId), passkey);
      setStatus("Passkey verified. Redirecting to photo capture...");
      router.push(`/attendance/kiosk/photo?employeeId=${encodeURIComponent(employeeId)}&slot=${encodeURIComponent(slot)}&sig=${encodeURIComponent(sig)}`);
      return;
    }

    setPasskeyVerified(true);
    setStatus("Passkey verified. You can continue to Time Out.");
  }

  async function runTimeOut() {
    if (!passkeyVerified) {
      setStatus("Verify passkey first.");
      return;
    }

    const token = await ensureQrToken();
    const slot = token?.slot || activeQrSlot;
    const sig = token?.sig || activeQrSig;
    if (!employeeId || !slot || !sig) {
      setStatus("Invalid or expired QR code. Please rescan.");
      return;
    }

    const res = await fetch("/api/attendance/time-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        passkey,
        qrSlot: Number(slot),
        qrSig: sig,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed");
      if (res.status === 401) setPasskeyVerified(false);
      return;
    }

    const fullName = employee ? `${employee.firstName} ${employee.lastName}` : "Employee";
    setStatus(`Time Out recorded. Goodbye, ${fullName}.`);
    setPasskey("");
    setPasskeyVerified(false);
    await loadKioskStatus();
    await ensureQrToken();
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-orange-700">Attendance Kiosk</h1>
      <p className="text-center text-sm text-slate-600">{employee ? `${employee.firstName} ${employee.lastName}` : "Unknown employee"}</p>
      {employee ? <p className="text-center text-sm text-orange-700">Welcome, {employee.firstName}! Please enter your passkey.</p> : null}
      <p className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${isTimedIn ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700"}`}>
        {isTimedIn
          ? `Currently timed in${openShiftTimeIn ? ` since ${new Date(openShiftTimeIn).toLocaleString()}` : ""}`
          : "Currently timed out"}
      </p>
      <input
        className="field text-center text-lg tracking-[0.3em]"
        maxLength={6}
        pattern="\d{6}"
        placeholder="000000"
        type="password"
        value={passkey}
        onChange={(e) => {
          setPasskey(e.target.value.replace(/\D/g, "").slice(0, 6));
          setPasskeyVerified(false);
        }}
      />
      <button className="btn-secondary" onClick={verifyPasskey} disabled={verifyingPasskey || passkey.length !== 6}>
        {verifyingPasskey ? "Verifying..." : "Verify Passkey"}
      </button>
      <div className="grid grid-cols-1 gap-2">
        {!isTimedIn ? (
          <button className="btn-primary" onClick={verifyPasskey} disabled={verifyingPasskey || passkey.length !== 6}>Continue to Time In Photo</button>
        ) : (
          <button className="btn-secondary" onClick={runTimeOut} disabled={!passkeyVerified}>Time Out</button>
        )}
      </div>
      <p className="text-center text-sm text-slate-700">{status}</p>
    </div>
  );
}

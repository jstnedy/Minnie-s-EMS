"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  employeeId: string;
  firstName: string;
  lastName: string;
};

function passkeyStorageKey(id: string) {
  return `kiosk-passkey:${id}`;
}

export function KioskTimeInPhotoClient({
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
  const [status, setStatus] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function loadKioskStatus() {
      if (!employeeId) return;
      const res = await fetch(`/api/kiosk/status?employeeId=${encodeURIComponent(employeeId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setEmployee(data.employee);
    }

    loadKioskStatus();
  }, [employeeId]);

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera not supported on this device/browser");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        setStatus("Camera permission is required for Time In photo.");
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  async function submitTimeIn() {
    const passkey = sessionStorage.getItem(passkeyStorageKey(employeeId)) ?? "";
    if (!passkey) {
      setStatus("Passkey verification expired. Please scan QR and verify passkey again.");
      return;
    }

    const photoDataUrl = capturePhoto();
    if (!photoDataUrl) {
      setStatus("Photo capture is required for Time In.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/attendance/time-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        passkey,
        qrSlot: Number(qrSlot),
        qrSig,
        photoDataUrl,
      }),
    });
    setSubmitting(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error || "Failed to record Time In");
      return;
    }

    sessionStorage.removeItem(passkeyStorageKey(employeeId));
    setStatus("Time In recorded successfully.");
    window.setTimeout(() => {
      router.push(`/attendance/kiosk?employeeId=${encodeURIComponent(employeeId)}&slot=${encodeURIComponent(qrSlot)}&sig=${encodeURIComponent(qrSig)}`);
    }, 900);
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-sm space-y-4 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <h1 className="text-center text-xl font-semibold text-orange-700">Time In Photo Capture</h1>
      <p className="text-center text-sm text-slate-600">{employee ? `${employee.firstName} ${employee.lastName}` : "Unknown employee"}</p>
      <p className="rounded-lg bg-orange-50 px-3 py-2 text-center text-sm text-orange-700">
        Take a clear selfie to complete Time In.
      </p>
      <div className="overflow-hidden rounded-xl border border-orange-100 bg-slate-900">
        <video ref={videoRef} className="h-52 w-full object-cover" playsInline muted />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button className="btn-primary" onClick={submitTimeIn} disabled={!cameraReady || submitting}>
        {submitting ? "Submitting..." : "Time In"}
      </button>
      <button
        className="btn-secondary"
        onClick={() =>
          router.push(
            `/attendance/kiosk?employeeId=${encodeURIComponent(employeeId)}&slot=${encodeURIComponent(qrSlot)}&sig=${encodeURIComponent(qrSig)}`,
          )
        }
      >
        Back
      </button>
      <p className="text-center text-sm text-slate-700">{status}</p>
    </div>
  );
}

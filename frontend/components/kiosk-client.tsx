"use client";

import { useEffect, useRef, useState } from "react";

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
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [passkey, setPasskey] = useState("");
  const [status, setStatus] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    fetch(`/api/employees?employeeId=${encodeURIComponent(employeeId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setEmployee({
            employeeId: data[0].employeeId,
            firstName: data[0].firstName,
            lastName: data[0].lastName,
          });
        }
      });
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
        setStatus("Camera permission is required for attendance");
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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setPhotoPreview(dataUrl);
    return dataUrl;
  }

  async function runAction(action: "time-in" | "time-out") {
    if (!employeeId || !qrSlot || !qrSig) {
      setStatus("Invalid or expired QR code. Please rescan.");
      return;
    }

    const photoDataUrl = capturePhoto();
    if (!photoDataUrl) {
      setStatus("Live photo capture is required");
      return;
    }

    const res = await fetch(`/api/attendance/${action}`, {
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
      <p className="text-center text-sm text-slate-600">{employee ? `${employee.firstName} ${employee.lastName}` : "Unknown employee"}</p>
      <div className="overflow-hidden rounded-xl border border-orange-100 bg-slate-900">
        <video ref={videoRef} className="h-52 w-full object-cover" playsInline muted />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {photoPreview ? <img src={photoPreview} alt="Captured proof" className="h-24 w-full rounded-xl object-cover" /> : null}
      <input
        className="field text-center text-lg tracking-[0.3em]"
        maxLength={6}
        pattern="\d{6}"
        placeholder="000000"
        value={passkey}
        onChange={(e) => setPasskey(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={() => runAction("time-in")} disabled={!cameraReady}>Time In</button>
        <button className="btn-secondary" onClick={() => runAction("time-out")} disabled={!cameraReady}>Time Out</button>
      </div>
      <p className="text-center text-sm text-slate-700">{status}</p>
    </div>
  );
}

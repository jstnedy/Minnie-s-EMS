export const dynamic = "force-dynamic";
import { KioskTimeInPhotoClient } from "@/components/kiosk-timein-photo-client";

export default async function AttendanceKioskPhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; slot?: string; sig?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-orange-50 px-3 py-6">
      <KioskTimeInPhotoClient employeeId={params.employeeId ?? ""} qrSlot={params.slot ?? ""} qrSig={params.sig ?? ""} />
    </main>
  );
}

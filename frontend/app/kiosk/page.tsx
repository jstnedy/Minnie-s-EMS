export const dynamic = "force-dynamic";
import { KioskClient } from "@/components/kiosk-client";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; slot?: string; sig?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-orange-50 px-3 py-6">
      <KioskClient employeeId={params.employeeId ?? ""} qrSlot={params.slot ?? ""} qrSig={params.sig ?? ""} />
    </main>
  );
}


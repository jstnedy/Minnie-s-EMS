export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-orange-700">Minnie&apos;s Cakes & Pastries</h1>
        <p className="text-sm text-slate-600">Employee Management + Attendance + Payroll</p>
        <LoginForm />
      </div>
    </main>
  );
}


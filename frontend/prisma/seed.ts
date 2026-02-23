import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const supervisorPassword = await bcrypt.hash("Supervisor123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@pastrypal.local" },
    update: {},
    create: {
      email: "admin@pastrypal.local",
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@pastrypal.local" },
    update: {},
    create: {
      email: "supervisor@pastrypal.local",
      passwordHash: supervisorPassword,
      role: UserRole.SUPERVISOR,
    },
  });

  const employees = [
    { employeeId: "EMP100", fullName: "Ava Baker", hourlyRate: "12.50", passkey: "111111" },
    { employeeId: "EMP101", fullName: "Noah Frost", hourlyRate: "13.00", passkey: "222222" },
    { employeeId: "EMP102", fullName: "Mia Dough", hourlyRate: "12.75", passkey: "333333" },
  ];

  for (const e of employees) {
    const passkeyHash = await bcrypt.hash(e.passkey, 10);
    await prisma.employee.upsert({
      where: { employeeId: e.employeeId },
      update: {},
      create: {
        employeeId: e.employeeId,
        fullName: e.fullName,
        hourlyRate: e.hourlyRate,
        passkeyHash,
        role: UserRole.EMPLOYEE,
      },
    });
  }

  await prisma.employee.upsert({
    where: { employeeId: "SUP200" },
    update: { userId: supervisor.id },
    create: {
      employeeId: "SUP200",
      fullName: "Lead Supervisor",
      hourlyRate: "18.00",
      passkeyHash: await bcrypt.hash("444444", 10),
      role: UserRole.SUPERVISOR,
      userId: supervisor.id,
    },
  });

  await prisma.employee.upsert({
    where: { employeeId: "ADM900" },
    update: { userId: admin.id },
    create: {
      employeeId: "ADM900",
      fullName: "System Admin",
      hourlyRate: "22.00",
      passkeyHash: await bcrypt.hash("555555", 10),
      role: UserRole.ADMIN,
      userId: admin.id,
    },
  });

  console.log("Seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

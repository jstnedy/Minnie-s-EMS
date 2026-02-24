import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [adminRole, supervisorRole, staffRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "Admin" },
      update: { isActive: true },
      create: { name: "Admin", isActive: true },
    }),
    prisma.role.upsert({
      where: { name: "Supervisor" },
      update: { isActive: true },
      create: { name: "Supervisor", isActive: true },
    }),
    prisma.role.upsert({
      where: { name: "Staff" },
      update: { isActive: true },
      create: { name: "Staff", isActive: true },
    }),
  ]);

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
    { employeeId: "EMP-2026-000100", firstName: "Ava", lastName: "Baker", hourlyRate: "12.50", passkey: "111111" },
    { employeeId: "EMP-2026-000101", firstName: "Noah", lastName: "Frost", hourlyRate: "13.00", passkey: "222222" },
    { employeeId: "EMP-2026-000102", firstName: "Mia", lastName: "Dough", hourlyRate: "12.75", passkey: "333333" },
  ];

  for (const e of employees) {
    const passkeyHash = await bcrypt.hash(e.passkey, 10);
    await prisma.employee.upsert({
      where: { employeeId: e.employeeId },
      update: {},
      create: {
        employeeId: e.employeeId,
        firstName: e.firstName,
        lastName: e.lastName,
        hourlyRate: e.hourlyRate,
        passkeyHash,
        roleId: staffRole.id,
      },
    });
  }

  await prisma.employee.upsert({
    where: { employeeId: "SUP200" },
    update: { userId: supervisor.id },
    create: {
      employeeId: "SUP200",
      firstName: "Lead",
      lastName: "Supervisor",
      hourlyRate: "18.00",
      passkeyHash: await bcrypt.hash("444444", 10),
      roleId: supervisorRole.id,
      userId: supervisor.id,
    },
  });

  await prisma.employee.upsert({
    where: { employeeId: "ADM900" },
    update: { userId: admin.id },
    create: {
      employeeId: "ADM900",
      firstName: "System",
      lastName: "Admin",
      hourlyRate: "22.00",
      passkeyHash: await bcrypt.hash("555555", 10),
      roleId: adminRole.id,
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

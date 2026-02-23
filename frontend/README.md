# Pastry Pal (Next.js + Prisma)

Production-ready Employee Management + Attendance + Payroll web app for a pastry shop.

## Stack
- Next.js App Router + TypeScript + Tailwind CSS
- Next.js API Routes + server-side auth checks
- PostgreSQL + Prisma ORM
- NextAuth (Credentials) with RBAC
- Zod validation
- QR code attendance kiosk (URL-based, phone camera friendly)

## Setup
1. `cd frontend`
2. `copy .env.example .env` (Windows) and update values.
3. Install dependencies: `npm install`
4. Generate Prisma client: `npm run prisma:generate`
5. Run migrations: `npx prisma migrate dev`
6. Seed data: `npm run prisma:seed`
7. Start app: `npm run dev`

## Required Environment Variables
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `APP_BASE_URL`

## Seeded Credentials
- Admin login
  - Email: `admin@pastrypal.local`
  - Password: `Admin123!`
- Supervisor login
  - Email: `supervisor@pastrypal.local`
  - Password: `Supervisor123!`

## Seeded Employee Passkeys
- `EMP100` -> `111111`
- `EMP101` -> `222222`
- `EMP102` -> `333333`

## Implemented Routes
Pages:
- `/login`
- `/dashboard`
- `/employees`
- `/employees/[id]`
- `/attendance`
- `/payroll`
- `/kiosk?employeeId=...`
- `/me`

API:
- `POST /api/auth/login`
- `GET,POST /api/employees`
- `GET,PATCH,DELETE /api/employees/:id`
- `POST /api/employees/:id/reset-passkey`
- `POST /api/attendance/time-in`
- `POST /api/attendance/time-out`
- `GET /api/attendance`
- `PATCH /api/attendance/:id`
- `POST /api/payroll/compute?month=&year=`
- `POST /api/payroll/finalize`
- `GET /api/payroll/export?month=&year=`

## Security + Rules
- Passwords and passkeys are hashed with bcrypt.
- All payloads are validated with Zod.
- API routes enforce server-side RBAC.
- Middleware protects role-specific pages.
- Passkey attempts lock for 5 minutes after 5 failed tries.
- Attendance edits are audit-logged.
- Payroll finalize is admin-only and immutable after final.

## Notes
- Employee account creation supports optional user account creation if an email is supplied.
- New user accounts are assigned a temporary password: `Temp1234!`.

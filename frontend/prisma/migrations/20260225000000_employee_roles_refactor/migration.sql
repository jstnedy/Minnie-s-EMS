-- roles table
CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_ci_key" ON "Role"(LOWER("name"));

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "role_id" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "contact_number" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hourly_rate" DECIMAL(10,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "passkey_hash" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "must_change_passkey" BOOLEAN DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

-- Backfill split names from existing fullName.
UPDATE "Employee"
SET
  "first_name" = COALESCE(NULLIF(split_part("fullName", ' ', 1), ''), 'Unknown'),
  "last_name" = COALESCE(NULLIF(trim(substring("fullName" from position(' ' in "fullName") + 1)), ''), 'Employee')
WHERE ("first_name" IS NULL OR "last_name" IS NULL)
  AND "fullName" IS NOT NULL;

UPDATE "Employee" SET "contact_number" = "contactNumber" WHERE "contact_number" IS NULL AND "contactNumber" IS NOT NULL;
UPDATE "Employee" SET "hourly_rate" = "hourlyRate" WHERE "hourly_rate" IS NULL AND "hourlyRate" IS NOT NULL;
UPDATE "Employee" SET "passkey_hash" = "passkeyHash" WHERE "passkey_hash" IS NULL AND "passkeyHash" IS NOT NULL;
UPDATE "Employee" SET "employee_id" = "employeeId" WHERE "employee_id" IS NULL AND "employeeId" IS NOT NULL;
UPDATE "Employee" SET "user_id" = "userId" WHERE "user_id" IS NULL AND "userId" IS NOT NULL;
UPDATE "Employee" SET "must_change_passkey" = COALESCE("mustChangePasskey", false) WHERE "must_change_passkey" IS NULL;
UPDATE "Employee" SET "created_at" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "created_at" IS NULL;
UPDATE "Employee" SET "updated_at" = COALESCE("updatedAt", CURRENT_TIMESTAMP) WHERE "updated_at" IS NULL;

-- Seed default roles.
INSERT INTO "Role" ("id", "name", "is_active", "created_at", "updated_at")
VALUES
  ('role_admin_default', 'Admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_supervisor_default', 'Supervisor', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_staff_default', 'Staff', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Map legacy enum role to new role table.
UPDATE "Employee" e
SET "role_id" = r."id"
FROM "Role" r
WHERE e."role_id" IS NULL
  AND (
    (e."role" = 'ADMIN' AND LOWER(r."name") = 'admin') OR
    (e."role" = 'SUPERVISOR' AND LOWER(r."name") = 'supervisor') OR
    (e."role" = 'EMPLOYEE' AND LOWER(r."name") = 'staff')
  );

-- Ensure required values exist for all rows.
UPDATE "Employee"
SET "first_name" = COALESCE("first_name", 'Unknown'),
    "last_name" = COALESCE("last_name", 'Employee')
WHERE "first_name" IS NULL OR "last_name" IS NULL;

UPDATE "Employee"
SET "role_id" = (SELECT "id" FROM "Role" WHERE LOWER("name")='staff' LIMIT 1)
WHERE "role_id" IS NULL;

ALTER TABLE "Employee" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "last_name" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "passkey_hash" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "hourly_rate" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "employee_id" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_role_id_fkey"
FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Employee_role_id_idx" ON "Employee"("role_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employee_id_key" ON "Employee"("employee_id");

-- Cleanup legacy columns
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "fullName";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "contactNumber";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "hourlyRate";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "passkeyHash";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "employeeId";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "mustChangePasskey";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "role";

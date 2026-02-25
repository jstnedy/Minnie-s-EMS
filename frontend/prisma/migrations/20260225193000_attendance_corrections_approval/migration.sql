DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CorrectionStatus') THEN
    CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL,
  "attendance_log_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "requested_time_in" TIMESTAMP(3) NOT NULL,
  "requested_time_out" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendanceCorrectionRequest_attendance_log_id_fkey'
  ) THEN
    ALTER TABLE "AttendanceCorrectionRequest"
      ADD CONSTRAINT "AttendanceCorrectionRequest_attendance_log_id_fkey"
      FOREIGN KEY ("attendance_log_id") REFERENCES "AttendanceLog"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendanceCorrectionRequest_requested_by_fkey'
  ) THEN
    ALTER TABLE "AttendanceCorrectionRequest"
      ADD CONSTRAINT "AttendanceCorrectionRequest_requested_by_fkey"
      FOREIGN KEY ("requested_by") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttendanceCorrectionRequest_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "AttendanceCorrectionRequest"
      ADD CONSTRAINT "AttendanceCorrectionRequest_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_status_created_at_idx"
  ON "AttendanceCorrectionRequest"("status", "created_at");
CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_attendance_log_id_idx"
  ON "AttendanceCorrectionRequest"("attendance_log_id");

CREATE TYPE "SavingsChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "savings_change_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previous_thrift" DOUBLE PRECISION NOT NULL,
  "previous_special" DOUBLE PRECISION NOT NULL,
  "requested_thrift" DOUBLE PRECISION NOT NULL CHECK ("requested_thrift" >= 0 AND "requested_thrift" <= 100000000),
  "requested_special" DOUBLE PRECISION NOT NULL CHECK ("requested_special" >= 0 AND "requested_special" <= 100000000),
  "requested_period" TEXT NOT NULL CHECK ("requested_period" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  "effective_period" TEXT CHECK ("effective_period" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  "reason" TEXT,
  "status" "SavingsChangeStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "review_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "savings_change_positive_plan" CHECK ("requested_thrift" + "requested_special" > 0),
  CONSTRAINT "savings_change_approved_period" CHECK ("status" <> 'APPROVED' OR ("effective_period" IS NOT NULL AND "reviewed_at" IS NOT NULL))
);
CREATE INDEX "savings_change_requests_user_id_status_effective_period_idx" ON "savings_change_requests"("user_id", "status", "effective_period");
CREATE INDEX "savings_change_requests_status_created_at_idx" ON "savings_change_requests"("status", "created_at");
CREATE UNIQUE INDEX "savings_change_one_pending_per_member" ON "savings_change_requests"("user_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "savings_change_one_approved_per_period" ON "savings_change_requests"("user_id", "effective_period") WHERE "status" = 'APPROVED';

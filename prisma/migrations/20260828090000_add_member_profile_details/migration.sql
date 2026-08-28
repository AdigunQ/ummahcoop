ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "organization" TEXT,
  ADD COLUMN IF NOT EXISTS "station" TEXT,
  ADD COLUMN IF NOT EXISTS "grade_level" TEXT,
  ADD COLUMN IF NOT EXISTS "next_of_kin_name" TEXT,
  ADD COLUMN IF NOT EXISTS "next_of_kin_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "next_of_kin_email" TEXT,
  ADD COLUMN IF NOT EXISTS "next_of_kin_relationship" TEXT;

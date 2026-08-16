-- Store original amounts collected separately from monthly payroll deductions.
ALTER TABLE "users" ADD COLUMN "loan_principal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "commodity_principal" DOUBLE PRECISION NOT NULL DEFAULT 0;

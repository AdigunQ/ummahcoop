-- CreateTable
CREATE TABLE "commodity_repayments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "commodity_request_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodity_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commodity_repayments_user_id_date_idx" ON "commodity_repayments"("user_id", "date");

-- CreateIndex
CREATE INDEX "commodity_repayments_commodity_request_id_idx" ON "commodity_repayments"("commodity_request_id");

-- AddForeignKey
ALTER TABLE "commodity_repayments" ADD CONSTRAINT "commodity_repayments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commodity_repayments" ADD CONSTRAINT "commodity_repayments_commodity_request_id_fkey" FOREIGN KEY ("commodity_request_id") REFERENCES "commodity_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

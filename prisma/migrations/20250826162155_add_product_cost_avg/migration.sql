-- CreateTable
CREATE TABLE "public"."ProductCostAvg" (
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "avgCost" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCostAvg_pkey" PRIMARY KEY ("productId","warehouseId")
);

-- CreateIndex
CREATE INDEX "ProductCostAvg_warehouseId_idx" ON "public"."ProductCostAvg"("warehouseId");

-- AddForeignKey
ALTER TABLE "public"."ProductCostAvg" ADD CONSTRAINT "ProductCostAvg_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductCostAvg" ADD CONSTRAINT "ProductCostAvg_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

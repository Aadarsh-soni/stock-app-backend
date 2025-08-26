import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Admin user (password just placeholder for now)
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: Role.ADMIN,
      password: "changeme",
    },
  });

  // MAIN warehouse
  const wh = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { code: "MAIN", name: "Main Warehouse" },
  });

  // Sample product
  const prod = await prisma.product.upsert({
    where: { sku: "SKU-001" },
    update: {},
    create: {
      name: "Demo Pen",
      sku: "SKU-001",
      unit: "pcs",
      cost: 10,
      price: 15,
      reorderLevel: 20,
    },
  });

  // Ensure ProductStock row exists at 0
  await prisma.productStock.upsert({
    where: { productId_warehouseId: { productId: prod.id, warehouseId: wh.id } },
    update: {},
    create: { productId: prod.id, warehouseId: wh.id, qtyOnHand: 0 },
  });

  // Sample supplier (to test purchases)
  await prisma.supplier.upsert({
    where: { id: "Default Supplier" },
    update: {},
    create: { name: "Default Supplier", phone: "0000000000", gstin: "NA" },
  });

  console.log("Seed completed ✅");
}

main().finally(() => prisma.$disconnect()); 
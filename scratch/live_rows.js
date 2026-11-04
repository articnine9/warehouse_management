const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

function getMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("MONGODB_URI=")) {
        return trimmed.slice("MONGODB_URI=".length).replace(/["']/g, "").trim();
      }
    }
  }
  return process.env.MONGODB_URI;
}

async function main() {
  await mongoose.connect(getMongoUri());
  const db = mongoose.connection.db;
  const products = db.collection("products");
  const inventory = db.collection("inventories");
  const warehouses = db.collection("warehouses");

  const productIds = new Set(
    (await products.find({}, { projection: { _id: 1 } }).toArray()).map((p) => p._id.toString())
  );
  const warehouseIds = new Set(
    (await warehouses.find({}, { projection: { _id: 1 } }).toArray()).map((w) => w._id.toString())
  );

  const rows = await inventory.find({}).toArray();
  let liveRows = 0;
  let missingProduct = 0;
  let missingWarehouse = 0;
  const liveProductIds = new Set();
  const liveRowsPerProduct = new Map();

  for (const row of rows) {
    const hasProduct = Boolean(row.productId) && productIds.has(row.productId.toString());
    const hasWarehouse = Boolean(row.warehouseId) && warehouseIds.has(row.warehouseId.toString());
    if (!hasProduct) missingProduct++;
    if (!hasWarehouse) missingWarehouse++;
    if (!hasProduct || !hasWarehouse) continue;
    liveRows += 1;
    const pid = row.productId.toString();
    liveProductIds.add(pid);
    liveRowsPerProduct.set(pid, (liveRowsPerProduct.get(pid) || 0) + 1);
  }

  let multiRack = 0;
  for (const count of liveRowsPerProduct.values()) if (count > 1) multiRack++;

  console.log(`all inventory rows:                       ${rows.length}`);
  console.log(`  rows for a deleted product:             ${missingProduct}`);
  console.log(`  rows for a deleted warehouse:           ${missingWarehouse}`);
  console.log(`live rows (existing product+warehouse):   ${liveRows}`);
  console.log(`distinct live products in inventory:      ${liveProductIds.size}`);
  console.log(`live products kept in more than one rack: ${multiRack}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

function getMongoUri() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("MONGODB_URI=")) {
      return trimmed.slice("MONGODB_URI=".length).replace(/["']/g, "").trim();
    }
  }
}

async function main() {
  await mongoose.connect(getMongoUri());
  const db = mongoose.connection.db;

  const productsColl = db.collection("products");
  const inventoryColl = db.collection("inventories");
  const racksColl = db.collection("racks");
  const warehousesColl = db.collection("warehouses");

  // Find products with multiple inventory entries
  const multi = await inventoryColl.aggregate([
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 },
        entries: { $push: { invId: "$_id", rackId: "$rackId", warehouseId: "$warehouseId", quantity: "$quantity" } }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 }
  ]).toArray();

  for (const item of multi) {
    const prod = await productsColl.findOne({ _id: item._id });
    if (!prod) continue;
    console.log(`\n========================================`);
    console.log(`Product: "${prod.name}" (SKU: ${prod.sku})`);
    console.log(`Total Quantity: ${prod.totalStock ?? "N/A"}`);
    console.log(`Inventory records (${item.count} places):`);
    for (const e of item.entries) {
      const wh = await warehousesColl.findOne({ _id: e.warehouseId });
      const rk = await racksColl.findOne({ _id: e.rackId });
      console.log(`  -> Rack: "${rk ? rk.name : e.rackId}" (Warehouse: "${wh ? wh.name : e.warehouseId}"): ${e.quantity} units`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);


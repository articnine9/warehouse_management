const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

function getMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("MONGODB_URI=")) {
          return trimmed.slice("MONGODB_URI=".length).replace(/["']/g, "").trim();
        }
      }
    }
  }
  return process.env.MONGODB_URI;
}

async function main() {
  const uri = getMongoUri();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const productsColl = db.collection("products");
  const inventoryColl = db.collection("inventories");

  const totalProducts = await productsColl.countDocuments();
  const totalInventory = await inventoryColl.countDocuments();

  console.log(`Total Products in Product collection: ${totalProducts}`);
  console.log(`Total Inventory records in Inventory collection: ${totalInventory}`);

  // Distinct products in inventory
  const distinctProductsInInv = await inventoryColl.distinct("productId");
  console.log(`Distinct productIds in inventory: ${distinctProductsInInv.length}`);

  // Check how many products have multiple inventory records
  const multiLocation = await inventoryColl.aggregate([
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 },
        totalQty: { $sum: "$quantity" },
        racks: { $push: "$rackId" },
        warehouses: { $push: "$warehouseId" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  console.log(`Products stored across multiple locations/racks: ${multiLocation.length}`);
  console.log("Sample products with multiple inventory entries:");
  for (const m of multiLocation.slice(0, 10)) {
    const p = await productsColl.findOne({ _id: m._id });
    console.log(`- Product: ${p ? p.name : "UNKNOWN"} (SKU: ${p ? p.sku : m._id}) -> ${m.count} inventory entries, totalQty: ${m.totalQty}`);
  }

  // Check for orphan inventory records (productId not in products collection)
  const allProductIds = new Set((await productsColl.find({}, { projection: { _id: 1 } }).toArray()).map(p => p._id.toString()));
  let orphanCount = 0;
  for (const pid of distinctProductsInInv) {
    if (!pid || !allProductIds.has(pid.toString())) {
      orphanCount++;
    }
  }
  console.log(`Orphan inventory records (productId not found in products): ${orphanCount}`);

  // Check products that have 0 inventory records
  const invProductIds = new Set(distinctProductsInInv.map(p => p ? p.toString() : "null"));
  let zeroInvProducts = 0;
  for (const pid of allProductIds) {
    if (!invProductIds.has(pid)) {
      zeroInvProducts++;
    }
  }
  console.log(`Products in catalog with 0 inventory records: ${zeroInvProducts}`);

  await mongoose.disconnect();
}

main().catch(console.error);

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
  await mongoose.connect(getMongoUri());
  const db = mongoose.connection.db;

  const productsColl = db.collection("products");
  const inventoryColl = db.collection("inventories");
  const warehousesColl = db.collection("warehouses");
  const racksColl = db.collection("racks");
  const zonesColl = db.collection("zones");

  console.log(`products:   ${await productsColl.countDocuments()}`);
  console.log(`inventories:${await inventoryColl.countDocuments()}`);
  console.log(`warehouses: ${await warehousesColl.countDocuments()}`);
  console.log(`racks:      ${await racksColl.countDocuments()}`);
  console.log(`zones:      ${await zonesColl.countDocuments()}`);

  console.log("\n=== inventory rows per warehouse (raw rows vs distinct live products) ===");
  const productIds = new Set(
    (await productsColl.find({}, { projection: { _id: 1 } }).toArray()).map((p) => p._id.toString())
  );
  const perWarehouse = await inventoryColl.aggregate([
    { $group: { _id: "$warehouseId", rows: { $sum: 1 }, products: { $addToSet: "$productId" } } },
  ]).toArray();
  for (const w of perWarehouse) {
    const wh = await warehousesColl.findOne({ _id: w._id });
    const live = w.products.filter((p) => p && productIds.has(p.toString())).length;
    console.log(
      `- ${wh ? wh.name : w._id}: ${w.rows} inventory rows, ${w.products.length} distinct productIds, ${live} live products`
    );
  }

  console.log("\n=== per-rack rows (racks page shows 'N Products') ===");
  const perRack = await inventoryColl.aggregate([
    { $group: { _id: "$rackId", rows: { $sum: 1 }, products: { $addToSet: "$productId" } } },
  ]).toArray();
  let rackRowTotal = 0;
  for (const r of perRack) {
    rackRowTotal += r.rows;
  }
  console.log(`sum of rows over ${perRack.length} racks = ${rackRowTotal}`);

  console.log("\n=== stale rows: quantity 0 and/or product no longer exists ===");
  const zeroQty = await inventoryColl.countDocuments({ quantity: 0 });
  const missingProduct = await inventoryColl.countDocuments({
    productId: { $nin: Array.from(productIds).map((id) => new mongoose.Types.ObjectId(id)) },
  });
  console.log(`rows with quantity 0: ${zeroQty}`);
  console.log(`rows whose product no longer exists: ${missingProduct}`);

  console.log("\n=== distinct live products in inventory (what the user wants) ===");
  const distinctAll = await inventoryColl.distinct("productId");
  const liveProducts = distinctAll.filter((p) => p && productIds.has(p.toString())).length;
  console.log(`distinct productIds in inventory: ${distinctAll.length}`);
  console.log(`of which still exist in products: ${liveProducts}`);

  await mongoose.disconnect();
}

main().catch(console.error);
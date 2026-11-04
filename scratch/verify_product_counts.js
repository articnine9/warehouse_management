// Read-only check of the Inventory page counts after the product-grouping change.
// Mirrors exactly what app/inventory/page.tsx now computes in the browser.
// No writes: find() only.
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

  const productIds = new Set(
    (await db.collection("products").find({}, { projection: { _id: 1 } }).toArray()).map((p) =>
      p._id.toString()
    )
  );

  const rows = await db.collection("inventories").find({}).toArray();

  const all = new Set();
  const available = new Set();
  const lowStock = new Set();
  const outOfStock = new Set();
  const lowOut = new Set();
  let entriesForList = 0;
  let skippedStale = 0;

  for (const row of rows) {
    const pid = row.productId ? row.productId.toString() : null;
    if (!pid || !productIds.has(pid)) {
      skippedStale += 1; // product deleted: not a product, so not listed or counted
      continue;
    }
    entriesForList += 1;
    all.add(pid);
    if (row.status === "AVAILABLE") available.add(pid);
    if (row.status === "LOW_STOCK") lowStock.add(pid);
    if (row.status === "OUT_OF_STOCK") outOfStock.add(pid);
    if (row.status === "LOW_STOCK" || row.status === "OUT_OF_STOCK") lowOut.add(pid);
  }

  console.log(`inventory rows in database:                 ${rows.length}`);
  console.log(`  rows skipped (product deleted, not shown): ${skippedStale}`);
  console.log(`  rows shown as rack locations inside a product row: ${entriesForList}`);
  console.log("");
  console.log("WHAT THE PAGE NOW SHOWS");
  console.log(`  header "total products"      : ${all.size}`);
  console.log(`  ALL card                     : ${all.size}`);
  console.log(`  Available card               : ${available.size}`);
  console.log(`  Low (<=10) card              : ${lowStock.size}`);
  console.log(`  Out of Stock card            : ${outOfStock.size}`);
  console.log(`  Low & Out card               : ${lowOut.size}`);
  console.log(`  "Products (N)" list heading  : ${all.size}`);
  console.log(`  pagination "... of N products": ${all.size}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
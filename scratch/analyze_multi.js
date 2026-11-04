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

  const inventoryColl = db.collection("inventories");

  const multi = await inventoryColl.aggregate([
    {
      $group: {
        _id: "$productId",
        count: { $sum: 1 },
        qtys: { $push: "$quantity" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  let hasZeroRow = 0;
  let allNonZero = 0;
  for (const m of multi) {
    if (m.qtys.includes(0)) hasZeroRow++;
    else allNonZero++;
  }

  console.log(`Products with multiple racks: ${multi.length}`);
  console.log(`- Products where one rack has 0 units (e.g. moved to another rack): ${hasZeroRow}`);
  console.log(`- Products where both/all racks have >0 stock: ${allNonZero}`);

  await mongoose.disconnect();
}

main().catch(console.error);


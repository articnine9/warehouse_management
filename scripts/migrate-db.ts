import fs from "fs";
import path from "path";
import mongoose from "mongoose";

function loadEnvLocal(): string {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return "";

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "MONGODB_URI") {
      return value;
    }
  }
  return "";
}

async function runMigration() {
  const oldUri = process.env.OLD_MONGODB_URI || loadEnvLocal();
  const newUri = process.argv[2] || process.env.NEW_MONGODB_URI;

  if (!oldUri) {
    console.error("❌ Error: Could not find current MONGODB_URI in .env.local.");
    process.exit(1);
  }

  if (!newUri) {
    console.error("❌ Error: Please provide the target MongoDB URI.");
    console.log("\nUsage:");
    console.log('  npx tsx scripts/migrate-db.ts "mongodb+srv://<username>:<password>@cluster.xxx.mongodb.net/warehouse_management?..."');
    process.exit(1);
  }

  if (oldUri === newUri) {
    console.error("❌ Error: Target MongoDB URI is identical to the current MONGODB_URI!");
    process.exit(1);
  }

  console.log("\n=======================================================");
  console.log("   🚀 MongoDB Database Migration Tool");
  console.log("=======================================================\n");

  console.log("Connecting to Source (Old) Database...");
  const sourceConn = mongoose.createConnection(oldUri);
  await new Promise((resolve, reject) => {
    sourceConn.once("open", resolve);
    sourceConn.once("error", reject);
  });
  console.log(" Connected to Source DB successfully.");

  console.log("Connecting to Target (New) Database...");
  const targetConn = mongoose.createConnection(newUri);
  await new Promise((resolve, reject) => {
    targetConn.once("open", resolve);
    targetConn.once("error", reject);
  });
  console.log(" Connected to Target DB successfully.\n");

  const sourceDb = sourceConn.db;
  const targetDb = targetConn.db;

  if (!sourceDb || !targetDb) {
    throw new Error("Failed to initialize database references.");
  }

  // List all collections in source database
  const collections = await sourceDb.listCollections().toArray();
  const validCollections = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."));

  console.log(`Found ${validCollections.length} collections to migrate:`);
  console.log(validCollections.map((name) => ` • ${name}`).join("\n"));
  console.log("\n--- Starting Data Migration ---\n");

  let totalDocsMigrated = 0;

  for (const colName of validCollections) {
    const sourceCol = sourceDb.collection(colName);
    const targetCol = targetDb.collection(colName);

    const count = await sourceCol.countDocuments();
    if (count === 0) {
      console.log(`⚪ Collection [${colName}]: 0 documents (Skipped)`);
      continue;
    }

    process.stdout.write(`⏳ Migrating [${colName}] (${count} documents)... `);

    // Fetch all documents from source collection
    const docs = await sourceCol.find({}).toArray();

    // Insert into target with unordered insertion to ignore any existing duplicate keys if re-run
    try {
      await targetCol.insertMany(docs, { ordered: false });
    } catch (err: any) {
      // If error is just duplicate key on re-run, that's fine
      if (!err?.message?.includes("duplicate key")) {
        console.warn(`(Notice: ${err.message})`);
      }
    }

    // Copy indexes (except default _id_ index)
    try {
      const indexes = await sourceCol.indexes();
      for (const idx of indexes) {
        if (idx.name === "_id_") continue;
        const options: any = { name: idx.name };
        if (idx.unique) options.unique = true;
        if (idx.sparse) options.sparse = true;
        try {
          await targetCol.createIndex(idx.key, options);
        } catch {
          // ignore duplicate index errors
        }
      }
    } catch {
      // ignore index reading errors if any
    }

    const targetCount = await targetCol.countDocuments();
    console.log(` Done! (${targetCount} in target)`);
    totalDocsMigrated += docs.length;
  }

  console.log("\n=======================================================");
  console.log(` 🎉 Migration Completed! Total documents migrated: ${totalDocsMigrated}`);
  console.log("=======================================================\n");

  // Update .env.local with new URI
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (envContent.includes("MONGODB_URI=")) {
    envContent = envContent.replace(
      /MONGODB_URI=.*(\r?\n|$)/,
      `MONGODB_URI="${newUri}"$1`
    );
  } else {
    envContent += `\nMONGODB_URI="${newUri}"\n`;
  }

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log(" Updated .env.local automatically with the new MONGODB_URI.");
  console.log(" You can now run 'npm run dev' to use your new MongoDB database!\n");

  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed with error:", err);
  process.exit(1);
});

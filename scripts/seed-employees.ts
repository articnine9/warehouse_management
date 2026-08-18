import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Employee from "../models/Employee";
import Warehouse from "../models/Warehouse";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const sampleEmployees = [
  ["EMP001", "Arun Kumar", "9876501001", "Warehouse", "Picker"],
  ["EMP002", "Bala Murugan", "9876501002", "Warehouse", "Packer"],
  ["EMP003", "Chitra Devi", "9876501003", "Inventory", "Stock Auditor"],
  ["EMP004", "Deepak Raj", "9876501004", "Dispatch", "Dispatch Executive"],
  ["EMP005", "Eswari Priya", "9876501005", "Accounts", "Billing Assistant"],
  ["EMP006", "Fathima Nisha", "9876501006", "Warehouse", "Supervisor"],
  ["EMP007", "Gokul Nath", "9876501007", "Inventory", "Inventory Assistant"],
  ["EMP008", "Hari Prasad", "9876501008", "Dispatch", "Loader"],
  ["EMP009", "Indhu Mathi", "9876501009", "HR", "HR Assistant"],
  ["EMP010", "Jagan Mohan", "9876501010", "Warehouse", "Forklift Operator"],
  ["EMP011", "Karthik Selvan", "9876501011", "Procurement", "Purchase Assistant"],
  ["EMP012", "Lavanya S", "9876501012", "Accounts", "Accounts Executive"],
  ["EMP013", "Manikandan R", "9876501013", "Security", "Security Staff"],
  ["EMP014", "Naveen Kumar", "9876501014", "Warehouse", "Picker"],
  ["EMP015", "Oviya Lakshmi", "9876501015", "Inventory", "Stock Checker"],
  ["EMP016", "Prakash M", "9876501016", "Dispatch", "Delivery Coordinator"],
  ["EMP017", "Queen Mary", "9876501017", "Admin", "Admin Assistant"],
  ["EMP018", "Rajesh Kannan", "9876501018", "Warehouse", "Packer"],
  ["EMP019", "Saranya V", "9876501019", "Customer Support", "Support Executive"],
  ["EMP020", "Tamil Selvan", "9876501020", "Warehouse", "Loader"],
  ["EMP021", "Uma Maheswari", "9876501021", "Inventory", "Stock Auditor"],
  ["EMP022", "Vignesh Babu", "9876501022", "Dispatch", "Dispatch Executive"],
  ["EMP023", "Wasim Akram", "9876501023", "Warehouse", "Supervisor"],
  ["EMP024", "Xavier Raj", "9876501024", "Maintenance", "Technician"],
  ["EMP025", "Yamini R", "9876501025", "Accounts", "Billing Assistant"],
  ["EMP026", "Zahir Hussain", "9876501026", "Security", "Security Staff"],
  ["EMP027", "Anitha Paul", "9876501027", "Admin", "Office Assistant"],
  ["EMP028", "Boopathi S", "9876501028", "Procurement", "Purchase Executive"],
  ["EMP029", "Divya Bharathi", "9876501029", "HR", "HR Executive"],
  ["EMP030", "Suresh Kumar", "9876501030", "Maintenance", "Electrician"],
] as const;

async function main() {
  loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const firstWarehouse = await Warehouse.findOne({ status: "ACTIVE" }).sort({ createdAt: 1 });

  const operations = sampleEmployees.map(([employeeCode, name, phone, department, designation]) => ({
    updateOne: {
      filter: { employeeCode },
      update: {
        $set: {
          employeeCode,
          name,
          phone,
          email: `${employeeCode.toLowerCase()}@warehouse.local`,
          department,
          designation,
          warehouseId: firstWarehouse?._id,
          status: "ACTIVE" as const,
        },
      },
      upsert: true,
    },
  }));

  const result = await Employee.bulkWrite(operations);
  const total = await Employee.countDocuments();

  console.log(
    `Seeded employees. Inserted: ${result.upsertedCount}, updated: ${result.modifiedCount}, total employees: ${total}`
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

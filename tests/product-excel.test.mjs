import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import ExcelJS from "exceljs";

function load(file, modules = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", source)((name) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; }, exports);
  return exports;
}
const stock = load("../lib/productStock.ts");
const type = load("../lib/productType.ts");
const { createProductWorkbook } = load("../lib/productExcel.ts", { exceljs: ExcelJS, "./productStock": stock, "./productType": type });
const info = { generatedAt: "2026-11-04T07:00:00Z", scope: "ALL_WAREHOUSES" };
const location = (quantity, rack) => ({ inventoryId: "inventory-" + rack, warehouseId: "wh", warehouseName: "ABU DHABI Distribution Hub", warehouseCode: "WH-AUH-002", warehouseAddress: "Abu Dhabi", warehouseStatus: "ACTIVE", zoneId: "zone", zoneName: "Zone B", zoneCode: "ZB", zoneStatus: "ACTIVE", rackId: rack, rackName: rack, rackCode: rack, rackStatus: "ACTIVE", quantity, status: "LOW_STOCK", recordedStatus: "LOW_STOCK", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-04T00:00:00Z" });
function fixture() {
  return [
    { _id: "product-1", name: "Drill bit 20mm — கருவி", sku: "000123", category: "Working Tools", categoryId: { _id: "cat", code: "TOOLS" }, productType: "REUSABLE", status: "ACTIVE", price: 12.5, sellerName: "Supplier", serialNumber: "000045", warrantyMonths: 12, serviceIntervalMonths: 3, returnDueDays: 30, description: "Full description\nwith another line", createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-11-04T07:00:00Z", totalStock: 12, locations: [location(6, "Rack A"), location(6, "Rack B")] },
    { _id: "product-2", name: "Zero price", sku: "SKU-002", status: "ACTIVE", price: 0, warrantyMonths: 0, serviceIntervalMonths: 0, totalStock: 0, locations: [] },
    { _id: "product-3", name: "=SUM(A1:A3)", sku: "SKU-003", status: "INACTIVE", totalStock: 0, locations: [] },
  ];
}
const values = (sheet, name) => {
  const column = sheet.getRow(1).values.findIndex(value => value === name);
  return Array.from({ length: sheet.rowCount - 1 }, (_, index) => sheet.getRow(index + 2).getCell(column).value);
};

test("real XLSX round trip retains every product, location, numeric stock and complete details", async () => {
  const input = fixture(), before = JSON.stringify(input);
  const workbook = createProductWorkbook(input, info);
  const buffer = await workbook.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), "PK");
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  assert.deepEqual(loaded.worksheets.map(sheet => sheet.name), ["Overview", "Products", "Stock Locations"]);
  const products = loaded.getWorksheet("Products"), locations = loaded.getWorksheet("Stock Locations");
  assert.equal(products.rowCount, 4);
  assert.equal(locations.rowCount, 5); // two racks plus two unassigned products
  assert.equal(products.getCell("B2").value, "Drill bit 20mm — கருவி");
  assert.equal(products.getCell("C2").value, "000123");
  assert.equal(products.getCell("R2").value, "000045");
  assert.deepEqual(values(products, "Total Stock Qty"), [12, 0, 0]);
  assert.equal(values(products, "Stock Value (INR)")[0], 150);
  assert.equal(values(products, "Unit Price (INR)")[1], 0);
  assert.equal(values(products, "Warranty (Months)")[1], 0);
  assert.equal(values(products, "Description")[0], "Full description\nwith another line");
  assert.equal(values(locations, "Zone / Room")[0], "Zone B");
  assert.equal(values(locations, "Zone Code")[0], "ZB");
  assert.deepEqual(values(locations, "Location Stock Qty"), [6, 6, 0, 0]);
  assert.equal(values(locations, "Location Stock Value (INR)").filter(value => typeof value === "number").reduce((sum, value) => sum + value, 0), 150);
  assert.equal(values(products, "Updated At (IST)")[0].toISOString(), "2026-11-04T12:30:00.000Z");
  assert.equal(products.views[0].state, "frozen");
  assert.ok(products.autoFilter);
  assert.equal(JSON.stringify(input), before);
});

test("unassigned products, missing fields and formula-looking text are exported safely", () => {
  const workbook = createProductWorkbook(fixture(), info), products = workbook.getWorksheet("Products"), locations = workbook.getWorksheet("Stock Locations");
  assert.equal(products.getCell("B4").value, "=SUM(A1:A3)");
  assert.equal(products.getCell("B4").type, ExcelJS.ValueType.String);
  assert.equal(products.getCell("B4").formula, undefined);
  assert.equal(values(products, "Stock Status")[1], "OUT OF STOCK");
  assert.equal(values(products, "Unit Price (INR)")[2], null);
  assert.equal(values(locations, "Warehouse")[2], "Unassigned");
  assert.equal(values(products, "Product Type")[2], "Type not recorded");
  assert.equal(workbook.getWorksheet("Overview").getCell("B4").value, 3);
  assert.equal(workbook.getWorksheet("Overview").getCell("B5").value, 12);
  assert.equal(workbook.getWorksheet("Overview").getCell("B6").value, 2);
});

test("exports the full 1160-product catalog independently of UI pagination", async () => {
  const products = Array.from({ length: 1160 }, (_, index) => ({ _id: `product-${index}`, name: `Product ${index}`, sku: `SKU-${index}`, price: 1, status: "ACTIVE", totalStock: index, locations: [location(index, `rack-${index}`)] }));
  const workbook = createProductWorkbook(products, info);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(loaded.getWorksheet("Products").rowCount, 1161);
  assert.equal(loaded.getWorksheet("Stock Locations").rowCount, 1161);
  assert.equal(loaded.getWorksheet("Products").getCell("B1161").value, "Product 1159");
  assert.equal(loaded.getWorksheet("Overview").getCell("B5").value, 1160 * 1159 / 2);
});

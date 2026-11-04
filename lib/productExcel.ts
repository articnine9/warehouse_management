import ExcelJS from "exceljs";
import { productStockStatus } from "./productStock";
import { productTypeLabel } from "./productType";
import type { ProductExportInfo, ProductExportLocation, ProductExportRecord } from "./productExportTypes";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const text = (value?: string | null) => value || "";
const status = (value?: string) => value?.replaceAll("_", " ") || "Not recorded";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].join("\n");

/** Excel stores wall-clock dates without a timezone; these columns are labelled IST. */
function indiaDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getTime() + 330 * 60 * 1000);
}

type Column = { header: string; key: string; width: number; style?: Partial<ExcelJS.Style> };
const numeric = (header: string, key: string, width = 16): Column => ({ header, key, width, style: { numFmt: "#,##0", alignment: { horizontal: "right" } } });
const currency = (header: string, key: string): Column => ({ header, key, width: 20, style: { numFmt: "#,##0.00", alignment: { horizontal: "right" } } });
const dateColumn = (header: string, key: string): Column => ({ header, key, width: 23, style: { numFmt: "yyyy-mm-dd hh:mm:ss" } });

function finishSheet(sheet: ExcelJS.Worksheet, columns: Column[], filter = true) {
  sheet.views = [{ state: "frozen", xSplit: filter ? 3 : 1, ySplit: 1 }];
  sheet.getRow(1).height = 34;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    let lines = 1;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
      cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: true };
      if (rowNumber % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      const width = Math.max(8, (columns[columnNumber - 1]?.width || 20) - 2);
      if (typeof cell.value === "string") lines = Math.max(lines, cell.value.split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / width)), 0));
      if (["AVAILABLE", "LOW STOCK", "OUT OF STOCK"].includes(String(cell.value))) {
        const colour = cell.value === "AVAILABLE" ? "FFDCFCE7" : cell.value === "LOW STOCK" ? "FFFEF3C7" : "FFFEE2E2";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colour } };
      }
    });
    row.height = Math.min(409, Math.max(22, lines * 15 + 6));
  });
  if (filter) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.printTitlesRow = "1:1";
}

export function createProductWorkbook(products: ProductExportRecord[], info: ProductExportInfo) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Management";
  workbook.title = "Complete Product and Stock Location Export";
  workbook.subject = "Product catalog and current warehouse stock";
  workbook.created = new Date(info.generatedAt);
  workbook.views = [{ x: 0, y: 0, width: 1440, height: 900, visibility: "visible", firstSheet: 0, activeTab: 1 }];

  const overview = workbook.addWorksheet("Overview", { properties: { tabColor: { argb: "FF2563EB" } } });
  const productSheet = workbook.addWorksheet("Products", { properties: { tabColor: { argb: "FF059669" } } });
  const locationSheet = workbook.addWorksheet("Stock Locations", { properties: { tabColor: { argb: "FF4F46E5" } } });
  const productColumns: Column[] = [
    numeric("No.", "number", 8), { header: "Product Name", key: "name", width: 38 }, { header: "SKU", key: "sku", width: 20 },
    { header: "Category", key: "category", width: 25 }, { header: "Category Code", key: "categoryCode", width: 18 },
    { header: "Product Type", key: "type", width: 20 }, { header: "Catalog Status", key: "catalogStatus", width: 18 },
    { header: "Stock Status", key: "stockStatus", width: 20 }, numeric("Total Stock Qty", "quantity"),
    currency("Unit Price (INR)", "price"), currency("Stock Value (INR)", "value"), numeric("Stock Locations", "locationCount"),
    { header: "Warehouses", key: "warehouses", width: 36 }, { header: "Warehouse Codes", key: "warehouseCodes", width: 22 },
    { header: "Zones / Rooms", key: "zones", width: 28 }, { header: "Racks / Shelves", key: "racks", width: 28 },
    { header: "Supplier / Seller", key: "seller", width: 30 }, { header: "Serial Number", key: "serial", width: 24 },
    numeric("Return Due Days", "returnDays"), numeric("Warranty (Months)", "warranty", 19), numeric("Service Interval (Months)", "service", 23),
    { header: "Description", key: "description", width: 60 }, dateColumn("Created At (IST)", "created"), dateColumn("Updated At (IST)", "updated"),
    { header: "Product ID", key: "id", width: 28 },
  ];
  const locationColumns: Column[] = [
    numeric("No.", "number", 8), { header: "Product Name", key: "name", width: 38 }, { header: "SKU", key: "sku", width: 20 },
    { header: "Category", key: "category", width: 25 }, { header: "Product Type", key: "type", width: 20 },
    { header: "Catalog Status", key: "catalogStatus", width: 18 },
    { header: "Warehouse", key: "warehouse", width: 36 }, { header: "Warehouse Code", key: "warehouseCode", width: 20 },
    { header: "Warehouse Address", key: "address", width: 45 }, { header: "Warehouse Status", key: "warehouseStatus", width: 20 },
    { header: "Zone / Room", key: "zone", width: 26 }, { header: "Zone Code", key: "zoneCode", width: 18 }, { header: "Zone Status", key: "zoneStatus", width: 18 },
    { header: "Rack / Shelf", key: "rack", width: 24 }, { header: "Rack Code", key: "rackCode", width: 18 }, { header: "Rack Status", key: "rackStatus", width: 18 },
    numeric("Location Stock Qty", "quantity", 20), { header: "Location Stock Status", key: "stockStatus", width: 24 },
    { header: "Recorded Inventory Status", key: "recordedStatus", width: 27 },
    currency("Unit Price (INR)", "price"), currency("Location Stock Value (INR)", "value"),
    { header: "Supplier / Seller", key: "seller", width: 30 }, { header: "Serial Number", key: "serial", width: 24 },
    dateColumn("Stock Created At (IST)", "created"), dateColumn("Stock Updated At (IST)", "updated"),
    { header: "Inventory Record ID", key: "inventoryId", width: 28 }, { header: "Product ID", key: "productId", width: 28 },
    { header: "Warehouse ID", key: "warehouseId", width: 28 }, { header: "Zone ID", key: "zoneId", width: 28 }, { header: "Rack ID", key: "rackId", width: 28 },
  ];
  productSheet.columns = productColumns;
  locationSheet.columns = locationColumns;
  let locationNumber = 0, totalUnits = 0, knownValue = 0, locationCount = 0, available = 0, low = 0, out = 0;
  for (const [index, product] of products.entries()) {
    const locations = product.locations || [];
    const quantity = locations.reduce((sum, location) => sum + number(location.quantity), 0);
    const stockStatus = productStockStatus(quantity);
    const price = typeof product.price === "number" && Number.isFinite(product.price) ? product.price : null;
    const value = price === null ? null : quantity * price;
    totalUnits += quantity;
    knownValue += value ?? 0;
    locationCount += locations.length;
    if (stockStatus === "AVAILABLE") available++;
    else if (stockStatus === "LOW_STOCK") low++;
    else out++;
    const common = { name: product.name, sku: product.sku, category: text(product.category), type: productTypeLabel(product.productType), catalogStatus: status(product.status), price, seller: text(product.sellerName), serial: text(product.serialNumber) };
    productSheet.addRow({
      ...common, number: index + 1, id: product._id,
      categoryCode: typeof product.categoryId === "object" ? text(product.categoryId?.code) : "",
      stockStatus: status(stockStatus), quantity, value, locationCount: locations.length,
      warehouses: unique(locations.map(location => location.warehouseName)), warehouseCodes: unique(locations.map(location => text(location.warehouseCode))),
      zones: unique(locations.map(location => location.zoneName || "Unassigned")), racks: unique(locations.map(location => location.rackName || "Unassigned")),
      returnDays: product.returnDueDays ?? null, warranty: product.warrantyMonths ?? null, service: product.serviceIntervalMonths ?? null,
      description: text(product.description), created: indiaDate(product.createdAt), updated: indiaDate(product.updatedAt),
    });
    for (const location of (locations.length ? locations : [null]) as (ProductExportLocation | null)[]) {
      const qty = number(location?.quantity);
      locationSheet.addRow({
        ...common, number: ++locationNumber, productId: product._id, inventoryId: text(location?.inventoryId),
        warehouse: location?.warehouseName || "Unassigned", warehouseCode: text(location?.warehouseCode), address: text(location?.warehouseAddress), warehouseStatus: status(location?.warehouseStatus),
        zone: location?.zoneName || "Unassigned", zoneCode: text(location?.zoneCode), zoneStatus: status(location?.zoneStatus),
        rack: location?.rackName || "Unassigned", rackCode: text(location?.rackCode), rackStatus: status(location?.rackStatus),
        quantity: qty, stockStatus: status(productStockStatus(qty)), recordedStatus: status(location?.recordedStatus), value: price === null ? null : qty * price,
        created: indiaDate(location?.createdAt), updated: indiaDate(location?.updatedAt),
        warehouseId: text(location?.warehouseId), zoneId: text(location?.zoneId), rackId: text(location?.rackId),
      });
    }
  }
  const overviewColumns: Column[] = [{ header: "Report Detail", key: "detail", width: 37 }, { header: "Value", key: "value", width: 100 }];
  overview.columns = overviewColumns;
  overview.addRows([
    { detail: "Generated At (IST)", value: indiaDate(info.generatedAt) },
    { detail: "Access Scope", value: info.scope === "ASSIGNED_WAREHOUSES" ? "Assigned warehouses only" : "All warehouses" },
    { detail: "Products", value: products.length }, { detail: "Warehouse Stock Units", value: totalUnits },
    { detail: "Stock Location Records", value: locationCount }, { detail: "Available Products", value: available },
    { detail: "Low Stock Products", value: low }, { detail: "Out of Stock Products", value: out },
    { detail: "Known Stock Value (INR)", value: knownValue },
    { detail: "Products Sheet", value: "One row per product. Includes all accessible products, independent of page filters and pagination." },
    { detail: "Stock Locations Sheet", value: "One row per warehouse / zone / rack stock record. Products with no stock location have an unassigned row with zero quantity." },
    { detail: "Stock Status Rules", value: "AVAILABLE: more than 10 units; LOW STOCK: 1–10 units; OUT OF STOCK: zero units. Product status uses the sum across its accessible locations." },
    { detail: "Catalog Status", value: "ACTIVE / INACTIVE is the product catalog status, separate from stock availability." },
    { detail: "Missing Details", value: "Unrecorded optional fields remain blank. Missing warehouse, zone or rack assignments are shown as Unassigned. Missing product types are not guessed." },
    { detail: "Stock Values", value: "Current warehouse stock quantity multiplied by recorded unit price. Blank prices and values are excluded from Known Stock Value." },
  ]);
  overview.getCell("B2").numFmt = "yyyy-mm-dd hh:mm:ss";
  overview.getCell("B10").numFmt = "#,##0.00";
  finishSheet(overview, overviewColumns, false);
  finishSheet(productSheet, productColumns);
  finishSheet(locationSheet, locationColumns);
  return workbook;
}

export async function downloadProductsExcel() {
  const response = await fetch("/api/products?export=excel", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Unable to load products for export.");
  if (!Array.isArray(result.data) || result.pagination || result.count !== result.data.length || !result.export) throw new Error("The complete product list could not be loaded. Please retry.");
  const info: ProductExportInfo = result.export;
  const products: ProductExportRecord[] = result.data;
  const workbook = createProductWorkbook(products, info);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const url = URL.createObjectURL(new Blob([bytes], { type: MIME }));
  const link = document.createElement("a");
  link.href = url;
  const day = new Date(info.generatedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  link.download = `${info.scope === "ASSIGNED_WAREHOUSES" ? "assigned" : "all"}-products-${day}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { products: products.length, locations: products.reduce((sum, product) => sum + product.locations.length, 0) };
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, modules = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", source)((name) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; }, exports);
  return exports;
}
const stock = load("../lib/productStock.ts");
const id = value => String(value).padStart(24, "0");
const whA = { _id: id(100), name: "Warehouse Alpha", code: "WH-A", address: "Abu Dhabi", status: "ACTIVE" };
const whB = { _id: id(101), name: "Warehouse Beta", code: "WH-B" };
const rackA = { _id: id(200), name: "Shelf A", code: "A1", status: "ACTIVE", zoneId: { _id: id(400), name: "Zone B", code: "ZB", status: "ACTIVE" } };
const rackB = { _id: id(201), name: "Shelf B", code: "B1" };
const catalog = Array.from({ length: 5 }, (_, index) => ({ _id: id(index + 1), name: index === 0 ? "Drill [XL]" : `Tool ${index + 1}`, sku: `SKU-${index + 1}`, category: index < 3 ? "Tools" : "Safety", price: 0, createdAt: `2026-11-0${index + 1}` }));
const entries = [
  { productId: id(1), warehouseId: whA, rackId: rackA, quantity: 6 },
  { productId: id(1), warehouseId: whB, rackId: rackB, quantity: 6 },
  { productId: id(2), warehouseId: whA, rackId: rackA, quantity: 1 },
  { productId: id(3), warehouseId: whA, rackId: null, quantity: 0 },
  { productId: id(5), warehouseId: whB, rackId: rackB, quantity: 20 },
  { productId: id(999), warehouseId: whA, rackId: rackA, quantity: 500 },
].map((entry, index) => ({ ...entry, _id: id(300 + index), status: stock.productStockStatus(entry.quantity), createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-04T00:00:00Z") }));

const value = actual => actual && typeof actual === "object" && "_id" in actual ? actual._id : actual;
function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") return expected.every(item => matches(record, item));
    if (key === "$or") return expected.some(item => matches(record, item));
    if (expected?.$in) return expected.$in.map(String).includes(String(value(record[key])));
    if (expected?.$regex) return new RegExp(expected.$regex, expected.$options || "").test(record[key] || "");
    return value(record[key]) === expected;
  });
}
function setup(role = "ADMIN") {
  const calls = [];
  const query = values => {
    const q = { populate: () => q, select: () => q, sort: () => q, then: (resolve, reject) => Promise.resolve(values).then(resolve, reject) };
    return q;
  };
  const model = values => ({ find: filter => query(values.filter(record => matches(record, filter))) });
  const { GET } = load("../app/api/products/route.ts", {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/auth": { requireSessionUser: async () => ({ role }), getUserWarehouseId: () => [whA._id] },
    "@/lib/productStock": stock,
    "@/models/Product": { find: filter => query([...catalog].reverse().filter(record => matches(record, filter))), countDocuments: () => assert.fail("Must paginate after grouping stock") },
    "@/models/Inventory": { find: filter => { calls.push(filter); return query(entries.filter(record => matches(record, filter))); } },
    "@/models/Warehouse": model([whA, whB]), "@/models/Zone": model([]), "@/models/Rack": model([rackA, rackB]),
    "@/models/Category": { findOne: async () => null }, "@/models/ProductHistory": {}, "@/models/StockMovement": {},
  });
  return { get: async (params = "") => {
    const response = await GET(new Request(`http://localhost/api/products?view=stock&${params}`));
    assert.equal(response.status, 200);
    return response.json();
  }, calls };
}

test("counts catalog products once and keeps all locations together before pagination", async () => {
  const { get } = setup();
  const products = [];
  for (let page = 1; page <= 5; page++) {
    const result = await get(`page=${page}&limit=1`);
    assert.equal(result.pagination.total, 5);
    products.push(...result.data);
  }
  assert.equal(new Set(products.map(product => product._id)).size, 5);
  const drill = products.find(product => product._id === id(1));
  assert.equal(drill.locations.length, 2);
  assert.equal(drill.totalStock, 12);
  assert.equal(drill.stockStatus, "AVAILABLE");
  assert.equal(drill.locations[0].warehouseCode, "WH-A");
  assert.equal(drill.locations[1].rackCode, "B1");
  assert.equal(products.reduce((total, product) => total + product.totalStock, 0), 33);
  const unstocked = products.find(product => product._id === id(4));
  assert.deepEqual(unstocked.locations, []);
  assert.equal(unstocked.stockStatus, "OUT_OF_STOCK");
});

test("category and status filters count whole products using summed quantities", async () => {
  const { get } = setup();
  const available = await get("status=AVAILABLE&limit=10");
  assert.equal(available.pagination.total, 2);
  assert.ok(available.data.some(product => product._id === id(1)));
  const low = await get("status=LOW_STOCK&category=Tools");
  assert.equal(low.pagination.total, 1);
  assert.equal(low.data[0]._id, id(2));
  const out = await get("status=OUT_OF_STOCK");
  assert.equal(out.pagination.total, 2);
});

test("Viewer sees every product while Staff sees only stock in assigned warehouses", async () => {
  assert.equal((await setup("VIEWER").get()).pagination.total, 5);
  const { get, calls } = setup("STAFF");
  const result = await get("limit=10");
  assert.equal(result.pagination.total, 3);
  assert.ok(result.data.every(product => product.locations.every(location => location.warehouseId === whA._id)));
  assert.equal(result.data.find(product => product._id === id(1)).totalStock, 6);
  assert.deepEqual(calls[0].warehouseId, { $in: [whA._id] });
});

test("search preserves literal punctuation and finds warehouse/rack codes without duplicate products", async () => {
  const { get } = setup();
  const named = await get("q=" + encodeURIComponent("Drill [XL]"));
  assert.equal(named.pagination.total, 1);
  assert.equal(named.data[0]._id, id(1));
  const rack = await get("q=B1");
  assert.equal(rack.pagination.total, 2);
  const warehouse = await get("q=WH-B");
  assert.equal(warehouse.pagination.total, 2);
  assert.equal((await setup("STAFF").get("q=WH-B")).pagination.total, 0);
});

test("Excel export includes the entire catalog regardless of search, filters or pagination", async () => {
  for (const role of ["ADMIN", "VIEWER"]) {
    const result = await setup(role).get("export=excel&page=2&limit=1&q=missing&category=Safety&status=LOW_STOCK&checkName=missing");
    assert.equal(result.count, 5);
    assert.equal(result.data.length, 5);
    assert.equal(result.pagination, undefined);
    assert.equal(result.export.scope, "ALL_WAREHOUSES");
    const drill = result.data.find(product => product._id === id(1));
    assert.equal(drill.locations.length, 2);
    assert.equal(drill.locations[0].warehouseAddress, "Abu Dhabi");
    assert.equal(drill.locations[0].zoneName, "Zone B");
    assert.equal(drill.locations[0].zoneCode, "ZB");
    assert.equal(drill.locations[0].rackStatus, "ACTIVE");
    assert.equal(drill.locations[0].updatedAt, "2026-11-04T00:00:00.000Z");
  }
});

test("Staff Excel export includes all assigned products without exposing other warehouses", async () => {
  const result = await setup("STAFF").get("export=excel&limit=1");
  assert.equal(result.export.scope, "ASSIGNED_WAREHOUSES");
  assert.equal(result.count, 3);
  assert.equal(result.data.length, 3);
  assert.ok(result.data.every(product => product.locations.every(location => location.warehouseId === whA._id)));
  assert.equal(result.data.find(product => product._id === id(1)).totalStock, 6);
});

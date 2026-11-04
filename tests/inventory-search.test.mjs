import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the real route handler with isolated database and session dependencies.
const source = readFileSync(new URL("../app/api/inventory/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function loadRoute(user = { role: "ADMIN" }) {
  const calls = {};
  const model = (name, ids) => ({
    find(filter) {
      (calls[name] ??= []).push(filter);
      return { select: async () => ids.map((_id) => ({ _id })) };
    },
  });
  const inventory = {
    countDocuments(filter) {
      calls.countFilter = filter;
      return Promise.resolve(7);
    },
    find(filter) {
      calls.filter = filter;
      const query = {
        populate() { return query; },
        sort(value) { calls.sort = value; return query; },
        skip(value) { calls.skip = value; return query; },
        limit(value) { calls.limit = value; return Promise.resolve([{ _id: "inventory-1" }]); },
      };
      return query;
    },
  };
  const modules = {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/auth": {
      requireSessionUser: async () => user,
      getUserWarehouseId: (value) => value.warehouseId,
    },
    "@/models/Inventory": inventory,
    "@/models/Product": model("products", ["product-1"]),
    "@/models/Rack": model("racks", ["rack-1"]),
    "@/models/Warehouse": model("warehouses", ["warehouse-1"]),
    "@/models/StockMovement": {},
  };
  const exports = {};
  new Function("require", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  }, exports);
  return { GET: exports.GET, calls };
}

test("Viewer can browse stock in all warehouses without an assignment and filter a chosen warehouse", async () => {
  const { GET, calls } = loadRoute({ role: "VIEWER", warehouseId: [] });
  assert.equal((await GET(new Request("http://localhost/api/inventory"))).status, 200);
  assert.equal(calls.filter.warehouseId, undefined);
  assert.equal((await GET(new Request("http://localhost/api/inventory?warehouseId=warehouse-2"))).status, 200);
  assert.equal(calls.filter.warehouseId, "warehouse-2");
});

test("search treats punctuation literally across product, rack, and warehouse fields", async () => {
  for (const term of ["Tool [XL]", "Cable (2m)", "A+B", "SKU.*", "[", "\\"]) {
    const { GET, calls } = loadRoute();
    const response = await GET(new Request(`http://localhost/api/inventory?page=1&q=${encodeURIComponent(term)}`));
    assert.equal(response.status, 200);
    const regex = calls.products[0].$or[0].name;
    assert.ok(regex.test(term));
    assert.ok(!regex.test("unrelated product"));
    assert.equal(calls.products[0].$or[1].sku, regex);
    assert.equal(calls.products[0].$or[2].sellerName, regex);
    assert.equal(calls.racks[0].$or[0].name, regex);
    assert.equal(calls.warehouses[0].$or[1].code, regex);
  }
});

test("category and status remain combined with text search and staff warehouse restriction", async () => {
  const { GET, calls } = loadRoute({ role: "STAFF", warehouseId: "assigned-warehouse" });
  await GET(new Request("http://localhost/api/inventory?page=1&q=tool&category=Tools&status=LOW_STOCK&warehouseId=other"));
  assert.deepEqual(calls.products[0], { category: "Tools" });
  assert.deepEqual(calls.filter.productId, { $in: ["product-1"] });
  assert.equal(calls.filter.warehouseId, "assigned-warehouse");
  assert.equal(calls.filter.status, "LOW_STOCK");
  assert.deepEqual(calls.filter.$or, [
    { productId: { $in: ["product-1"] } },
    { rackId: { $in: ["rack-1"] } },
    { warehouseId: { $in: ["warehouse-1"] } },
  ]);
  assert.deepEqual(calls.countFilter, calls.filter);
});

test("category works without a query and ALL clears the category restriction", async () => {
  for (const category of ["Tools", "ALL"]) {
    const { GET, calls } = loadRoute();
    await GET(new Request(`http://localhost/api/inventory?page=1&category=${category}`));
    assert.deepEqual(calls.filter, category === "ALL" ? {} : { productId: { $in: ["product-1"] } });
  }
});

test("pagination uses a stable order and returns the filtered count", async () => {
  const { GET, calls } = loadRoute();
  const response = await GET(new Request("http://localhost/api/inventory?page=2&limit=5"));
  const result = await response.json();
  assert.equal(calls.skip, 5);
  assert.equal(calls.limit, 5);
  assert.deepEqual(calls.sort, { createdAt: -1, _id: -1 });
  assert.deepEqual(result.pagination, { total: 7, page: 2, limit: 5, totalPages: 2 });
});

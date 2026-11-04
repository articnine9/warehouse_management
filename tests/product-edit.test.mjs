import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isValidObjectId } from "mongoose";

const ids = Object.fromEntries(["product", "inventory", "warehouse", "zone", "rack", "oldRack", "category", "otherWarehouse"].map((key, index) => [key, String(index + 1).padStart(24, "0")]));
const compiled = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const editSource = compiled("../app/api/products/[id]/route.ts");
const productsSource = compiled("../app/api/products/route.ts");
const productStock = {};
new Function("exports", compiled("../lib/productStock.ts"))(productStock);

function setup(options = {}) {
  const writes = [];
  const product = { _id: ids.product, name: "Drill [XL]", sku: "TOOL-1", category: "Tools", sellerName: "Vendor", price: 100 };
  const inventory = { _id: ids.inventory, productId: ids.product, warehouseId: options.sourceWarehouse || ids.warehouse, rackId: options.missingRack ? undefined : options.nullRack ? null : ids.oldRack, quantity: 12, async save() { writes.push(["inventory", { ...this }]); } };
  const models = {
    Product: {
      findById: () => ({ lean: async () => product }),
      findByIdAndUpdate: (id, values, config) => ({ populate: async () => {
        writes.push(["product", values, config]);
        return { ...product, ...values };
      } }),
      findOne: async () => null,
      create: async (values) => { writes.push(["product", values]); return { ...values, _id: ids.product }; },
      find: (filter) => {
        assert.ok(filter.name.$regex.test("Drill [XL]"));
        assert.ok(!filter.name.$regex.test("Drill X"));
        return { limit: () => ({ sort: async () => [product] }) };
      },
    },
    Inventory: {
      findOne: async (filter) => filter._id === ids.inventory ? (options.foreignInventory ? null : inventory) : (options.occupied ? inventory : null),
      findById: async () => inventory,
      findOneAndUpdate: async (filter, update) => {
        assert.equal(filter.rackId, inventory.rackId ?? null);
        assert.equal(filter.productId, ids.product);
        if (options.concurrentMove) return null;
        writes.push(["move", update]);
        return { ...inventory, ...update.$set };
      },
      create: async (values) => { writes.push(["inventory", values]); return values; },
      find: () => {
        const query = { populate: () => query, then: (resolve, reject) => Promise.resolve([]).then(resolve, reject) };
        return query;
      },
    },
    Rack: {
      exists: async () => options.deletedRack ? null : { _id: ids.oldRack },
      findOne: async (filter) => options.invalidRack || (filter.zoneId && options.wrongZone) ? null : { _id: ids.rack, name: "Rack B", warehouseId: ids.warehouse, zoneId: options.wrongZone ? ids.category : ids.zone },
    },
    Zone: { findOne: async () => ({ _id: ids.zone }) },
    Warehouse: { findById: async () => ({ _id: ids.warehouse, name: "Main" }) },
    Category: { findOne: async () => ({ _id: ids.category }) },
    ProductHistory: { create: async (values) => { writes.push(["history", values]); } },
    StockMovement: { create: async (values) => { writes.push(["movement", values]); } },
  };
  const modules = {
    "@/lib/productStock": productStock,
    mongoose: { isValidObjectId },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/auth": {
      requireSessionUser: async () => ({ id: ids.product, name: "Tester", role: options.staff ? "STAFF" : "ADMIN" }),
      getUserWarehouseId: () => [ids.warehouse],
    },
    ...Object.fromEntries(Object.entries(models).map(([key, value]) => [`@/models/${key}`, value])),
  };
  const load = (source) => {
    const exports = {};
    new Function("require", "exports", source)((name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
      return modules[name];
    }, exports);
    return exports;
  };
  const location = { inventoryId: ids.inventory, warehouseId: ids.warehouse, zoneId: ids.zone, rackId: ids.rack, quantity: 12 };
  return { edit: load(editSource), products: load(productsSource), writes, inventory, location };
}

const request = (body, method = "PUT") => new Request("http://localhost/api/products", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: ids.product }) };

test("relocating stock preserves quantity and records the old and new rack", async () => {
  const { edit, writes, inventory, location } = setup();
  const response = await edit.PUT(request({ category: "Tools", locations: [location] }), context);
  assert.equal(response.status, 200);
  assert.equal(inventory.rackId, ids.rack);
  assert.equal(inventory.quantity, 12);
  assert.equal(writes.filter(([type]) => type === "movement").length, 0);
  const history = writes.find(([type]) => type === "history")[1];
  assert.equal(history.oldValues.locations[0].rackId, ids.oldRack);
  assert.equal(history.newValues.locations[0].rackId, ids.rack);
});

test("invalid destinations, foreign inventory and occupied racks are rejected before writes", async () => {
  for (const options of [{ invalidRack: true }, { wrongZone: true }, { foreignInventory: true }, { occupied: true }]) {
    const { edit, writes, location } = setup(options);
    const response = await edit.PUT(request({ locations: [location] }), context);
    assert.equal(response.status, 400, JSON.stringify(options));
    assert.deepEqual(writes, []);
  }
});

test("duplicate assignments and incomplete locations are rejected before writes", async () => {
  for (const update of [(loc) => [loc, loc], (loc) => [{ ...loc, rackId: "" }], (loc) => [{ ...loc, quantity: -1 }]]) {
    const { edit, writes, location } = setup();
    const response = await edit.PUT(request({ locations: update(location) }), context);
    assert.equal(response.status, 400);
    assert.deepEqual(writes, []);
  }
});

test("staff can relocate assigned stock but cannot use unassigned source or destination warehouses", async () => {
  for (const options of [{ staff: true }, { staff: true, sourceWarehouse: ids.otherWarehouse }, { staff: true, destinationWarehouse: ids.otherWarehouse }]) {
    const { edit, writes, location } = setup(options);
    if (options.destinationWarehouse) location.warehouseId = options.destinationWarehouse;
    const response = await edit.PUT(request({ locations: [location] }), context);
    assert.equal(response.status, options.sourceWarehouse || options.destinationWarehouse ? 403 : 200);
    if (response.status === 403) assert.deepEqual(writes, []);
  }
});

test("category is mandatory and optional seller and price can be cleared during edit", async () => {
  const { edit, writes } = setup();
  const invalid = await edit.PUT(request({ category: "  " }), context);
  assert.equal(invalid.status, 400);
  assert.deepEqual(writes, []);
  const valid = await edit.PUT(request({ category: "Tools", sellerName: "", price: "" }), context);
  assert.equal(valid.status, 200);
  const productWrite = writes.find(([type]) => type === "product");
  assert.equal(productWrite[1].sellerName, "");
  assert.equal(productWrite[1].price, 0);
  assert.equal(productWrite[2].runValidators, true);
});

test("creating a product requires category and accepts omitted seller and price", async () => {
  const { products, writes } = setup();
  const body = { name: "New Drill", sku: "TOOL-2", warehouseId: ids.warehouse, rackId: ids.rack, initialQuantity: 12 };
  const invalid = await products.POST(request(body, "POST"));
  assert.equal(invalid.status, 400);
  assert.deepEqual(writes, []);
  const valid = await products.POST(request({ ...body, category: "Tools" }, "POST"));
  assert.equal(valid.status, 201);
  const created = writes.find(([type]) => type === "product")[1];
  assert.equal(created.category, "Tools");
  assert.equal(created.sellerName, "");
  assert.equal(created.price, 0);
});

test("name lookup returns matching names and SKUs with literal punctuation", async () => {
  const { products } = setup();
  const response = await products.GET(new Request("http://localhost/api/products?checkName=%5BXL%5D"));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.exists, true);
  assert.equal(result.products[0].name, "Drill [XL]");
  assert.equal(result.products[0].sku, "TOOL-1");
});

const moveBody = () => ({ inventoryId: ids.inventory, zoneId: ids.zone, rackId: ids.rack, sourceRackId: ids.oldRack });

test("dedicated Move changes only the rack, preserving live quantity and product details", async () => {
  const { edit, writes, inventory } = setup();
  // Stock may have changed since the popup opened; Move must preserve the live value.
  inventory.quantity = 7;
  const response = await edit.PATCH(request(moveBody(), "PATCH"), context);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.data.quantity, 7);
  assert.equal(result.data.rackId, ids.rack);
  assert.deepEqual(writes.find(([type]) => type === "move")[1], { $set: { rackId: ids.rack } });
  assert.equal(writes.some(([type]) => type === "product" || type === "movement"), false);
  const history = writes.find(([type]) => type === "history")[1];
  assert.equal(history.oldValues.locations[0].rackId, ids.oldRack);
  assert.equal(history.newValues.locations[0].zoneId, ids.zone);
  assert.equal(history.newValues.locations[0].quantity, 7);
});

test("dedicated Move rejects invalid destinations and unassigned staff stock before writes", async () => {
  const scenarios = [
    [{ invalidRack: true }, 400],
    [{ wrongZone: true }, 400],
    [{ foreignInventory: true }, 404],
    [{ occupied: true }, 409],
    [{ staff: true, sourceWarehouse: ids.otherWarehouse }, 403],
    [{ concurrentMove: true }, 409],
  ];
  for (const [options, status] of scenarios) {
    const { edit, writes } = setup(options);
    const response = await edit.PATCH(request(moveBody(), "PATCH"), context);
    assert.equal(response.status, status, JSON.stringify(options));
    assert.deepEqual(writes, []);
  }
});

test("dedicated Move rejects stale source, unchanged rack and malformed selections", async () => {
  for (const [update, status] of [
    [{ sourceRackId: ids.category }, 409],
    [{ rackId: ids.oldRack }, 400],
    [{ rackId: "" }, 400],
    [{ inventoryId: null }, 400],
    [{ sourceRackId: "" }, 409],
    [{ sourceRackId: null }, 409],
    [{ sourceRackId: "invalid" }, 400],
    [{ sourceRackId: undefined }, 400],
  ]) {
    const { edit, writes } = setup();
    const response = await edit.PATCH(request({ ...moveBody(), ...update }, "PATCH"), context);
    assert.equal(response.status, status);
    assert.deepEqual(writes, []);
  }
});

test("dedicated Move assigns stock from missing, null and deleted racks without changing quantity", async () => {
  for (const options of [{ missingRack: true }, { nullRack: true }, { deletedRack: true }]) {
    for (const sourceRackId of ["", null]) {
      const { edit, writes, inventory } = setup(options);
      inventory.quantity = 21;
      const response = await edit.PATCH(request({ ...moveBody(), sourceRackId }, "PATCH"), context);
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify({ options, result }));
      assert.equal(result.data.quantity, 21);
      assert.equal(result.data.rackId, ids.rack);
      assert.deepEqual(writes.find(([type]) => type === "move")[1], { $set: { rackId: ids.rack } });
      assert.equal(writes.some(([type]) => type === "product" || type === "movement"), false);
      const history = writes.find(([type]) => type === "history")[1];
      assert.equal(history.oldValues.locations[0].rackId, inventory.rackId ?? null);
      assert.equal(history.newValues.locations[0].quantity, 21);
    }
  }
});

test("unassigned sources still enforce destination, access and concurrent move checks", async () => {
  for (const [options, status] of [
    [{ deletedRack: true, invalidRack: true }, 400],
    [{ nullRack: true, wrongZone: true }, 400],
    [{ missingRack: true, occupied: true }, 409],
    [{ deletedRack: true, staff: true, sourceWarehouse: ids.otherWarehouse }, 403],
    [{ deletedRack: true, concurrentMove: true }, 409],
  ]) {
    const { edit, writes } = setup(options);
    const response = await edit.PATCH(request({ ...moveBody(), sourceRackId: "" }, "PATCH"), context);
    assert.equal(response.status, status, JSON.stringify(options));
    assert.deepEqual(writes, []);
  }
});

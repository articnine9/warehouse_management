import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import mongoose from "mongoose";

function load(file, modules = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", source)((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
const types = load("../lib/productType.ts");
const { movementProductType } = load("../lib/movementProductType.ts", { "./productType": types });
const issueId = "000000000000000000000001";
const productId = "000000000000000000000002";
const issues = [{ _id: issueId, issueNumber: "ISS-01", items: [{ productId, sku: "TOOL-1", productType: "REUSABLE" }] }];

test("explicit classifications take precedence and missing type is not labelled non-returnable", () => {
  assert.equal(types.resolveProductType("NON_REUSABLE", "2026-11-01", "REUSABLE"), "NON_REUSABLE");
  assert.equal(types.resolveProductType(undefined, "2026-11-01"), "REUSABLE");
  assert.equal(types.resolveProductType(undefined, undefined, "NON_REUSABLE"), "NON_REUSABLE");
  assert.equal(types.resolveProductType(undefined), undefined);
  assert.equal(types.productTypeLabel(undefined), "Type not recorded");
});

test("movement snapshots survive changes to current issue and catalog classifications", () => {
  assert.equal(movementProductType({ reason: "EMPLOYEE_ISSUE", productType: "NON_REUSABLE", referenceId: issueId, sku: "TOOL-1" }, issues, "REUSABLE"), "NON_REUSABLE");
});

test("legacy employee movement type is resolved from its issue, not today's catalog", () => {
  assert.equal(movementProductType({ reason: "EMPLOYEE_ISSUE", referenceId: issueId, sku: "TOOL-1" }, issues, "NON_REUSABLE"), "REUSABLE");
  assert.equal(movementProductType({ reason: "EMPLOYEE_RETURN", referenceNumber: "RETURN #ISS-01", sku: "TOOL-1" }, issues), "REUSABLE");
  assert.equal(movementProductType({ reason: "EMPLOYEE_ISSUE", sku: "TOOL-1" }, [], "NON_REUSABLE"), undefined);
  assert.equal(movementProductType({ reason: "RESTOCK" }, [], "REUSABLE"), "REUSABLE");
});

test("ambiguous legacy issue lines are not assigned a guessed type", () => {
  const mixed = [{ ...issues[0], items: [...issues[0].items, { sku: "TOOL-1", productType: "NON_REUSABLE" }] }];
  assert.equal(movementProductType({ reason: "EMPLOYEE_ISSUE", referenceId: issueId, sku: "TOOL-1" }, mixed, "REUSABLE"), undefined);
});

test("populated product IDs match the correct legacy issue line when SKU is missing", () => {
  const issue = { ...issues[0], items: [{ productId: "other", productType: "NON_REUSABLE" }, { productId, productType: "REUSABLE" }] };
  assert.equal(movementProductType({ reason: "EMPLOYEE_ISSUE", referenceId: issueId, productId: { _id: productId } }, [issue]), "REUSABLE");
});

test("movement API includes resolved historical types without rewriting existing records", async () => {
  const movement = { productId: { _id: productId, productType: "NON_REUSABLE" }, sku: "TOOL-1", referenceId: issueId, reason: "EMPLOYEE_ISSUE", quantity: 1, unitPrice: 10, totalValue: 10, movementType: "OUTWARD", toObject() { const { toObject, ...plain } = this; void toObject; return plain; } };
  const query = {
    populate() { return query; }, sort() { return query; }, skip() { return query; },
    limit: async () => [movement],
    select: () => ({ lean: async () => [movement] }),
  };
  const { GET } = load("../app/api/movements/route.ts", {
    mongoose: { isValidObjectId: mongoose.isValidObjectId },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/auth": { requireSessionUser: async () => ({ role: "ADMIN" }), getUserWarehouseId: () => [] },
    "@/lib/movementProductType": { movementProductType },
    "@/models/StockMovement": { countDocuments: async () => 1, find: () => query },
    "@/models/EmployeeIssue": { find: () => ({ lean: async () => issues }) },
    "@/models/Product": {}, "@/models/Inventory": {}, "@/models/Invoice": {}, "@/models/Warehouse": {}, "@/models/Rack": {},
  });
  const response = await GET(new Request("http://localhost/api/movements?period=all"));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.data[0].productType, "REUSABLE");
  assert.equal(movement.productType, undefined);
  assert.equal(result.metrics.totalOutwardUnits, 1);
});

test("billing serializes real invoice lines and preserves snapshots over catalog fallback", async () => {
  const Invoice = load("../models/Invoice.ts", { mongoose }).default;
  const invoice = new Invoice({ invoiceNumber: "INV-1", customerName: "Customer", items: [
    { productId, productName: "Drill", sku: "TOOL-1", quantity: 2, unitPrice: 10, total: 20, productType: "NON_REUSABLE" },
    { productId, productName: "Legacy drill", sku: "TOOL-2", quantity: 1, unitPrice: 10, total: 10 },
  ], subtotal: 30, grandTotal: 30 });
  const { GET } = load("../app/api/billing/route.ts", {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/productType": types,
    "@/models/Invoice": { find: () => ({ sort: async () => [invoice] }) },
    "@/models/Product": { find: () => ({ select: () => ({ lean: async () => [{ _id: productId, productType: "REUSABLE" }] }) }) },
    "@/models/Inventory": {}, "@/models/Warehouse": {}, "@/models/Rack": {}, "@/models/StockMovement": {},
  });
  const response = await GET(new Request("http://localhost/api/billing"));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.data[0].items[0].productType, "NON_REUSABLE");
  assert.equal(result.data[0].items[0].productName, "Drill");
  assert.equal(result.data[0].items[0].quantity, 2);
  assert.equal(result.data[0].items[1].productType, "REUSABLE");
  assert.equal(result.data[0].items[0]._doc, undefined);
});

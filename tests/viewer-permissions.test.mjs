import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import crypto from "node:crypto";
import mongoose from "mongoose";
import test from "node:test";
import ts from "typescript";

function load(file, modules) {
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
const permissions = load("../lib/permissions.ts", {});
const productStock = load("../lib/productStock.ts", {});

function guard({ role = "VIEWER", status = "ACTIVE", token = true, cookieRole = "ADMIN", databaseFails = false } = {}) {
  let queries = 0;
  const { proxy } = load("../proxy.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init), next: () => new Response(null, { headers: { "x-forwarded": "true" } }) } },
    "@/lib/auth": { SESSION_COOKIE: "warehouse_session", parseSessionToken: () => token ? { userId: "user", role: cookieRole } : null },
    "@/lib/mongodb": { connectDB: async () => { if (databaseFails) throw new Error("Offline"); } },
    "@/lib/permissions": permissions,
    "@/models/User": { findById: () => ({ select: () => ({ lean: async () => { queries++; return role ? { role, status } : null; } }) }) },
  });
  return {
    call: (method, pathname) => proxy({ method, nextUrl: new URL(`http://localhost${pathname}`), cookies: { get: () => ({ value: "session" }) } }),
    queries: () => queries,
  };
}

const routes = (directory = new URL("../app/api/", import.meta.url), prefix = "/api") => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
  if (entry.isDirectory()) return routes(url, `${prefix}/${entry.name.startsWith("[") ? "test-id" : entry.name}`);
  if (entry.name !== "route.ts") return [];
  const source = ts.createSourceFile("route.ts", readFileSync(url, "utf8"), ts.ScriptTarget.Latest, true);
  return source.statements.filter((node) => ts.isFunctionDeclaration(node) && ["POST", "PUT", "PATCH", "DELETE"].includes(node.name?.text)).map((node) => [node.name.text, prefix]);
});

test("Viewer cannot mutate through any API, even with an older admin cookie", async () => {
  const handler = guard();
  const endpoints = routes().filter(([, path]) => !["/api/auth/login", "/api/auth/logout"].includes(path));
  assert.ok(endpoints.length > 25);
  for (const [method, path] of endpoints) {
    const response = await handler.call(method, path);
    assert.equal(response.status, 403, `${method} ${path}`);
    assert.match((await response.json()).message, /view-only/);
  }
  assert.equal(handler.queries(), endpoints.length);
});

test("Viewer can read and log out, and admin/staff retain write access", async () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    const handler = guard();
    assert.equal((await handler.call(method, "/api/inventory")).headers.get("x-forwarded"), "true");
    assert.equal(handler.queries(), 0);
  }
  for (const path of ["/api/auth/login", "/api/auth/logout"]) assert.equal((await guard().call("POST", path)).status, 200);
  for (const role of ["ADMIN", "STAFF"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal((await guard({ role, cookieRole: "VIEWER" }).call(method, "/api/products/test-id")).headers.get("x-forwarded"), "true");
  }
});

test("each data-changing handler also denies Viewer before touching application data", async () => {
  function routeFiles(directory = new URL("../app/api/", import.meta.url)) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
      ? routeFiles(new URL(`${entry.name}/`, directory)) : entry.name === "route.ts" ? [new URL(entry.name, directory)] : []);
  }
  let checked = 0;
  for (const file of routeFiles()) {
    if (/\/auth\/(login|logout)\//.test(file.pathname)) continue;
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
    const methods = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["POST", "PUT", "PATCH", "DELETE"].includes(node.name?.text)).map((node) => node.name.text);
    if (!methods.length) continue;
    const modules = Object.fromEntries(ast.statements.filter(ts.isImportDeclaration).map((node) => [node.moduleSpecifier.text, {}]));
    Object.assign(modules, {
      mongoose,
      "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
      "@/lib/mongodb": { connectDB: async () => {} },
      "@/lib/permissions": permissions,
      "@/lib/auth": { requireSessionUser: async () => ({ role: "VIEWER" }), requireWriteUser: async () => { throw new Error("FORBIDDEN"); } },
    });
    const exports = load(file.href, modules);
    for (const method of methods) {
      const response = await exports[method](new Request("http://localhost/api/test", { method, headers: { "content-type": "application/json" }, body: "{}" }), { params: Promise.resolve({ id: "000000000000000000000001" }) });
      assert.equal(response.status, 403, `${method} ${file.pathname}`);
      checked++;
    }
  }
  assert.ok(checked > 25);
});

test("mutation guard fails closed for missing sessions, inactive accounts and database errors", async () => {
  for (const options of [{ token: false }, { role: null }, { status: "INACTIVE" }]) assert.equal((await guard(options).call("POST", "/api/billing")).status, 401);
  assert.equal((await guard({ databaseFails: true }).call("POST", "/api/billing")).status, 503);
  assert.equal((await guard({ role: "UNKNOWN" }).call("POST", "/api/billing")).status, 403);
});

test("Viewer sessions authenticate, but the current account role blocks write helpers", async () => {
  let cookie;
  const user = { _id: "user", role: "VIEWER", status: "ACTIVE" };
  const query = { select: () => query, populate: () => query, then: (resolve, reject) => Promise.resolve(user).then(resolve, reject) };
  const auth = load("../lib/auth.ts", {
    crypto, "./permissions": permissions,
    "next/headers": { cookies: async () => ({ get: () => ({ value: cookie }) }) },
    "@/models/User": { findById: () => query }, "@/models/Warehouse": {},
  });
  cookie = auth.createSessionToken("user", "VIEWER");
  assert.equal(auth.parseSessionToken(cookie).role, "VIEWER");
  assert.equal((await auth.requireSessionUser()).role, "VIEWER");
  await assert.rejects(auth.requireWriteUser(), /FORBIDDEN/);
  cookie = auth.createSessionToken("user", "ADMIN");
  await assert.rejects(auth.requireWriteUser(), /FORBIDDEN/);
  user.role = "STAFF";
  assert.equal((await auth.requireWriteUser()).role, "STAFF");
  assert.equal(auth.parseSessionToken(cookie + "tampered"), null);
});

function accounts(actor = "ADMIN") {
  const changes = [];
  let account = { _id: "account", name: "Viewer", email: "viewer@example.com", role: "STAFF", warehouseIds: ["warehouse"], async save() { changes.push({ ...this }); } };
  const userQuery = () => Object.assign(Promise.resolve(account), { select: () => ({ populate: async () => account }) });
  const modules = {
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/permissions": permissions,
    "@/lib/auth": { requireSessionUser: async () => ({ role: actor }), hashPassword: async () => "hashed", toSafeUser: (value) => value },
    "@/models/User": {
      findOne: async () => null, findById: userQuery,
      create: async (values) => { changes.push(values); account = { ...values, _id: "account" }; return account; },
    },
    "@/models/Warehouse": { find: async () => { throw new Error("Viewer must not need warehouse assignment"); } },
    "@/models/Inventory": {}, "@/models/Product": {}, "@/models/Rack": {}, "@/models/Category": {},
  };
  return { create: load("../app/api/staff/route.ts", modules).POST, update: load("../app/api/staff/[id]/route.ts", modules).PUT, changes };
}
const accountRequest = (role, method = "POST") => new Request("http://localhost/api/staff", { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Viewer", email: "viewer@example.com", password: "test-password", role }) });

test("admin can create a Viewer and change a Staff account to Viewer without assigned warehouses", async () => {
  const handler = accounts();
  const created = await handler.create(accountRequest("VIEWER"));
  assert.equal(created.status, 200);
  assert.equal(handler.changes[0].role, "VIEWER");
  assert.deepEqual(handler.changes[0].warehouseIds, []);
  const existing = accounts();
  const updated = await existing.update(accountRequest("VIEWER", "PUT"), { params: Promise.resolve({ id: "account" }) });
  assert.equal(updated.status, 200);
  assert.equal(existing.changes[0].role, "VIEWER");
  assert.deepEqual(existing.changes[0].warehouseIds, []);
  assert.equal(existing.changes[0].warehouseId, null);
});

test("only Admin can create or modify login accounts, and unknown roles are rejected", async () => {
  for (const actor of ["STAFF", "VIEWER"]) {
    const handler = accounts(actor);
    assert.equal((await handler.create(accountRequest("ADMIN"))).status, 403);
    assert.equal((await handler.update(accountRequest("ADMIN", "PUT"), { params: Promise.resolve({ id: "account" }) })).status, 403);
    assert.deepEqual(handler.changes, []);
  }
  assert.equal((await accounts().create(accountRequest("UNKNOWN"))).status, 400);
});

test("Viewer dashboard covers all warehouses even without an assignment", async () => {
  const filters = [];
  const query = { populate() { return query; }, sort() { return query; }, limit() { return query; }, lean: async () => [], then: (resolve, reject) => Promise.resolve([]).then(resolve, reject) };
  const model = { countDocuments: async () => 2, find: (filter) => { filters.push(filter); return query; }, aggregate: async () => [{ totalQuantity: 21 }], distinct: async () => [] };
  const user = { role: "VIEWER", warehouseIds: [] };
  const { GET } = load("../app/api/dashboard/route.ts", {
    "@/lib/productStock": productStock,
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/auth": { requireSessionUser: async () => user, toSafeUser: value => value, getUserWarehouseId: () => [], getUserWarehouse: () => null },
    "@/lib/productType": { resolveProductType: () => undefined },
    "@/lib/serviceCycle": { getServiceCycleInfo: () => ({}) },
    ...Object.fromEntries(["EmployeeIssue", "Inventory", "Product", "Category", "Rack", "User", "Warehouse"].map(name => [`@/models/${name}`, model])),
  });
  const response = await GET();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.role, "VIEWER");
  assert.ok(result.data.metrics.some(metric => metric.label === "Total Stock" && metric.value === 21));
  assert.ok(filters.every(filter => !JSON.stringify(filter).includes("warehouseId")));
});

test("Viewer reads do not seed departments or update historical warehouse names", async () => {
  const auth = { requireSessionUser: async () => ({ role: "VIEWER" }) };
  const database = { connectDB: async () => {} };
  const departments = load("../app/api/departments/route.ts", {
    "@/lib/auth": auth, "@/lib/mongodb": database,
    "@/models/Department": { find: () => ({ sort: async () => [] }), insertMany: () => { assert.fail("Viewer seeded departments"); } },
  });
  assert.equal((await departments.GET()).status, 200);
  const warehouses = load("../app/api/warehouses/route.ts", {
    "@/lib/auth": auth, "@/lib/mongodb": database,
    "@/models/Warehouse": { find: () => ({ sort: async () => [{ _id: "warehouse", name: "Warehouse", toObject: () => ({ name: "Warehouse" }) }] }) },
    ...Object.fromEntries(["Inventory", "Rack", "Zone"].map(name => [`@/models/${name}`, { aggregate: async () => [] }])),
    ...Object.fromEntries(["StockMovement", "Invoice", "EmployeeIssue"].map(name => [`@/models/${name}`, { updateMany: () => { assert.fail("Viewer updated historical names"); } }])),
  });
  assert.equal((await warehouses.GET()).status, 200);
});

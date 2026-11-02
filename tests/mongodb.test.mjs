import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const databaseSource = compile("../lib/mongodb.ts");
const inventorySource = compile("../app/api/inventory/route.ts");

function setup(env = {}, failFirst = false) {
  const calls = [];
  const mongoose = {
    connect: async (uri) => {
      calls.push(uri);
      if (failFirst && calls.length === 1) throw new Error("Temporary connection failure");
      return mongoose;
    },
  };
  const exports = {};
  new Function("require", "exports", "process", "global", "console", databaseSource)(
    () => mongoose, exports, { env }, {}, { log() {}, error() {} }
  );
  return { ...exports, calls, mongoose };
}

test("missing database configuration does not crash module import and fails at request time", async () => {
  for (const value of [undefined, "", "  "]) {
    const { connectDB, calls } = setup({ MONGODB_URI: value });
    await assert.rejects(connectDB(), /Set MONGODB_URI in .env.local/);
    assert.deepEqual(calls, []);
  }
});

test("database configuration can be restored after a missing configuration error", async () => {
  const env = {};
  const { connectDB, calls } = setup(env);
  await assert.rejects(connectDB());
  env.MONGODB_URI = "mongodb://test.invalid/warehouse";
  await connectDB();
  assert.deepEqual(calls, [env.MONGODB_URI]);
});

test("simultaneous database requests share a connection and reuse it", async () => {
  const { connectDB, calls, mongoose } = setup({ MONGODB_URI: "mongodb://test.invalid/warehouse" });
  const connections = await Promise.all([connectDB(), connectDB(), connectDB()]);
  assert.ok(connections.every((connection) => connection === mongoose));
  await connectDB();
  assert.equal(calls.length, 1);
});

test("failed database connections can be retried", async () => {
  const { connectDB, calls } = setup({ MONGODB_URI: "mongodb://test.invalid/warehouse" }, true);
  await assert.rejects(connectDB(), /Temporary connection failure/);
  await connectDB();
  assert.equal(calls.length, 2);
});

test("inventory returns valid JSON when database configuration is missing", async () => {
  const { connectDB } = setup();
  const exports = {};
  new Function("require", "exports", "console", inventorySource)(
    (name) => name === "@/lib/mongodb" ? { connectDB } : {}, exports, { error() {} }
  );
  const response = await exports.GET(new Request("http://localhost/api/inventory?page=1&limit=5"));
  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { success: false, message: "Failed to fetch inventory" });
});

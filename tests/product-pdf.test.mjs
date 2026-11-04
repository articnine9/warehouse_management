import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/productPdf.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText;
const exports = {};
new Function("exports", source)(exports);
const { paginateProductDesign, productPdfFilename } = exports;

test("keeps cards and rows intact across columns with continuous coverage", () => {
  const blocks = [{ top: 500, bottom: 950 }, { top: 850, bottom: 1050 }, { top: 1450, bottom: 1550 }];
  const pages = paginateProductDesign(2200, 1000, blocks);
  assert.deepEqual(pages, [{ top: 0, height: 500 }, { top: 500, height: 950 }, { top: 1450, height: 750 }]);
  assert.equal(pages.reduce((sum, page) => sum + page.height, 0), 2200);
  for (const page of pages.slice(0, -1)) {
    const bottom = page.top + page.height;
    assert.ok(blocks.every((block) => !(block.top < bottom && block.bottom > bottom)));
  }
});

test("handles very long records without empty pages or missing content", () => {
  const pages = paginateProductDesign(12000, 900, [{ top: 0, bottom: 11000 }]);
  assert.ok(pages.length > 10);
  let offset = 0;
  for (const page of pages) {
    assert.equal(page.top, offset);
    assert.ok(page.height > 0 && page.height <= 900);
    offset += page.height;
  }
  assert.equal(offset, 12000);
  assert.deepEqual(paginateProductDesign(0, 900, []), []);
  assert.throws(() => paginateProductDesign(200, 0, []));
});

test("packs adjacent table rows onto pages without adding an artificial overlap", () => {
  const rows = Array.from({ length: 65 }, (_, index) => ({ top: index * 100, bottom: (index + 1) * 100 }));
  const pages = paginateProductDesign(6500, 950, rows);
  assert.equal(pages.length, 8);
  assert.ok(pages.slice(0, -1).every((page) => page.height === 900));
});

test("produces safe filenames with SKU, name and fallback", () => {
  assert.equal(productPdfFilename("DRILL/01", "Drill"), "DRILL-01-product-report.pdf");
  assert.equal(productPdfFilename("", "Drill 20mm"), "Drill 20mm-product-report.pdf");
  assert.equal(productPdfFilename("", ""), "product-product-report.pdf");
});

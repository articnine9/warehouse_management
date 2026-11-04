"use client";

import { useState } from "react";
import { FileSpreadsheet, LoaderCircle } from "lucide-react";

export default function ProductsExcelExportButton() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const { downloadProductsExcel } = await import("@/lib/productExcel");
      const report = await downloadProductsExcel();
      setResult(`Exported ${report.products} products and ${report.locations} stock locations`);
    } catch (err) {
      console.error("Product Excel export failed:", err);
      setError(err instanceof Error ? err.message : "Excel export failed. Please retry.");
    } finally {
      setExporting(false);
    }
  }
  return <div className="flex flex-col items-start gap-1">
    <button type="button" onClick={() => void exportExcel()} disabled={exporting} aria-busy={exporting}
      aria-label="Export all products to Excel"
      title="Export all accessible products and stock locations, including every page. Current search and filters do not limit this export."
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60">
      {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      {exporting ? "Exporting Excel..." : "Export Excel"}
    </button>
    {error && <p role="alert" className="max-w-xs text-xs text-red-600">{error}</p>}
    {result && <p role="status" className="max-w-xs text-xs text-emerald-700">{result}</p>}
  </div>;
}

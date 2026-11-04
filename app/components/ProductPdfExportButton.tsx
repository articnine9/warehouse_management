"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export default function ProductPdfExportButton({ data, disabled = false }: { data: { product: { id: string } } | null; disabled?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    if (!data || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const { downloadProductPdf } = await import("@/lib/productDesignPdf");
      await downloadProductPdf(data.product.id);
    } catch (err) {
      console.error("Product PDF export failed:", err);
      setError("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void exportPdf()}
        disabled={!data || disabled || exporting}
        aria-busy={exporting}
        title="Download complete product details and history as PDF"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exporting ? "Exporting..." : "Export PDF"}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

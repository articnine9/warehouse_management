export interface PdfBlock { top: number; bottom: number }
export interface PdfSlice { top: number; height: number }

/** Paginate continuous content, keeping cards and table rows together when they fit. */
export function paginateProductDesign(totalHeight: number, pageHeight: number, blocks: PdfBlock[]): PdfSlice[] {
  if (!Number.isFinite(totalHeight) || !Number.isFinite(pageHeight) || totalHeight < 0 || pageHeight <= 0) {
    throw new Error("Invalid PDF page dimensions");
  }
  const slices: PdfSlice[] = [];
  let top = 0;
  while (top < totalHeight) {
    let bottom = Math.min(totalHeight, top + pageHeight);
    // Moving one break can land inside another card in the adjacent column.
    while (bottom < totalHeight) {
      const overlapping = blocks.filter((block) => block.top > top && block.top < bottom && block.bottom > bottom && block.bottom - block.top <= pageHeight);
      if (!overlapping.length) break;
      bottom = Math.min(...overlapping.map((block) => block.top));
    }
    slices.push({ top, height: bottom - top });
    top = bottom;
  }
  return slices;
}

export function productPdfFilename(sku: string, name: string) {
  return `${(sku || name || "product").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 100)}-product-report.pdf`;
}

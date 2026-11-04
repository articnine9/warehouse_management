import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { jsPDF } from "jspdf";
import { getFontEmbedCSS, toSvg } from "html-to-image";
import ProductHistoryModal, { type ProductHistoryData } from "@/app/components/ProductHistoryModal";
import ProductPdfDetails from "@/app/components/ProductPdfDetails";
import { paginateProductDesign, productPdfFilename } from "./productPdf";
import "@fontsource-variable/inter/wght.css";

const WIDTH = 1440;

/** Render in a desktop viewport so mobile exports use the same complete page design. */
export async function createProductDesignPdf(data: ProductHistoryData) {
  const frame = document.createElement("iframe");
  frame.title = "Product PDF rendering";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;height:1100px;border:0;pointer-events:none;`;
  document.body.appendChild(frame);
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    const frameDoc = frame.contentDocument;
    if (!frameDoc) throw new Error("Could not prepare PDF layout");
    frameDoc.documentElement.lang = document.documentElement.lang;
    // Reuse the app's real styles, including Tailwind's current CSS colour syntax.
    await Promise.all(Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).filter((source) =>
      source.tagName !== "LINK" || new URL((source as HTMLLinkElement).href, document.baseURI).origin === window.location.origin
    ).map((source) => {
      const copy = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      if (copy.tagName !== "LINK") { frameDoc.head.appendChild(copy); return Promise.resolve(); }
      return new Promise<void>((resolve, reject) => {
        const required = new URL((copy as HTMLLinkElement).href, document.baseURI).origin === window.location.origin;
        const timeout = window.setTimeout(() => required ? reject(new Error("PDF stylesheet took too long to load")) : resolve(), required ? 15000 : 3000);
        copy.onload = () => { window.clearTimeout(timeout); resolve(); };
        copy.onerror = () => { window.clearTimeout(timeout); if (required) reject(new Error("Could not load PDF stylesheet")); else resolve(); };
        frameDoc.head.appendChild(copy);
      });
    }));
    const style = frameDoc.createElement("style");
    style.textContent = `
      html, body { margin: 0; width: ${WIDTH}px; background: #f1f5f9; }
      *, *::before, *::after { animation: none !important; transition: none !important; }
      body, body * { font-family: 'Inter Variable', system-ui, sans-serif !important; }
      .font-mono, .font-mono * { font-family: ui-monospace, monospace !important; }
      [data-pdf-controls], .product-pdf-view button, .product-pdf-view input,
      .product-pdf-view select, .product-pdf-view a { display: none !important; }
      .product-pdf-view [class*="overflow-"] { overflow: visible !important; }
      .product-pdf-view [class*="max-h-"] { max-height: none !important; }
      .product-pdf-view .truncate { white-space: normal !important; overflow: visible !important;
        text-overflow: clip !important; max-width: none !important; overflow-wrap: anywhere; }
      .product-pdf-view td, .product-pdf-view th { white-space: normal !important; overflow-wrap: anywhere; }
      .product-pdf-view table { width: 100%; table-layout: fixed; }
    `;
    frameDoc.head.appendChild(style);

    const viewport = frameDoc.createElement("div");
    viewport.style.cssText = `position:relative;width:${WIDTH}px;overflow:hidden;background:#f1f5f9;`;
    const content = frameDoc.createElement("div");
    viewport.appendChild(content);
    frameDoc.body.appendChild(viewport);
    root = createRoot(content);
    flushSync(() => root!.render(
      <>
        <header className="px-8 pt-6 max-w-7xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Product & Stock History</p>
          <h1 className="text-2xl font-black text-slate-900 mt-1">{data.product.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{data.product.sku} · Complete product report · {new Date().toLocaleString("en-IN")}</p>
        </header>
        <ProductHistoryModal productId={data.product.id} initialData={data} pdfView="PRODUCT_HISTORY" onClose={() => {}} />
        <div data-pdf-block className="px-8 pt-4 max-w-7xl mx-auto">
          <h2 className="text-xl font-black text-slate-900">Loan History & Employee Assignments</h2>
        </div>
        <ProductHistoryModal productId={data.product.id} initialData={data} pdfView="LOAN_HISTORY" onClose={() => {}} />
        <ProductPdfDetails data={data} />
      </>
    ));
    await frameDoc.fonts.ready;
    // Fonts and images must be laid out before measuring page breaks.
    await Promise.all(Array.from(content.querySelectorAll("img")).map((img) => img.decode()));
    const fontEmbedCSS = await getFontEmbedCSS(content, { preferredFontFormat: "woff2" });
    // Embedding remote font rules may start additional font loads in this viewport.
    await frameDoc.fonts.ready;
    const height = Math.ceil(content.getBoundingClientRect().height);
    if (!height) throw new Error("Product report is empty");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const margin = 8;
    const printWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const printHeight = doc.internal.pageSize.getHeight() - margin * 2 - 7;
    const pageHeight = Math.floor(printHeight * WIDTH / printWidth);
    const origin = content.getBoundingClientRect().top;
    const blocks = Array.from(content.querySelectorAll("tr, .rounded-2xl, [data-pdf-block], h1, h2, h3")).map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: Math.max(0, Math.round(rect.top - origin)), bottom: Math.round(rect.bottom - origin) };
    });
    const pages = paginateProductDesign(height, pageHeight, blocks);
    // Snapshot styles once, then rasterize one page at a time. This keeps large
    // histories fast without allocating a canvas the height of the whole report.
    const snapshot = await toSvg(content, {
      width: WIDTH, height, fontEmbedCSS,
      filter: (node) => !node.hasAttribute?.("data-pdf-controls"),
    });
    const svg = new DOMParser().parseFromString(decodeURIComponent(snapshot.slice(snapshot.indexOf(",") + 1)), "image/svg+xml").documentElement;
    const foreignObject = svg.querySelector("foreignObject");
    foreignObject?.setAttribute("width", String(WIDTH));
    foreignObject?.setAttribute("height", String(height));
    // The snapshot library freezes auto-sized text boxes to fractional pixel
    // dimensions. Let them lay out naturally so glyph rounding cannot wrap a
    // heading inside a box whose height was fixed to one line.
    foreignObject?.querySelectorAll<HTMLElement>("*").forEach((node) => {
      if (node.namespaceURI !== "http://www.w3.org/1999/xhtml" || node === foreignObject.firstElementChild) return;
      const classes = node.getAttribute("class") ?? "";
      if (!/(^|\s)([\w-]+:)*w-/.test(classes)) {
        node.style.removeProperty("width");
        node.style.removeProperty("inline-size");
      }
      if (!/(^|\s)([\w-]+:)*h-/.test(classes)) {
        node.style.removeProperty("height");
        node.style.removeProperty("block-size");
      }
    });
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      svg.setAttribute("height", String(page.height));
      svg.setAttribute("viewBox", `0 ${page.top} ${WIDTH} ${page.height}`);
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH * 2;
      canvas.height = page.height * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not render PDF page");
      context.fillStyle = "#f1f5f9";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (index) doc.addPage();
      doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, printWidth, page.height * printWidth / WIDTH);
      // Release each page canvas; large histories never require one enormous bitmap.
      canvas.width = 0;
      canvas.height = 0;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${index + 1} of ${pages.length}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 5, { align: "right" });
    }
    return doc;
  } finally {
    root?.unmount();
    frame.remove();
  }
}

export async function downloadProductPdf(productId: string) {
  const response = await fetch(`/api/history/product/${encodeURIComponent(productId)}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success || !result.data?.product) throw new Error("Unable to load complete product details");
  const data: ProductHistoryData = result.data;
  const doc = await createProductDesignPdf(data);
  doc.save(productPdfFilename(data.product.sku, data.product.name));
}

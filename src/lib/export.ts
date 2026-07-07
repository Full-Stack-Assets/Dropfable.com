// Client-side export helpers, extracted from App.tsx. Pure functions: they take
// the data + options explicitly (no component state) and trigger a browser
// download. Guarded by the Playwright UI smoke test (scripts/ui-smoke.mjs).
import { jsPDF } from "jspdf";
import type { ManufactureResult } from "../types";

const FOOTER_DEFAULT = "Manufactured by DropKit Digital Factory";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function triggerDownload(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProductTxt(
  item: ManufactureResult,
  opts: { productTypeName: string; niche: string; angle: string }
): void {
  const fileContent = `=== DIGITAL PRODUCT ===
TITLE: ${item.productTitle}
TYPE: ${opts.productTypeName}
AUDIENCE: ${item.originalNiche || opts.niche}
${opts.angle ? `ANGLE: ${opts.angle}` : ""}
========================

${item.productContent}

========================
© ${FOOTER_DEFAULT}.`;
  triggerDownload(fileContent, "text/plain;charset=utf-8", `${slug(item.productTitle) || "dropkit-product"}.txt`);
}

export function exportProductHtml(item: ManufactureResult): void {
  const safeTitle = item.productTitle.replace(/<[^>]*>?/gm, "") || "dropkit-product";
  const escaped = item.productContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 1rem; }
        .niche { color: #6b7280; font-size: 1rem; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .content { background: white; padding: 2.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); white-space: pre-wrap; font-size: 1.125rem; }
        .footer { margin-top: 3rem; text-align: center; color: #9ca3af; font-size: 0.875rem; }
    </style>
</head>
<body>
    <h1>${safeTitle}</h1>
    <div class="niche">Target Audience: ${item.originalNiche || "General"}</div>
    <div class="content">${escaped}</div>
    <div class="footer">${FOOTER_DEFAULT}</div>
</body>
</html>`;
  triggerDownload(htmlContent, "text/html;charset=utf-8", `${slug(safeTitle) || "dropkit-product"}.html`);
}

function pdfFooter(doc: jsPDF, watermarkText: string): void {
  doc.setFontSize(10);
  doc.setTextColor(150);
  const footerText = watermarkText.trim() ? `Manufactured by DropKit • ${watermarkText}` : FOOTER_DEFAULT;
  doc.text(footerText, 105, 285, { align: "center" });
  doc.setTextColor(0);
  doc.setFontSize(11);
}

// Render one product (title page + content pages) into an existing jsPDF doc.
function renderProductPdf(doc: jsPDF, item: ManufactureResult, audience: string, watermarkText: string): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const titleLines = doc.splitTextToSize(item.productTitle, 180);
  doc.text(titleLines, 105, 100, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  const audienceY = 130 + titleLines.length * 10;
  doc.text(`Target Audience: ${audience}`, 105, audienceY, { align: "center" });

  // Cover art on the title page when one was generated (4:3 → 160x120mm).
  // jsPDF throws on malformed image data; a bad cover shouldn't kill the export.
  if (item.coverImage) {
    try {
      doc.addImage(item.coverImage, "PNG", 25, audienceY + 10, 160, 120);
    } catch (e) {
      console.error("PDF cover image skipped:", e);
    }
  }
  pdfFooter(doc, watermarkText);

  doc.addPage();
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  pdfFooter(doc, watermarkText);

  let y = 20;
  const textLines = doc.splitTextToSize(item.productContent, 180);
  for (let i = 0; i < textLines.length; i++) {
    if (y > 275) {
      doc.addPage();
      pdfFooter(doc, watermarkText);
      y = 20;
    }
    doc.text(textLines[i], 15, y);
    y += 6;
  }
}

export function exportProductPdf(
  item: ManufactureResult,
  opts: { watermarkText: string; niche: string }
): void {
  const doc = new jsPDF();
  renderProductPdf(doc, item, item.originalNiche || opts.niche || "General", opts.watermarkText);
  doc.save(`${slug(item.productTitle) || "dropkit-product"}.pdf`);
}

export function exportBatchPdf(items: ManufactureResult[], opts: { watermarkText: string }): void {
  const doc = new jsPDF();
  items.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    renderProductPdf(doc, item, item.originalNiche || item.productTitle || "General", opts.watermarkText);
  });
  doc.save("dropkit-batch-archive.pdf");
}

export function exportMetadataCsv(items: ManufactureResult[]): void {
  const headers = ["Title", "Niche", "Price", "Gumroad Blurb"];
  const rows = items.map((item) => [
    `"${item.productTitle.replace(/"/g, '""')}"`,
    `"${item.originalNiche || ""}"`,
    `"${item.priceRecommendationValue}"`,
    `"${item.gumroadBlurb.replace(/"/g, '""')}"`,
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = "dropkit_metadata.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

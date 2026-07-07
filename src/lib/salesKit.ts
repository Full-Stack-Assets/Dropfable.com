// Sales Kit + archive bundle exports. The monetization pipeline's last mile:
// one click turns a generated product into a ready-to-upload seller package
// (product file, listing copy, cover art, launch checklist) instead of leaving
// the user to copy-paste ten fields into Gumroad/Etsy by hand.
// Pure functions over ManufactureResult — no React, guarded by the UI smoke test.
import JSZip from "jszip";
import type { ManufactureResult } from "../types";

function slug(s: string): string {
  return (s || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Full product document: content plus every piece of sales copy, so a single
// file carries everything needed to relist or archive the product.
export function buildProductMarkdown(item: ManufactureResult): string {
  const tags = Array.isArray(item.etsyTags) ? item.etsyTags.join(", ") : "";
  return [
    item.productContent || "",
    "\n\n---\n\n## 📦 Sales Copy & Listing Metadata\n",
    `**Target Audience / Niche:** ${item.originalNiche || "—"}`,
    `\n**Recommended Price:** ${item.priceRecommendationValue || "—"}`,
    `\n### Etsy Title\n${item.etsyTitle || "—"}`,
    `\n### Etsy Tags (${Array.isArray(item.etsyTags) ? item.etsyTags.length : 0})\n${tags}`,
    `\n### Listing Description\n${item.listingDescription || "—"}`,
    `\n### Gumroad Blurb\n${item.gumroadBlurb || "—"}`,
    "\n\n---\n_Manufactured by DropKit Digital Factory_\n",
  ].join("\n");
}

// Copy-paste-ready listing fields, one per labelled block, in the order the
// Gumroad/Etsy forms ask for them.
function buildListingCopy(item: ManufactureResult): string {
  const tags = Array.isArray(item.etsyTags) ? item.etsyTags.join(", ") : "";
  return `LISTING COPY — ${item.productTitle}
Niche: ${item.originalNiche || "—"}

── PRICE ──────────────────────────────
${item.priceRecommendationValue || "—"}

── ETSY TITLE (≤140 chars) ────────────
${item.etsyTitle || "—"}

── ETSY TAGS (13, comma-separated) ────
${tags}

── LISTING DESCRIPTION ────────────────
${item.listingDescription || "—"}

── GUMROAD BLURB ──────────────────────
${item.gumroadBlurb || "—"}

── SOCIAL LAUNCH POST ─────────────────
Just launched: ${item.productTitle}! ${item.gumroadBlurb || ""}
`;
}

function buildLaunchChecklist(item: ManufactureResult): string {
  return `# 🚀 Launch Checklist — ${item.productTitle}

Everything in this kit is ready to upload. Work top to bottom; each step's copy
is in \`listing-copy.txt\`.

## 1. Package the product
- [ ] Open \`product.md\` and export/print it as a polished PDF (or import into
      Canva/Notion for styling). This PDF is your deliverable file.

## 2. List on Gumroad (fastest — ~5 minutes)
- [ ] Go to https://gumroad.com/products/new
- [ ] Name: use the product title
- [ ] Price: use the recommended price
- [ ] Description: paste the Gumroad blurb, then the listing description
- [ ] Upload the product PDF${item.coverImage ? " and `cover.png` as the thumbnail" : ""}
- [ ] Publish, then copy your Gumroad link

## 3. List on Etsy (digital download)
- [ ] Etsy → Shop Manager → Listings → Add a listing (Digital)
- [ ] Title: paste the Etsy title
- [ ] Tags: paste all 13 tags
- [ ] Description: paste the listing description
- [ ] Upload the product PDF${item.coverImage ? " and use `cover.png` for listing images" : ""}
- [ ] Set the price and publish

## 4. Announce
- [ ] Post the social launch line (bottom of \`listing-copy.txt\`) with your link
- [ ] Send the email promo to your list (the app's Growth panel has a template)

## 5. Iterate
- [ ] Check impressions/visits after 48h; test a second cover or title variant
`;
}

// One-click seller package for a single product.
export async function exportSalesKit(item: ManufactureResult): Promise<void> {
  const zip = new JSZip();
  const base = slug(item.productTitle) || "product";
  zip.file("product.md", buildProductMarkdown(item));
  zip.file("listing-copy.txt", buildListingCopy(item));
  zip.file("LAUNCH-CHECKLIST.md", buildLaunchChecklist(item));
  if (item.coverImage && item.coverImage.startsWith("data:")) {
    const comma = item.coverImage.indexOf(",");
    const meta = item.coverImage.slice(5, comma);
    const ext = meta.includes("png") ? "png" : meta.includes("webp") ? "webp" : "jpg";
    zip.file(`cover.${ext}`, item.coverImage.slice(comma + 1), { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, `${base}-sales-kit.zip`);
}

// Whole-archive bundle: one Markdown file per product (plus covers) and an index.
export async function exportArchiveZip(items: ManufactureResult[]): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  const pad = (n: number) => String(n).padStart(2, "0");
  let index = `# DropKit Archive — ${items.length} Products\n\n`;

  items.forEach((item, i) => {
    let base = `${pad(i + 1)}-${slug(item.productTitle) || "product"}`;
    while (used.has(base)) base += "-x";
    used.add(base);
    zip.file(`${base}.md`, buildProductMarkdown(item));
    index += `${i + 1}. [${item.originalNiche || "—"}] ${item.productTitle || "Untitled"} — ${base}.md\n`;
    if (item.coverImage && item.coverImage.startsWith("data:")) {
      const comma = item.coverImage.indexOf(",");
      const meta = item.coverImage.slice(5, comma);
      const ext = meta.includes("png") ? "png" : meta.includes("webp") ? "webp" : "jpg";
      zip.file(`${base}.${ext}`, item.coverImage.slice(comma + 1), { base64: true });
    }
  });

  zip.file("00-INDEX.md", index);
  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, "dropkit_archive_documents.zip");
}

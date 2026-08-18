import JSZip from "jszip";
import type { ManufactureResult } from "../types";
import { ETSY_AI_DISCLOSURE, ETSY_PROMPT_PACK_NOTICE } from "../types";

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

function ensureDisclosure(description: string): string {
  if (!description) return ETSY_AI_DISCLOSURE;
  return description.includes(ETSY_AI_DISCLOSURE) ? description : `${description.trim()}\n\n${ETSY_AI_DISCLOSURE}`;
}

function etsyEligible(item: ManufactureResult): boolean {
  return item.etsyEligible !== false && item.productId !== "prompts";
}

export function buildProductMarkdown(item: ManufactureResult): string {
  const tags = Array.isArray(item.etsyTags) ? item.etsyTags.join(", ") : "";
  const eligible = etsyEligible(item);
  return [
    item.productContent || "",
    "\n\n---\n\n## Sales Copy & Listing Metadata\n",
    `**Target Audience / Niche:** ${item.originalNiche || "—"}`,
    `\n**Recommended Price:** ${item.priceRecommendationValue || "—"}`,
    `\n### Etsy eligibility\n${eligible ? "Eligible with AI disclosure and Designed-by-seller attribution." : ETSY_PROMPT_PACK_NOTICE}`,
    `\n### Etsy Title\n${eligible ? item.etsyTitle || "—" : ETSY_PROMPT_PACK_NOTICE}`,
    `\n### Etsy Tags (${eligible && Array.isArray(item.etsyTags) ? item.etsyTags.length : 0})\n${eligible ? tags : "—"}`,
    `\n### Listing Description\n${eligible ? ensureDisclosure(item.listingDescription || "") : item.listingDescription || "—"}`,
    `\n### Gumroad Blurb\n${item.gumroadBlurb || "—"}`,
    "\n\n---\n_Manufactured by DropKit Digital Factory_\n",
  ].join("\n");
}

function buildListingCopy(item: ManufactureResult): string {
  const eligible = etsyEligible(item);
  const tags = Array.isArray(item.etsyTags) ? item.etsyTags.join(", ") : "";
  const description = eligible ? ensureDisclosure(item.listingDescription || "") : item.listingDescription || "—";
  return `LISTING COPY — ${item.productTitle}
Niche: ${item.originalNiche || "—"}

── PRICE ──────────────────────────────
${item.priceRecommendationValue || "—"}

── ETSY ───────────────────────────────
${eligible ? `Eligible: yes
Production: Designed by the seller (not handmade)
Title (≤140 chars):
${item.etsyTitle || "—"}

Tags (13, comma-separated):
${tags}

Description (includes required AI disclosure):
${description}` : ETSY_PROMPT_PACK_NOTICE}

── GUMROAD BLURB ──────────────────────
${item.gumroadBlurb || "—"}

── SOCIAL LAUNCH POST ─────────────────
Just launched: ${item.productTitle}! ${item.gumroadBlurb || ""}
`;
}

function buildLaunchChecklist(item: ManufactureResult): string {
  const eligible = etsyEligible(item);
  return `# Launch Checklist — ${item.productTitle}

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
- [ ] Upload the product PDF${item.coverImage ? " and \`cover.png\` as the thumbnail" : ""}
- [ ] Publish, then copy your Gumroad link

## 3. List on Etsy (digital download)
${eligible ? `- [ ] Etsy → Shop Manager → Listings → Add a listing (Digital)
- [ ] Title: paste the Etsy title
- [ ] Tags: paste all 13 tags
- [ ] Description: paste the listing description (keep the AI disclosure paragraph)
- [ ] Production: set attribution to **Designed by the seller**, not handmade
- [ ] Upload the product PDF${item.coverImage ? " and use \`cover.png\` for listing images" : ""}
- [ ] Set the price and publish` : `- [ ] Skip Etsy. ${ETSY_PROMPT_PACK_NOTICE}`}

## 4. Announce
- [ ] Post the social launch line (bottom of \`listing-copy.txt\`) with your link

## 5. Iterate
- [ ] Check impressions/visits after 48h; test a second cover or title variant
- [ ] In Dropfable Archive, mark "I listed this" and note any sale
`;
}

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

export async function exportArchiveZip(items: ManufactureResult[]): Promise<void> {
  const zip = new JSZip();
  const used = new Set<string>();
  const pad = (n: number) => String(n).toString().padStart(2, "0");
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

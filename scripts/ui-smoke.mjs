import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";

const DIST = path.resolve("dist");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(DIST, urlPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, "index.html");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

const FAKE_ARCHIVE = [
  {
    productTitle: "UI Smoke Test Product",
    productContent: "# Heading\n\nSome **markdown** body content for the export smoke test.",
    etsyTitle: "UI Smoke Etsy Title",
    priceRecommendationValue: "$19",
    listingDescription: "Listing description for the smoke test.",
    etsyTags: ["alpha", "beta", "gamma"],
    gumroadBlurb: "A punchy blurb.",
    originalNiche: "Smoke Test Niche",
    productId: "guide",
    etsyEligible: true,
  },
];

async function expectDownload(page, clickName) {
  const button = page.getByRole("button", { name: clickName }).first();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    button.click(),
  ]);
  const file = await download.path();
  if (!file || !fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`download for "${clickName}" produced no file`);
  }
  return download.suggestedFilename();
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("dist/index.html not found — run `npx vite build` first");
  }
  const server = await startStaticServer();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  let failed = 0;
  try {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => {
      console.log("FAIL pageerror:", e.message);
      failed++;
    });
    await page.addInitScript((items) => {
      const json = JSON.stringify(items);
      localStorage.setItem("dropkit_archive", json);
    }, FAKE_ARCHIVE);

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    await page.getByText(/Archive \(/).first().click();
    await page.getByText("UI Smoke Test Product").first().waitFor({ timeout: 10000 });

    for (const [label, name] of [
      ["TXT", /TXT/i],
      ["HTML", /HTML/i],
      ["PDF", /Download PDF/i],
      ["SalesKit", /Sales Kit/i],
      ["ArchiveZip", /Download All/i],
    ]) {
      try {
        const fn = await expectDownload(page, name);
        console.log(`PASS export ${label} -> ${fn}`);
      } catch (e) {
        console.log(`FAIL export ${label} -> ${e.message}`);
        failed++;
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) {
    console.error(`\n${failed} UI smoke check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll UI smoke checks passed.");
}

main().catch((err) => {
  console.error("UI smoke crashed:", err);
  process.exit(1);
});

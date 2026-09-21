import "dotenv/config";
import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";
import { GoogleGenAI, Type } from "@google/genai";
import { BILLING_ENABLED, meter } from "./billing";
import { registerBillingWebhook, registerBillingRoutes, requireQuota } from "./billing-routes";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const AUTONOMOUS_ENABLED = process.env.AUTONOMOUS_ENABLED === "true";
const AUTONOMOUS_GIT_PUSH = process.env.AUTONOMOUS_GIT_PUSH === "true";
const ETSY_AI_DISCLOSURE =
  "This product was created with AI assistance under the creative direction of the seller. On Etsy, list it as Designed by the seller (not handmade) and keep this disclosure in the description.";
const ETSY_PROMPT_PACK_NOTICE =
  "Not for Etsy — Etsy prohibits selling AI prompt bundles. List this pack on Gumroad or another creator storefront only.";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "https://dropfable.com,https://www.dropfable.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-DropKit-Quota-Remaining, X-DropKit-Quota-Limit");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

registerBillingWebhook(app);
app.use(express.json({ limit: "15mb" }));
registerBillingRoutes(app);

// Initialize the GoogleGenAI client on the server
// API key is fetched from process.env.GEMINI_API_KEY, which is supplied by AI Studio
const geminiApiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// ── LLM provider abstraction ─────────────────────────────────────────────
// LLM_PROVIDER=nvidia | gemini | openai. When unset (or "gemini") the original
// behavior is preserved: gemini-first with an OpenAI fallback. "nvidia" routes
// manufacture, format detection, and tag suggestions through NVIDIA's
// OpenAI-compatible endpoint — no Gemini key required in that mode.
type LlmProvider = "nvidia" | "gemini" | "openai";
const LLM_PROVIDER: LlmProvider = (() => {
  const v = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  return v === "nvidia" || v === "openai" ? v : "gemini";
})();
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "moonshotai/kimi-k3";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Gemini model IDs verified live 2026-09-20 against published API model lists:
// gemini-3.5-flash, gemini-3.1-flash-lite, gemini-3.1-pro-preview are live;
// gemini-3.6-flash and gemini-3.5-flash-lite are the current stable GA tier.
// gemini-2.0-* and gemini-1.5-* were shut down (404) and are removed so
// requests never burn through a doomed retry chain.
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

interface LlmCallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

// Generic OpenAI-compatible JSON chat call (used for NVIDIA + OpenAI).
async function openAiCompatibleJson(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
  system: string;
  user: string;
  call?: LlmCallOptions;
}): Promise<any> {
  const resp = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${opts.system} Respond with JSON only.` },
        { role: "user", content: opts.user },
      ],
    }),
    signal: opts.call?.signal ?? AbortSignal.timeout(opts.call?.timeoutMs ?? 300000),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`${opts.label} HTTP ${resp.status}${txt ? `: ${txt.slice(0, 300)}` : ""}`);
  }
  const data: any = await resp.json();
  const content = (data?.choices?.[0]?.message?.content || "").trim();
  if (!content) throw new Error(`${opts.label} returned an empty response.`);
  const jsonStr = content.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(`${opts.label} returned non-JSON output.`);
  }
}

const specMap: Record<string, string> = {
  planner: "a premium 30-day planner/workbook: featuring an engaging intro page, a clear 'how-to-use' layout, 30 beautifully detailed daily pages (each with an inspiring daily theme, 2-3 specific reflective prompts or input fields, and a daily actionable microscopic step), a recurring weekly review section (every 7 days, so total of 4 reviews), and a final comprehensive reflection page. Do not hold back, provide the complete content for each of the 30 days.",
  prompts: "a pack of 50 extremely high-value, ready-to-use AI prompts sorted into 5 sensible categories of 10 prompts each. Each prompt includes a distinct bold title, the complete, ready-to-copy-paste prompt with placeholder [VARIABLES] in brackets, and a brief 1-line usage tip ('Use this when...'). Also provide a 1-paragraph quick-start overview at the beginning.",
  templates: "a system of 25 fill-in-the-blank communication templates (emails, outreach scripts, captions, or follow-up messages depending on what fits this niche best) across 5 thematic categories. Each template must feature a clear header/title, the core copy-paste template text with clear [BLANK] blocks to fill, and a stellar usage tip.",
  guide: "a complete deep-dive mini-guide (~2,000-3,000 words): full title page details, an introduction, 6-8 comprehensive chapters filled with extremely actionable specifics, real-world numbers, checklists, examples, and a strong conclusion with defined next steps. Write the FULL text, not an outline.",
  checklist: "an actionable set of 10 related checklists suitable for this niche. Provide a master table or index of 'which checklist to use when', followed by the 10 checklists. Each checklist must have a descriptive title, context of when to use it, and 8-15 ordered, highly detailed actionable bullet points/checkbox tasks.",
  swipe: "a premium swipe file comprising 75 ready-to-use subject lines, titles, hook formulas, or captions (customized for the niche) across 5 themed categories of 15 items. Each category includes a brief intro note explaining why and when these mental hooks work best."
};

const labelsMap: Record<string, string> = {
  planner: "Planner / Workbook",
  prompts: "AI Prompt Pack",
  templates: "Template Pack",
  guide: "Mini-Guide / Book",
  checklist: "Checklist System",
  swipe: "Swipe File"
};

// Model health tracking to dynamically deprioritize overloaded/503/429 models temporarily
const modelCooldowns: Record<string, number> = {};

function getOrderedModels(preferredModels: string[]): string[] {
  const now = Date.now();
  const healthy = preferredModels.filter(m => !modelCooldowns[m] || modelCooldowns[m] < now);
  const coolingDown = preferredModels.filter(m => modelCooldowns[m] && modelCooldowns[m] >= now);
  return [...healthy, ...coolingDown];
}

function markModelFailure(modelName: string, minutes = 5) {
  modelCooldowns[modelName] = Date.now() + minutes * 60 * 1000;
  console.log(`[ModelTracker] Demoting ${modelName} for ${minutes} minutes due to a transient/overload occurrence.`);
}

const RL_WINDOW_MS = 60_000;
const RL_MAX = Number(process.env.RATE_LIMIT_PER_MIN || 20);
const rlHits = new Map<string, number[]>();
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const hits = (rlHits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (hits.length >= RL_MAX) {
    return res.status(429).json({ error: "Too many requests — please wait a minute and try again." });
  }
  hits.push(now);
  rlHits.set(ip, hits);
  if (rlHits.size > 1000) {
    for (const [key, times] of rlHits) {
      if (times.every((t) => now - t >= RL_WINDOW_MS)) rlHits.delete(key);
    }
  }
  next();
}

const DATA_DIR = process.env.VERCEL ? os.tmpdir() : process.cwd();
const ARCHIVE_FILE = path.join(DATA_DIR, "archive_store.json");

function loadArchive(): any[] {
  try {
    if (fs.existsSync(ARCHIVE_FILE)) {
      const data = fs.readFileSync(ARCHIVE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to read archive_store.json", err);
  }
  return [];
}

function saveArchive(items: any[]) {
  try {
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write archive_store.json", err);
  }
}

// Git configuration & initialization helper
function configureGit() {
  try {
    try {
      execSync("git config --global user.email 'autonomous-builder@dropkit.ai'");
      execSync("git config --global user.name 'DropKit Autonomous Builder'");
    } catch (_) {}
    
    if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
      console.log("[Git] Initializing local Git repository...");
      execSync("git init", { stdio: "inherit" });
    }
  } catch (err: any) {
    console.warn("[Git] Git setup/config skipped:", err.message);
  }
}

// Push to GitHub helper
function pushToGitHub(niche: string) {
  if (!AUTONOMOUS_GIT_PUSH) {
    console.log("[Git] Push skipped (AUTONOMOUS_GIT_PUSH is not true).");
    return;
  }
  try {
    console.log("[Git] Committing and pushing autonomous batch for niche:", niche);
    const filesToAdd = ["products/", "archive_store.json", "queue_store.json"].filter(f => fs.existsSync(f));
    if (filesToAdd.length > 0) {
      execSync(`git add ${filesToAdd.join(" ")}`, { stdio: "inherit" });
    }
    try {
      execSync(`git commit -m "Autonomous hourly product update: ${niche}"`, { stdio: "inherit" });
    } catch (commitErr: any) {
      console.log("[Git] Nothing to commit or commit failed:", commitErr.message);
    }
    
    const remoteOutput = execSync("git remote").toString().trim();
    if (remoteOutput) {
      execSync("git push origin main || git push origin master", { stdio: "inherit" });
      console.log("[Git] Successfully pushed autonomous batch to GitHub remote!");
    } else {
      console.log("[Git] No remote configured. Changes committed locally.");
    }
  } catch (err: any) {
    console.warn("[Git] Push to GitHub skipped or failed (expected if unauthorized or no remote):", err.message);
  }
}

// Autonomous scheduled state
const autonomousState = {
  isRunning: false,
  lastRunTime: null as string | null,
  nextRunTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  currentNiche: null as string | null,
  currentProductIndex: 0,
  totalProducts: 6,
  status: "idle" as "idle" | "brainstorming" | "generating" | "git-pushing" | "completed" | "failed",
  error: null as string | null,
  history: [] as Array<{ niche: string; timestamp: string; status: "success" | "failed"; error?: string }>
};

// Autonomous scheduled workflow
async function runAutonomousWorkflow() {
  if (!AUTONOMOUS_ENABLED) {
    console.log("[Autonomous] Disabled (set AUTONOMOUS_ENABLED=true to enable).");
    autonomousState.status = "idle";
    autonomousState.error = "Autonomous generation is disabled.";
    return;
  }
  if (autonomousState.isRunning) {
    console.log("[Autonomous] Workflow already running, skipping.");
    return;
  }
  
  if (!geminiApiKey) {
    console.log("[Autonomous] Skipping workflow execution because GEMINI_API_KEY is not defined in Settings > Secrets.");
    autonomousState.status = "failed";
    autonomousState.error = "GEMINI_API_KEY is not defined. Please verify your Secrets in Settings > Secrets.";
    return;
  }
  
  autonomousState.isRunning = true;
  autonomousState.status = "brainstorming";
  autonomousState.error = null;
  console.log("[Autonomous] Starting scheduled hourly workflow...");
  
  let chosenNiche = "";
  try {
    configureGit();
    
    // Step 1: Brainstorm niche via Gemini
    console.log("[Autonomous] Brainstorming fresh niche via Gemini with robust fallback...");
    const baseBrainstormModels = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash-8b"
    ];
    const brainstormModels = getOrderedModels(baseBrainstormModels);

    for (const bModel of brainstormModels) {
      try {
        console.log(`[Autonomous] Attempting niche brainstorm with ${bModel}...`);
        const response = await ai.models.generateContent({
          model: bModel,
          contents: "Generate a highly specific, modern, trending digital product niche or target audience that has strong monetization potential right now. Return a JSON object with a single field 'niche' containing a short 3-5 word name for this target audience (e.g. 'Vegan Meal Prep Beginners', 'First-time Chicken Owners', 'ADHD College Students', 'No-code App Builders', 'Local Bakery Owners'). Do not return any other text, formatting, or placeholders.",
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                niche: { type: Type.STRING }
              },
              required: ["niche"]
            }
          }
        });
        const data = JSON.parse(response.text || "{}");
        if (data.niche) {
          chosenNiche = data.niche;
          console.log(`[Autonomous] Successfully brainstormed niche "${chosenNiche}" using ${bModel}`);
          break;
        }
      } catch (err: any) {
        console.log(`[Autonomous] Brainstorming with ${bModel} was unresponsive/skipped:`, err.message || err);
        const errorMessage = err.message || "";
        const isTransient = errorMessage.includes("503") || 
                            err.status === 503 || 
                            errorMessage.includes("429") ||
                            errorMessage.includes("UNAVAILABLE") ||
                            errorMessage.includes("high demand") ||
                            errorMessage.includes("overloaded");
        if (isTransient) {
          markModelFailure(bModel, 5);
        }
      }
    }
    
    if (!chosenNiche) {
      const presets = [
        "SaaS Customer Success Managers",
        "Home Mushroom Cultivators",
        "First-time Chicken Owners",
        "Shopify Dropshippers using AI",
        "B2B Freelance Copywriters",
        "Indoor Plant Parents in Small Apartments"
      ];
      chosenNiche = presets[Math.floor(Math.random() * presets.length)];
    }
    
    autonomousState.currentNiche = chosenNiche;
    autonomousState.status = "generating";
    console.log(`[Autonomous] Niche chosen: "${chosenNiche}". Beginning synthesis of all 6 products...`);
    
    const productsToGenerate = ["planner", "prompts", "templates", "guide", "checklist", "swipe"];
    autonomousState.totalProducts = productsToGenerate.length;
    
    const generatedProducts: any[] = [];
    
    for (let i = 0; i < productsToGenerate.length; i++) {
      const productId = productsToGenerate[i];
      autonomousState.currentProductIndex = i + 1;
      console.log(`[Autonomous] Generating product ${i + 1}/${productsToGenerate.length}: ${productId} for ${chosenNiche}`);
      
      try {
        const result = await manufactureProduct(productId, chosenNiche, undefined, "English");
        result.originalNiche = chosenNiche;
        generatedProducts.push({ productId, result });
        
        // Save to archive_store.json
        const archive = loadArchive();
        if (!archive.some(a => a.productTitle === result.productTitle)) {
          archive.push(result);
          saveArchive(archive);
        }
        
        // Save as local files
        const safeNiche = chosenNiche.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dirPath = path.join(process.cwd(), "products", safeNiche);
        fs.mkdirSync(dirPath, { recursive: true });
        
        const txtContent = `========================================================================
Product Title: ${result.productTitle}
Niche: ${chosenNiche}
Product Type: ${labelsMap[productId]}
Price Recommendation: ${result.priceRecommendationValue}
========================================================================

PRODUCT CONTENT:
------------------------------------------------------------------------
${result.productContent}

------------------------------------------------------------------------
SALES LISTINGS:
------------------------------------------------------------------------
Etsy Title:
${result.etsyTitle}

Etsy Tags:
${(result.etsyTags || []).join(", ")}

Etsy Description:
${result.listingDescription}

Gumroad Blurb:
${result.gumroadBlurb}
`;
        fs.writeFileSync(path.join(dirPath, `${productId}.txt`), txtContent, "utf-8");
        fs.writeFileSync(path.join(dirPath, `${productId}.json`), JSON.stringify(result, null, 2), "utf-8");
        
      } catch (productErr: any) {
        console.error(`[Autonomous] Failed to generate ${productId} for ${chosenNiche}:`, productErr.message);
      }
    }
    
    if (generatedProducts.length > 0) {
      autonomousState.status = "git-pushing";
      pushToGitHub(chosenNiche);
      
      autonomousState.status = "completed";
      autonomousState.lastRunTime = new Date().toISOString();
      autonomousState.history.unshift({
        niche: chosenNiche,
        timestamp: new Date().toISOString(),
        status: "success"
      });
    } else {
      throw new Error("Zero products successfully synthesized.");
    }
    
  } catch (err: any) {
    console.error("[Autonomous] Workflow failure:", err);
    autonomousState.status = "failed";
    autonomousState.error = err.message || "Unknown background workflow failure";
    autonomousState.history.unshift({
      niche: chosenNiche || "Unknown",
      timestamp: new Date().toISOString(),
      status: "failed",
      error: err.message
    });
  } finally {
    autonomousState.isRunning = false;
    autonomousState.nextRunTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    if (autonomousState.history.length > 10) {
      autonomousState.history = autonomousState.history.slice(0, 10);
    }
  }
}

if (AUTONOMOUS_ENABLED && !process.env.VERCEL) {
  setInterval(runAutonomousWorkflow, 60 * 60 * 1000);
  setTimeout(() => {
    runAutonomousWorkflow().catch(err => console.error("[Autonomous] Startup autonomous execution failed:", err));
  }, 15000);
}

interface Task {
  id: string;
  productId: string;
  productName: string;
  niche: string;
  angle?: string;
  language: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const DB_FILE = path.join(DATA_DIR, "queue_store.json");

function loadQueue(): Task[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to read queue_store.json", err);
  }
  return [];
}

function saveQueue(tasks: Task[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write queue_store.json", err);
  }
}

// In-memory queue initialized from disk
let taskQueue: Task[] = loadQueue();

// Core content generation utility shared by synchronous manufacture and the background queue
async function manufactureProduct(productId: string, niche: string, angle?: string, language?: string, opts?: LlmCallOptions) {
  if (!productId || !specMap[productId]) {
    throw new Error("Invalid product ID selected.");
  }

  if (!niche || niche.trim() === "") {
    throw new Error("Niche/Audience is required.");
  }

  const spec = specMap[productId];
  const productName = labelsMap[productId];
  const openaiKey = OPENAI_API_KEY;

  if (LLM_PROVIDER === "nvidia" && !NVIDIA_API_KEY) {
    throw new Error("LLM_PROVIDER=nvidia requires NVIDIA_API_KEY to be set.");
  }
  if (LLM_PROVIDER === "openai" && !openaiKey) {
    throw new Error("LLM_PROVIDER=openai requires OPENAI_API_KEY to be set.");
  }
  if (LLM_PROVIDER === "gemini" && !geminiApiKey && !openaiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please verify your Secrets in Settings > Secrets.");
  }

  const etsyEligible = productId !== "prompts";
  const systemInstruction =
    "You are a master digital product engineer and elite copywriter. " +
    "Your goal is to generate exceptionally detailed, highly professional, completely filled digital products " +
    "and the exact optimized sales copy of the product to sell on platforms like Gumroad and Etsy." +
    "\n\nCRITICAL SPEC: Generate absolute FULL content, not summary outlines or instructions on what to write. " +
    "If the specification asks for 30 daily pages or 50 prompts, write out detailed content for them. " +
    "Keep the tone encouraging, high-value, premium, and actionable. " +
    `Always append this exact disclosure to listingDescription: "${ETSY_AI_DISCLOSURE}" ` +
    (etsyEligible
      ? "This product may be listed on Etsy with Designed-by-seller attribution."
      : `Do not produce an Etsy listing for prompt bundles. Set etsyTitle to "${ETSY_PROMPT_PACK_NOTICE}" and etsyTags to an empty array.`);

  const promptText = `Please manufacture a premium quality digital product of type: "${productName}".
Specification of the product: ${spec}
Niche/Audience: ${niche}
${angle ? `Specific angle / flavor requested: ${angle}` : ""}
${language && language !== 'English' ? `CRITICAL: You MUST translate and output ALL generated content, including the product content, titles, and sales copy, exactly into the following language: ${language}` : ""}
Etsy eligible: ${etsyEligible ? "yes" : "no — Gumroad only"}

Please output the generated product content and its sales listings in the requested JSON structure. No placeholders. Ensure high completeness.`;

  function finalizeResult(parsed: any) {
    const listingDescription = String(parsed.listingDescription || "");
    const withDisclosure = listingDescription.includes(ETSY_AI_DISCLOSURE)
      ? listingDescription
      : `${listingDescription.trim()}\n\n${ETSY_AI_DISCLOSURE}`;
    return {
      ...parsed,
      productId,
      etsyEligible,
      listingDescription: etsyEligible ? withDisclosure : listingDescription,
      etsyTitle: etsyEligible ? parsed.etsyTitle : ETSY_PROMPT_PACK_NOTICE,
      etsyTags: etsyEligible ? parsed.etsyTags || [] : [],
    };
  }

  // Gemini model IDs verified live 2026-09-20 (see GEMINI_MODELS): the three
  // named IDs are live and gemini-3.6-flash / gemini-3.5-flash-lite are the
  // current stable GA tier. Shut-down 2.0/1.5 IDs are removed so requests
  // never burn through a doomed retry chain.
  const modelsToTry = getOrderedModels(GEMINI_MODELS);
  let lastError: any = null;

  // NVIDIA primary path — no Gemini key required in this mode.
  if (LLM_PROVIDER === "nvidia") {
    try {
      console.log(`[Generator] Requesting content generation from NVIDIA (${NVIDIA_MODEL})...`);
      const parsed = await openAiCompatibleJson({
        baseUrl: NVIDIA_BASE_URL,
        apiKey: NVIDIA_API_KEY as string,
        model: NVIDIA_MODEL,
        label: `NVIDIA ${NVIDIA_MODEL}`,
        system: systemInstruction,
        user:
          promptText +
          "\n\nReturn JSON with keys: productTitle, productContent, etsyTitle, priceRecommendationValue, listingDescription, etsyTags (array of strings), gumroadBlurb.",
        call: opts,
      });
      return finalizeResult(parsed);
    } catch (err: any) {
      lastError = err;
      console.warn("[Generator] NVIDIA generation failed:", err.message);
    }
  }

  for (const modelName of modelsToTry) {
    if (LLM_PROVIDER !== "gemini") break; // gemini chain only runs in gemini mode
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`[Generator] Requesting content generation from ${modelName} (attempt ${retryCount + 1}/${maxRetries})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            abortSignal: opts?.signal,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                productTitle: {
                  type: Type.STRING,
                  description: "A highly click-worthy, premium title for the digital product designed for this niche."
                },
                productContent: {
                  type: Type.STRING,
                  description: "The complete, detailed, ready-to-sell content. Section headers, copy-paste components, exercises, full text. Absolutely complete."
                },
                etsyTitle: {
                  type: Type.STRING,
                  description: "Etsy listing title (under 140 chars, front-loaded with search terms like '30 Day Planner for [Niche]', '50 AI Prompts...')."
                },
                priceRecommendationValue: {
                  type: Type.STRING,
                  description: "Recommended price (e.g., '$19') with 1-sentence reasoning based on pricing power in this niche."
                },
                listingDescription: {
                  type: Type.STRING,
                  description: "Etsy description containing: an interactive hook line, a scannable bullet points list of 'What is inside', 'Who is this for', and a note on 'How to download'."
                },
                etsyTags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactly 13 comma-separated search tags (each under 20 characters length)."
                },
                gumroadBlurb: {
                  type: Type.STRING,
                  description: "A highly persuasive, punchy 2-sentence marketing block for the Gumroad page."
                }
              },
              required: [
                "productTitle",
                "productContent",
                "etsyTitle",
                "priceRecommendationValue",
                "listingDescription",
                "etsyTags",
                "gumroadBlurb"
              ]
            }
          }
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error("Empty response received from Gemini model.");
        }

        return finalizeResult(JSON.parse(responseText));

      } catch (error: any) {
        lastError = error;
        const errorMessage = error.message || "";
        
        const isTransient = errorMessage.includes("503") || 
                            error.status === 503 || 
                            errorMessage.includes("429") ||
                            errorMessage.includes("UNAVAILABLE") ||
                            errorMessage.includes("high demand") ||
                            errorMessage.includes("overloaded");
        
        if (isTransient) {
          // Immediately demote the overloaded model to prevent trying it for the rest of this batch
          markModelFailure(modelName, 5);
          console.log(`[Generator] Dynamic shift from ${modelName} due to transient overload. Switching to next model...`, errorMessage);
          break; // break retry loop immediately to try the next healthy model
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000);
            console.log(`[Generator] Non-transient note on ${modelName} (attempt ${retryCount}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, errorMessage);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        console.log(`[Generator] Model ${modelName} was bypassed. Note:`, errorMessage);
        break; // break retry loop to try the next model
      }
    }
  }

  // OpenAI: primary when LLM_PROVIDER=openai, fallback for gemini/nvidia modes.
  if (openaiKey) {
    try {
      console.log(
        LLM_PROVIDER === "openai"
          ? "[Generator] Requesting content generation from OpenAI..."
          : "[Generator] Falling back to OpenAI..."
      );
      const parsed = await openAiCompatibleJson({
        baseUrl: "https://api.openai.com/v1",
        apiKey: openaiKey,
        model: OPENAI_MODEL,
        label: `OpenAI ${OPENAI_MODEL}`,
        system: systemInstruction,
        user:
          promptText +
          "\n\nReturn JSON with keys: productTitle, productContent, etsyTitle, priceRecommendationValue, listingDescription, etsyTags (array of strings), gumroadBlurb.",
        call: opts,
      });
      return finalizeResult(parsed);
    } catch (err: any) {
      lastError = err;
      console.warn("[Generator] OpenAI generation failed:", err.message);
    }
  }

  const errorMessage = lastError?.message || "";
  const quotaMsg =
    LLM_PROVIDER === "nvidia"
      ? "NVIDIA API rate limit or quota exceeded. Check your NVIDIA API key usage and try again shortly."
      : LLM_PROVIDER === "openai"
        ? "OpenAI API rate limit or quota exceeded. Check your OpenAI plan and billing."
        : "You have exceeded your Gemini API quota. Please check your Google AI Studio plan and billing details.";
  const authMsg =
    LLM_PROVIDER === "nvidia"
      ? "The provided NVIDIA_API_KEY is invalid or disabled."
      : LLM_PROVIDER === "openai"
        ? "The provided OPENAI_API_KEY is invalid or disabled."
        : "The provided GEMINI_API_KEY is invalid or disabled. Please verify your Secrets in Settings > Secrets.";
  if (errorMessage.includes("quota") || lastError?.status === 429 || errorMessage.includes("429")) {
    throw new Error(quotaMsg);
  }
  if (errorMessage.includes("UNAUTHENTICATED") || errorMessage.includes("ACCOUNT_STATE_INVALID") || lastError?.status === 401 || errorMessage.includes("401")) {
    throw new Error(authMsg);
  }

  throw lastError ?? new Error("All configured LLM providers failed to generate content.");
}

let isProcessing = false;

// Sequential background task runner
async function processQueueRunner() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const nextTaskIndex = taskQueue.findIndex(t => t.status === "pending");
      if (nextTaskIndex === -1) {
        break; // No more pending tasks
      }

      const task = taskQueue[nextTaskIndex];
      task.status = "processing";
      task.startedAt = new Date().toISOString();
      saveQueue(taskQueue);

      console.log(`[Queue] Starting task ${task.id} (Product: ${task.productId}, Niche: ${task.niche})`);

      try {
        const result = await manufactureProduct(task.productId, task.niche, task.angle, task.language);
        task.status = "completed";
        task.result = result;
        task.completedAt = new Date().toISOString();
        console.log(`[Queue] Task ${task.id} completed successfully!`);
      } catch (err: any) {
        console.error(`[Queue] Task ${task.id} failed:`, err);
        task.status = "failed";
        task.error = err.message || "An unexpected error occurred during background synthesis.";
        task.completedAt = new Date().toISOString();
      }

      saveQueue(taskQueue);
    }
  } catch (err) {
    console.error("[Queue] Critical queue runner failure:", err);
  } finally {
    isProcessing = false;
  }
}

app.get("/api/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "dropkit",
    llmProvider: LLM_PROVIDER,
    llmModel: LLM_PROVIDER === "nvidia" ? NVIDIA_MODEL : LLM_PROVIDER === "openai" ? OPENAI_MODEL : "gemini-chain",
    hasGeminiKey: Boolean(geminiApiKey),
    hasNvidiaKey: Boolean(NVIDIA_API_KEY),
    hasOpenAiKey: Boolean(OPENAI_API_KEY),
    hasGumroadToken: Boolean(process.env.GUMROAD_ACCESS_TOKEN),
    billingEnabled: BILLING_ENABLED,
    autonomousEnabled: AUTONOMOUS_ENABLED,
  });
});

// 1. Instant/Synchronous Manufacture Endpoint
app.post("/api/manufacture", rateLimit, requireQuota(), async (req, res) => {
  try {
    const { productId, niche, angle, language } = req.body;
    const data = await manufactureProduct(productId, niche, angle, language);
    return res.json(data);
  } catch (error: any) {
    console.error("Manufacturing Jammed Error:", error);
    return res.status(500).json({ 
      error: error.message || "The manufacturing factory engine suffered a temporary jam. Please click 'Drop it' again!" 
    });
  }
});

// 1b. Manufacture ALL formats for a niche as a background job with per-format
// progress + cancel. NOTE: jobs live in process memory only. On Render's free
// tier the disk is ephemeral and dynos sleep — a restart or redeploy wipes
// in-flight and finished jobs, so clients must treat a 404 on a jobId as
// "job lost (server restarted)" and poll promptly.
type AllFormatStatus = "pending" | "working" | "done" | "error";
interface AllFormatState {
  productId: string;
  name: string;
  status: AllFormatStatus;
  error?: string;
  result?: any;
}
interface ManufactureAllJob {
  id: string;
  niche: string;
  angle?: string;
  language?: string;
  status: "running" | "completed" | "cancelled";
  formats: AllFormatState[];
  createdAt: string;
  completedAt?: string;
  cancelled: boolean;
  abort: AbortController | null;
}

const MANUFACTURE_ALL_IDS = ["planner", "prompts", "templates", "guide", "checklist", "swipe"];
const manufactureAllJobs = new Map<string, ManufactureAllJob>();

function pruneManufactureAllJobs() {
  if (manufactureAllJobs.size <= 50) return;
  const entries = [...manufactureAllJobs.entries()].sort((a, b) =>
    a[1].createdAt.localeCompare(b[1].createdAt)
  );
  for (const [id, job] of entries) {
    if (manufactureAllJobs.size <= 50) break;
    if (job.status !== "running") manufactureAllJobs.delete(id);
  }
}

function publicAllJob(job: ManufactureAllJob) {
  return {
    jobId: job.id,
    status: job.status,
    niche: job.niche,
    progress: {
      done: job.formats.filter((f) => f.status === "done" || f.status === "error").length,
      total: job.formats.length,
    },
    formats: job.formats.map((f) => ({
      productId: f.productId,
      name: f.name,
      status: f.status,
      error: f.error,
    })),
    results: job.formats
      .filter((f) => f.status === "done" && f.result)
      .map((f) => ({ ...f.result, productId: f.productId, originalNiche: job.niche })),
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

async function runManufactureAllJob(job: ManufactureAllJob) {
  for (const f of job.formats) {
    if (job.cancelled) break;
    f.status = "working";
    const controller = new AbortController();
    job.abort = controller;
    const timeout = setTimeout(() => controller.abort(), 6 * 60 * 1000); // per-format ceiling
    try {
      console.log(`[manufacture-all] job ${job.id}: generating ${f.productId}...`);
      const data = await manufactureProduct(f.productId, job.niche, job.angle, job.language, {
        signal: controller.signal,
      });
      if (job.cancelled) {
        f.status = "pending";
        break;
      }
      f.result = data;
      f.status = "done";
      console.log(`[manufacture-all] job ${job.id}: ${f.productId} done.`);
    } catch (err: any) {
      if (job.cancelled || controller.signal.aborted) {
        f.status = "pending";
        break;
      }
      console.warn(`[manufacture-all] job ${job.id}: ${f.productId} failed:`, err.message || err);
      f.status = "error";
      f.error = err.message || `Failed to generate ${f.productId}.`;
    } finally {
      clearTimeout(timeout);
      if (job.abort === controller) job.abort = null;
    }
  }
  job.status = job.cancelled ? "cancelled" : "completed";
  job.completedAt = new Date().toISOString();
}

function apiKeyFromReq(req: express.Request): string | undefined {
  const header = req.headers["x-api-key"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return (fromHeader || (req.body as any)?.apiKey || (req.query as any)?.key) as string | undefined;
}

// Quota gate that consumes N units (one per generated format). No-op unless billing is on.
async function consumeQuotaUnits(
  req: express.Request,
  res: express.Response,
  units: number
): Promise<boolean> {
  if (!BILLING_ENABLED) return true;
  const key = apiKeyFromReq(req);
  for (let i = 0; i < units; i++) {
    const result = await meter(key);
    if (!result.ok) {
      const code = result.reason === "invalid_key" ? 401 : 402;
      const error =
        result.reason === "invalid_key"
          ? "Missing or invalid API key. Create a free key on the Pricing page and send it as the x-api-key header."
          : "Monthly quota reached. Upgrade your plan on the Pricing page to keep generating.";
      res.status(code).json({ error, reason: result.reason, limit: result.limit, plan: result.plan });
      return false;
    }
    if (typeof result.remaining === "number") {
      res.setHeader("X-DropKit-Quota-Remaining", String(result.remaining));
      res.setHeader("X-DropKit-Quota-Limit", String(result.limit ?? ""));
    }
  }
  return true;
}

app.post("/api/manufacture-all", rateLimit, async (req, res) => {
  const { niche, angle, language } = req.body;
  if (!niche || !String(niche).trim()) {
    return res.status(400).json({ error: "Niche/Audience is required." });
  }
  // All-format runs generate 6 products: consume 6 quota units, not 1.
  if (!(await consumeQuotaUnits(req, res, MANUFACTURE_ALL_IDS.length))) return;

  const job: ManufactureAllJob = {
    id: "all_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now(),
    niche: String(niche).trim(),
    angle: typeof angle === "string" && angle.trim() ? angle.trim() : undefined,
    language: language || "English",
    status: "running",
    formats: MANUFACTURE_ALL_IDS.map((pid) => ({
      productId: pid,
      name: labelsMap[pid],
      status: "pending" as AllFormatStatus,
    })),
    createdAt: new Date().toISOString(),
    cancelled: false,
    abort: null,
  };
  manufactureAllJobs.set(job.id, job);
  pruneManufactureAllJobs();
  runManufactureAllJob(job).catch((err) =>
    console.error(`[manufacture-all] job ${job.id} runner failed:`, err)
  );
  return res.status(202).json(publicAllJob(job));
});

app.get("/api/manufacture-all/:jobId", (req, res) => {
  const job = manufactureAllJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found — it may have been lost to a server restart." });
  }
  return res.json(publicAllJob(job));
});

app.delete("/api/manufacture-all/:jobId", (req, res) => {
  const job = manufactureAllJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }
  job.cancelled = true;
  try {
    job.abort?.abort();
  } catch {
    /* ignore */
  }
  return res.json({ success: true, jobId: job.id, status: job.status });
});

// 1c. Gumroad publishing (server-side only; GUMROAD_ACCESS_TOKEN never leaves the server).
// Capability verified against Gumroad's official API docs (https://gumroad.com/api,
// read 2026-09-21). Flow: POST /v2/files/presign -> PUT part bytes to the
// presigned S3 URL -> POST /v2/files/complete -> POST /v2/products.
// Products are created as UNPUBLISHED DRAFTS (draft=true) unless the caller
// explicitly passes publish=true; the /products/:id/enable call that would make
// a listing live is a separate, deliberate step. Requires the token to carry
// the edit_products (or account) scope.
const GUMROAD_API = "https://api.gumroad.com/v2";
const GUMROAD_MAX_PDF_BYTES = 50 * 1024 * 1024; // presign parts are 100MB; one part covers our PDFs

function gumroadToken(): string {
  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "GUMROAD_ACCESS_TOKEN is not set on the server. Generate one in Gumroad: Settings > Advanced > Create application > Generate access token."
    );
  }
  return token;
}

// POST a form-encoded call to the Gumroad v2 API. Supports repeated keys
// (e.g. "files[][url]", "tags[]") via arrays. The official docs send the token
// as an access_token form field; third-party live tests use a Bearer header —
// send both.
async function gumroadForm<T>(
  path: string,
  params: Record<string, string | string[]>,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const token = gumroadToken();
  const body = new URLSearchParams();
  body.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => body.append(key, v));
    else body.set(key, value);
  }
  const res = await fetch(GUMROAD_API + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 60000),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || data.success === false) {
    // Note: Gumroad has been observed returning 404 (not 401) for invalid tokens.
    const err: any = new Error(data?.message || `Gumroad API request failed (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

function parsePriceCents(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100);
  const match = String(raw ?? "").match(/[\d,]+(?:\.\d{1,2})?/);
  if (!match) return null;
  const value = parseFloat(match[0].replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "dropkit-product";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildGumroadDescription(item: any): string {
  const parts = [item?.gumroadBlurb, item?.listingDescription]
    .filter((s) => s && String(s).trim())
    .map((s) => String(s).trim());
  const unique = [...new Set(parts)];
  const html = unique.map((p) => `<p>${escapeHtml(p).replace(/\n+/g, "<br/>")}</p>`).join("");
  return html || "<p>Digital download product.</p>";
}

app.post("/api/gumroad/publish", rateLimit, async (req, res) => {
  try {
    if (!process.env.GUMROAD_ACCESS_TOKEN) {
      return res.status(400).json({
        error:
          "Gumroad publishing is not connected. Add GUMROAD_ACCESS_TOKEN to the server environment (Gumroad: Settings > Advanced > Create application > Generate access token), then try again.",
      });
    }
    const { item, pdfBase64, publish } = (req.body || {}) as {
      item?: any;
      pdfBase64?: string;
      publish?: boolean;
    };
    const title = String(item?.productTitle || "").trim();
    if (!title) return res.status(400).json({ error: "A product title is required." });
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return res.status(400).json({ error: "A PDF file is required." });
    }
    const pdfBytes = Buffer.from(pdfBase64, "base64");
    if (pdfBytes.length === 0 || pdfBytes.length > GUMROAD_MAX_PDF_BYTES) {
      return res.status(400).json({ error: "The PDF must be between 1 byte and 50 MB." });
    }
    if (pdfBytes.subarray(0, 4).toString("latin1") !== "%PDF") {
      return res.status(400).json({ error: "The uploaded file is not a PDF." });
    }
    const priceCents = parsePriceCents(item?.priceRecommendationValue);
    if (priceCents === null) {
      return res.status(400).json({ error: "Could not parse a price from the item's recommended price." });
    }

    const filename = `${slugifyTitle(title)}.pdf`;

    // 1. Presign the multipart upload.
    const presign = await gumroadForm<any>("/files/presign", {
      filename,
      file_size: String(pdfBytes.length),
    });
    const parts: Array<{ part_number: number; presigned_url: string }> = presign.parts || [];
    if (!presign.upload_id || !presign.key || parts.length === 0) {
      throw new Error("Gumroad did not return a file upload session.");
    }

    // 2. PUT each part's bytes to its presigned S3 URL, capturing the ETag.
    const partSize = Math.ceil(pdfBytes.length / parts.length);
    const etags: Array<{ part_number: number; etag: string }> = [];
    try {
      for (const part of parts) {
        const start = (part.part_number - 1) * partSize;
        const chunk = pdfBytes.subarray(start, Math.min(start + partSize, pdfBytes.length));
        const upload = await fetch(part.presigned_url, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf", "Content-Length": String(chunk.length) },
          body: chunk,
          signal: AbortSignal.timeout(5 * 60 * 1000),
        });
        if (!upload.ok) throw new Error(`File upload to Gumroad storage failed (HTTP ${upload.status}).`);
        const etag = upload.headers.get("etag");
        if (!etag) throw new Error("Gumroad storage did not return an ETag for the uploaded part.");
        etags.push({ part_number: part.part_number, etag });
      }
    } catch (err) {
      // Best-effort abort of the multipart session; the upload_id is single-use.
      try {
        await gumroadForm("/files/abort", { upload_id: presign.upload_id, key: presign.key });
      } catch {
        /* ignore */
      }
      throw err;
    }

    // 3. Complete the upload -> canonical file_url (one-shot; do not retry).
    const completePartNumbers: string[] = [];
    const completePartEtags: string[] = [];
    for (const e of etags) {
      completePartNumbers.push(String(e.part_number));
      completePartEtags.push(e.etag);
    }
    const complete = await gumroadForm<any>("/files/complete", {
      upload_id: presign.upload_id,
      key: presign.key,
      "parts[][part_number]": completePartNumbers,
      "parts[][etag]": completePartEtags,
    });
    const fileUrl: string | undefined = complete.file_url;
    if (!fileUrl) throw new Error("Gumroad did not return a file URL for the uploaded PDF.");

    // 4. Create the product — as a DRAFT unless explicit publish was requested.
    const createParams: Record<string, string | string[]> = {
      draft: publish === true ? "false" : "true",
      native_type: "digital",
      name: title.slice(0, 200),
      price: String(priceCents),
      price_currency_type: "usd",
      description: buildGumroadDescription(item),
      "files[][url]": [fileUrl],
    };
    const tags = Array.isArray(item?.etsyTags) ? item.etsyTags.filter(Boolean).slice(0, 10) : [];
    if (tags.length > 0) createParams["tags[]"] = tags;
    const created = await gumroadForm<any>("/products", createParams);
    const product = created.product || {};
    let published = Boolean(product.published);

    // 5. Explicit publish is a separate deliberate step (not exposed in the UI).
    if (publish === true && !published && product.id) {
      const enabled = await gumroadForm<any>(
        `/products/${encodeURIComponent(product.id)}/enable`,
        {}
      );
      published = Boolean(enabled.product?.published ?? enabled.success);
    }

    return res.json({
      success: true,
      productId: product.id,
      url: product.short_url || null,
      published,
      draft: !published,
      warning: product.warning || null,
    });
  } catch (err: any) {
    console.error("[gumroad] publish failed:", err.message);
    const isAuth = err.status === 401 || err.status === 404;
    return res.status(502).json({
      error: isAuth
        ? "Gumroad rejected the access token. Check that GUMROAD_ACCESS_TOKEN is valid and carries the edit_products scope."
        : err.message || "Gumroad publishing failed.",
    });
  }
});

// 2. Queue management endpoints
app.get("/api/queue", (req, res) => {
  res.json({ tasks: taskQueue });
});

app.post("/api/queue", (req, res) => {
  try {
    const { productId, niches, angle, language } = req.body;

    if (!productId || !specMap[productId]) {
      return res.status(400).json({ error: "Invalid product ID selected." });
    }

    if (!niches || !Array.isArray(niches) || niches.length === 0) {
      return res.status(400).json({ error: "At least one target audience/niche is required." });
    }

    const productName = labelsMap[productId];
    const newTasks: Task[] = [];

    for (const rawNiche of niches) {
      const cleanNiche = rawNiche.trim();
      if (!cleanNiche) continue;

      const task: Task = {
        id: "task_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now(),
        productId,
        productName,
        niche: cleanNiche,
        angle: angle?.trim() || undefined,
        language: language || "English",
        status: "pending",
        createdAt: new Date().toISOString()
      };
      newTasks.push(task);
      taskQueue.push(task);
    }

    saveQueue(taskQueue);

    // Run queue in the background (fire-and-forget, non-blocking)
    processQueueRunner().catch(err => console.error("[Queue] Failed to execute background runner:", err));

    return res.json({ success: true, added: newTasks.length, tasks: newTasks });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to add items to queue." });
  }
});

app.post("/api/queue/clear", (req, res) => {
  // Clear completed and failed tasks, keep processing/pending intact
  taskQueue = taskQueue.filter(t => t.status === "pending" || t.status === "processing");
  saveQueue(taskQueue);
  return res.json({ success: true, tasks: taskQueue });
});

app.delete("/api/queue/tasks/:id", (req, res) => {
  const { id } = req.params;
  taskQueue = taskQueue.filter(t => t.id !== id);
  saveQueue(taskQueue);
  return res.json({ success: true });
});

// 3. Server-side Archive API endpoints
app.get("/api/archive", (req, res) => {
  const archive = loadArchive();
  return res.json({ archive });
});

app.post("/api/archive", (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.productTitle) {
      return res.status(400).json({ error: "Invalid product payload to archive." });
    }
    const archive = loadArchive();
    const isAlreadySaved = archive.some(a => a.productTitle === item.productTitle);
    if (!isAlreadySaved) {
      archive.push(item);
      saveArchive(archive);
    }
    return res.json({ success: true, archive });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to save item to server archive." });
  }
});

app.post("/api/archive/sync", (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid sync request. 'items' array required." });
    }
    const serverArchive = loadArchive();
    
    // Merge client items into server archive, avoiding duplicates
    let updated = [...serverArchive];
    for (const clientItem of items) {
      if (!clientItem || !clientItem.productTitle) continue;
      const exists = updated.some(s => s.productTitle === clientItem.productTitle);
      if (!exists) {
        updated.push(clientItem);
      }
    }
    
    saveArchive(updated);
    return res.json({ success: true, archive: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to synchronize archives." });
  }
});

app.post("/api/archive/remove", (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Product title is required to remove." });
    }
    let archive = loadArchive();
    archive = archive.filter(a => a.productTitle !== title);
    saveArchive(archive);
    return res.json({ success: true, archive });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to remove item from archive." });
  }
});

// Trending Niches via Google Trends RSS + NVIDIA LLM (no Gemini required)
const NVIDIA_TRENDS_MODEL = process.env.NVIDIA_TRENDS_MODEL || "moonshotai/kimi-k3";

interface TrendTopic { title: string; traffic: string; pubDate: string; }

async function fetchGoogleTrendsTopics(limit = 12): Promise<TrendTopic[]> {
  const rssUrl = "https://trends.google.com/trending/rss?geo=US";
  const resp = await fetch(rssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Dropfable/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Google Trends RSS returned HTTP ${resp.status}`);
  const xml = await resp.text();
  const items: TrendTopic[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const body = m[1];
    const title = (body.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim();
    const traffic = (body.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || "").trim();
    const pubDate = (body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    if (title) items.push({ title, traffic, pubDate });
  }
  if (!items.length) throw new Error("No trending topics found in Google Trends feed.");
  return items;
}

function templateTrendsFromTopics(topics: TrendTopic[], query: string) {
  return topics.slice(0, 5).map((t) => ({
    niche: t.title,
    whyTrending: `Trending on Google US${t.traffic ? ` with ${t.traffic} searches` : ""}${t.pubDate ? ` (${t.pubDate})` : ""}. Relevant to "${query}".`,
    exampleConcept: `30-Day ${t.title} Planner`,
  }));
}

async function nvidiaTrendsFromTopics(topics: TrendTopic[], query: string) {
  const topicList = topics.map((t, i) => `${i + 1}. ${t.title}${t.traffic ? ` (${t.traffic} searches)` : ""}`).join("\n");
  const resp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_TRENDS_MODEL,
      messages: [
        { role: "system", content: "You are a digital-product niche researcher. Reply with ONLY a JSON array, no markdown fences, no commentary." },
        { role: "user", content: `These topics are trending on Google US right now:\n${topicList}\n\nUser focus: "${query}".\n\nIdentify 5 highly relevant, specific, realistic digital-product niches inspired by these trends. For each return an object with exactly these keys: "niche" (short audience/topic name), "whyTrending" (one sentence tying it to the trend), "exampleConcept" (one concrete digital product idea, e.g. "30-Day Email Marketing Planner"). Do not return placeholders.` },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`NVIDIA API returned HTTP ${resp.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
  }
  const data: any = await resp.json();
  const content = (data?.choices?.[0]?.message?.content || "").trim();
  const jsonStr = content.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed) || !parsed.length) throw new Error("NVIDIA API returned no trends.");
  return parsed;
}

app.get("/api/trending-niches", rateLimit, requireQuota(), async (req, res) => {
  const query = (req.query.q as string) || "currently trending digital product niches 2026";
  try {
    console.log(`[Trends] Fetching Google Trends for: "${query}"`);
    const topics = await fetchGoogleTrendsTopics(12);
    if (NVIDIA_API_KEY) {
      try {
        const trends = await nvidiaTrendsFromTopics(topics, query);
        return res.json({ success: true, trends, modelUsed: `nvidia/${NVIDIA_TRENDS_MODEL}`, source: "google-trends" });
      } catch (llmErr: any) {
        console.warn("[Trends] NVIDIA enrichment failed, using template fallback:", llmErr.message || llmErr);
      }
    }
    const trends = templateTrendsFromTopics(topics, query);
    return res.json({ success: true, trends, modelUsed: "template", source: "google-trends", note: "Set NVIDIA_API_KEY for AI-enriched niche ideas." });
  } catch (err: any) {
    console.warn("[Trends] Failed:", err.message || err);
    return res.status(502).json({ error: "Trend lookup is temporarily unavailable. Please try again." });
  }
});

// Semantic Product Type Detection
app.post("/api/detect-format", rateLimit, requireQuota(), async (req, res) => {
  const { niche } = req.body;
  if (!niche) return res.status(400).json({ error: "Niche is required." });

  const detectPrompt = `Analyze the user's niche/request: "${niche}". Decide which of the following 6 digital product formats is the absolute best fit to create for this request: planner, prompts, templates, guide, checklist, swipe. Return ONLY a JSON object with 'format' string and 'reason' string.`;

  try {
    if (LLM_PROVIDER !== "gemini") {
      const providerKey = LLM_PROVIDER === "nvidia" ? NVIDIA_API_KEY : OPENAI_API_KEY;
      if (!providerKey) {
        return res.status(400).json({
          error: `LLM_PROVIDER=${LLM_PROVIDER} requires ${LLM_PROVIDER === "nvidia" ? "NVIDIA_API_KEY" : "OPENAI_API_KEY"}.`,
        });
      }
      const parsed = await openAiCompatibleJson({
        baseUrl: LLM_PROVIDER === "nvidia" ? NVIDIA_BASE_URL : "https://api.openai.com/v1",
        apiKey: providerKey,
        model: LLM_PROVIDER === "nvidia" ? NVIDIA_MODEL : OPENAI_MODEL,
        label: `${LLM_PROVIDER} detect-format`,
        system: "You are a digital product format classifier.",
        user: detectPrompt,
        call: { timeoutMs: 60000 },
      });
      return res.json(parsed);
    }
    if (!geminiApiKey) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not defined." });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: detectPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            format: { type: Type.STRING, enum: ["planner", "prompts", "templates", "guide", "checklist", "swipe"] },
            reason: { type: Type.STRING }
          },
          required: ["format", "reason"]
        }
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    const errorMessage = err.message || "";
    const isAuthError = errorMessage.includes("UNAUTHENTICATED") || errorMessage.includes("ACCOUNT_STATE_INVALID") || err.status === 401 || errorMessage.includes("401");
    if (isAuthError) {
      return res.status(401).json({ error: "The provided GEMINI_API_KEY is invalid or disabled. Please verify your Secrets in Settings > Secrets." });
    }
    const isQuotaError = errorMessage.includes("quota") || err.status === 429 || errorMessage.includes("429");
    if (isQuotaError) {
      return res.status(429).json({ error: "You have exceeded your Gemini API quota. Please check your Google AI Studio plan and billing details." });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Semantic Tags Suggestion
app.post("/api/suggest-tags", rateLimit, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.json({ tags: [] });

  const tagsPrompt = `Given the target audience or niche: "${query}", suggest 5 relevant secondary keywords or related micro-niches that the user could target. Return JSON with 'tags' array of strings. Keep them under 3 words each.`;

  try {
    if (LLM_PROVIDER !== "gemini") {
      const providerKey = LLM_PROVIDER === "nvidia" ? NVIDIA_API_KEY : OPENAI_API_KEY;
      if (!providerKey) return res.json({ tags: [] });
      const parsed = await openAiCompatibleJson({
        baseUrl: LLM_PROVIDER === "nvidia" ? NVIDIA_BASE_URL : "https://api.openai.com/v1",
        apiKey: providerKey,
        model: LLM_PROVIDER === "nvidia" ? NVIDIA_MODEL : OPENAI_MODEL,
        label: `${LLM_PROVIDER} suggest-tags`,
        system: "You suggest related micro-niches. Respond with JSON only.",
        user: tagsPrompt,
        call: { timeoutMs: 60000 },
      });
      return res.json({ tags: Array.isArray(parsed?.tags) ? parsed.tags : [] });
    }
    if (!geminiApiKey) return res.status(400).json({ error: "No API key" });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: tagsPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["tags"]
        }
      }
    });
    return res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    const errorMessage = err.message || "";
    const isAuthError = errorMessage.includes("UNAUTHENTICATED") || errorMessage.includes("ACCOUNT_STATE_INVALID") || err.status === 401 || errorMessage.includes("401");
    if (isAuthError) {
      return res.status(401).json({ error: "The provided GEMINI_API_KEY is invalid or disabled. Please verify your Secrets in Settings > Secrets." });
    }
    const isQuotaError = errorMessage.includes("quota") || err.status === 429 || errorMessage.includes("429");
    if (isQuotaError) {
      return res.status(429).json({ error: "You have exceeded your Gemini API quota. Please check your Google AI Studio plan and billing details." });
    }
    return res.status(500).json({ error: err.message });
  }
});

// 4. Autonomous Scheduler API endpoints
app.get("/api/autonomous-status", (req, res) => {
  return res.json({
    ...autonomousState,
    hasApiKey: !!geminiApiKey
  });
});

app.post("/api/image/generate", rateLimit, requireQuota(), async (req, res) => {
  try {
    const { productTitle, niche } = req.body;
    if (!productTitle) {
      return res.status(400).json({ error: "Product title required for cover art generation." });
    }
    if (!geminiApiKey) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not defined." });
    }
    const prompt = `A clean, elegant, premium, modern graphical cover for a digital product targeting ${niche || "creators"}. The product is named: "${productTitle}". Best suited for a digital download product card, minimal style.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "4:3" } },
    });
    let imageUrl: string | null = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || "image/jpeg";
        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
    if (!imageUrl) throw new Error("No image generated");
    return res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    return res.status(500).json({ error: error.message || "Failed to generate image." });
  }
});

app.post("/api/autonomous-trigger", (req, res) => {
  if (!AUTONOMOUS_ENABLED) {
    return res.status(400).json({ error: "Autonomous generation is disabled. Set AUTONOMOUS_ENABLED=true to enable." });
  }
  if (!geminiApiKey) {
    return res.status(400).json({ error: "GEMINI_API_KEY is not defined. Please verify your Secrets in Settings > Secrets." });
  }
  if (autonomousState.isRunning) {
    return res.status(400).json({ error: "Autonomous background generator is already actively running." });
  }
  runAutonomousWorkflow().catch(err => console.error("[Autonomous] Triggered workflow failure:", err));
  return res.json({ success: true, message: "Autonomous hourly product batch generator triggered." });
});

if (!process.env.VERCEL) {
  processQueueRunner().catch(err => console.error("[Queue] Startup runner failure:", err));
}

async function mountViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const viteSpecifier = "vite";
    const { createServer: createViteServer } = await import(viteSpecifier);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DropKit Digital Factory active on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  mountViteMiddleware();
}

export default app;

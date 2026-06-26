import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { Client as NotionClient } from "@notionhq/client";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

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

import fs from "fs";
import { execSync } from "child_process";

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
  console.warn(`[ModelTracker] Demoting ${modelName} for ${minutes} minutes due to a transient/overload error.`);
}

// Generate text with model fallback, leading with the models actually provisioned
// for this key (fastest first) and demoting any that return transient/overload
// errors. Used by the lightweight text endpoints (e.g. /api/trends).
async function generateText(params: { contents: any; config?: any }) {
  const models = getOrderedModels([
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ]);
  let lastErr: any;
  for (const model of models) {
    try {
      return await ai.models.generateContent({ model, ...params });
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? err);
      if (/\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|high demand/i.test(msg)) {
        markModelFailure(model);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const ARCHIVE_FILE = path.join(process.cwd(), "archive_store.json");

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

// Push to GitHub helper. Auto-pushing to main caused repeated outages (it
// overwrote the deploy config and deleted code), so it is OFF unless explicitly
// enabled via ENABLE_AUTONOMOUS_GIT_PUSH=true.
function pushToGitHub(niche: string) {
  if (process.env.ENABLE_AUTONOMOUS_GIT_PUSH !== "true") {
    console.log("[Git] Auto-push to main is disabled (set ENABLE_AUTONOMOUS_GIT_PUSH=true to enable).");
    return;
  }
  try {
    console.log("[Git] Committing and pushing autonomous batch for niche:", niche);
    execSync("git add products/ archive_store.json queue_store.json", { stdio: "inherit" });
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
  if (autonomousState.isRunning) {
    console.log("[Autonomous] Workflow already running, skipping.");
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
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
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
        console.warn(`[Autonomous] Brainstorming with ${bModel} failed:`, err.message || err);
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

// Hourly autonomous workflow. DISABLED by default: it git-pushes to main, which
// previously clobbered the repo. The /api/autonomous-trigger endpoint still lets
// you run it manually. Enable the timer only with ENABLE_AUTONOMOUS=true, and
// never on Vercel (serverless has no persistent timers or writable git).
if (process.env.ENABLE_AUTONOMOUS === "true" && !process.env.VERCEL) {
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

const DB_FILE = path.join(process.cwd(), "queue_store.json");

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
async function manufactureProduct(productId: string, niche: string, angle?: string, language?: string) {
  if (!productId || !specMap[productId]) {
    throw new Error("Invalid product ID selected.");
  }

  if (!niche || niche.trim() === "") {
    throw new Error("Niche/Audience is required.");
  }

  const spec = specMap[productId];
  const productName = labelsMap[productId];

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please verify your Secrets in Settings > Secrets.");
  }

  const systemInstruction = 
    "You are a master digital product engineer and elite copywriter. " +
    "Your goal is to generate exceptionally detailed, highly professional, completely filled digital products " +
    "and the exact optimized sales copy of the product to sell on platforms like Gumroad and Etsy." +
    "\n\nCRITICAL SPEC: Generate absolute FULL content, not summary outlines or instructions on what to write. " +
    "If the specification asks for 30 daily pages or 50 prompts, write out detailed content for them. " +
    "Keep the tone encouraging, high-value, premium, and actionable.";

  const promptText = `Please manufacture a premium quality digital product of type: "${productName}".
Specification of the product: ${spec}
Niche/Audience: ${niche}
${angle ? `Specific angle / flavor requested: ${angle}` : ""}
${language && language !== 'English' ? `CRITICAL: You MUST translate and output ALL generated content, including the product content, titles, and sales copy, exactly into the following language: ${language}` : ""}

Please output the generated product content and its sales listings in the requested JSON structure. No placeholders. Ensure high completeness.`;

  // Lead with the models actually provisioned for this key, fastest first.
  // gemini-3.5-flash / gemini-3.1-flash-lite return persistent 503/404 here, so
  // they are not used (leading with them wasted every request on dead models —
  // the health-tracker's cooldowns don't persist across serverless invocations).
  const baseModelsToTry = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ];
  const modelsToTry = getOrderedModels(baseModelsToTry);
  let lastError: any = null;

  for (const modelName of modelsToTry) {
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

        return JSON.parse(responseText);

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
          console.warn(`[Generator] Transient error on ${modelName}. Switching immediately to the next fallback model...`, errorMessage);
          break; // break retry loop immediately to try the next healthy model
        } else {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000);
            console.warn(`[Generator] Non-transient error on ${modelName} (attempt ${retryCount}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, errorMessage);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        console.warn(`[Generator] Model ${modelName} failed. Error:`, errorMessage);
        break; // break retry loop to try the next model
      }
    }
  }
  throw lastError;
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

// 1. Instant/Synchronous Manufacture Endpoint
app.post("/api/manufacture", async (req, res) => {
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

// 2. Queue management endpoints
// Restored frontend API routes (trends, image, Notion, Shopify) that the
// autonomous rewrite dropped.
app.post("/api/shopify/push", async (req, res) => {
  try {
    const { title, description, price } = req.body;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;
    const domain = process.env.SHOPIFY_STORE_DOMAIN;

    if (!token || !domain) {
      return res.status(400).json({ error: "Missing SHOPIFY_ACCESS_TOKEN or SHOPIFY_STORE_DOMAIN in environment." });
    }

    const priceValue = price ? parseFloat(price.replace(/[^0-9.]/g, '')) || 19.99 : 19.99;

    const query = `
      mutation productCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    // Shopify GraphQL API
    const response = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            title: title,
            descriptionHtml: description,
            variants: [{
              price: priceValue.toString()
            }]
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }
    
    if (data.data?.productCreate?.userErrors?.length > 0) {
      throw new Error(data.data.productCreate.userErrors[0].message);
    }

    const productId = data.data?.productCreate?.product?.id?.split('/').pop();
    
    res.json({ success: true, url: `https://${domain}/admin/products/${productId}` });
  } catch (error: any) {
    console.error("Shopify API Error:", error);
    res.status(500).json({ error: error.message || "Failed to push to Shopify." });
  }
});

app.post("/api/notion/push", async (req, res) => {
  try {
    const { title, content, targetAudience } = req.body;
    const notionKey = process.env.NOTION_API_KEY;
    const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

    if (!notionKey || !parentPageId) {
      return res.status(400).json({ error: "Missing NOTION_API_KEY or NOTION_PARENT_PAGE_ID in environment." });
    }

    const notion = new NotionClient({ auth: notionKey });
    
    // Convert content text into rough Notion blocks
    const children: any[] = [];
    const lines = content.split('\n');
    let currentParagraph = "";

    const flushParagraph = () => {
      if (currentParagraph.trim()) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: currentParagraph.substring(0, 2000) } }] }
        });
        currentParagraph = "";
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        flushParagraph();
        children.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: trimmed.replace(/^# /, '').substring(0, 2000) } }] } });
      } else if (trimmed.startsWith('## ')) {
        flushParagraph();
        children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: trimmed.replace(/^## /, '').substring(0, 2000) } }] } });
      } else if (trimmed.startsWith('### ')) {
        flushParagraph();
        children.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: trimmed.replace(/^### /, '').substring(0, 2000) } }] } });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        flushParagraph();
        children.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: trimmed.replace(/^[-*] /, '').substring(0, 2000) } }] } });
      } else if (trimmed === '') {
        flushParagraph();
      } else {
        currentParagraph += (currentParagraph ? "\n" : "") + trimmed;
      }
    }
    flushParagraph();

    // Notion limits creation to 100 blocks at once in children array
    const response = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: {
          title: [
            { text: { content: title.substring(0, 2000) } }
          ]
        }
      },
      children: children.slice(0, 100)
    });

    res.json({ success: true, url: (response as any).url });
  } catch (error: any) {
    console.error("Notion API Error:", error);
    res.status(500).json({ error: error.message || "Failed to push to Notion." });
  }
});

app.get("/api/trends", async (req, res) => {
  try {
    const response = await generateText({
      contents: "Return a JSON array of 5 currently trending digital product niches or target audiences, just 5 strings answering the query. Be specific, like 'ADHD Notion Creators', not just 'ADHD'.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });
    const trends = JSON.parse(response.text || "[]");
    res.json({ trends });
  } catch (error: any) {
    console.error("Trends Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch trends." });
  }
});

app.post("/api/image/generate", async (req, res) => {
  try {
    const { productTitle, niche } = req.body;
    
    if (!productTitle) {
      return res.status(400).json({ error: "Product title required for cover art generation." });
    }

    const prompt = `A clean, elegant, premium, modern graphical cover for a digital product targeting ${niche || 'creators'}. The product is named: "${productTitle}". Best suited for a digital download product card, minimal style.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: { aspectRatio: "4:3" }
      }
    });

    let imageUrl = null;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/jpeg";
        imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("No image generated");
    }
    
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate image." });
  }
});

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

// 4. Autonomous Scheduler API endpoints
app.get("/api/autonomous-status", (req, res) => {
  return res.json(autonomousState);
});

app.post("/api/autonomous-trigger", (req, res) => {
  if (autonomousState.isRunning) {
    return res.status(400).json({ error: "Autonomous background generator is already actively running." });
  }
  // Run asynchronously in background
  runAutonomousWorkflow().catch(err => console.error("[Autonomous] Triggered workflow failure:", err));
  return res.json({ success: true, message: "Autonomous hourly product batch generator triggered." });
});

// Auto-run queue processing on startup (standalone server only; serverless
// functions have no persistent process or writable filesystem for the queue).
if (!process.env.VERCEL) {
  processQueueRunner().catch(err => console.error("[Queue] Startup runner failure:", err));
}


// Standalone server bootstrap (dev: Vite middleware; prod: static dist/) + listen.
// On Vercel the app runs as a serverless function (see api/index.ts) which
// imports the exported `app`, so this bootstrap is skipped there.
async function mountViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import via a variable specifier so Vite (a devDependency) is never
    // pulled into the production esbuild bundle or the Vercel function trace.
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

// Vercel sets process.env.VERCEL; there the app is consumed as a serverless
// handler and must not call listen().
if (!process.env.VERCEL) {
  mountViteMiddleware();
}

export default app;

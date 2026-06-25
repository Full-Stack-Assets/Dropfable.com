import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

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

  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
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
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = (Math.pow(2, retryCount) * 1000) + (Math.random() * 1000);
            console.warn(`[Generator] Transient error on ${modelName} (attempt ${retryCount}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, errorMessage);
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

// Auto-run processing on server startup if any pending items exist
processQueueRunner().catch(err => console.error("[Queue] Startup runner failure:", err));


// Setup Vite Dev Middleware / Static files serving
async function mountViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
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

mountViteMiddleware();

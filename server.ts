import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { Client as NotionClient } from "@notionhq/client";
import { PRODUCT_DEFS } from "./src/products";

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

// Derived from the shared product catalog so ids/labels/specs stay in sync with
// the frontend (see src/products.ts).
const specMap: Record<string, string> = Object.fromEntries(
  PRODUCT_DEFS.map((p) => [p.id, p.spec])
);

const labelsMap: Record<string, string> = Object.fromEntries(
  PRODUCT_DEFS.map((p) => [p.id, p.label])
);

// Text-generation models in priority order. The original `gemini-3.5-flash`
// returns persistent 503 "high demand" / UNAVAILABLE for this key, so we lead
// with the GA flash models (the 2.5 family is provisioned — cover images use
// gemini-2.5-flash-image) and fall through to the next model on transient,
// overload, or quota errors.
const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash"];

function isRetriableGeminiError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err);
  return /\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|high demand/i.test(msg);
}

// generateContent with model fallback + light backoff. Tries each model in
// TEXT_MODELS, retrying transient/overload errors twice before moving to the
// next model. Non-retriable errors (e.g. a malformed request) fail fast.
async function generateText(params: { contents: any; config?: any }) {
  let lastErr: unknown;
  for (const model of TEXT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, ...params });
      } catch (err) {
        lastErr = err;
        if (!isRetriableGeminiError(err)) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

  app.post("/api/manufacture", async (req, res) => {
    try {
      const { productId, niche, angle, language } = req.body;
  
      if (!productId || !specMap[productId]) {
        return res.status(400).json({ error: "Invalid product ID selected." });
      }
  
      if (!niche || niche.trim() === "") {
        return res.status(400).json({ error: "Niche/Audience is required." });
      }
  
      const spec = specMap[productId];
      const productName = labelsMap[productId];
  
      if (!geminiApiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not defined. Please verify your Secrets in Settings > Secrets." 
        });
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

    const response = await generateText({
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
            },
            growthTactics: {
              type: Type.STRING,
              description: "A dynamically generated 3-month launch roadmap, including milestones for email list growth, social media posting cadence, and initial beta tester acquisition strategies based on the niche."
            }
          },
          required: [
            "productTitle",
            "productContent",
            "etsyTitle",
            "priceRecommendationValue",
            "listingDescription",
            "etsyTags",
            "gumroadBlurb",
            "growthTactics"
          ]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response received from Gemini model.");
    }

    const data = JSON.parse(responseText);
    return res.json(data);

  } catch (error: any) {
    console.error("Manufacturing Jammed Error:", error);
    return res.status(500).json({ 
      error: error.message || "The manufacturing factory engine suffered a temporary jam. Please click 'Drop it' again!" 
    });
  }
});

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

// Standalone server bootstrap: Vite dev middleware (dev) or static dist/ serving
// (production `node dist/server.cjs`) + listen(). On Vercel the app runs as a
// serverless function (see api/[...path].ts) which imports the exported `app`
// directly, so this bootstrap is skipped — Vercel serves the static frontend
// and routes /api/* to the function (see vercel.json).
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

// Vercel sets process.env.VERCEL; in that case the app is consumed as a
// serverless handler and must not call listen().
if (!process.env.VERCEL) {
  mountViteMiddleware();
}

export default app;

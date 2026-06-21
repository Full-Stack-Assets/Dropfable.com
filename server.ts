import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
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
  swipe: "a premium swipe file comprising 75 ready-to-use subject lines, titles, hook formulas, or captions (customized for the niche) across 5 themed categories of 15 items. Each category includes a brief intro note explaining why and when these mental hooks work best.",
  website: "a comprehensive 5-page website wireframe and copy generator, providing exact headline copy, sub-headlines, body text, call-to-actions, and structural layouts for: Homepage, About Us, Services/Products, Testimonials, and Contact pages, all perfectly tailored to the requested niche."
};

const labelsMap: Record<string, string> = {
  planner: "Planner / Workbook",
  prompts: "AI Prompt Pack",
  templates: "Template Pack",
  guide: "Mini-Guide / Book",
  checklist: "Checklist System",
  swipe: "Swipe File",
  website: "Website Generator"
};

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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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

// Shared product catalog — the single source of truth for Nichesmith's product
// types. Imported by BOTH the frontend (`src/App.tsx`) and the backend
// (`server.ts`) so ids, labels and specs never drift out of sync.
//
// Keep this file free of React / JSX: it is bundled into the Node server build
// by esbuild. UI-only concerns (the lucide icon per product) live in App.tsx,
// keyed by `id`.

export interface ProductDef {
  /** Stable id shared across frontend and backend (e.g. "planner"). */
  id: string;
  /** Display name in the UI and the product label sent to Gemini. */
  label: string;
  /** Short tagline shown under the product name in the picker. */
  code: string;
  /** Short, human-friendly summary of what the product contains (UI only). */
  blurb: string;
  /** Full generation specification handed to Gemini server-side. */
  spec: string;
}

export const PRODUCT_DEFS: ProductDef[] = [
  {
    id: "planner",
    label: "Planner / Workbook",
    code: "30-day structure",
    blurb: "30 daily interactive entries, weekly reflection reviews & comprehensive introduction",
    spec: "a premium 30-day planner/workbook: featuring an engaging intro page, a clear 'how-to-use' layout, 30 beautifully detailed daily pages (each with an inspiring daily theme, 2-3 specific reflective prompts or input fields, and a daily actionable microscopic step), a recurring weekly review section (every 7 days, so total of 4 reviews), and a final comprehensive reflection page. Do not hold back, provide the complete content for each of the 30 days."
  },
  {
    id: "prompts",
    label: "AI Prompt Pack",
    code: "50 copy-paste prompts",
    blurb: "50 high-value ready-to-use bracketed prompts across 5 key niche categories",
    spec: "a pack of 50 extremely high-value, ready-to-use AI prompts sorted into 5 sensible categories of 10 prompts each. Each prompt includes a distinct bold title, the complete, ready-to-copy-paste prompt with placeholder [VARIABLES] in brackets, and a brief 1-line usage tip ('Use this when...'). Also provide a 1-paragraph quick-start overview at the beginning."
  },
  {
    id: "templates",
    label: "Template Pack",
    code: "25 fill-in scripts",
    blurb: "25 customizable captions, templates or message logs with custom blanks and strategies",
    spec: "a system of 25 fill-in-the-blank communication templates (emails, outreach scripts, captions, or follow-up messages depending on what fits this niche best) across 5 thematic categories. Each template must feature a clear header/title, the core copy-paste template text with clear [BLANK] blocks to fill, and a stellar usage tip."
  },
  {
    id: "guide",
    label: "Mini-Guide / Book",
    code: "~3k word deep-dive",
    blurb: "A complete non-fiction playbook including 6-8 chapters loaded with specific guidance",
    spec: "a complete deep-dive mini-guide (~2,000-3,000 words): full title page details, an introduction, 6-8 comprehensive chapters filled with extremely actionable specifics, real-world numbers, checklists, examples, and a strong conclusion with defined next steps. Write the FULL text, not an outline."
  },
  {
    id: "checklist",
    label: "Checklist System",
    code: "10-part checklist package",
    blurb: "A synchronized set of 10 related checklists with sequential tasks and trigger index",
    spec: "an actionable set of 10 related checklists suitable for this niche. Provide a master table or index of 'which checklist to use when', followed by the 10 checklists. Each checklist must have a descriptive title, context of when to use it, and 8-15 ordered, highly detailed actionable bullet points/checkbox tasks."
  },
  {
    id: "swipe",
    label: "Swipe File",
    code: "75 creative hooks",
    blurb: "75 highly converting lines, email headers or openers with sectioned applicability guidance",
    spec: "a premium swipe file comprising 75 ready-to-use subject lines, titles, hook formulas, or captions (customized for the niche) across 5 themed categories of 15 items. Each category includes a brief intro note explaining why and when these mental hooks work best."
  },
  {
    id: "website",
    label: "Website Generator",
    code: "5-page structure",
    blurb: "A comprehensive wireframe and copy generator for Homepage, About, Services, Testimonials, and Contact.",
    spec: "a comprehensive 5-page website wireframe and copy generator, providing exact headline copy, sub-headlines, body text, call-to-actions, and structural layouts for: Homepage, About Us, Services/Products, Testimonials, and Contact pages, all perfectly tailored to the requested niche."
  }
];

// Static UI catalog and constants. Extracted from App.tsx. This is a .tsx file
// because the product catalog embeds lucide icons (JSX). The Gemini specs that
// drive generation live server-side in server.ts's specMap/labelsMap, keyed by
// the same product `id` — keep the two in sync when adding a product.
import { Calendar, Brain, Mail, BookOpen, CheckSquare, Layers } from "lucide-react";
import type { ProductType } from "./types";

export const PRODUCTS: ProductType[] = [
  {
    id: "planner",
    ico: <Calendar className="w-5 h-5" />,
    name: "Planner / Workbook",
    code: "30-day structure",
    spec: "30 daily interactive entries, weekly reflection reviews & comprehensive introduction"
  },
  {
    id: "prompts",
    ico: <Brain className="w-5 h-5" />,
    name: "Prompt Pack",
    code: "50 copy-paste prompts",
    spec: "50 high-value ready-to-use bracketed prompts across 5 key niche categories"
  },
  {
    id: "templates",
    ico: <Mail className="w-5 h-5" />,
    name: "Template Pack",
    code: "25 fill-in scripts",
    spec: "25 customizable captions, templates or message logs with custom blanks and strategies"
  },
  {
    id: "guide",
    ico: <BookOpen className="w-5 h-5" />,
    name: "Mini-Guide / Book",
    code: "~3k word deep-dive",
    spec: "A complete non-fiction playbook including 6-8 chapters loaded with specific guidance"
  },
  {
    id: "checklist",
    ico: <CheckSquare className="w-5 h-5" />,
    name: "Checklist System",
    code: "10-part checklist package",
    spec: "A synchronized set of 10 related checklists with sequential tasks and trigger index"
  },
  {
    id: "swipe",
    ico: <Layers className="w-5 h-5" />,
    name: "Swipe File",
    code: "75 creative hooks",
    spec: "75 highly converting lines, email headers or openers with sectioned applicability guidance"
  }
];

export const PRESET_NICHES = [
  "ADHD College Students",
  "New Real Estate Agents",
  "Pet Shop Owners",
  "Self-Taught Indie Hackers",
  "Vegan Meal Prep Beginners"
];

export const NICHE_TREND_DATA = [
  { intensity: 20 },
  { intensity: 24 },
  { intensity: 30 },
  { intensity: 28 },
  { intensity: 45 },
  { intensity: 60 },
  { intensity: 58 },
  { intensity: 80 },
  { intensity: 85 },
  { intensity: 100 }
];

export const LOADER_MESSAGES = [
  "Setting up architecture...",
  "Initiating high-value synthesis...",
  "Conceptualizing structual solutions...",
  "Drafting tailored expert content...",
  "Formatting precise layout boundaries...",
  "Aligning semantic search models...",
  "Calibrating optimal price vectors...",
  "Preparing final delivery payload..."
];

// localStorage key the client archive persists under. Single source of truth so
// reads/writes can't drift (they previously hardcoded the literal in 6 places).
export const ARCHIVE_KEY = "dropkit_archive";

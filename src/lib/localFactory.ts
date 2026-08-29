import type { ManufactureResult, ProductType } from "../types";
import { ETSY_AI_DISCLOSURE, ETSY_PROMPT_PACK_NOTICE } from "../types";

export interface TrendIdea {
  niche: string;
  exampleConcept: string;
  whyTrending: string;
  source: "starter";
}

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

const titleCase = (value: string) =>
  clean(value)
    .split(" ")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(" ");

const nicheWords = (niche: string) =>
  clean(niche)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter((word) => word.length > 2);

export function suggestNiches(query: string): string[] {
  const base = titleCase(query);
  if (!base) return [];
  return [
    `${base} Beginners`,
    `${base} Freelancers`,
    `${base} Business Owners`,
    `${base} on a Budget`,
    `${base} 30-Day Challenge`,
  ];
}

export function detectLocalFormat(niche: string): string {
  const value = niche.toLowerCase();
  if (/prompt|\bai\b|chatgpt|automation/.test(value)) return "prompts";
  if (/email|caption|message|script|outreach|proposal/.test(value)) return "templates";
  if (/check|audit|launch|setup|workflow|system/.test(value)) return "checklist";
  if (/copy|headline|hook|sales|marketing|social/.test(value)) return "swipe";
  if (/learn|guide|course|explain|handbook|playbook/.test(value)) return "guide";
  return "planner";
}

export function localTrendIdeas(query: string): TrendIdea[] {
  const topic = titleCase(query || "Digital Product Creators");
  return [
    ["Beginners", "30-Day Quick-Start Workbook", "A narrow first-result offer with a clear completion window."],
    ["Freelancers", "Client Delivery Template Pack", "A practical business-use angle tied to repeatable work."],
    ["Business Owners", "Weekly Operations Checklist", "A recurring workflow product with concrete time-saving value."],
    ["on a Budget", "Low-Cost Resource Planner", "A constraint-led angle that makes the outcome and audience specific."],
    ["Accountability Groups", "Shared Progress Tracker", "A collaborative use case that supports recurring engagement."],
  ].map(([suffix, exampleConcept, whyTrending]) => ({
    niche: `${topic} ${suffix}`,
    exampleConcept,
    whyTrending: `Demand-research starter: ${whyTrending}`,
    source: "starter" as const,
  }));
}

const numbered = (count: number, render: (index: number) => string) =>
  Array.from({ length: count }, (_, index) => render(index + 1)).join("\n\n");

function buildContent(productId: string, title: string, niche: string, angle: string): string {
  const direction = angle ? `Creative direction: ${angle}.` : "Creative direction: practical, specific, and action-led.";
  const intro = `# ${title}\n\nBuilt for **${niche}**. ${direction}\n\n## How to use this product\n\nChoose one section at a time, complete the action, and record the result before moving forward.`;

  if (productId === "prompts") {
    const sections = ["Research", "Planning", "Creation", "Optimization", "Review"];
    return `${intro}\n\n${sections.map((section, sectionIndex) =>
      `## ${section}\n\n${numbered(10, (item) => `${sectionIndex * 10 + item}. Act as a ${section.toLowerCase()} specialist for ${niche}. Using [CONTEXT], produce [DELIVERABLE] for [GOAL]. Include assumptions, three options, and a next-action checklist.`)}`
    ).join("\n\n")}`;
  }

  if (productId === "templates") {
    return `${intro}\n\n## Fill-in templates\n\n${numbered(25, (item) =>
      `### Template ${item}\n\n**Purpose:** Move ${niche} from [CURRENT STATE] to [DESIRED RESULT].\n\n**Copy:** “Hi [NAME] — I noticed [SPECIFIC CONTEXT]. I created [RESOURCE/OFFER] to help with [OUTCOME]. The next step is [ACTION].”\n\n**Customize:** Replace every bracket, add one proof point, and remove any claim you cannot substantiate.`
    )}`;
  }

  if (productId === "guide") {
    const chapters = ["Define the outcome", "Understand the starting point", "Choose the smallest viable system", "Build the first version", "Test with real constraints", "Measure useful signals", "Improve what matters", "Create the next 30-day plan"];
    return `${intro}\n\n${chapters.map((chapter, index) =>
      `## Chapter ${index + 1}: ${chapter}\n\nFor ${niche}, this stage turns a broad intention into a verifiable result. Write down the decision, the evidence supporting it, and the condition that would make you change course.\n\n### Action\n\n- Define one observable outcome.\n- Remove one unnecessary dependency.\n- Complete one small test this week.\n- Record the result and the next decision.`
    ).join("\n\n")}`;
  }

  if (productId === "checklist") {
    return `${intro}\n\n${numbered(10, (section) =>
      `## Checklist ${section}: Stage ${section}\n\n${numbered(5, (item) => `- [ ] ${item}. Complete and verify the stage-${section} action for ${niche}.`)}`
    )}`;
  }

  if (productId === "swipe") {
    const frames = ["How to", "The simple way to", "What most people miss about", "A practical system for", "Before you", "The checklist for", "A better way to", "The fastest responsible path to"];
    return `${intro}\n\n## 75 adaptable hooks\n\n${numbered(75, (item) => `${item}. ${frames[(item - 1) % frames.length]} [DESIRED RESULT] for ${niche} — without [COMMON FRICTION].`)}`;
  }

  return `${intro}\n\n## 30-day planner\n\n${numbered(30, (day) =>
    `### Day ${day}\n\n**Outcome:** Define the smallest useful result for today.\n\n**Action:** Complete one focused task that advances ${niche}.\n\n**Evidence:** What changed, and how do you know?\n\n**Reflection:** What should be repeated, revised, or removed tomorrow?`
  )}\n\n## Weekly reviews\n\nAt the end of each week, record wins, friction, evidence, and the single highest-leverage adjustment for the next seven days.`;
}

export function manufactureLocally(
  product: ProductType,
  rawNiche: string,
  rawAngle: string,
  language: string,
): ManufactureResult {
  const niche = titleCase(rawNiche);
  const angle = clean(rawAngle);
  const shortProductName = product.name.replace(/ \(Gumroad only\)/i, "");
  const productTitle = `${niche} ${shortProductName}`;
  const etsyEligible = product.id !== "prompts";
  const tags = Array.from(new Set([
    ...nicheWords(niche),
    product.id,
    "digital download",
    "printable",
    "instant access",
  ])).map((tag) => tag.slice(0, 20)).slice(0, 13);
  const price = product.id === "guide" ? "$19" : product.id === "prompts" || product.id === "swipe" ? "$12" : "$15";
  const channelNotice = etsyEligible ? ETSY_AI_DISCLOSURE : ETSY_PROMPT_PACK_NOTICE;

  return {
    productTitle,
    productContent: buildContent(product.id, productTitle, niche, angle),
    etsyTitle: etsyEligible ? `${productTitle} | Printable Digital Download`.slice(0, 140) : "Not eligible for Etsy",
    priceRecommendationValue: price,
    listingDescription: `${productTitle} is a ready-to-customize ${shortProductName.toLowerCase()} designed for ${niche}. It includes ${product.code}, clear instructions, and structured action steps. Delivered as a digital download; no physical item is shipped. ${channelNotice}`,
    etsyTags: tags,
    gumroadBlurb: `A practical ${shortProductName.toLowerCase()} for ${niche}. Get a complete, editable product core with action-led content and launch-ready copy.`,
    originalNiche: rawNiche,
    productId: product.id,
    etsyEligible,
    ...(language !== "English" ? { listingDescription: `Language requested: ${language}. ${productTitle} is a ready-to-customize digital product for ${niche}. ${channelNotice}` } : {}),
  };
}

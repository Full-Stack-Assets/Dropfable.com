export interface ProductType {
  id: string;
  ico: React.ReactNode;
  name: string;
  code: string;
  spec: string;
}

export interface ManufactureResult {
  productTitle: string;
  productContent: string;
  etsyTitle: string;
  priceRecommendationValue: string;
  listingDescription: string;
  etsyTags: string[];
  gumroadBlurb: string;
  originalNiche?: string;
}

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

export const PRESET_NICHES = [
  "ADHD College Students",
  "New Real Estate Agents",
  "Pet Shop Owners",
  "Self-Taught Indie Hackers",
  "Vegan Meal Prep Beginners"
];

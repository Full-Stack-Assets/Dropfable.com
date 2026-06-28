// Shared frontend types. Extracted from App.tsx so they can be imported by
// future component modules without dragging in the whole app.
import type { ReactNode } from "react";

export interface ProductType {
  id: string;
  ico: ReactNode;
  name: string;
  code: string;
  spec: string;
}

// Canonical shape returned by /api/manufacture and stored in the archive. If the
// response schema in server.ts changes, update this too.
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

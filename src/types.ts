import type { ReactNode } from "react";

export interface ProductType {
  id: string;
  ico: ReactNode;
  name: string;
  code: string;
  spec: string;
}

export interface ListingOutcome {
  listedOn?: string;
  saleNoted?: boolean;
  receiptNote?: string;
  updatedAt?: string;
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
  productId?: string;
  etsyEligible?: boolean;
  coverImage?: string;
  listingOutcome?: ListingOutcome;
}

export const ETSY_AI_DISCLOSURE =
  "This product was created with AI assistance under the creative direction of the seller. On Etsy, list it as Designed by the seller (not handmade) and keep this disclosure in the description.";

export const ETSY_PROMPT_PACK_NOTICE =
  "Not for Etsy — Etsy prohibits selling AI prompt bundles. List this pack on Gumroad or another creator storefront only.";

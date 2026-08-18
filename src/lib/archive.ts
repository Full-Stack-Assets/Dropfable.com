import type { ManufactureResult } from "../types";

export const ARCHIVE_KEY = "dropkit_archive";

export function upsertArchiveItem(
  items: ManufactureResult[],
  incoming: ManufactureResult
): ManufactureResult[] {
  const title = (incoming.productTitle || "").trim();
  if (!title) return [...items, incoming];
  const idx = items.findIndex((item) => (item.productTitle || "").trim() === title);
  if (idx === -1) return [...items, incoming];
  const next = [...items];
  next[idx] = { ...items[idx], ...incoming };
  return next;
}

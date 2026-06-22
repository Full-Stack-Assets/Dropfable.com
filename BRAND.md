# Nichesmith — brand kit

The single reference for how Nichesmith looks and sounds, so every product, cover,
and storefront stays consistent as the line grows.

- **Name:** Nichesmith
- **One-liner:** Done-for-you AI prompt packs that help pros market in minutes.
- **Personality:** clear, confident, professional, helpful. Premium but not stuffy.

## Logo

Files live in [`assets/brand/`](./assets/brand/):

| File | Use |
| --- | --- |
| `nichesmith-logo.svg` | Primary horizontal logo (dark text) — light backgrounds |
| `nichesmith-logo-light.svg` | Horizontal logo (white text) — dark backgrounds / photos |
| `nichesmith-mark.svg` | Icon only (emerald tile, "N" + spark) — avatar, favicon, social profile |

The mark is an **"N" monogram** (the "smith" — crafted, solid) with a small mint
**spark** (the AI). 

**Usage rules**
- Keep clear space around the logo equal to the height of the "N".
- Don't recolor, stretch, rotate, add shadows, or put the light logo on a busy
  light photo (use the mark on a solid emerald chip instead).
- Minimum size: mark no smaller than 32px; wordmark legible at ~120px wide.

**Export to PNG (no terminal):** open the SVG in a browser or Canva/Figma →
export at 2x. For the Gumroad avatar, export `nichesmith-mark.svg` at **512×512**.

## Color palette

| Role | Name | Hex | Where |
| --- | --- | --- | --- |
| Primary accent | Emerald | `#1A7A4F` | logo tile, buttons, links, Gumroad accent |
| Deep accent / headings | Forest | `#14532D` | wordmark, headlines on light |
| Light accent | Mint | `#A7E3C4` | spark, subtle highlights, badges |
| Background | White | `#FFFFFF` | primary page background |
| Background alt | Off-white | `#F7F8F7` | storefront / section backgrounds |
| Text | Ink | `#111111` | body copy |
| Muted text | Slate | `#5B6660` | captions, secondary text |
| Hairlines | Border | `#E6E8E6` | dividers, card borders |

> Note: this customer-facing palette is **light** by design (best for selling
> text products to professionals). It's intentionally different from the app's
> internal dark UI theme in `src/index.css` — don't mix the two.

## Typography

- **Primary typeface:** Inter (already used by the app). Fallback: Helvetica
  Neue / Arial.
- Headings: Inter **600–700**, tight letter-spacing (-2 to -3).
- Body: Inter **400**, generous line-height (~1.5).
- In Canva, use **Inter** (free) for everything to match the logo.

## Gumroad setup

- **Theme:** Light.
- **Background:** White or off-white `#F7F8F7`.
- **Accent color:** `#1A7A4F`.
- **Profile / store name:** Nichesmith (or "Nichesmith — AI Prompt Packs for Pros").
- **Avatar:** `nichesmith-mark.svg` exported at 512×512.
- **Bio (one benefit line):** *Done-for-you AI prompt packs that help real estate
  & mortgage pros market in minutes.*
- **Product order:** pin the **Real Estate + Mortgage Bundle ($29)** first, then
  the two single packs ($19 each).

## Product cover template

Make every pack cover from one template so the shop reads as a real brand:

- **Canvas:** 1600×1200 (4:3), background white or off-white.
- **Top-left:** Nichesmith mark (small).
- **Center headline (Forest `#14532D`, Inter 700):** the profession —
  e.g. "Real Estate Agent" / "Loan Officer".
- **Sub-headline (Ink):** "AI Prompt Pack".
- **Badge (Emerald pill, white text):** "50 Prompts".
- **Footer line (Slate):** "For ChatGPT · Gemini · Claude".
- Keep one emerald accent element per cover; everything else neutral.

## Voice & tone

- Lead with the **benefit**, not the feature ("write a listing in 60 seconds," not
  "50 prompts included" — though both can appear).
- Plain English, short sentences, confident. No hype words ("revolutionary"),
  no emojis in headlines (sparingly in listing bodies is fine).
- Always honest about what's inside (real counts, real format).

## Quick reference (copy/paste)

```
Accent  #1A7A4F
Forest  #14532D
Mint    #A7E3C4
Off-wht #F7F8F7
Ink     #111111
Slate   #5B6660
Font    Inter (600/700 headings, 400 body)
```

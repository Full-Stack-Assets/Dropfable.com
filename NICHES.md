# Niche shortlist & pre-screen

A pre-screened set of beachhead niches for the Nichesmith side hustle, scored
against a fixed rubric. Pick **one** to start (see [GTM.md](./GTM.md)).

> **Methodology note:** scores are a qualitative read of the digital-product
> market (Etsy/Gumroad), 1–5 per criterion. They are analyst estimates, not
> scraped data — use them to *rank*, then validate the top pick with live search
> data before committing. The point of the screen is to kill bad fits early, not
> to be precise.

## The rubric

Each niche is scored 1–5 on five criteria. The criteria are deliberately tilted
toward what *this* tool is good at.

| Criterion | What it measures | Why it matters here |
| --- | --- | --- |
| **Demand** | Are people actively buying digital products in this niche? | No demand = no amount of quality saves you |
| **WTP** | Willingness to pay / price power | Pros buying business tools pay more than consumers buying nice-to-haves |
| **Gap** | Room to beat mediocre incumbents | Saturation with *good* products is the killer, not saturation itself |
| **AI-fit** | Low design dependency, text-based deliverable | Nichesmith outputs **text**. Design-heavy niches need a tool it isn't |
| **Line** | Can you build a repeatable product line? | Margin lives in repeat buyers and vol. 2, not one-off hits |

Simple sum out of 25. Verdict: **Top pick / Strong / Consider / Skip.**

## Shortlist (revised after live validation, June 2026)

Scores below are **updated** from live web data (see the validation section).
The big correction: Etsy demand skews heavily toward *designed/Canva* assets, so
**AI-fit was over-scored** for design-forward niches and they drop. The format
Nichesmith actually wins — hyper-focused text — rises to the top.

| Niche | Demand | WTP | Gap | AI-fit | Line | Total | Verdict |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| **Hyper-niche AI prompt pack** (for a high-WTP profession) | 5 | 4 | 4 | 5 | 5 | **23** | ⭐ Top pick |
| Real estate agent marketing | 5 | 5 | 3 | 3 | 5 | 21 | Strong (text slice only) |
| Freelancer / solo-agency client ops | 4 | 4 | 4 | 5 | 4 | 21 | Strong (Gumroad-validated) |
| Fitness / nutrition coach business kit | 4 | 4 | 3 | 5 | 4 | 20 | Strong |
| Faith-based planners & devotionals | 4 | 3 | 4 | 4 | 5 | 20 | Strong (best B2C) |
| ADHD / neurodivergent productivity | 5 | 4 | 2 | 4 | 4 | 19 | Consider |
| Airbnb / short-term-rental host ops | 5 | 4 | 3 | 3 | 4 | 19 | Consider (text slice only) |
| Wedding planning (consumer) | 5 | 4 | 1 | 2 | 4 | 16 | Skip |
| Notion template buyers | 4 | 3 | 2 | 1 | 3 | 13 | Skip |

The bottom two are included on purpose to show the screen working: wedding and
Notion both have huge demand but **fail on AI-fit** — they're won with Canva
design and actual Notion builds, not generated text. Don't chase demand into a
format the tool can't serve.

## Live validation (June 2026)

What the market actually shows right now:

- **Etsy demand is design-skewed.** In every high-demand niche, the best-sellers
  are Canva/design bundles — real estate "social media kits, listing
  presentations, flyers"; Airbnb "beautifully designed Canva welcome books." This
  is the AI-fit trap in action: the money on Etsy often sits in *design*, not copy.
- **Hyper-niche AI prompt packs are a called-out winner** — they "perform
  exceptionally well," but "generic prompts no longer stand out; sellers winning
  create hyper-focused prompt packs." That is exactly Nichesmith's Prompt Pack
  format, and it's text-native (low design dependency). This is why it's now #1.
- **Niche-specific kits for underserved pros** (e.g. dog trainers, podcast
  creators) are flagged "high demand, low competition."
- **Freelancer client-ops templates are text-native and sell** — proposals,
  onboarding, scope, payment policies priced **$20–75/pack** with live Gumroad
  sales (50+ units on individual items). This validates the text-substance play,
  especially on Gumroad where buyers don't expect Canva design.
- **Real estate is real but more design-competitive than assumed.** 5,000+ items
  in the category; agents are high-value repeat buyers ("niche templates: ~40%
  less competition, ~20% higher price"). The *text* slice (listing descriptions,
  email/script kits, buyer-seller guides) is the part Nichesmith can own.

**The synthesis:** marry the high-WTP audience with the high-AI-fit format. A
**hyper-niche prompt pack aimed at a profession that pays** (lead candidate:
real estate agents) rides validated demand, sidesteps the Canva fight, and maxes
the tool's strength.

Sources:
- [Top selling digital products on Etsy 2026 — Outfy](https://www.outfy.com/blog/top-selling-digital-products-on-etsy/)
- [Best digital product niches 2026 — Inkfluence AI](https://www.inkfluenceai.com/blog/best-digital-product-niches-2026)
- [Etsy best-selling digital products trend tools 2026 — Insight Agent](https://www.insightagent.app/tools/etsy-best-selling-digital-products-trend-tools-2026)
- [Best-selling templates on Etsy — Insight Agent](https://www.insightagent.app/blog/best-selling-templates-etsy)
- [Real estate marketing templates — Etsy](https://www.etsy.com/market/real_estate_marketing_templates)
- [Airbnb welcome book template — Etsy](https://www.etsy.com/market/airbnb_welcome_book_template)
- [Best digital products to sell for beginners 2026 — Hustle Inspires Hustle](https://www.hustleinspireshustle.com/blog/digital-products-guide)
- [Client onboarding & offboarding kits — Gumroad](https://tanugandass.gumroad.com/l/clientskit)

## The picks, in detail

### ⭐ Hyper-niche AI prompt pack for a high-WTP profession — start here
- **Why:** the live data's clearest win — prompt packs sell well *when
  hyper-focused*, the format is pure text (perfect AI-fit), and it sidesteps the
  Canva-design competition that dominates Etsy. Targeting a profession that pays
  (realtors first) layers high willingness-to-pay on top.
- **Best product type:** Prompt Pack (Nichesmith makes exactly this — 50 prompts
  in 5 categories with `[VARIABLES]` and usage tips).
- **Flagship (week 1):** *"ChatGPT Prompt Pack for Real Estate Agents — listings,
  social, lead-gen & client comms."*
- **Ready-to-run Nichesmith input:**
  - Product: **Prompt Pack** (`productId: "prompts"`)
  - Niche: `Real estate agents`
  - Angle: `listing descriptions, Instagram/social captions, lead-gen follow-ups, and client emails; written for ChatGPT/Gemini with fill-in [VARIABLES]`
- **Line potential:** the same pack for every paying profession — loan officers,
  insurance agents, med spas, dentists, fitness coaches, recruiters, photographers
  — plus "vol. 2" expansions. One validated format, dozens of niches.
- **Watch-out:** generic prompt packs are dead. Win on hyper-focus and genuinely
  outcome-specific prompts; lightly QA every prompt before listing.

### Real estate agent marketing (text slice)
- **Why:** a massive, renewable audience that *pays to win listings* and returns
  for bundles. But Etsy demand here is design-heavy (social kits, flyers,
  presentations) — so own the **text** slice the tool is built for.
- **Best product types:** Template Pack, Swipe File, Website Generator.
- **Flagship:** *"Realtor Content Kit — 25 fill-in listing descriptions, client
  emails & open-house follow-ups."*
- **Watch-out:** you'll sit next to polished Canva bundles. Win on volume of
  genuinely usable, editable copy — or pair it with the prompt pack above as a
  two-product realtor line.

### Freelancer / solo-agency client ops
- **Why:** freelancers buy business tools that save time and look professional;
  100% text deliverables; healthy gap above the generic "proposal template" tier.
- **Product types:** Template Pack (proposals, onboarding, scope/pricing emails),
  Swipe File (cold outreach, follow-ups), Mini-Guide (pricing/positioning).
- **Flagship:** *"Freelance Client System — proposals, onboarding & follow-up
  scripts."*

### Fitness / nutrition coach business kit
- **Why:** sell *to coaches* (B2B, pays) rather than to dieters (saturated, cheap).
  Onboarding, check-in scripts, program-sale copy — all text.
- **Product types:** Template Pack, Checklist System, Swipe File.
- **Flagship:** *"Coach Client Toolkit — onboarding, check-in & retention scripts."*

### Airbnb / short-term-rental host ops
- **Why:** big, motivated buyers protecting real revenue. Lead with the *text*
  angle (guest message sequences, house-manual copy, SOP checklists) where supply
  is thinner — the "welcome book" slice is design-heavy and crowded, so avoid it.
- **Product types:** Template Pack (guest messages), Checklist System (turnover
  SOPs), Mini-Guide (pricing/superhost).
- **Flagship:** *"STR Host Message Kit — automated guest message sequences + SOPs."*

### Faith-based planners & devotionals (best consumer option)
- **Why:** if you'd rather sell B2C, this audience is loyal, repeat-buying, and
  text-friendly (devotionals, prompts, reflection planners), with room above the
  generic tier.
- **Product types:** Planner/Workbook, Mini-Guide, Prompt Pack.
- **Flagship:** *"30-Day Devotional Planner"* for a specific sub-audience (e.g.
  busy moms, men's groups, new believers).

## How to act on this

1. Pick the niche you can **judge quality in** — if you can't tell a good realtor
   prompt from generic, pick the one you can.
2. Run the flagship through Nichesmith using the ready-to-run input above. (Needs
   `GEMINI_API_KEY` set locally — it isn't present in the dev container, so run
   `npm run dev` on your machine with the key in `.env.local`.)
3. Follow [GTM.md](./GTM.md): one niche → one flagship → one channel → iterate on
   what sells. Channel note from validation: **Gumroad** suits text-first packs
   (no Canva expectation); **Etsy** brings search traffic but you compete beside
   design bundles — lead with prompt packs there, where design matters least.

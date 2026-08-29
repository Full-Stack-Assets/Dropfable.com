import assert from "node:assert/strict";
import { detectLocalFormat, localTrendIdeas, manufactureLocally, suggestNiches } from "../src/lib/localFactory";
import type { ProductType } from "../src/types";

const product = (id: string, name: string, code: string): ProductType => ({ id, name, code, spec: "", ico: null });

assert.equal(detectLocalFormat("AI prompt workflows"), "prompts");
assert.equal(detectLocalFormat("Cold email scripts"), "templates");
assert.equal(detectLocalFormat("Launch audit system"), "checklist");
assert.equal(detectLocalFormat("Beginner handbook"), "guide");
assert.equal(detectLocalFormat("Daily focus"), "planner");

assert.equal(suggestNiches("creator economy").length, 5);
const trends = localTrendIdeas("creator economy");
assert.equal(trends.length, 5);
assert.ok(trends.every((idea) => idea.source === "starter" && idea.whyTrending.startsWith("Demand-research starter:")));

const planner = manufactureLocally(product("planner", "Planner / Workbook", "30-day structure"), "independent consultants", "evidence-led", "English");
assert.match(planner.productContent, /### Day 30/);
assert.equal(planner.etsyEligible, true);
assert.equal(planner.etsyTags.length <= 13, true);

const prompts = manufactureLocally(product("prompts", "Prompt Pack (Gumroad only)", "50 copy-paste prompts"), "local retailers", "practical", "English");
assert.match(prompts.productContent, /50\. Act as a review specialist/);
assert.equal(prompts.etsyEligible, false);
assert.equal(prompts.etsyTitle, "Not eligible for Etsy");

const swipe = manufactureLocally(product("swipe", "Swipe File", "75 creative hooks"), "fitness coaches", "direct", "English");
assert.match(swipe.productContent, /75\./);

console.log("PASS local factory smoke");

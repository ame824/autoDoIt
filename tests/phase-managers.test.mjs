import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFactionPlan, parseFactionPlan } from "../lib/faction-plan.js";

const coordinatorRules = [
  ["../tasks/manage-factions.js", /ns\.singularity\./, "faction"],
  ["../tasks/manage-augmentations.js", /ns\.singularity\./, "augmentation"],
  ["../special/manage-sleeves.js", /ns\.sleeve\./, "sleeve"],
  ["../special/manage-bladeburner.js", /ns\.bladeburner\./, "bladeburner"],
  ["../special/manage-stocks.js", /ns\.stock\./, "stock"],
  ["../special/manage-ipvgo.js", /ns\.go(?:\.|\b)/, "ipvgo"],
];

for (const [file, forbidden, name] of coordinatorRules) {
  test(`${name} coordinator keeps its expensive API inside phase workers`, async () => {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, forbidden);
    assert.match(source, /workers\//);
  });
}

test("shared faction plan drives work and purchases from one augmentation scan", () => {
  const augmentations = {
    "Slum Snakes": ["Cheap", "Later", "NeuroFlux Governor"],
  };
  const requirements = { Cheap: 100, Later: 500, "NeuroFlux Governor": 1_000 };
  const prices = { Cheap: 10, Later: 20, "NeuroFlux Governor": 30 };
  const ns = { singularity: {
    getFactionRep: () => 150,
    getAugmentationsFromFaction: (faction) => augmentations[faction],
    getAugmentationRepReq: (name) => requirements[name],
    getAugmentationPrice: (name) => prices[name],
    getAugmentationPrereq: () => [],
  } };
  const plan = buildFactionPlan(ns, ["Slum Snakes"], new Set(), "Slum Snakes", 1_000);
  assert.equal(plan.purchaseTarget.name, "Cheap");
  assert.equal(plan.workTarget.name, "Later");
  assert.equal(plan.specificRemaining, 2);
  assert.equal(parseFactionPlan(JSON.stringify(plan), 2_000)?.workTarget.name, "Later");
  assert.equal(parseFactionPlan(JSON.stringify(plan), 200_000), null);
});

test("NeuroFlux work excludes the Gang faction while purchase may still use it", () => {
  const ns = { singularity: {
    getFactionRep: (faction) => faction === "Slum Snakes" ? 2_000 : 1_500,
    getAugmentationsFromFaction: () => ["NeuroFlux Governor"],
    getAugmentationRepReq: () => 1_000,
    getAugmentationPrice: () => 30,
    getAugmentationPrereq: () => [],
  } };
  const plan = buildFactionPlan(ns, ["Slum Snakes", "CyberSec"], new Set(), "Slum Snakes", 1_000);
  assert.equal(plan.purchaseTarget.faction, "Slum Snakes");
  assert.equal(plan.workTarget.faction, "CyberSec");
  assert.equal(plan.workTarget.neuroFluxStage, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveAugmentationThreshold,
  chooseCriticalAugmentation,
  createNodeRushState,
  extractCriticalRequirements,
  parseNodeRushState,
  spendableMoney,
} from "../lib/node-rush.js";

test("Daedalus API requirements choose autoDoIt's hacking alternative", () => {
  const requirements = extractCriticalRequirements([
    { type: "money", money: 100e9 },
    { type: "numAugmentations", numAugmentations: 30 },
    { type: "someCondition", conditions: [
      { type: "skills", skills: { strength: 1_500, defense: 1_500 } },
      { type: "skills", skills: { hacking: 2_500 } },
    ] },
  ]);
  assert.deepEqual(requirements, { money: 100e9, hacking: 2_500, augmentations: 30 });
});

test("critical path protects Daedalus money and starts XP at the final quarter", () => {
  const common = {
    currentNode: 1,
    installedAugmentations: 30,
    daedalusRequirements: { money: 100e9, hacking: 2_500, augmentations: 30 },
  };
  const money = createNodeRushState({ ...common, playerMoney: 80e9, hackingLevel: 2_500 });
  assert.equal(money.stage, "daedalus-money");
  assert.equal(spendableMoney(80e9, money), 0);

  const early = createNodeRushState({ ...common, playerMoney: 100e9, hackingLevel: 1_700 });
  assert.equal(early.stage, "daedalus-hacking");
  assert.equal(early.xpOnly, false);

  const sprint = createNodeRushState({ ...common, playerMoney: 100e9, hackingLevel: 1_875 });
  assert.equal(sprint.xpOnly, true);
  assert.equal(sprint.targetHacking, 2_500);
});

test("Red Pill and World Demon stages override ordinary progression", () => {
  assert.equal(createNodeRushState({ joinedDaedalus: true }).stage, "red-pill");
  const sprint = createNodeRushState({
    hasRedPill: true,
    hackingLevel: 4_500,
    worldDaemonRequiredLevel: 6_000,
  });
  assert.equal(sprint.stage, "world-daemon-hacking");
  assert.equal(sprint.xpOnly, true);
});

test("adaptive resets are quick early, patient in BN8/BN9, and decay on slow runs", () => {
  assert.equal(adaptiveAugmentationThreshold({ elapsedSinceNodeReset: 10 * 60_000 }), 4);
  assert.equal(adaptiveAugmentationThreshold({
    elapsedSinceNodeReset: 3 * 60 * 60_000,
    elapsedSinceAugReset: 3 * 60 * 60_000,
  }), 3);
  assert.equal(adaptiveAugmentationThreshold({ currentNode: 8 }), 7);
  assert.equal(adaptiveAugmentationThreshold({ currentNode: 9, installedCount: 0 }), 7);
  assert.equal(adaptiveAugmentationThreshold({
    currentNode: 8,
    elapsedSinceNodeReset: 4 * 60 * 60_000,
    elapsedSinceAugReset: 4 * 60 * 60_000,
  }), 3);
});

test("The Red Pill overrides cheaper ordinary augmentations", () => {
  const target = chooseCriticalAugmentation([
    { name: "Cheap", prerequisitesMet: true, gap: 0, price: 1 },
    { name: "The Red Pill", prerequisitesMet: true, gap: 100, price: 10 },
  ]);
  assert.equal(target.name, "The Red Pill");
});

test("node rush state expires so stale reserves cannot lock player money", () => {
  const state = createNodeRushState({ now: 1_000 });
  assert.equal(parseNodeRushState(JSON.stringify(state), 20_000)?.stage, "augmentations");
  assert.equal(parseNodeRushState(JSON.stringify(state), 40_000), null);
});

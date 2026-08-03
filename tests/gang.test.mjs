import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  chooseGangTaskPlan,
  createGangReputationGoal,
  parseGangReputationGoal,
  wantedWorkerCount,
} from "../lib/gang-logic.js";

function members(count, primary = 500, isHacking = true) {
  return Array.from({ length: count }, (_, index) => ({
    name: `member-${index + 1}`,
    hack: isHacking ? primary + index : 0,
    str: primary + index,
    def: primary + index,
    dex: primary + index,
    agi: primary + index,
  }));
}

test("gang augmentation targets are serialized only for the active gang faction", () => {
  const target = {
    faction: "Slum Snakes",
    augmentation: "Bionic Arms",
    requirement: 100_000,
    factionRep: 25_000,
  };
  assert.deepEqual(createGangReputationGoal(target, "Slum Snakes", 1_000), {
    ...target,
    updatedAt: 1_000,
  });
  assert.equal(createGangReputationGoal(target, "Tetrads", 1_000), null);
  assert.equal(createGangReputationGoal({ ...target, factionRep: 100_000 }, "Slum Snakes", 1_000), null);
  assert.equal(createGangReputationGoal({ ...target, neuroFluxStage: true }, "Slum Snakes", 1_000), null);
});

test("gang augmentation targets expire and never leak into a different gang", () => {
  const raw = JSON.stringify({
    faction: "Slum Snakes",
    augmentation: "Bionic Arms",
    requirement: 100_000,
    factionRep: 25_000,
    updatedAt: 1_000,
  });
  assert.equal(parseGangReputationGoal(raw, "Tetrads", 2_000), null);
  assert.equal(parseGangReputationGoal(raw, "Slum Snakes", 200_000), null);
  assert.equal(parseGangReputationGoal(raw, "Slum Snakes", 2_000)?.augmentation, "Bionic Arms");
});

test("gang reputation goal keeps productive members on respect instead of money", () => {
  const plan = chooseGangTaskPlan({
    gang: {
      isHacking: true,
      respect: 1e9,
      respectForNextRecruit: Infinity,
      wantedPenalty: 1,
      wantedLevelGainRate: 0,
    },
    members: members(12),
    reputationGoal: { augmentation: "Bionic Arms" },
  });
  assert.equal(plan.respectCount, 12);
  assert.equal(plan.moneyCount, 0);
  assert.equal(plan.allowAscension, true);
});

test("recruitment respect is protected from premature ascensions", () => {
  const plan = chooseGangTaskPlan({
    gang: {
      isHacking: false,
      respect: 50,
      respectForNextRecruit: 100,
      wantedPenalty: 1,
      wantedLevelGainRate: 0,
    },
    members: members(6, 500, false),
  });
  assert.equal(plan.recruiting, true);
  assert.equal(plan.respectCount, 6);
  assert.equal(plan.allowAscension, false);
});

test("wanted control remains bounded so reputation cannot stall completely", () => {
  assert.equal(wantedWorkerCount({ wantedPenalty: 0.4 }, 12), 9);
  assert.equal(wantedWorkerCount({ wantedPenalty: 0.4 }, 1), 0);
  const plan = chooseGangTaskPlan({
    gang: {
      isHacking: true,
      respect: 1e9,
      respectForNextRecruit: Infinity,
      wantedPenalty: 0.4,
      wantedLevelGainRate: 10,
    },
    members: members(12),
    reputationGoal: { augmentation: "Bionic Arms" },
  });
  assert.equal(plan.wantedCount, 9);
  assert.equal(plan.respectCount, 3);
});

test("the Gang coordinator keeps expensive Gang APIs inside short-lived workers", async () => {
  const source = await readFile(new URL("../special/manage-gang.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ns\.gang\./);
  assert.match(source, /workers\/gang-bootstrap\.js/);
  assert.match(source, /workers\/gang-assignments\.js/);
  assert.match(source, /workers\/gang-equipment\.js/);
  assert.match(source, /workers\/gang-territory\.js/);
});

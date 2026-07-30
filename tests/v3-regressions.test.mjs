import test from "node:test";
import assert from "node:assert/strict";
import { getIndustryStartingCost } from "../special/manage-corporation.js";
import { chooseAction, spendSkillPoints } from "../special/manage-bladeburner.js";
import { serverSnapshot } from "../tasks/manage-hacking.js";

test("reads the v3 corporation industry startingCost property", () => {
  assert.equal(getIndustryStartingCost({ startingCost: 40e9 }), 40e9);
  assert.equal(getIndustryStartingCost({ cost: 40e9 }), Infinity);
});

test("uses v3 Bladeburner action enum values", () => {
  const seenTypes = [];
  const ns = {
    enums: {
      BladeburnerActionType: {
        General: "General",
        Contract: "Contracts",
        Operation: "Operations",
        BlackOp: "Black Operations",
      },
    },
    bladeburner: {
      getStamina: () => [100, 100],
      getCity: () => "Sector-12",
      getCityChaos: () => 0,
      getNextBlackOp: () => null,
      getOperationNames: () => ["Investigation"],
      getContractNames: () => [],
      getActionCountRemaining: (type) => {
        seenTypes.push(type);
        return 1;
      },
      getActionEstimatedSuccessChance: () => [0.9, 0.95],
      getActionRankGain: () => 1,
      getActionTime: () => 1_000,
    },
  };

  const action = chooseAction(ns);
  assert.equal(action.type, "Operations");
  assert.deepEqual(seenTypes, ["Operations"]);
});

test("Bladeburner spending drains a large point backlog with batched v3 upgrades", () => {
  const levels = { Alpha: 0, Beta: 0, Gamma: 0 };
  let points = 250_000;
  const purchases = [];
  const multiplier = { Alpha: 1, Beta: 2, Gamma: 4 };
  const cost = (name, count) => {
    let total = 0;
    for (let offset = 1; offset <= count; offset += 1) {
      total += multiplier[name] * (levels[name] + offset);
    }
    return total;
  };
  const bladeburner = {
    getSkillNames: () => Object.keys(levels),
    getSkillPoints: () => points,
    getSkillUpgradeCost: (name, count = 1) => cost(name, count),
    upgradeSkill: (name, count = 1) => {
      const price = cost(name, count);
      if (price > points) return false;
      points -= price;
      levels[name] += count;
      purchases.push({ name, count });
      return true;
    },
  };

  const result = spendSkillPoints(bladeburner);
  const cheapestRemaining = Math.min(
    ...Object.keys(levels).map((name) => cost(name, 1)),
  );
  assert.equal(result.drained, true);
  assert.ok(points < cheapestRemaining);
  assert.ok(result.upgrades > 100);
  assert.ok(purchases.some(({ count }) => count > 1));
  assert.ok(purchases.length < result.upgrades / 2);
});

test("does not call money or hacking APIs for Hacknet servers", () => {
  const forbidden = () => {
    throw new Error("must not be called for a Hacknet server");
  };
  const ns = {
    getServer: () => ({
      hostname: "hacknet-server-0",
      purchasedByPlayer: true,
      hasAdminRights: true,
    }),
    getServerMaxMoney: forbidden,
    getServerRequiredHackingLevel: forbidden,
    getWeakenTime: forbidden,
    hackAnalyzeChance: forbidden,
  };

  assert.deepEqual(serverSnapshot(ns, "hacknet-server-0", 100), {
    host: "hacknet-server-0",
    rooted: true,
    maxMoney: 0,
    requiredLevel: Infinity,
    hackingLevel: 100,
    weakenTime: Infinity,
    hackChance: 0,
  });
});

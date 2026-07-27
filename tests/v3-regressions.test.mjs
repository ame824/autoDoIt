import test from "node:test";
import assert from "node:assert/strict";
import { getIndustryStartingCost } from "../special/manage-corporation.js";
import { chooseAction } from "../special/manage-bladeburner.js";
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

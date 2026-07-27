import test from "node:test";
import assert from "node:assert/strict";
import {
  affordable,
  calculateHomeReserve,
  chooseFactionWorkType,
  chooseNextBitNode,
  hasApiAccess,
  selectBestTarget,
  selectHackingAction,
  sourceFileLevel,
} from "../lib/logic.js";

test("reads source file levels from the v3 Map shape", () => {
  const reset = { currentNode: 1, ownedSF: new Map([[4, 2]]) };
  assert.equal(sourceFileLevel(reset, 4), 2);
  assert.equal(sourceFileLevel(reset, 2), 0);
});

test("grants API access inside its BitNode or through a Source-File", () => {
  assert.equal(hasApiAccess({ currentNode: 4, ownedSF: new Map() }, [4], [4]), true);
  assert.equal(hasApiAccess({ currentNode: 1, ownedSF: new Map([[4, 1]]) }, [4], [4]), true);
  assert.equal(hasApiAccess({ currentNode: 1, ownedSF: new Map() }, [4], [4]), false);
});

test("keeps a small dynamic home RAM reserve", () => {
  assert.equal(calculateHomeReserve(8), 2);
  assert.equal(calculateHomeReserve(128), 12.8);
  assert.equal(calculateHomeReserve(1024), 32);
});

test("selects weaken, grow, and hack in priority order", () => {
  const config = { securityTolerance: 5, growMoneyThreshold: 0.75 };
  assert.equal(
    selectHackingAction({ security: 20, minSecurity: 10, money: 100, maxMoney: 100 }, config),
    "weaken",
  );
  assert.equal(
    selectHackingAction({ security: 12, minSecurity: 10, money: 50, maxMoney: 100 }, config),
    "grow",
  );
  assert.equal(
    selectHackingAction({ security: 12, minSecurity: 10, money: 90, maxMoney: 100 }, config),
    "hack",
  );
});

test("selects only a rooted and hackable money target", () => {
  const common = { hackingLevel: 50, weakenTime: 1_000, hackChance: 1 };
  const target = selectBestTarget([
    { ...common, host: "locked", rooted: false, maxMoney: 1e12, requiredLevel: 1 },
    { ...common, host: "hard", rooted: true, maxMoney: 1e12, requiredLevel: 100 },
    { ...common, host: "valid", rooted: true, maxMoney: 1e6, requiredLevel: 1 },
  ]);
  assert.equal(target.host, "valid");
});

test("prefers hacking faction work and falls back safely", () => {
  assert.equal(chooseFactionWorkType(["field", "hacking"]), "hacking");
  assert.equal(chooseFactionWorkType(["security"]), "security");
  assert.equal(chooseFactionWorkType([]), null);
});

test("chooses the first not-maxed BitNode and never re-enters the current one", () => {
  const reset = { currentNode: 4, ownedSF: new Map([[4, 1], [5, 3]]) };
  assert.equal(chooseNextBitNode(reset, [4, 5, 10]), 10);
});

test("budget helper respects fractions and reserves", () => {
  assert.equal(affordable(100, 1_000, 0.2), true);
  assert.equal(affordable(250, 1_000, 0.2), false);
  assert.equal(affordable(150, 1_000, 0.2, 100), false);
});


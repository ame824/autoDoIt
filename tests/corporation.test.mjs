import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  boostMaterialTargets,
  jobAllocation,
  nextCorporationPhase,
  officeTargetSize,
  productInvestment,
  shouldAcceptInvestment,
} from "../lib/corporation-logic.js";

test("Corporation phases wrap around without running concurrently", () => {
  assert.equal(nextCorporationPhase(0, 11), 1);
  assert.equal(nextCorporationPhase(10, 11), 0);
});

test("Corporation offices assign every employee to productive work", () => {
  for (const [size, products, headquarters] of [[6, false, false], [30, true, true], [17, true, false]]) {
    const allocation = jobAllocation(size, products, headquarters);
    assert.equal(Object.values(allocation).reduce((sum, amount) => sum + amount, 0), size);
    assert.ok(Object.values(allocation).every((amount) => Number.isInteger(amount) && amount >= 0));
  }
  assert.ok(officeTargetSize({ makesProducts: true }, "Aevum", 1e15) > 30);
});

test("boost material targets reserve warehouse space and follow industry factors", () => {
  const targets = boostMaterialTargets({
    hardwareFactor: 0.2,
    robotFactor: 0.1,
    aiCoreFactor: 0.3,
    realEstateFactor: 0.4,
  }, 1_000, {
    Hardware: 1,
    Robots: 1,
    "AI Cores": 1,
    "Real Estate": 1,
  });
  assert.equal(Object.values(targets).reduce((sum, amount) => sum + amount, 0), 550);
  assert.ok(targets["Real Estate"] > targets.Hardware);
  assert.ok(targets["AI Cores"] > targets.Robots);
});

test("investment and product budgets accelerate growth without spending the treasury", () => {
  assert.equal(shouldAcceptInvestment({ round: 1, funds: 30e9 }, { funds: 1e9, revenue: 0, expenses: 0 }), true);
  assert.equal(shouldAcceptInvestment({ round: 4, funds: 1e12 }, { funds: 1e12, revenue: 1e12, expenses: 0 }), false);
  assert.equal(productInvestment(100e9, 0), 1e9);
  assert.ok(productInvestment(1e15, 1e12) <= 1e15 * 0.02);
});

test("the Corporation coordinator only dispatches one specialized phase", async () => {
  const manager = await readFile(new URL("../special/manage-corporation.js", import.meta.url), "utf8");
  assert.match(manager, /const PHASES = Object\.freeze/);
  assert.match(manager, /const file = PHASES\[phase\]/);
  assert.match(manager, /ns\.run\(file, 1\)/);
  for (const expensiveApi of [
    "getCorporation",
    "expandIndustry",
    "expandCity",
    "getOffice",
    "getWarehouse",
    "getInvestmentOffer",
    "getMaterial",
    "research",
    "makeProduct",
  ]) {
    assert.equal(manager.includes(`ns.corporation.${expensiveApi}(`), false);
  }
});

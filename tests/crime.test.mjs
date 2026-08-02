import test from "node:test";
import assert from "node:assert/strict";
import {
  CRIMES,
  CRIME_GOAL,
  analyzeCrime,
  chooseCrime,
  determineCrimeGoal,
  estimateCrimeChance,
} from "../lib/crime-logic.js";

const player = {
  money: 0,
  karma: 0,
  skills: { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1, intelligence: 0 },
  mults: { crime_success: 1, strength_exp: 1, defense_exp: 1, dexterity_exp: 1, agility_exp: 1 },
};

test("crime chance estimator matches the v3 weighted skill formula", () => {
  const mug = CRIMES.find(({ name }) => name === "Mug").stats;
  const skilled = { ...player, skills: { ...player.skills, strength: 100, defense: 100, dexterity: 100, agility: 100 } };
  const chance = estimateCrimeChance(skilled, mug, 1);
  assert.equal(chance, 1);
  assert.ok(Math.abs(estimateCrimeChance(skilled, mug, 14) - 400 / 975 / (1 / 5) * 0.4) < 1e-12);
});

test("expected value accounts for failures and duration", () => {
  const result = analyzeCrime("Test", {
    time: 2_000, money: 1_000, karma: 4, kills: 1,
    strength_exp: 8, defense_exp: 0, dexterity_exp: 0, agility_exp: 0,
  }, 0.5, player, 100);
  assert.equal(result.moneyPerSecond, 250);
  assert.equal(result.karmaPerSecond, 1.25);
  assert.equal(result.killsPerSecond, 0.25);
  assert.ok(result.combatExpPerSecond > 0);
});

test("goal-specific selection is not a hard-coded Homicide loop", () => {
  const candidates = [
    { name: "Fast money", chance: 1, moneyPerSecond: 100, karmaPerSecond: 1, killsPerSecond: 0, combatExpPerSecond: 1 },
    { name: "Fast karma", chance: 1, moneyPerSecond: 1, karmaPerSecond: 10, killsPerSecond: 0.1, combatExpPerSecond: 2 },
    { name: "Training", chance: 1, moneyPerSecond: 2, karmaPerSecond: 2, killsPerSecond: 0, combatExpPerSecond: 20 },
  ];
  assert.equal(chooseCrime(candidates, CRIME_GOAL.money).name, "Fast money");
  assert.equal(chooseCrime(candidates, CRIME_GOAL.karma).name, "Fast karma");
  assert.equal(chooseCrime(candidates, CRIME_GOAL.combat).name, "Training");
});

test("crime goals follow progression and do not steal normal work indefinitely", () => {
  assert.deepEqual(determineCrimeGoal({ currentNode: 2, gangAvailable: true, inGang: false, karma: -1, money: 1e9, skills: player.skills }), {
    type: CRIME_GOAL.karma, urgent: true, reason: "gang",
  });
  assert.deepEqual(determineCrimeGoal({ currentNode: 6, gangAvailable: false, karma: -54_000, money: 1e9, skills: player.skills }), {
    type: CRIME_GOAL.combat, urgent: true, reason: "bladeburner",
  });
  assert.equal(determineCrimeGoal({ currentNode: 1, money: 2e6, skills: { strength: 100, defense: 100, dexterity: 100, agility: 100 } }), null);
});

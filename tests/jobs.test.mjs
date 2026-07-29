import test from "node:test";
import assert from "node:assert/strict";
import { chooseJobPlan, main as checkJob } from "../tasks/check-job.js";
import { chooseManualJobRecommendation } from "../lib/job-advisor.js";

function createNs({
  currentNode = 1,
  ownedSF = new Map(),
  jobs = {},
  city = "Sector-12",
  skills = {
    hacking: 1,
    strength: 1,
    defense: 1,
    dexterity: 1,
    agility: 1,
    charisma: 1,
  },
} = {}) {
  const files = new Map();
  const terminal = [];
  return {
    files,
    terminal,
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getPlayer: () => ({ jobs, city, skills, mults: { work_money: 1 } }),
    getResetInfo: () => ({ currentNode, ownedSF }),
    format: { number: (value) => Number(value).toFixed(0) },
    toast: () => {},
    tprint: (message) => terminal.push(String(message)),
  };
}

test("early job plan prefers Software and falls back to IT", () => {
  assert.deepEqual(chooseJobPlan({ jobs: {} }), {
    currentCompany: "",
    currentPosition: "",
    preferredField: "Software",
    fallbackField: "IT",
  });
});

test("fresh BN1 receives one concrete manual job decision", async () => {
  const ns = createNs();
  await checkJob(ns);

  assert.equal(ns.terminal.length, 1);
  assert.match(ns.terminal[0], /FoodNStuff/);
  assert.match(ns.terminal[0], /Employee/);
  assert.match(ns.terminal[0], /110 pro Sekunde/);
});

test("manual advisor picks the highest-paying safe v3 entry job for current stats", () => {
  const recommendation = chooseManualJobRecommendation({
    jobs: {},
    city: "Sector-12",
    skills: {
      hacking: 100,
      strength: 1,
      defense: 1,
      dexterity: 1,
      agility: 1,
      charisma: 100,
    },
    mults: { work_money: 2 },
  });

  assert.equal(recommendation.company, "Omega Software");
  assert.equal(recommendation.position, "Software Consultant");
  assert.equal(recommendation.city, "Ishima");
  assert.ok(Math.abs(recommendation.estimatedSalaryPerSecond - 726) < 0.0001);
});

test("manual advisor keeps a more valuable job the player already owns", () => {
  const recommendation = chooseManualJobRecommendation({
    jobs: { ECorp: "Chief Technology Officer" },
    city: "Aevum",
    skills: {
      hacking: 1_000,
      strength: 1_000,
      defense: 1_000,
      dexterity: 1_000,
      agility: 1_000,
      charisma: 1_000,
    },
    mults: { work_money: 1 },
  });

  assert.equal(recommendation.kind, "current");
  assert.equal(recommendation.company, "ECorp");
  assert.equal(recommendation.position, "Chief Technology Officer");
});

test("Source-File 4 switches the early check to automatic job control", async () => {
  const ns = createNs({ ownedSF: new Map([[4, 1]]) });
  await checkJob(ns);

  assert.equal(ns.terminal.length, 0);
  const status = [...ns.files.values()].find((value) =>
    String(value).includes("Automatische Jobsteuerung verfügbar")
  );
  assert.ok(status);
});

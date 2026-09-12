import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildFactionPlan, parseFactionPlan } from "../lib/faction-plan.js";
import {
  main as factionWork,
  isCharismaGoalStage,
  isHackingGoalStage,
} from "../workers/faction-work.js";
import { NODE_RUSH_STATE_FILE } from "../lib/node-rush.js";

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

test("Hacking end stages override ordinary faction work with the v3 Algorithms course", async () => {
  assert.equal(isHackingGoalStage({ stage: "world-daemon-hacking" }), true);
  assert.equal(isHackingGoalStage({ stage: "daedalus-hacking" }), true);
  assert.equal(isHackingGoalStage({ stage: "augmentations" }), false);

  const files = new Map([[NODE_RUSH_STATE_FILE, JSON.stringify({
    updatedAt: Date.now(),
    currentNode: 4,
    stage: "world-daemon-hacking",
    targetHacking: 9_000,
  })]]);
  const calls = [];
  const ns = {
    enums: {
      CityName: { Aevum: "Aevum", Sector12: "Sector-12", Volhaven: "Volhaven" },
      LocationName: {
        AevumSummitUniversity: "Summit University",
        Sector12RothmanUniversity: "Rothman University",
        VolhavenZBInstituteOfTechnology: "ZB Institute of Technology",
      },
      UniversityClassType: { algorithms: "Algorithms" },
    },
    singularity: {
      getCurrentWork: () => ({ type: "FACTION", factionName: "CyberSec" }),
      universityCourse: (...args) => { calls.push(args); return true; },
      travelToCity: () => { throw new Error("Aevum already has a university"); },
      getFactionWorkTypes: () => { throw new Error("ordinary faction work must stay paused"); },
      workForFaction: () => { throw new Error("ordinary faction work must stay paused"); },
    },
    getPlayer: () => ({ city: "Aevum" }),
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    format: { number: (value) => String(value) },
    tprint: () => {},
    toast: () => {},
  };

  await factionWork(ns);
  assert.deepEqual(calls, [["Summit University", "Algorithms", false]]);
});

test("BN15 Charisma preparation overrides ordinary work with Leadership", async () => {
  assert.equal(isCharismaGoalStage({ stage: "labyrinth-charisma" }), true);
  assert.equal(isCharismaGoalStage({ stage: "labyrinth" }), false);
  const files = new Map([[NODE_RUSH_STATE_FILE, JSON.stringify({
    updatedAt: Date.now(),
    currentNode: 15,
    stage: "labyrinth-charisma",
    targetCharisma: 600,
  })]]);
  const calls = [];
  const travel = [];
  const ns = {
    enums: {
      CityName: { Aevum: "Aevum", Sector12: "Sector-12", Volhaven: "Volhaven" },
      LocationName: {
        AevumSummitUniversity: "Summit University",
        Sector12RothmanUniversity: "Rothman University",
        VolhavenZBInstituteOfTechnology: "ZB Institute of Technology",
      },
      UniversityClassType: { algorithms: "Algorithms", leadership: "Leadership" },
    },
    singularity: {
      getCurrentWork: () => ({ type: "FACTION", factionName: "CyberSec" }),
      universityCourse: (...args) => { calls.push(args); return true; },
      travelToCity: (city) => { travel.push(city); return true; },
      getFactionWorkTypes: () => { throw new Error("ordinary faction work must stay paused"); },
      workForFaction: () => { throw new Error("ordinary faction work must stay paused"); },
    },
    getPlayer: () => ({ city: "Aevum", skills: { charisma: 200 } }),
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    format: { number: (value) => String(value) },
    tprint: () => {},
    toast: () => {},
  };

  await factionWork(ns);
  assert.deepEqual(travel, ["Volhaven"]);
  assert.deepEqual(calls, [["ZB Institute of Technology", "Leadership", false]]);
});

test("BN15 Charisma training keeps a local Leadership fallback without travel money", async () => {
  const files = new Map([[NODE_RUSH_STATE_FILE, JSON.stringify({
    updatedAt: Date.now(), currentNode: 15, stage: "labyrinth-charisma", targetCharisma: 600,
  })]]);
  const calls = [];
  const ns = {
    enums: {
      CityName: { Aevum: "Aevum", Sector12: "Sector-12", Volhaven: "Volhaven" },
      LocationName: {
        AevumSummitUniversity: "Summit University",
        Sector12RothmanUniversity: "Rothman University",
        VolhavenZBInstituteOfTechnology: "ZB Institute of Technology",
      },
      UniversityClassType: { leadership: "Leadership" },
    },
    singularity: {
      getCurrentWork: () => ({ type: "FACTION", factionName: "CyberSec" }),
      travelToCity: () => false,
      universityCourse: (...args) => { calls.push(args); return true; },
    },
    getPlayer: () => ({ city: "Sector-12", skills: { charisma: 200 } }),
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    format: { number: String },
    tprint: () => {},
    toast: () => {},
  };

  await factionWork(ns);
  assert.deepEqual(calls, [["Rothman University", "Leadership", false]]);
});

test("synchronized Sleeves reinforce the BN15 Leadership goal", async () => {
  const source = await readFile(new URL("../workers/sleeve-tasks.js", import.meta.url), "utf8");
  assert.match(source, /stage === "labyrinth-charisma"/);
  assert.match(source, /setToUniversityCourse\(index, university, leadership\)/);
  assert.match(source, /shock > 0[\s\S]+sync < 100[\s\S]+trainCharisma/);
});

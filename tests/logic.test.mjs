import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, TASKS } from "../core/config.js";
import {
  affordable,
  calculateHomeReserve,
  chooseFactionWorkType,
  chooseNextBitNode,
  hasApiAccess,
  projectedSourceFileLevel,
  selectBestTarget,
  selectHackingAction,
  sourceFileLevel,
} from "../lib/logic.js";
import {
  SCHEDULER_MODE,
  isLightweightMode,
  schedulerMode,
  sortTasksForMode,
  taskFitsRam,
  taskRamCapacity,
  tasksForMode,
} from "../lib/scheduler-mode.js";

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

test("full-operation hacking favors progression targets without abandoning income", () => {
  const common = { rooted: true, hackingLevel: 100, hackChance: 1, weakenTime: 100 };
  const servers = [
    { ...common, host: "cash", maxMoney: 1_000, requiredLevel: 1 },
    { ...common, host: "progress", maxMoney: 800, requiredLevel: 100 },
  ];
  assert.equal(selectBestTarget(servers, false).host, "cash");
  assert.equal(selectBestTarget(servers, true).host, "progress");
});

test("prefers hacking faction work and falls back safely", () => {
  assert.equal(chooseFactionWorkType(["field", "hacking"]), "hacking");
  assert.equal(chooseFactionWorkType(["security"]), "security");
  assert.equal(chooseFactionWorkType([]), null);
});

test("projects the Source-File earned by the imminent BitNode completion", () => {
  const reset = { currentNode: 4, ownedSF: new Map([[4, 1]]) };
  assert.equal(projectedSourceFileLevel(reset, 4), 2);
  assert.equal(projectedSourceFileLevel(reset, 5), 0);
});

test("automation-first routing repeats BN4 exactly until projected SF4.3", () => {
  assert.equal(CONFIG.bitNodeOrder[0], 4);
  assert.deepEqual(
    new Set(CONFIG.bitNodeOrder),
    new Set(Array.from({ length: 15 }, (_value, index) => index + 1)),
  );
  const route = [4, 5, 10];
  assert.equal(chooseNextBitNode(
    { currentNode: 4, ownedSF: new Map() },
    route,
  ), 4);
  assert.equal(chooseNextBitNode(
    { currentNode: 4, ownedSF: new Map([[4, 1]]) },
    route,
  ), 4);
  assert.equal(chooseNextBitNode(
    { currentNode: 4, ownedSF: new Map([[4, 2]]) },
    route,
  ), 5);
});

test("discovers every missing Source-File before repeating owned BitNodes", () => {
  const reset = { currentNode: 10, ownedSF: new Map([[4, 3]]) };
  assert.equal(chooseNextBitNode(reset, [4, 5, 10, 2]), 5);

  const allDiscovered = {
    currentNode: 10,
    ownedSF: new Map([[4, 3], [5, 1], [2, 1]]),
  };
  assert.equal(chooseNextBitNode(allDiscovered, [4, 5, 10, 2]), 5);
});
test("budget helper respects fractions and reserves", () => {
  assert.equal(affordable(100, 1_000, 0.2), true);
  assert.equal(affordable(250, 1_000, 0.2), false);
  assert.equal(affordable(150, 1_000, 0.2, 100), false);
});

test("scheduler enters its dynamic middle phase at half the RAM goal", () => {
  const tasks = [
    { file: "hack", priority: 10, lightweight: true, lightweightPriority: 100 },
    { file: "progress", priority: 20, medium: true, mediumPriority: 110 },
    { file: "gang", priority: 90, bitNodes: [2], mediumPriority: 105 },
    { file: "corp", priority: 80, bitNodes: [3], mediumPriority: 105 },
  ];

  assert.equal(isLightweightMode(127, 128), true);
  assert.equal(isLightweightMode(128, 128), false);
  assert.deepEqual(tasksForMode(tasks, true).map(({ file }) => file), ["hack"]);
  assert.deepEqual(
    tasksForMode(tasks, SCHEDULER_MODE.medium, 2).map(({ file }) => file),
    ["hack", "progress", "gang"],
  );
  assert.deepEqual(
    tasksForMode(tasks, SCHEDULER_MODE.medium, 3).map(({ file }) => file),
    ["hack", "progress", "corp"],
  );
  assert.equal(sortTasksForMode(tasks, true)[0].file, "hack");
  assert.equal(sortTasksForMode(tasks, SCHEDULER_MODE.medium)[0].file, "progress");
});

test("real lightweight profile keeps income and RAM expansion while excluding heavy modules", () => {
  const files = tasksForMode(TASKS, true).map(({ file }) => file);
  assert.equal(CONFIG.lightweightMaxTasksPerTick, 1);
  assert.ok(files.includes("/tasks/manage-hacking.js"));
  assert.ok(files.includes("/tasks/manage-home-ram.js"));
  assert.ok(!files.includes("/tasks/manage-home.js"));
  assert.ok(files.includes("/tasks/manage-purchased-servers.js"));
  assert.ok(files.includes("/tasks/manage-hacknet.js"));
  assert.ok(files.includes("/tasks/manage-jobs.js"));
  assert.ok(files.includes("/special/manage-contracts.js"));
  assert.ok(!files.includes("/special/manage-exploits.js"));
  assert.ok(!files.includes("/tasks/manage-factions.js"));
  assert.ok(!files.includes("/special/manage-darknet.js"));

  const ordered = sortTasksForMode(tasksForMode(TASKS, true), true);
  const hacking = ordered.findIndex(({ file }) => file === "/tasks/manage-hacking.js");
  const root = ordered.findIndex(({ file }) => file === "/tasks/root-network.js");
  const programs = ordered.findIndex(({ file }) => file === "/tasks/manage-programs.js");
  const deploy = ordered.findIndex(({ file }) => file === "/tasks/deploy-workers.js");
  assert.ok(programs >= 0 && programs < root);
  assert.ok(root < deploy);
  assert.ok(deploy < hacking);
});

test("scheduler uses bootstrap, light, medium, and full dynamic phases", () => {
  assert.equal(schedulerMode(8, 32, 512, 1_024), SCHEDULER_MODE.bootstrap);
  assert.equal(schedulerMode(32, 32, 512, 1_024), SCHEDULER_MODE.lightweight);
  assert.equal(schedulerMode(512, 32, 512, 1_024), SCHEDULER_MODE.medium);
  assert.equal(schedulerMode(1_024, 32, 512, 1_024), SCHEDULER_MODE.full);

  const files = tasksForMode(TASKS, SCHEDULER_MODE.bootstrap).map(({ file }) => file);
  assert.deepEqual(new Set(files), new Set([
    "/tasks/check-home-ram.js",
    "/tasks/check-job.js",
    "/tasks/root-network.js",
    "/tasks/deploy-workers.js",
    "/tasks/manage-hacking-lite.js",
  ]));
});

test("middle phase prioritizes RAM and Source-File completion for the current BitNode", () => {
  const node3 = tasksForMode(TASKS, SCHEDULER_MODE.medium, 3);
  const files = node3.map(({ file }) => file);
  assert.ok(files.includes("/tasks/manage-home-ram.js"));
  assert.ok(files.includes("/tasks/manage-augmentations.js"));
  assert.ok(files.includes("/tasks/manage-progression.js"));
  assert.ok(files.includes("/special/manage-corporation.js"));
  assert.ok(!files.includes("/special/manage-gang.js"));
  assert.ok(!files.includes("/special/manage-exploits.js"));
  assert.ok(!files.includes("/tasks/manage-hacking-lite.js"));

  const ordered = sortTasksForMode(node3, SCHEDULER_MODE.medium);
  const ram = ordered.find(({ file }) => file === "/tasks/manage-home-ram.js");
  const progression = ordered.find(({ file }) => file === "/tasks/manage-progression.js");
  assert.equal(ram.mediumPriority, progression.mediumPriority);

  const node15 = tasksForMode(TASKS, SCHEDULER_MODE.medium, 15)
    .map(({ file }) => file);
  assert.ok(node15.includes("/special/manage-darknet.js"));

  const node13 = sortTasksForMode(
    tasksForMode(TASKS, SCHEDULER_MODE.medium, 13),
    SCHEDULER_MODE.medium,
  ).map(({ file }) => file);
  assert.ok(node13.includes("/special/manage-stanek.js"));
  assert.ok(
    node13.indexOf("/special/manage-stanek.js") <
      node13.indexOf("/tasks/manage-augmentations.js"),
  );
});

test("full operation prioritizes Source-File completion, programs, and network takeover", () => {
  const ordered = sortTasksForMode(
    tasksForMode(TASKS, SCHEDULER_MODE.full, 1),
    SCHEDULER_MODE.full,
  ).map(({ file }) => file);
  const index = (file) => ordered.indexOf(file);

  assert.ok(index("/tasks/manage-progression.js") < index("/tasks/manage-programs.js"));
  assert.ok(index("/tasks/manage-programs.js") < index("/tasks/root-network.js"));
  assert.ok(index("/tasks/root-network.js") < index("/tasks/deploy-workers.js"));
  assert.ok(index("/tasks/deploy-workers.js") < index("/tasks/manage-hacking.js"));
  assert.ok(index("/tasks/manage-hacking.js") < index("/tasks/manage-purchased-servers.js"));
});

test("scheduler admits only modules that can fit beside itself and the dashboard", () => {
  const capacity = taskRamCapacity(32, 4, 4.75);
  assert.equal(capacity, 23.25);
  assert.equal(taskFitsRam(18.1, capacity), true);
  assert.equal(taskFitsRam(83.25, capacity), false);
  assert.equal(taskFitsRam(0, capacity), false);
});

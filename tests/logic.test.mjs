import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, TASKS } from "../core/config.js";
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

test("scheduler stays lightweight below 128 GiB and releases all tasks at 128 GiB", () => {
  const tasks = [
    { file: "hack", priority: 10, lightweight: true, lightweightPriority: 100 },
    { file: "gang", priority: 90 },
  ];

  assert.equal(isLightweightMode(127, 128), true);
  assert.equal(isLightweightMode(128, 128), false);
  assert.deepEqual(tasksForMode(tasks, true).map(({ file }) => file), ["hack"]);
  assert.deepEqual(tasksForMode(tasks, false).map(({ file }) => file), ["hack", "gang"]);
  assert.equal(sortTasksForMode(tasks, true)[0].file, "hack");
  assert.equal(sortTasksForMode(tasks, false)[0].file, "gang");
});

test("real lightweight profile keeps income and RAM expansion while excluding heavy modules", () => {
  const files = tasksForMode(TASKS, true).map(({ file }) => file);
  assert.equal(CONFIG.lightweightMaxTasksPerTick, 1);
  assert.ok(files.includes("/tasks/manage-hacking.js"));
  assert.ok(files.includes("/tasks/manage-home.js"));
  assert.ok(files.includes("/tasks/manage-purchased-servers.js"));
  assert.ok(files.includes("/tasks/manage-hacknet.js"));
  assert.ok(!files.includes("/special/manage-exploits.js"));
  assert.ok(!files.includes("/tasks/manage-factions.js"));
  assert.ok(!files.includes("/special/manage-darknet.js"));

  const ordered = sortTasksForMode(tasksForMode(TASKS, true), true);
  const hacking = ordered.findIndex(({ file }) => file === "/tasks/manage-hacking.js");
  const root = ordered.findIndex(({ file }) => file === "/tasks/root-network.js");
  assert.ok(hacking >= 0 && hacking < root);
});

test("bootstrap profile uses only root, deployment, and the mini hacking manager", () => {
  assert.equal(schedulerMode(8, 32, 128), SCHEDULER_MODE.bootstrap);
  assert.equal(schedulerMode(32, 32, 128), SCHEDULER_MODE.lightweight);
  assert.equal(schedulerMode(128, 32, 128), SCHEDULER_MODE.full);

  const files = tasksForMode(TASKS, SCHEDULER_MODE.bootstrap).map(({ file }) => file);
  assert.deepEqual(new Set(files), new Set([
    "/tasks/root-network.js",
    "/tasks/deploy-workers.js",
    "/tasks/manage-hacking-lite.js",
  ]));
});

test("scheduler admits only modules that can fit beside itself and the dashboard", () => {
  const capacity = taskRamCapacity(32, 4, 4.75);
  assert.equal(capacity, 23.25);
  assert.equal(taskFitsRam(18.1, capacity), true);
  assert.equal(taskFitsRam(83.25, capacity), false);
  assert.equal(taskFitsRam(0, capacity), false);
});

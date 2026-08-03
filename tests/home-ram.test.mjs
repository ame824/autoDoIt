import test from "node:test";
import assert from "node:assert/strict";
import {
  HOME_RAM_FOCUS_FILE,
  calculateConcurrentRamTarget,
  fullOperationRamTarget,
  readHomeRamFocus,
  writeHomeRamFocus,
} from "../lib/home-ram.js";
import { main as manageHomeRam } from "../tasks/manage-home-ram.js";
import { main as checkHomeRam } from "../tasks/check-home-ram.js";
import { main as manageHacknet } from "../tasks/manage-hacknet.js";
import {
  CLOUD_BUDGET_FILE,
  main as manageCloudServers,
} from "../tasks/manage-purchased-servers.js";
import { main as manageStocks } from "../special/manage-stocks.js";
import { NODE_RUSH_STATE_FILE } from "../lib/node-rush.js";

test("concurrent Home RAM target includes every module and rounds to an upgrade size", () => {
  assert.equal(
    calculateConcurrentRamTarget([100, 120, 80], 128, 0.10, 32),
    512,
  );
  assert.equal(
    calculateConcurrentRamTarget([10, 20], 128, 0.10, 32),
    128,
  );
});

test("full-operation target de-duplicates files and persists focus state", () => {
  const files = new Map([
    ["/autoDoIt.js", 4],
    ["/ui/dashboard.js", 6],
    ["/task.js", 90],
  ]);
  const writes = new Map();
  const ns = {
    getScriptRam: (file) => files.get(file) ?? 0,
    read: (file) => writes.get(file) ?? "",
    write: (file, value) => writes.set(file, String(value)),
  };
  const target = fullOperationRamTarget(
    ns,
    ["/autoDoIt.js", "/ui/dashboard.js", "/task.js", "/task.js"],
    {
      fullModeHomeRam: 128,
      homeRamFocusReserveFraction: 0.10,
      homeRamFocusMinimumReserve: 32,
    },
  );

  assert.equal(target, 256);
  writeHomeRamFocus(ns, 64, target);
  assert.deepEqual(readHomeRamFocus(ns), {
    active: true,
    ramOnly: true,
    phase: "ram",
    current: 64,
    target: 256,
    mediumAt: 128,
    purchaseState: "unknown",
    currentNode: 0,
  });
});

test("full-operation target counts only the largest worker in each phase group", () => {
  const files = new Map([
    ["/scheduler.js", 10], ["/manager.js", 5],
    ["/phase-a.js", 40], ["/phase-b.js", 90], ["/phase-c.js", 20],
  ]);
  const ns = { getScriptRam: (file) => files.get(file) ?? 0 };
  assert.equal(fullOperationRamTarget(ns, ["/scheduler.js", "/manager.js"], {
    fullModeHomeRam: 1,
    homeRamFocusReserveFraction: 0,
    homeRamFocusMinimumReserve: 0,
  }, [["/phase-a.js", "/phase-b.js", "/phase-c.js"]]), 128);
});

test("RAM-only upgrader spends toward the scheduler target before optional modules", async () => {
  let homeRam = 64;
  const files = new Map([
    [HOME_RAM_FOCUS_FILE, JSON.stringify({ active: true, current: 64, target: 256 })],
  ]);
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getResetInfo: () => ({ currentNode: 4, ownedSF: new Map() }),
    getServerMaxRam: () => homeRam,
    getPlayer: () => ({ money: 1_000_000_000 }),
    singularity: {
      getUpgradeHomeRamCost: () => 1,
      upgradeHomeRam: () => {
        if (homeRam >= 256) return false;
        homeRam *= 2;
        return true;
      },
    },
    format: { ram: (value) => `${value} GiB` },
    toast: () => {},
    tprint: () => {},
  };

  await manageHomeRam(ns);
  assert.equal(homeRam, 256);
});

test("Daedalus reserve temporarily outranks an affordable Home RAM upgrade", async () => {
  let homeRam = 64;
  const files = new Map([
    [HOME_RAM_FOCUS_FILE, JSON.stringify({ active: true, current: 64, target: 256 })],
    [NODE_RUSH_STATE_FILE, JSON.stringify({
      updatedAt: Date.now(),
      currentNode: 1,
      stage: "daedalus-money",
      reserveMoney: 100_000,
    })],
  ]);
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getResetInfo: () => ({ currentNode: 1, ownedSF: new Map([[4, 3]]) }),
    getServerMaxRam: () => homeRam,
    getPlayer: () => ({ money: 50_000 }),
    singularity: {
      getUpgradeHomeRamCost: () => 1,
      upgradeHomeRam: () => { homeRam *= 2; return true; },
    },
    format: { ram: (value) => `${value} GiB` },
    toast: () => {},
    tprint: () => {},
  };

  await manageHomeRam(ns);
  assert.equal(homeRam, 64);
});

test("Hacknet and cloud servers each retain exactly 1% while Home RAM has priority", async () => {
  const focus = JSON.stringify({ active: true, current: 64, target: 1024 });
  let hacknetPurchases = 0;
  let cloudPurchases = 0;
  const files = new Map([[HOME_RAM_FOCUS_FILE, focus]]);
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getPlayer: () => ({ money: 10_000 }),
    hacknet: {
      numNodes: () => hacknetPurchases,
      maxNumNodes: () => 1,
      getPurchaseNodeCost: () => 60,
      getLevelUpgradeCost: () => Infinity,
      getRamUpgradeCost: () => Infinity,
      getCoreUpgradeCost: () => Infinity,
      purchaseNode: () => {
        hacknetPurchases += 1;
        return 0;
      },
    },
    cloud: {
      getServerNames: () => [],
      getServerLimit: () => 1,
      getRamLimit: () => 8,
      getServerCost: () => 80,
      purchaseServer: (name) => {
        cloudPurchases += 1;
        return name;
      },
    },
    getServerMaxRam: () => 8,
    format: {
      number: (value) => String(value),
      ram: (value) => `${value} GiB`,
    },
    toast: () => {},
    tprint: () => {},
  };

  await manageHacknet(ns);
  await manageCloudServers(ns);
  assert.equal(hacknetPurchases, 1);
  assert.equal(cloudPurchases, 1);
});

test("cloud budget buys a small server after saving and upgrades it at the limit", async () => {
  const focus = JSON.stringify({ active: true, current: 64, target: 1024 });
  const files = new Map([[HOME_RAM_FOCUS_FILE, focus]]);
  const servers = new Map();
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getPlayer: () => ({ money: 10_000 }),
    cloud: {
      getServerNames: () => [...servers.keys()],
      getServerLimit: () => 1,
      getRamLimit: () => 8,
      getServerCost: (ram) => ram * 75,
      purchaseServer: (name, ram) => {
        servers.set(name, ram);
        return name;
      },
      getServerUpgradeCost: () => 150,
      upgradeServer: (name, ram) => {
        servers.set(name, ram);
        return true;
      },
    },
    getServerMaxRam: (host) => servers.get(host) ?? 0,
    format: {
      number: (value) => String(value),
      ram: (value) => `${value} GiB`,
    },
    toast: () => {},
    tprint: () => {},
  };

  await manageCloudServers(ns);
  assert.equal(servers.size, 0);
  assert.equal(Number(files.get(CLOUD_BUDGET_FILE)), 100);

  await manageCloudServers(ns);
  assert.equal(servers.get("autodoit-00"), 2);
  assert.equal(Number(files.get(CLOUD_BUDGET_FILE)), 50);

  await manageCloudServers(ns);
  assert.equal(servers.get("autodoit-00"), 4);
  assert.equal(Number(files.get(CLOUD_BUDGET_FILE)), 0);
});

test("stock spending still pauses while Home RAM has priority", async () => {
  const focus = JSON.stringify({ active: true, current: 64, target: 1024 });
  const ns = {
    read: (file) => file === HOME_RAM_FOCUS_FILE ? focus : "",
    getPlayer: () => {
      throw new Error("stock spending must not inspect or spend player money");
    },
  };

  await manageStocks(ns);
});

test("lightweight RAM check reports whether automatic purchasing is available", async () => {
  const focus = JSON.stringify({ active: true, current: 8, target: 1_024, mediumAt: 512 });
  const files = new Map([[HOME_RAM_FOCUS_FILE, focus]]);
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getResetInfo: () => ({ currentNode: 1, ownedSF: new Map() }),
    format: { ram: (value) => `${value} GiB` },
    toast: () => {},
    tprint: () => {},
  };

  await checkHomeRam(ns);
  const state = readHomeRamFocus(ns);
  assert.equal(state.purchaseState, "manual");
  assert.equal(state.currentNode, 1);

  ns.getResetInfo = () => ({ currentNode: 4, ownedSF: new Map() });
  await checkHomeRam(ns);
  const automatic = readHomeRamFocus(ns);
  assert.equal(automatic.purchaseState, "automatic");
  assert.equal(automatic.currentNode, 4);
});

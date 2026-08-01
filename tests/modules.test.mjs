import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { staleDarknetProcesses } from "../workers/darknet-launcher.js";
import { resolveStasisRestartFile } from "../workers/darknet-stasis.js";

const executableModules = [
  "../autoDoIt.js",
  "../git-pull.js",
  "../git-pull-lite.js",
  "../ui/dashboard.js",
  "../ui/darknet-console.js",
  "../tools/self-test.js",
  "../tools/auto-updater.js",
  "../workers/hack.js",
  "../workers/grow.js",
  "../workers/weaken.js",
  "../workers/share.js",
  "../workers/darknet-bootstrap.js",
  "../workers/darknet-entry.js",
  "../workers/darknet-launcher.js",
  "../workers/darknet-cache.js",
  "../workers/darknet-crawler.js",
  "../workers/darknet-support.js",
  "../workers/darknet-stasis.js",
  "../workers/corporation-bootstrap.js",
  "../workers/corporation-expansion.js",
  "../workers/corporation-supply.js",
  "../workers/corporation-offices.js",
  "../workers/corporation-wellness.js",
  "../workers/corporation-capital.js",
  "../workers/corporation-growth.js",
  "../workers/corporation-materials.js",
  "../workers/corporation-research.js",
  "../workers/corporation-products.js",
  "../workers/corporation-sales.js",
  "../workers/exploit-quick.js",
  "../workers/exploit-timed.js",
  "../tasks/root-network.js",
  "../tasks/deploy-workers.js",
  "../tasks/manage-hacking.js",
  "../tasks/manage-hacking-lite.js",
  "../tasks/check-home-ram.js",
  "../tasks/check-job.js",
  "../tasks/manage-programs.js",
  "../tasks/manage-home-ram.js",
  "../tasks/manage-home.js",
  "../tasks/manage-jobs.js",
  "../tasks/manage-factions.js",
  "../tasks/manage-augmentations.js",
  "../tasks/manage-backdoors.js",
  "../tasks/manage-progression.js",
  "../tasks/manage-purchased-servers.js",
  "../tasks/manage-hacknet.js",
  "../special/manage-gang.js",
  "../special/manage-casino.js",
  "../special/manage-contracts.js",
  "../special/manage-darknet.js",
  "../special/manage-stanek.js",
  "../special/manage-ipvgo.js",
  "../special/manage-sleeves.js",
  "../special/manage-bladeburner.js",
  "../special/manage-corporation.js",
  "../special/manage-stocks.js",
  "../special/manage-exploits.js",
];

for (const path of executableModules) {
  test(`${path} exports a Bitburner main function`, async () => {
    const module = await import(path);
    assert.equal(typeof module.main, "function");
  });
}

test("the Darknet entry crawler keeps expensive support APIs in its 16 GiB companion", async () => {
  const crawler = await readFile(new URL("../workers/darknet-crawler.js", import.meta.url), "utf8");
  const support = await readFile(new URL("../workers/darknet-support.js", import.meta.url), "utf8");

  for (const api of ["phishingAttack", "induceServerMigration", "unleashStormSeed"]) {
    assert.equal(crawler.includes(`ns.dnet.${api}(`), false);
    assert.equal(support.includes(`ns.dnet.${api}(`), true);
  }
});

test("the fixed 16 GiB Darknet root uses a dedicated lightweight entry worker", async () => {
  const manager = await readFile(new URL("../special/manage-darknet.js", import.meta.url), "utf8");
  const entry = await readFile(new URL("../workers/darknet-entry.js", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../workers/darknet-launcher.js", import.meta.url), "utf8");

  assert.match(manager, /ns\.exec\(CACHE_FILE, entry, 1, version, ENTRY_FILE, threads\)/);
  assert.match(entry, /ns\.dnet\.authenticate\(host, password\)/);
  assert.match(entry, /ns\.exec\(LAUNCHER_FILE, host, 1, version\)/);
  assert.match(launcher, /crawlerRam > 0 && crawlerRam <= maximumRam/);
  assert.match(launcher, /ns\.spawn\(CACHE_FILE, 1, version, workerFile, threads\)/);
  for (const expensiveApi of [
    "heartbleed",
    "labreport",
    "openCache",
    "memoryReallocation",
    "phishingAttack",
    "induceServerMigration",
    "unleashStormSeed",
  ]) {
    assert.equal(entry.includes(`ns.dnet.${expensiveApi}(`), false);
  }
  for (const expensiveApi of [
    "getPlayer",
    "getScriptRam",
    "getServerMaxRam",
    "getServerUsedRam",
    "ps",
    "kill",
  ]) {
    assert.equal(entry.includes(`ns.${expensiveApi}(`), false);
  }
});

test("every Darknet launcher collects local cache stashes before continuing", async () => {
  const manager = await readFile(new URL("../special/manage-darknet.js", import.meta.url), "utf8");
  const crawler = await readFile(new URL("../workers/darknet-crawler.js", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../workers/darknet-launcher.js", import.meta.url), "utf8");
  const cache = await readFile(new URL("../workers/darknet-cache.js", import.meta.url), "utf8");

  assert.match(launcher, /const CACHE_FILE = "\/workers\/darknet-cache\.js"/);
  assert.match(cache, /ns\.ls\(current, "\.cache"\)/);
  assert.match(cache, /ns\.dnet\.openCache\(file, true\)/);
  assert.match(cache, /if \(!reward\.success\) continue/);
  assert.match(cache, /ns\.spawn\(nextFile, nextThreads, version\)/);
  assert.match(manager, /ns\.exec\(CACHE_FILE, entry, 1, version, ENTRY_FILE, threads\)/);
  assert.match(crawler, /ns\.exec\(CACHE_FILE, host, 1, version, workerFile, threads\)/);
});

test("the optional Stasis command keeps its 12 GiB API out of the permanent crawler", async () => {
  const manager = await readFile(new URL("../special/manage-darknet.js", import.meta.url), "utf8");
  const crawler = await readFile(new URL("../workers/darknet-crawler.js", import.meta.url), "utf8");
  const stasis = await readFile(new URL("../workers/darknet-stasis.js", import.meta.url), "utf8");
  const entry = await readFile(new URL("../workers/darknet-entry.js", import.meta.url), "utf8");

  assert.equal(crawler.includes("ns.dnet.setStasisLink("), false);
  assert.equal(entry.includes("ns.dnet.setStasisLink("), false);
  assert.match(stasis, /await ns\.dnet\.setStasisLink\(shouldLink\)/);
  assert.match(stasis, /ns\.spawn\(restartFile, \{ threads: workerThreads, spawnDelay: 100 \}, version\)/);
  assert.match(crawler, /const STASIS_FILE = "\/workers\/darknet-stasis\.js"/);
  assert.match(manager, /"\/workers\/darknet-stasis\.js"/);
  assert.match(entry, /const STASIS_FILE = "\/workers\/darknet-stasis\.js"/);
  assert.match(entry, /Leichter Darknet-Worker übernimmt Stasis-Auftrag/);
  assert.match(entry, /currentThreads,[\s\S]*ENTRY_FILE/);
  assert.match(crawler, /currentThreads,[\s\S]*WORKER_FILE/);
});

test("Darknet launchers replace only stale persistent autoDoIt workers", () => {
  const processes = [
    { pid: 1, filename: "/workers/darknet-crawler.js", args: ["old"] },
    { pid: 2, filename: "/workers/darknet-entry.js", args: ["current"] },
    { pid: 3, filename: "/workers/darknet-cache.js", args: ["old"] },
    { pid: 4, filename: "/workers/darknet-stasis.js", args: ["old"] },
    { pid: 5, filename: "/user-script.js", args: [] },
  ];

  assert.deepEqual(
    staleDarknetProcesses(processes, "current").map((process) => process.pid),
    [1, 3],
  );
});

test("Stasis handoff restores the worker type that previously fit the server", () => {
  assert.equal(
    resolveStasisRestartFile("/workers/darknet-entry.js"),
    "/workers/darknet-entry.js",
  );
  assert.equal(
    resolveStasisRestartFile("/workers/darknet-crawler.js"),
    "/workers/darknet-crawler.js",
  );
  assert.equal(
    resolveStasisRestartFile("/user-script.js"),
    "/workers/darknet-crawler.js",
  );
});

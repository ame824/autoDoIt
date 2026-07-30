import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const executableModules = [
  "../autoDoIt.js",
  "../git-pull.js",
  "../git-pull-lite.js",
  "../ui/dashboard.js",
  "../tools/self-test.js",
  "../tools/auto-updater.js",
  "../workers/hack.js",
  "../workers/grow.js",
  "../workers/weaken.js",
  "../workers/share.js",
  "../workers/darknet-bootstrap.js",
  "../workers/darknet-entry.js",
  "../workers/darknet-crawler.js",
  "../workers/darknet-support.js",
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

  assert.match(manager, /ns\.exec\(ENTRY_FILE, entry, threads, version\)/);
  assert.match(entry, /ns\.dnet\.authenticate\(host, password\)/);
  assert.match(entry, /ns\.exec\(CRAWLER_FILE, host, threads, version\)/);
  for (const expensiveApi of ["heartbleed", "labreport", "openCache", "induceServerMigration", "unleashStormSeed"]) {
    assert.equal(entry.includes(`ns.dnet.${expensiveApi}(`), false);
  }
});

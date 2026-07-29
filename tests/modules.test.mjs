import test from "node:test";
import assert from "node:assert/strict";

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
  "../workers/darknet-crawler.js",
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

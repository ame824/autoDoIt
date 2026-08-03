import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { worldDaemonPlan } from "../tasks/manage-progression.js";
import { translateEnglish } from "../core/localization.js";

test("World Daemon progression follows the BN15 labyrinth-to-destroy route", () => {
  assert.equal(worldDaemonPlan({ hasRedPill: false }), "labyrinth");
  assert.equal(worldDaemonPlan({ hasRedPill: true, reachable: false }), "search");
  assert.equal(worldDaemonPlan({ hasRedPill: true, reachable: true, rooted: false }), "root");
  assert.equal(worldDaemonPlan({
    hasRedPill: true,
    reachable: true,
    rooted: true,
    hackingLevel: 5_999,
    requiredLevel: 6_000,
  }), "train");
  assert.equal(worldDaemonPlan({
    hasRedPill: true,
    reachable: true,
    rooted: true,
    hackingLevel: 6_000,
    requiredLevel: 6_000,
  }), "destroy");
});

test("World Daemon manager scans, roots all five ports, and destroys through Singularity", async () => {
  const source = await readFile(new URL("../tasks/manage-progression.js", import.meta.url), "utf8");
  assert.match(source, /scanNetwork\(ns\)/);
  for (const api of ["brutessh", "ftpcrack", "relaysmtp", "httpworm", "sqlinject", "nuke"]) {
    assert.match(source, new RegExp(`ns\\.${api}\\(`));
  }
  assert.match(source, /ns\.singularity\.destroyW0r1dD43m0n\(nextNode, "\/autoDoIt\.js"\)/);
});

test("BN15 installs queued labyrinth rewards immediately and reports exact progress", async () => {
  const source = await readFile(new URL("../tasks/manage-progression.js", import.meta.url), "utf8");
  assert.match(source, /BN15_LAB_REWARDS/);
  assert.match(source, /queuedLabReward/);
  assert.match(source, /ns\.singularity\.installAugmentations\("\/autoDoIt\.js"\)/);
  assert.match(source, /Labyrinth-Vorstufen:/);
  assert.match(source, /BN15_LAB_CHARISMA/);
});

test("lightweight Darknet seeders sweep caches and full crawlers prioritize labyrinths", async () => {
  const entry = await readFile(new URL("../workers/darknet-entry.js", import.meta.url), "utf8");
  const crawler = await readFile(new URL("../workers/darknet-crawler.js", import.meta.url), "utf8");
  assert.match(entry, /ns\.ls\(current, "\.cache"\)/);
  assert.match(entry, /ns\.spawn\(CACHE_FILE/);
  assert.match(crawler, /details\.modelId === LABYRINTH_MODEL/);
  assert.match(crawler, /rightLab - leftLab/);
});

test("BN15 progress and cache sweep events remain bilingual", () => {
  assert.equal(
    translateEnglish("BN15 jagt The Red Pill im Darknet"),
    "BN15 is hunting The Red Pill in the Darknet",
  );
  assert.equal(
    translateEnglish("Darknet-Cache-Sammler startet auf blade_hub"),
    "Darknet cache collector is starting on blade_hub",
  );
  assert.equal(
    translateEnglish("Labyrinth-Vorstufen: 3/4; aktuelles Ziel: The Staff."),
    "Labyrinth prerequisites: 3/4; current target: The Staff.",
  );
});

test("critical-path progress remains bilingual", () => {
  assert.equal(translateEnglish("Daedalus-Geldreserve aktiv"), "Daedalus money reserve active");
  assert.equal(translateEnglish("Hacking-EP-Endspurt auf n00dles"), "Hacking XP sprint on n00dles");
  assert.equal(
    translateEnglish("3/4 für den nächsten adaptiven Installations-Reset."),
    "3/4 for the next adaptive installation reset.",
  );
});

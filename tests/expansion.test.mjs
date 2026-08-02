import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../core/config.js";
import { chooseGoMove } from "../lib/go-logic.js";
import {
  combinePrimeRemainders,
  commonFixedLengthSubstring,
  evaluateDarknetExpression,
  extractLogCandidates,
  findDarknetFeedback,
  getDarknetCandidates,
  parseRomanRange,
  passwordFromSortedRms,
} from "../lib/darknet-logic.js";
import {
  calculateCasinoBet,
  casinoMaintenanceDue,
  shouldHitBlackjack,
} from "../special/manage-casino.js";
import { findRepTarget, orderFactionInvitations } from "../tasks/manage-factions.js";
import {
  queuedAugmentations,
  requiresImmediateAugmentationInstall,
} from "../tasks/manage-augmentations.js";
import {
  chooseInitialCloudRam,
  nextCloudServerName,
} from "../tasks/manage-purchased-servers.js";
import { getCheapestHacknetChoice } from "../tasks/manage-hacknet.js";
import { calculateBootstrapThreads } from "../special/manage-darknet.js";
import { calculateDarknetWorkerThreads } from "../workers/darknet-crawler.js";
import { calculateAccruedBudget } from "../lib/investment-budget.js";
import {
  NEUROFLUX_GOVERNOR,
  chooseCheapestFactionAugmentation,
  chooseNeuroFluxFaction,
} from "../lib/faction-augmentations.js";
import { analyzePortAccess } from "../lib/port-programs.js";

test("IPvGO prefers an immediate capture", () => {
  const board = [
    ".X.",
    "XO.",
    ".X.",
  ];
  const valid = [
    [true, false, true],
    [false, false, true],
    [true, false, true],
  ];
  const move = chooseGoMove(board, valid);
  assert.deepEqual({ x: move.x, y: move.y }, { x: 1, y: 2 });
});

test("blackjack stays on 17 and hits below it", () => {
  assert.equal(shouldHitBlackjack([16]), true);
  assert.equal(shouldHitBlackjack([7, 17]), false);
  assert.equal(shouldHitBlackjack([18]), false);
});

test("casino bets at most 90% of cash and stops changing the capped wager", () => {
  assert.equal(calculateCasinoBet(1_000_000, 100_000_000), 900_000);
  assert.equal(calculateCasinoBet(1_000_000_000, 100_000_000), 100_000_000);
  assert.equal(calculateCasinoBet(-1, 100_000_000), 0);
});

test("casino maintenance runs by elapsed time or hand batch", () => {
  assert.equal(casinoMaintenanceDue(1_999, 0, 24), false);
  assert.equal(casinoMaintenanceDue(2_000, 0, 0), true);
  assert.equal(casinoMaintenanceDue(10, 0, 25), true);
});

test("faction invitations prioritize configured city choices without dropping others", () => {
  assert.deepEqual(
    orderFactionInvitations(["Daedalus", "Aevum", "Sector-12", "CyberSec"]),
    ["Sector-12", "Aevum", "Daedalus", "CyberSec"],
  );
});

test("every BitNode installs Darknet labyrinth rewards immediately while normal augs still batch", () => {
  assert.equal(
    requiresImmediateAugmentationInstall(15, ["The Broken Wings"]),
    true,
  );
  assert.equal(
    requiresImmediateAugmentationInstall(15, ["The Staff"]),
    true,
  );
  assert.equal(
    requiresImmediateAugmentationInstall(1, ["The Broken Wings"]),
    true,
  );
  assert.equal(
    requiresImmediateAugmentationInstall(1, ["The Red Pill"]),
    true,
  );
  assert.equal(
    requiresImmediateAugmentationInstall(15, ["BitWire"]),
    false,
  );
});

test("every queued NeuroFlux level counts toward the augmentation reset threshold", () => {
  const installed = ["BitWire", "NeuroFlux Governor"];
  const installedAndQueued = [
    ...installed,
    ...Array(15).fill("NeuroFlux Governor"),
  ];
  const queued = queuedAugmentations(installed, installedAndQueued);

  assert.equal(queued.length, 15);
  assert.ok(queued.every((name) => name === "NeuroFlux Governor"));
  assert.ok(queued.length >= CONFIG.minimumAugsBeforeInstall);
});

test("queued augmentation counting preserves duplicate and unique names", () => {
  assert.deepEqual(
    queuedAugmentations(
      ["NeuroFlux Governor", "BitWire"],
      ["NeuroFlux Governor", "BitWire", "NeuroFlux Governor", "Cranial Signal Processors - Gen I"],
    ),
    ["NeuroFlux Governor", "Cranial Signal Processors - Gen I"],
  );
});

test("faction work targets the cheapest actionable specific augmentation first", () => {
  const target = chooseCheapestFactionAugmentation([
    { name: "Expensive", price: 10_000, gap: 0, requirement: 1, prerequisitesMet: true },
    { name: "Cheap locked", price: 50, gap: 0, requirement: 1, prerequisitesMet: false },
    { name: "Cheap", price: 100, gap: 500, requirement: 501, prerequisitesMet: true },
  ]);
  assert.equal(target.name, "Cheap");
});

test("NeuroFlux is selected only by its own final-stage chooser", () => {
  const target = chooseNeuroFluxFaction([
    { name: NEUROFLUX_GOVERNOR, faction: "A", gap: 100, factionRep: 500 },
    { name: NEUROFLUX_GOVERNOR, faction: "B", gap: 0, factionRep: 200 },
  ]);
  assert.equal(target.faction, "B");
});

test("faction work skips specific augmentations whose reputation is already complete", () => {
  const augmentations = {
    Alpha: ["Cheap", "Next", NEUROFLUX_GOVERNOR],
  };
  const requirements = { Cheap: 100, Next: 500, [NEUROFLUX_GOVERNOR]: 1_000 };
  const prices = { Cheap: 10, Next: 20, [NEUROFLUX_GOVERNOR]: 30 };
  const ns = {
    singularity: {
      getFactionRep: () => 100,
      getAugmentationsFromFaction: (faction) => augmentations[faction],
      getAugmentationRepReq: (name) => requirements[name],
      getAugmentationPrice: (name) => prices[name],
      getAugmentationPrereq: () => [],
    },
  };
  assert.equal(findRepTarget(ns, ["Alpha"], new Set()).augmentation, "Next");
  assert.equal(findRepTarget(ns, ["Alpha"], new Set(["Next"])), null);
});

test("darknet arithmetic parser does not evaluate injected code", () => {
  assert.equal(evaluateDarknetExpression("4 + 5 * (6 + 2)"), 44);
  assert.equal(evaluateDarknetExpression("10 ➖ 4 ҳ 2"), 2);
  assert.equal(
    evaluateDarknetExpression("4 + 2, alert('nope'), ns.exit()"),
    6,
  );
});

test("darknet deterministic models produce their password", () => {
  const base = { passwordLength: 3, passwordFormat: "numeric", passwordHint: "", data: "" };
  assert.deepEqual(getDarknetCandidates({ ...base, modelId: "ZeroLogon", passwordLength: 0 }), [""]);
  assert.deepEqual(
    getDarknetCandidates({ ...base, modelId: "CloudBlare(tm)", data: "1a!2🙂3" }),
    ["123"],
  );
  assert.deepEqual(
    getDarknetCandidates({
      ...base,
      modelId: "110100100",
      passwordLength: 2,
      passwordFormat: "alphanumeric",
      data: "00110001 01000001",
    }),
    ["1A"],
  );
  assert.deepEqual(
    getDarknetCandidates({
      ...base,
      modelId: "FreshInstall_1.0",
      passwordLength: 4,
      passwordFormat: "numeric",
    }),
    ["0000"],
  );
  assert.deepEqual(
    getDarknetCandidates({
      ...base,
      modelId: "Laika4",
      passwordLength: 4,
      passwordFormat: "alphabetic",
    }),
    ["fido", "spot"],
  );
});

test("darknet log extraction only returns candidates matching server details", () => {
  const details = { passwordLength: 4, passwordFormat: "numeric" };
  const logs = [
    "Connecting to target:1234 ...",
    JSON.stringify({ message: "Logging in with passcode: 9876 ..." }),
    "--oops--",
  ];
  assert.deepEqual(extractLogCandidates(logs, "target", details), ["1234", "9876"]);
});

test("cloud servers use the largest evenly affordable initial RAM", () => {
  const cloud = { getServerCost: (ram) => ram * 100 };
  assert.equal(chooseInitialCloudRam(cloud, 1_024, 50_000), 256);
});

test("cloud server names fill gaps instead of colliding", () => {
  assert.equal(nextCloudServerName(["autodoit-00", "autodoit-02"], 4), "autodoit-01");
});

test("infrastructure budget banks repeated 1% allocations with a safe cap", () => {
  assert.equal(calculateAccruedBudget(0, 10_000, 0.01, 0.15), 100);
  assert.equal(calculateAccruedBudget(100, 10_000, 0.01, 0.15), 200);
  assert.equal(calculateAccruedBudget(1_490, 10_000, 0.01, 0.15), 1_500);
  assert.equal(calculateAccruedBudget(5_000, 1_000, 0.01, 0.15), 150);
});

test("hacknet batching always selects the cheapest available improvement", () => {
  const hacknet = {
    numNodes: () => 1,
    maxNumNodes: () => 2,
    getPurchaseNodeCost: () => 1_000,
    getLevelUpgradeCost: () => 250,
    getRamUpgradeCost: () => 500,
    getCoreUpgradeCost: () => 750,
    getCacheUpgradeCost: () => 900,
  };
  assert.deepEqual(getCheapestHacknetChoice({ hacknet }), {
    cost: 250,
    type: "level",
    index: 0,
  });
});

test("darknet bootstrap uses spare home RAM without exceeding its thread cap", () => {
  assert.equal(calculateBootstrapThreads(1_024, 2, 512), 512);
  assert.equal(calculateBootstrapThreads(100, 2, 512), 50);
  assert.equal(calculateBootstrapThreads(100, 0, 512), 0);
  assert.equal(calculateDarknetWorkerThreads(1_000, 20, 64), 50);
  assert.equal(calculateDarknetWorkerThreads(10_000, 20, 64), 64);
});

test("darknet interactive feedback and numeric helpers reconstruct passwords", () => {
  const logs = [
    JSON.stringify({
      message: {
        passwordAttempted: "500",
        data: "Lower",
        message: "Try again",
      },
      pid: 42,
    }),
  ];
  assert.equal(findDarknetFeedback(logs, "500")?.data, "Lower");
  assert.deepEqual(parseRomanRange("X,XX", 2), [10, 20]);
  assert.equal(combinePrimeRemainders([[3, 2], [5, 4], [7, 1]]), 29);
});

test("darknet sorted echo and packet helpers recover shared secrets", () => {
  const password = "31415";
  const rms = (guess) => Math.sqrt(
    [...password].reduce((sum, digit, index) => sum + (Number(guess[index]) - Number(digit)) ** 2, 0)
      / password.length,
  );
  const baseline = "0".repeat(password.length);
  const probes = [...password].map((_, index) => {
    const guess = Array(password.length).fill("0");
    guess[index] = "1";
    return rms(guess.join(""));
  });
  assert.equal(passwordFromSortedRms(password.length, rms(baseline), probes), password);
  assert.equal(
    commonFixedLengthSubstring(["abcSECRETxyz", "00SECRET11", "qSECRETp"], 6),
    "SECRET",
  );
});

test("port analysis identifies the exact final program and newly unlocked servers", () => {
  const access = analyzePortAccess(
    [5, 5, 5],
    new Set(["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe"]),
  );
  assert.equal(access.availableCount, 4);
  assert.equal(access.minimumRequiredPorts, 5);
  assert.equal(access.nextProgram.file, "SQLInject.exe");
  assert.equal(access.nextProgram.hackingLevel, 750);
  assert.equal(access.unlockedByNext, 3);
});

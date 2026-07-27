import test from "node:test";
import assert from "node:assert/strict";
import { chooseGoMove } from "../lib/go-logic.js";
import {
  evaluateDarknetExpression,
  extractLogCandidates,
  getDarknetCandidates,
} from "../lib/darknet-logic.js";
import { shouldHitBlackjack } from "../special/manage-casino.js";
import { orderFactionInvitations } from "../tasks/manage-factions.js";
import {
  chooseInitialCloudRam,
  nextCloudServerName,
} from "../tasks/manage-purchased-servers.js";
import { getCheapestHacknetChoice } from "../tasks/manage-hacknet.js";

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

test("faction invitations prioritize configured city choices without dropping others", () => {
  assert.deepEqual(
    orderFactionInvitations(["Daedalus", "Aevum", "Sector-12", "CyberSec"]),
    ["Sector-12", "Aevum", "Daedalus", "CyberSec"],
  );
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

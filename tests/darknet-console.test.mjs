import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateConsoleLayout,
  createStasisActionQueue,
  createStasisCommand,
  createTargetQueue,
  executeRoute,
  extractDarknetTopology,
  isDarknetPage,
  planDarknetRoute,
  parseStasisResponse,
  queueStasis,
  serverFromElement,
} from "../ui/darknet-console.js";
import { resolveDarknetConsolePreference } from "../autoDoIt.js";
import { parseStasisCommand } from "../workers/darknet-crawler.js";

function server(hostname, neighbors, options = {}) {
  return {
    hostname,
    ip: options.ip ?? "10.0.0.1",
    serversOnNetwork: neighbors,
    depth: options.depth ?? 0,
    hasAdminRights: options.admin ?? true,
    hasStasisLink: options.stasis ?? false,
    backdoorInstalled: options.backdoor ?? false,
  };
}

function buttonFor(darknetServer) {
  return {
    "__reactFiber$test": {
      memoizedProps: {},
      return: { memoizedProps: { server: darknetServer }, return: null },
    },
  };
}

test("Darknet page detection uses the v3 network canvas marker", () => {
  assert.equal(isDarknetPage({ getElementById: (id) => id === "draggableBackgroundTarget" ? {} : null }), true);
  assert.equal(isDarknetPage({ getElementById: () => null }), false);
});

test("Stasis worker responses can be matched to the pending server", () => {
  assert.deepEqual(parseStasisResponse(JSON.stringify({
    type: "stasis-result",
    target: "maze-end",
    enable: true,
    success: false,
    message: "limit reached",
  })), {
    target: "maze-end",
    enable: true,
    success: false,
    message: "limit reached",
  });
  assert.equal(parseStasisResponse('{"type":"other"}'), null);
});

test("React fiber server data is reduced to a safe topology snapshot", () => {
  const alpha = server("alpha", ["darkweb"], { depth: 1, ip: "1.2.3.4" });
  assert.equal(serverFromElement(buttonFor(alpha)), alpha);
  const root = { querySelectorAll: () => [buttonFor(alpha), buttonFor(alpha)] };
  const topology = extractDarknetTopology({
    getElementById: (id) => id === "draggableBackgroundTarget" ? root : null,
  });
  assert.deepEqual(topology, [{
    hostname: "alpha",
    ip: "1.2.3.4",
    neighbors: ["darkweb"],
    depth: 1,
    hasAdminRights: true,
    hasStasisLink: false,
    backdoorInstalled: false,
  }]);
});

test("route planner connects from home through authenticated Darknet neighbors", () => {
  const topology = [
    { ...server("darkweb", ["alpha"], { depth: 0 }), neighbors: ["alpha"] },
    { ...server("alpha", ["darkweb", "beta"], { depth: 1 }), neighbors: ["darkweb", "beta"] },
    { ...server("beta", ["alpha"], { depth: 2 }), neighbors: ["alpha"] },
  ];
  assert.deepEqual(planDarknetRoute(topology, "beta"), ["home", "darkweb", "alpha", "beta"]);
  assert.deepEqual(planDarknetRoute(topology, "home"), ["home"]);
});

test("route planner rejects locked servers and uses direct stasis links", () => {
  const locked = { ...server("locked", ["darkweb"], { admin: false }), neighbors: ["darkweb"] };
  const linked = { ...server("linked", [], { stasis: true }), neighbors: [] };
  assert.deepEqual(planDarknetRoute([locked, linked], "locked"), []);
  assert.deepEqual(planDarknetRoute([locked, linked], "linked"), ["home", "linked"]);
});

test("target selection is consumed only once", () => {
  const queue = createTargetQueue();
  queue.select("alpha");
  assert.equal(queue.take(), "alpha");
  assert.equal(queue.take(), "");
});

test("Stasis selection is queued separately from terminal navigation", () => {
  const queue = createStasisActionQueue();
  queue.select("alpha", true);
  assert.deepEqual(queue.take(), { target: "alpha", enable: true });
  assert.equal(queue.take(), null);
});

test("Stasis commands are bounded, validated, and written to the command port", () => {
  const now = 1_000;
  const raw = createStasisCommand("alpha", true, now);
  assert.deepEqual(parseStasisCommand(raw, now + 10), {
    target: "alpha",
    enable: true,
    expiresAt: 121_000,
  });
  assert.equal(parseStasisCommand(raw, 121_001), null);
  assert.equal(parseStasisCommand('{"type":"migrate"}', now), null);

  const writes = [];
  const ns = { tryWritePort: (...args) => { writes.push(args); return true; } };
  assert.equal(queueStasis(ns, "beta", false, now), true);
  assert.equal(writes[0][0], 18);
  assert.deepEqual(parseStasisCommand(writes[0][1], now), {
    target: "beta",
    enable: false,
    expiresAt: 121_000,
  });
});

test("route execution stops on the first failed terminal hop", async () => {
  const visited = [];
  const ns = {
    singularity: { connect: (host) => { visited.push(host); return host !== "alpha"; } },
    sleep: async () => {},
  };
  assert.equal(await executeRoute(ns, ["home", "alpha", "beta"]), "alpha");
  assert.deepEqual(visited, ["home", "alpha"]);
});

test("Darknet console preference persists and explicit disable wins", () => {
  assert.equal(resolveDarknetConsolePreference(false, false, "enabled"), true);
  assert.equal(resolveDarknetConsolePreference(false, false, "disabled"), false);
  assert.equal(resolveDarknetConsolePreference(true, false, ""), true);
  assert.equal(resolveDarknetConsolePreference(true, true, "enabled"), false);
});

test("console layout stays on the right and within small viewports", () => {
  assert.deepEqual(calculateConsoleLayout(1_920, 1_080), { width: 560, height: 650, x: 1_348, y: 8 });
  const small = calculateConsoleLayout(500, 400);
  assert.ok(small.width <= 500);
  assert.ok(small.height <= 400);
  assert.ok(small.x >= 8);
});

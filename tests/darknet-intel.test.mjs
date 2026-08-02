import test from "node:test";
import assert from "node:assert/strict";
import {
  exchangeDarknetIntel,
  extractDarknetIntel,
  getSharedDarknetCandidates,
  mergeDarknetIntel,
} from "../lib/darknet-logic.js";

const ALPHANUMERIC_SIX = {
  modelId: "FreshInstall_1.0",
  passwordLength: 6,
  passwordFormat: "alphanumeric",
};

test("Darknet data files extract direct, local, dictionary, and character intel", () => {
  const intel = extractDarknetIntel([
    "Some common passwords include qwerty, dragon, shadow",
    "Remember this password: abc123",
    'Server: remote^host Password: "s3cret"',
    "The password for remote^host contains s and 3",
    "Connecting to second::host:pass42 ...",
  ], "source%host", 1_000);

  assert.deepEqual(
    intel.credentials.map(({ host, password }) => [host, password]),
    [["remote^host", "s3cret"], ["second::host", "pass42"]],
  );
  assert.deepEqual(
    intel.candidates.map(({ password, kind }) => [password, kind]),
    [["qwerty", "common"], ["dragon", "common"], ["shadow", "common"], ["abc123", "neighbor"]],
  );
  assert.deepEqual(intel.hints[0].characters, ["s", "3"]);
});

test("shared intel prioritizes exact credentials and scopes unlabelled neighbor passwords", () => {
  const state = mergeDarknetIntel({}, [
    "Some common passwords include qwerty, dragon",
    "Remember this password: abc123",
    'Server: remote^host Password: "s3cret"',
    "The password for remote^host contains s and 3",
  ], "source%host", 2_000);

  assert.deepEqual(
    getSharedDarknetCandidates(state, "remote^host", ALPHANUMERIC_SIX, "other", 2_000),
    ["s3cret"],
  );
  assert.deepEqual(
    getSharedDarknetCandidates(state, "neighbor", ALPHANUMERIC_SIX, "source%host", 2_000),
    ["abc123"],
  );
  assert.deepEqual(
    getSharedDarknetCandidates(state, "neighbor", ALPHANUMERIC_SIX, "other", 2_000),
    [],
  );
  assert.deepEqual(
    getSharedDarknetCandidates(
      state,
      "dictionary-target",
      { ...ALPHANUMERIC_SIX, modelId: "TopPass" },
      "other",
      2_000,
    ),
    ["qwerty", "dragon"],
  );
});

test("port exchange preserves intel contributed by multiple crawlers", () => {
  const queue = [];
  const ns = {
    getPortHandle: () => ({
      empty: () => queue.length === 0,
      read: () => queue.shift(),
    }),
    tryWritePort: (_port, value) => {
      queue.push(value);
      return true;
    },
  };

  exchangeDarknetIntel(ns, 16, ['Server: alpha Password: "abc123"'], "first", 3_000);
  const state = exchangeDarknetIntel(ns, 16, ['Server: beta Password: "dragon"'], "second", 3_001);

  assert.deepEqual(
    state.credentials.map(({ host, password }) => [host, password]),
    [["beta", "dragon"], ["alpha", "abc123"]],
  );
  assert.equal(queue.length, 1);
});

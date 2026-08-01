import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { main as update } from "../git-pull.js";
import { main as liteUpdate } from "../git-pull-lite.js";
import {
  main as autoUpdate,
  parseRemoteVersion,
  shouldCheckForUpdate,
} from "../tools/auto-updater.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

test("updater downloads the manifest and every runtime file", async () => {
  const manifestText = await readFile(resolve(projectRoot, "runtime-manifest.txt"), "utf8");
  const manifest = JSON.parse(manifestText);
  const downloads = [];
  const terminal = [];

  const ns = {
    flags: () => ({
      repo: "ame824/autoDoIt",
      branch: "main",
      start: false,
      "skip-test": true,
    }),
    tprint: (message) => terminal.push(String(message)),
    print: () => {},
    wget: async (url, target) => {
      downloads.push({ url, target });
      return true;
    },
    read: () => manifestText,
    scriptRunning: () => false,
    scriptKill: () => false,
    sleep: async () => {},
    fileExists: () => true,
    run: () => 0,
    isRunning: () => false,
    spawn: () => {},
  };

  await update(ns);

  assert.equal(downloads[0].target, "/data/autoDoIt-runtime-manifest.txt");
  assert.equal(downloads.length, manifest.files.length + 1);
  assert.deepEqual(
    new Set(downloads.slice(1).map(({ target }) => target)),
    new Set(manifest.files),
  );
  assert.ok(terminal.some((line) => line.includes(`${manifest.files.length} Dateien erfolgreich`)));
});

test("updater starter forwards the optional Darknet console switch", async () => {
  const manifestText = await readFile(resolve(projectRoot, "runtime-manifest.txt"), "utf8");
  const spawned = [];
  const ns = {
    flags: () => ({
      repo: "ame824/autoDoIt",
      branch: "main",
      start: true,
      "skip-test": true,
      "darknet-console": true,
      "no-darknet-console": false,
      auto: false,
      version: "",
    }),
    tprint: () => {}, print: () => {},
    wget: async () => true,
    read: (file) => file === "/data/autoDoIt-runtime-manifest.txt" ? manifestText : "2026.08.01.4",
    write: () => {}, fileExists: () => true,
    getRunningScript: () => null,
    scriptRunning: () => false, scriptKill: () => false,
    sleep: async () => {}, run: () => 0, isRunning: () => false,
    spawn: (...args) => spawned.push(args),
  };
  await update(ns);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][0], "/autoDoIt.js");
  assert.ok(spawned[0].includes("--darknet-console"));
});

test("lite updater downloads everything, stops the scheduler, and does not restart scripts", async () => {
  const manifestText = await readFile(resolve(projectRoot, "runtime-manifest.txt"), "utf8");
  const manifest = JSON.parse(manifestText);
  const downloads = [];
  const killed = [];
  const started = [];
  const terminal = [];

  const ns = {
    flags: () => ({
      repo: "ame824/autoDoIt",
      branch: "main",
    }),
    tprint: (message) => terminal.push(String(message)),
    print: () => {},
    wget: async (url, target) => {
      downloads.push({ url, target });
      return true;
    },
    read: () => manifestText,
    scriptKill: (file, host) => {
      killed.push({ file, host });
      return true;
    },
    fileExists: () => true,
    run: (...args) => started.push(args),
    spawn: (...args) => started.push(args),
  };

  await liteUpdate(ns);

  assert.equal(downloads.length, manifest.files.length + 1);
  assert.deepEqual(
    new Set(downloads.slice(1).map(({ target }) => target)),
    new Set(manifest.files),
  );
  assert.deepEqual(killed, [{ file: "/autoDoIt.js", host: "home" }]);
  assert.equal(started.length, 0);
  assert.ok(terminal.some((line) => line.includes("Neustart mit: run autoDoIt.js")));
});

test("automatic updater immediately repairs a missing or outdated local version", async () => {
  const oldVersion = "2026.07.28.9";
  const newVersion = "2026.07.29.1";
  const files = new Map();
  const spawned = [];
  const ns = {
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    wget: async (_url, target) => {
      files.set(target, newVersion);
      return true;
    },
    toast: () => {},
    fileExists: () => true,
    spawn: (...args) => spawned.push(args),
  };

  await autoUpdate(ns);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0][0], "/git-pull.js");
  assert.ok(spawned[0].includes("--auto"));
  assert.ok(spawned[0].includes(newVersion));

  files.set("/version.txt", newVersion);
  files.set("/data/autoDoIt-update-last-check.txt", "0");
  await autoUpdate(ns);
  assert.equal(spawned.length, 1);
  assert.match(files.get("/data/autoDoIt-update-status.txt"), /"state":"current"/);

  files.set("/version.txt", oldVersion);
  files.set("/data/autoDoIt-update-last-check.txt", "0");
  await autoUpdate(ns);
  assert.equal(spawned.length, 2);
});

test("automatic updater validates version markers and persisted intervals", () => {
  assert.equal(parseRemoteVersion("2026.07.29.1\n"), "2026.07.29.1");
  assert.equal(parseRemoteVersion("invalid version"), "");
  assert.equal(shouldCheckForUpdate(1_000, 4_000, 3_000), true);
  assert.equal(shouldCheckForUpdate(1_001, 4_000, 3_000), false);
});

test("full updater records automatic versions and preserves scheduler arguments", async () => {
  const manifestText = await readFile(resolve(projectRoot, "runtime-manifest.txt"), "utf8");
  const version = "2026.07.29.1";
  const writes = new Map();
  const spawned = [];
  const ns = {
    flags: () => ({
      repo: "ame824/autoDoIt",
      branch: "main",
      start: false,
      "skip-test": true,
      auto: true,
      version,
    }),
    tprint: () => {},
    print: () => {},
    toast: () => {},
    wget: async () => true,
    read: (file) => file.includes("language") ? "en" : manifestText,
    write: (file, value) => writes.set(file, String(value)),
    getRunningScript: () => ({ args: ["--lang", "en"] }),
    scriptRunning: () => true,
    scriptKill: () => true,
    sleep: async () => {},
    fileExists: () => true,
    run: () => 0,
    isRunning: () => false,
    spawn: (...args) => spawned.push(args),
  };

  await update(ns);

  assert.equal(writes.get("/data/autoDoIt-installed-version.txt"), version);
  assert.match(writes.get("/data/autoDoIt-update-status.txt"), /"state":"current"/);
  assert.deepEqual(spawned[0].slice(-2), ["--lang", "en"]);
});

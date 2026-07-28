import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { main as update } from "../git-pull.js";
import { main as liteUpdate } from "../git-pull-lite.js";

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

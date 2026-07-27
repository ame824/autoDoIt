import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

test("runtime manifest contains valid, existing project files", async () => {
  const raw = await readFile(resolve(projectRoot, "runtime-manifest.txt"), "utf8");
  const manifest = JSON.parse(raw);

  assert.equal(manifest.format, 1);
  assert.equal(manifest.project, "autoDoIt");
  assert.ok(Array.isArray(manifest.files));
  assert.equal(new Set(manifest.files).size, manifest.files.length);
  assert.ok(manifest.files.includes("/git-pull.js"));
  assert.ok(manifest.files.includes("/autoDoIt.js"));
  assert.ok(manifest.files.includes("/tools/self-test.js"));

  await Promise.all(
    manifest.files.map(async (path) => {
      assert.match(path, /^\/[A-Za-z0-9_./-]+\.(?:js|txt)$/);
      await access(resolve(projectRoot, path.slice(1)));
    }),
  );
});


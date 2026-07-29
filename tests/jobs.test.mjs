import test from "node:test";
import assert from "node:assert/strict";
import { chooseJobPlan, main as checkJob } from "../tasks/check-job.js";

function createNs({ currentNode = 1, ownedSF = new Map(), jobs = {} } = {}) {
  const files = new Map();
  const terminal = [];
  return {
    files,
    terminal,
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    getPlayer: () => ({ jobs }),
    getResetInfo: () => ({ currentNode, ownedSF }),
    toast: () => {},
    tprint: (message) => terminal.push(String(message)),
  };
}

test("early job plan prefers Software and falls back to IT", () => {
  assert.deepEqual(chooseJobPlan({ jobs: {} }), {
    currentCompany: "",
    currentPosition: "",
    preferredField: "Software",
    fallbackField: "IT",
  });
});

test("fresh BN1 receives one concrete manual job decision", async () => {
  const ns = createNs();
  await checkJob(ns);

  assert.equal(ns.terminal.length, 1);
  assert.match(ns.terminal[0], /Software/);
  assert.match(ns.terminal[0], /IT/);
});

test("Source-File 4 switches the early check to automatic job control", async () => {
  const ns = createNs({ ownedSF: new Map([[4, 1]]) });
  await checkJob(ns);

  assert.equal(ns.terminal.length, 0);
  const status = [...ns.files.values()].find((value) =>
    String(value).includes("Automatische Jobsteuerung verfügbar")
  );
  assert.ok(status);
});

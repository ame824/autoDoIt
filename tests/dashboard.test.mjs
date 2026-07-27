import test from "node:test";
import assert from "node:assert/strict";
import { formatAge, progressBar } from "../ui/dashboard.js";
import { clearStatusEvent, readStatus, recordStatusEvent } from "../core/status.js";
import {
  reportBlocker,
  reportInfo,
  reportQuietBlocker,
  reportSuccess,
} from "../core/notifier.js";

test("dashboard progress bars clamp values safely", () => {
  assert.equal(progressBar(5, 10, 10), "[█████░░░░░]");
  assert.equal(progressBar(20, 10, 10), "[██████████]");
  assert.equal(progressBar(-1, 10, 10), "[░░░░░░░░░░]");
});

test("dashboard formats event age compactly", () => {
  const now = 10_000_000;
  assert.equal(formatAge(now - 20_000, now), "20s");
  assert.equal(formatAge(now - 120_000, now), "2m");
  assert.equal(formatAge(now - 7_200_000, now), "2h");
});

test("status events are persisted for the dashboard", () => {
  let stored = "";
  const ns = {
    read: () => stored,
    write: (_file, value) => {
      stored = value;
    },
  };

  recordStatusEvent(ns, {
    key: "test",
    level: "success",
    title: "Test erfolgreich",
    lines: ["Detail"],
  });
  recordStatusEvent(ns, {
    key: "test",
    level: "info",
    title: "Test aktualisiert",
    lines: [],
  });

  const status = readStatus(ns);
  assert.equal(status.events.length, 1);
  assert.equal(status.events[0].title, "Test aktualisiert");
  assert.equal(clearStatusEvent(ns, "test"), true);
  assert.equal(readStatus(ns).events.length, 0);
});

test("routine notices stay out of the terminal while blockers remain visible", () => {
  let storedStatus = "";
  let storedNotices = "";
  const terminal = [];
  const ns = {
    read: (file) => (file.includes("notices") ? storedNotices : storedStatus),
    write: (file, value) => {
      if (file.includes("notices")) storedNotices = value;
      else storedStatus = value;
    },
    tprint: (message) => terminal.push(String(message)),
    toast: () => {},
  };

  reportInfo(ns, "info", "Normale Information");
  reportSuccess(ns, "success", "Erfolg");
  assert.equal(terminal.length, 0);

  reportBlocker(ns, "blocker", "Spieleraktion erforderlich", ["Ein Schritt fehlt."]);
  assert.equal(terminal.length, 1);
  assert.match(terminal[0], /Spieleraktion erforderlich/);

  reportQuietBlocker(ns, "quiet", "Nur im Dashboard", ["Keine Terminalmeldung."]);
  assert.equal(terminal.length, 1);
  assert.ok(readStatus(ns).events.some(({ title }) => title.includes("Nur im Dashboard")));
});

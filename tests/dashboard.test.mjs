import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardLines,
  buildLanguageSelector,
  createLanguageSelectionQueue,
  creditLine,
  formatAge,
  progressBar,
  resolveReactApi,
} from "../ui/dashboard.js";
import { TASKS } from "../core/config.js";
import { SCHEDULER_MODE } from "../lib/scheduler-mode.js";
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

test("dashboard credit is subtle and right-aligned", () => {
  const line = creditLine(40);
  assert.equal(line.length, 40);
  assert.ok(line.endsWith("© ame824 · grz-gamerz.de"));
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

test("notifier uses the saved English language without changing stored events", () => {
  let storedStatus = "";
  let storedNotices = "";
  const terminal = [];
  const toasts = [];
  const ns = {
    read: (file) => {
      if (file.includes("language")) return "en";
      if (file.includes("notices")) return storedNotices;
      return storedStatus;
    },
    write: (file, value) => {
      if (file.includes("notices")) storedNotices = value;
      else storedStatus = value;
    },
    tprint: (message) => terminal.push(String(message)),
    toast: (message) => toasts.push(String(message)),
  };

  reportBlocker(ns, "english-blocker", "Kein freier RAM für Hacking-Worker", [
    "Home-RAM erweitern oder einen Server mit freiem RAM übernehmen.",
  ], [
    "Einige Male n00dles manuell hacken oder das Root-Modul weiterlaufen lassen.",
  ]);

  assert.match(terminal[0], /ACTION REQUIRED: No free RAM for hacking workers/);
  assert.match(terminal[0], /1\. Hack n00dles manually/);
  assert.match(toasts[0], /ACTION REQUIRED: No free RAM for hacking workers/);
  assert.match(readStatus(ns).events[0].title, /MANUELLE AKTION/);
});

test("dashboard labels lightweight and full scheduler modes", () => {
  const ns = {
    format: {
      number: String,
      ram: (value) => `${value} GiB`,
    },
  };
  const base = {
    player: {
      money: 1,
      skills: { hacking: 1 },
      city: "Sector-12",
    },
    reset: { currentNode: 1, ownedSF: new Map() },
    hosts: 1,
    rooted: 1,
    homeRamUsed: 4,
    schedulerRunning: true,
    activeTasks: 0,
    workerProcesses: 0,
    workerThreads: 0,
    dashboardRam: 4.75,
    events: [],
    time: Date.now(),
  };

  const lightweight = buildDashboardLines(ns, {
    ...base,
    homeRamMax: 64,
    mode: SCHEDULER_MODE.lightweight,
    phaseTasks: 8,
    executableTasks: 5,
  }).join("\n");
  const full = buildDashboardLines(ns, {
    ...base,
    homeRamMax: 128,
    mode: SCHEDULER_MODE.full,
    phaseTasks: TASKS.length,
    executableTasks: 18,
  }).join("\n");

  assert.match(lightweight, /STARTPHASE \(leicht\)/);
  assert.match(lightweight, new RegExp(`5/8 ausführbar · 8/${TASKS.length} Phase`));
  assert.match(full, /VOLLBETRIEB/);
});

test("dashboard labels the minimal bootstrap phase", () => {
  const ns = {
    format: {
      number: String,
      ram: (value) => `${value} GiB`,
    },
  };
  const lines = buildDashboardLines(ns, {
    player: { money: 0, skills: { hacking: 1 }, city: "Sector-12" },
    reset: { currentNode: 1, ownedSF: new Map() },
    hosts: 1,
    rooted: 1,
    homeRamMax: 8,
    homeRamUsed: 4,
    mode: SCHEDULER_MODE.bootstrap,
    phaseTasks: 3,
    executableTasks: 3,
    schedulerRunning: true,
    activeTasks: 0,
    workerProcesses: 0,
    workerThreads: 0,
    dashboardRam: 0,
    events: [],
    time: Date.now(),
  }).join("\n");

  assert.match(lines, /BOOTSTRAP \(minimal\)/);
  assert.match(lines, new RegExp(`3/3 ausführbar · 3/${TASKS.length} Phase`));
});

test("dashboard renders English labels and its language buttons are interactive", () => {
  const ns = {
    format: {
      number: String,
      ram: (value) => `${value} GiB`,
    },
  };
  const lines = buildDashboardLines(ns, {
    player: { money: 0, skills: { hacking: 1 }, city: "Sector-12" },
    reset: { currentNode: 1, ownedSF: new Map() },
    hosts: 1,
    rooted: 1,
    homeRamMax: 128,
    homeRamUsed: 4,
    mode: SCHEDULER_MODE.full,
    phaseTasks: TASKS.length,
    executableTasks: TASKS.length,
    schedulerRunning: false,
    activeTasks: 0,
    workerProcesses: 0,
    workerThreads: 0,
    dashboardRam: 4.75,
    events: [],
    time: Date.now(),
  }, "en").join("\n");

  assert.match(lines, /STOPPED/);
  assert.match(lines, /PLAYER/);
  assert.match(lines, /RESOURCES/);
  assert.match(lines, /FULL OPERATION/);
  assert.match(lines, /MANUAL ACTIONS/);
  assert.match(lines, /RECENT ACTIVITY/);

  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  let selected = "";
  const selector = buildLanguageSelector(React, "de", (language) => {
    selected = language;
  });
  const englishButton = selector.children.find((child) => child?.type === "button" && child.children[0] === "EN");
  assert.ok(englishButton);
  englishButton.props.onClick();
  assert.equal(selected, "en");
});

test("dashboard resolves Bitburner's global React API without shadowing it", () => {
  const reactApi = {
    createElement: () => {},
  };

  assert.equal(resolveReactApi({ React: reactApi }), reactApi);
  assert.equal(resolveReactApi({}), null);
});

test("language button queues a pure signal for the Netscript loop", () => {
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  const selections = createLanguageSelectionQueue();
  const selector = buildLanguageSelector(React, "de", selections.select);
  const englishButton = selector.children.find(
    (child) => child?.type === "button" && child.children[0] === "EN",
  );

  englishButton.props.onClick();
  assert.equal(selections.take(), "en");
  assert.equal(selections.take(), null);
});

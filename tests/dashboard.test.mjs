import test from "node:test";
import assert from "node:assert/strict";
import {
  applyResponsiveTailLayout,
  autoUpdateText,
  buildDashboardLines,
  buildLanguageSelector,
  buildOverviewStats,
  calculateTailLayout,
  clearOverviewStats,
  createLanguageSelectionQueue,
  creditLine,
  formatAge,
  formatCountdown,
  formatDuration,
  progressBar,
  renderOverviewStats,
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

test("dashboard formats run duration compactly", () => {
  assert.equal(formatDuration(43_000), "0m 43s");
  assert.equal(formatDuration(6_823_000), "1h 53m");
  assert.equal(formatDuration(183_600_000), "2d 3h");
});

test("dashboard shows a live bilingual countdown to the next update check", () => {
  const dictionaries = {
    de: {
      updateCurrent: "aktuell",
      updateUnknown: "noch nicht geprüft",
      nextUpdateCheck: "nächste Prüfung",
    },
    en: {
      updateCurrent: "up to date",
      updateUnknown: "not checked yet",
      nextUpdateCheck: "next check",
    },
  };
  const status = {
    state: "current",
    version: "2026.07.31.5",
    checkedAt: 1_000_000,
  };

  assert.equal(formatCountdown(899_001), "15m 00s");
  assert.equal(formatCountdown(61_000), "1m 01s");
  assert.equal(formatCountdown(-1), "0s");
  assert.equal(
    autoUpdateText((key) => dictionaries.de[key], status, 1_300_000, 900_000),
    "aktuell 2026.07.31.5 (nächste Prüfung: 10m 00s)",
  );
  assert.equal(
    autoUpdateText((key) => dictionaries.en[key], status, 1_300_000, 900_000),
    "up to date 2026.07.31.5 (next check: 10m 00s)",
  );
});

test("dashboard tail layout scales down with the Bitburner window", () => {
  assert.deepEqual(calculateTailLayout(1_920, 1_080), {
    width: 720,
    height: 620,
    fontSize: 13,
    x: 8,
    y: 8,
  });
  assert.deepEqual(calculateTailLayout(1_366, 768), {
    width: 601,
    height: 522,
    fontSize: 12,
    x: 8,
    y: 8,
  });
  assert.deepEqual(calculateTailLayout(800, 500), {
    width: 420,
    height: 340,
    fontSize: 10,
    x: 8,
    y: 8,
  });
});

test("dashboard only resizes when the game window dimensions change", () => {
  const calls = [];
  let size = [1_366, 768];
  const ns = {
    ui: {
      windowSize: () => size,
      resizeTail: (...args) => calls.push(["resize", ...args]),
      setTailFontSize: (...args) => calls.push(["font", ...args]),
      moveTail: (...args) => calls.push(["move", ...args]),
    },
  };

  let viewport = applyResponsiveTailLayout(ns, "", true);
  assert.equal(viewport, "1366x768");
  assert.equal(calls.length, 3);

  viewport = applyResponsiveTailLayout(ns, viewport, true);
  assert.equal(calls.length, 3);

  size = [1_024, 640];
  viewport = applyResponsiveTailLayout(ns, viewport, true);
  assert.equal(viewport, "1024x640");
  assert.equal(calls.length, 6);
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

test("frequent routine activity never evicts current manual blockers", () => {
  let stored = "";
  const ns = {
    read: () => stored,
    write: (_file, value) => {
      stored = value;
    },
  };
  recordStatusEvent(ns, {
    key: "blocker:ports",
    level: "warning",
    title: "Port-Programm fehlt",
    lines: [],
  });
  for (let index = 0; index < 40; index += 1) {
    recordStatusEvent(ns, {
      key: `activity:${index}`,
      level: "info",
      title: `Aktivität ${index}`,
      lines: [],
    });
  }

  const status = readStatus(ns);
  assert.ok(status.events.some(({ key }) => key === "blocker:ports"));
  assert.equal(status.events.filter(({ level }) => level === "info").length, 16);
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

  assert.doesNotThrow(() => reportBlocker(ns, "empty-blocker", "Details optional"));
  assert.equal(terminal.length, 2);
  assert.match(terminal[1], /Details optional/);

  reportQuietBlocker(ns, "quiet", "Nur im Dashboard", ["Keine Terminalmeldung."]);
  assert.equal(terminal.length, 2);
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
    homeRamFocus: { active: true, current: 64, target: 1024 },
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
  assert.match(lightweight, /Home-RAM-Ziel: 64 GiB \/ 1024 GiB/);
  assert.match(lightweight, /RAM-Kauf\s+wird geprüft/);
  assert.match(lightweight, new RegExp(`5/8 ausführbar · 8/${TASKS.length} Phase`));
  assert.match(full, /VOLLBETRIEB/);
});

test("dashboard labels the dynamic middle stage and automatic RAM status", () => {
  const ns = {
    format: {
      number: String,
      ram: (value) => `${value} GiB`,
    },
  };
  const lines = buildDashboardLines(ns, {
    player: { money: 0, skills: { hacking: 1 }, city: "Sector-12" },
    reset: { currentNode: 3, ownedSF: new Map() },
    hosts: 1,
    rooted: 1,
    homeRamMax: 512,
    homeRamUsed: 64,
    homeRamFocus: {
      active: true,
      ramOnly: false,
      current: 512,
      target: 1_024,
      mediumAt: 512,
      purchaseState: "automatic",
    },
    mode: SCHEDULER_MODE.medium,
    phaseTasks: 12,
    executableTasks: 10,
    schedulerRunning: true,
    activeTasks: 0,
    workerProcesses: 1,
    workerThreads: 10,
    dashboardRam: 5,
    events: [],
    time: Date.now(),
  }).join("\n");

  assert.match(lines, /MITTELSTUFE \(RAM \+ Source-Files\)/);
  assert.match(lines, /RAM-Kauf\s+automatisch/);
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
  assert.equal(selector.children[0].children[0], "autoDoIt CONTROL CENTER");
  assert.equal(selector.props.style.borderLeft, "1px solid #00ffff");
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

test("dashboard writes bilingual efficiency values into the v3 Overview hooks", () => {
  const ns = {
    format: {
      number: (value) => Number(value).toFixed(1),
    },
  };
  const stats = buildOverviewStats(ns, {
    time: 60_000,
    reset: {
      lastAugReset: 0,
      ownedAugs: new Map([["BitWire", 1], ["Neurotrainer I", 1]]),
    },
    moneySources: { sinceInstall: { total: 120 } },
    homeRamUsed: 32,
    homeRamMax: 64,
    workerProcesses: 3,
    workerThreads: 140,
  }, "en");
  const hooks = new Map([
    ["overview-extra-hook-0", { style: {}, textContent: "" }],
    ["overview-extra-hook-1", { style: {}, textContent: "" }],
    ["overview-extra-hook-2", { style: {}, textContent: "" }],
  ]);
  const documentApi = {
    getElementById: (id) => hooks.get(id) ?? null,
  };

  assert.equal(renderOverviewStats(documentApi, stats), true);
  assert.match(hooks.get("overview-extra-hook-0").textContent, /Money avg\/s/);
  assert.match(hooks.get("overview-extra-hook-1").textContent, /\+\$2\.0\/s/);
  assert.match(hooks.get("overview-extra-hook-1").textContent, /3 \/ 140t/);
  assert.equal(hooks.get("overview-extra-hook-0").style.whiteSpace, "pre-line");

  clearOverviewStats(documentApi);
  assert.equal(hooks.get("overview-extra-hook-0").textContent, "");
  assert.equal(hooks.get("overview-extra-hook-1").textContent, "");
});

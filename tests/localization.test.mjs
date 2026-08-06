import test from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGE,
  dashboardText,
  localizeEvent,
  normalizeLanguage,
  readLanguage,
  writeLanguage,
} from "../core/localization.js";

test("language preference defaults to German and persists English", () => {
  let stored = "";
  const ns = {
    read: () => stored,
    write: (_file, value) => {
      stored = value;
    },
  };

  assert.equal(readLanguage(ns), LANGUAGE.de);
  assert.equal(writeLanguage(ns, "EN"), LANGUAGE.en);
  assert.equal(readLanguage(ns), LANGUAGE.en);
  assert.equal(normalizeLanguage("unknown"), LANGUAGE.de);
});

test("dashboard labels and status events translate to English", () => {
  assert.equal(dashboardText("en", "manualActions"), "MANUAL ACTIONS");
  assert.equal(
    dashboardText("en", "allModulesReleased", { ram: "128 GiB" }),
    "All modules released at 128 GiB",
  );

  const translated = localizeEvent({
    title: "MANUELLE AKTION: Kein freier RAM für Hacking-Worker",
    lines: [
      "/workers/hack.js benötigt 1.70 GiB pro Thread.",
      "Home-RAM erweitern oder einen Server mit freiem RAM übernehmen.",
    ],
  }, "en");

  assert.equal(translated.title, "ACTION REQUIRED: No free RAM for hacking workers");
  assert.equal(translated.lines[0], "/workers/hack.js requires 1.70 GiB per thread.");
  assert.equal(translated.lines[1], "Upgrade Home RAM or root a server with free RAM.");

  const job = localizeEvent({
    title: "Automatische Jobsteuerung verfügbar",
    lines: [
      "Berufspriorität: Software, danach IT.",
      "Hacknet und Cloudserver erhalten je 1 % Wachstumsbudget; übrige optionale Käufe bleiben pausiert.",
    ],
  }, "en");
  assert.equal(job.title, "Automatic job control is available");
  assert.equal(job.lines[0], "Job priority: Software, followed by IT.");
  assert.equal(
    job.lines[1],
    "Hacknet and cloud servers each receive a 1% growth budget; other optional purchases remain paused.",
  );

  const manualJob = localizeEvent({
    title: "MANUELLE AKTION: Bester manueller Job: Omega Software",
    lines: [
      "Empfehlung: Software Consultant.",
      "Stadt: Ishima.",
      "Geschätzter Grundverdienst: 726 pro Sekunde.",
      "Bei Omega Software als Software Consultant bewerben.",
    ],
  }, "en");
  assert.equal(manualJob.title, "ACTION REQUIRED: Best manual job: Omega Software");
  assert.deepEqual(manualJob.lines, [
    "Recommendation: Software Consultant.",
    "City: Ishima.",
    "Estimated base earnings: 726 per second.",
    "Apply to Omega Software as Software Consultant.",
  ]);

  const ports = localizeEvent({
    title: "MANUELLE AKTION: Netzwerkübernahme wartet auf SQLInject.exe",
    lines: [
      "Hacking auf 750 steigern oder TOR und SQLInject.exe manuell kaufen.",
      "Port-Programme: 4/5; nächste Root-Stufe benötigt 5 offene Ports.",
      "29 Server sind noch durch Port-Anforderungen gesperrt.",
      "29 weitere Server werden damit direkt übernehmbar.",
    ],
  }, "en");
  assert.equal(ports.title, "ACTION REQUIRED: Network takeover is waiting for SQLInject.exe");
  assert.deepEqual(ports.lines, [
    "Raise Hacking to 750 or manually purchase TOR and SQLInject.exe.",
    "Port programs: 4/5; the next root tier requires 5 open ports.",
    "29 servers are still locked by port requirements.",
    "29 more servers will become immediately accessible.",
  ]);

  const route = localizeEvent({
    title: "Wechsel zu BitNode 4",
    lines: [
      "Automatisierungsziel: Source-File 4.2 reduziert die Singularity-RAM-Kosten.",
    ],
  }, "en");
  assert.equal(route.title, "Switching to BitNode 4");
  assert.deepEqual(route.lines, [
    "Automation target: Source-File 4.2 reduces Singularity RAM costs.",
  ]);

  const hackingGoal = localizeEvent({
    title: "Hacking-Training für BitNode-Ziel gestartet",
    lines: [
      "Phase: world-daemon-hacking",
      "Ziel-Level: 9000.",
      "Normale Fraktions-, Job- und Charisma-Arbeit bleibt bis zum Ziel pausiert.",
    ],
  }, "en");
  assert.equal(hackingGoal.title, "Hacking training for BitNode goal started");
  assert.deepEqual(hackingGoal.lines, [
    "Stage: world-daemon-hacking",
    "Target level: 9000.",
    "Regular faction, job, and Charisma work remains paused until the goal is reached.",
  ]);

  const stanek = localizeEvent({
    title: "Staneks Geschenk automatisch angenommen",
    lines: ["BN13 kann ohne manuelle Unterbrechung fortgesetzt werden."],
  }, "en");
  assert.equal(stanek.title, "Stanek's Gift accepted automatically");
  assert.deepEqual(stanek.lines, [
    "BN13 can continue without manual interruption.",
  ]);

  const crime = localizeEvent({
    title: "Crime-Manager optimiert auf negatives Karma pro Sekunde",
    lines: [
      "Erfolgschance: 82.05%",
      "Erwartetes Karma: -0.82 / s",
      "Dauer je Versuch: 3 seconds",
    ],
  }, "en");
  assert.equal(crime.title, "Crime manager is optimizing for negative karma per second");
  assert.deepEqual(crime.lines, [
    "Success chance: 82.05%",
    "Expected karma: -0.82 / s",
    "Duration per attempt: 3 seconds",
  ]);
});

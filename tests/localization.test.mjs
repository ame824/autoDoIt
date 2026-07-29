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
});

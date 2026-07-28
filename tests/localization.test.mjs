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
});

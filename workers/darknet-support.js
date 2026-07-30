import { CONFIG } from "../core/config.js";

const CRAWLER_FILE = "/workers/darknet-crawler.js";

function send(ns, level, key, title, lines = []) {
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

function boolArg(value) {
  return value === true || String(value).toLowerCase() === "true";
}

async function trainCharisma(ns) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await ns.dnet.phishingAttack();
    send(ns, "info", `darknet-charisma-${ns.getHostname()}`, "Darknet trainiert Charisma automatisch", [
      String(result.message ?? "Phishing-Angriff abgeschlossen."),
    ]);
  }
}

async function migrateRider(ns, target) {
  if (!target) return;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const details = ns.dnet.getServerDetails(target);
    if (!details.isOnline || !details.isConnectedToCurrentServer || details.isStationary) return;
    const result = await ns.dnet.induceServerMigration(target);
    if (!result.success) return;
    send(ns, "info", `darknet-migration-${target}`, "Darknet-Servermigration wird geladen", [
      `${target} trägt seinen aktiven Arbeiter über mögliche Luftlücken.`,
    ]);
  }
}

function restartCrawler(ns, version) {
  const ram = ns.getScriptRam(CRAWLER_FILE, ns.getHostname());
  const threads = Math.max(
    1,
    Math.min(
      CONFIG.darknetWorkerMaxThreads,
      Math.floor(ns.getServerMaxRam(ns.getHostname()) / Math.max(ram, 0.0001)),
    ),
  );
  ns.spawn(CRAWLER_FILE, threads, version);
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const version = String(ns.args[0] ?? "unknown");
  const migrationTarget = String(ns.args[1] ?? "");
  const shouldTrain = boolArg(ns.args[2]);
  const shouldStorm = boolArg(ns.args[3]);

  try {
    if (shouldTrain) await trainCharisma(ns);
    if (migrationTarget) await migrateRider(ns, migrationTarget);
    if (shouldStorm && ns.fileExists("STORM_SEED.exe", ns.getHostname())) {
      const result = ns.dnet.unleashStormSeed();
      send(ns, result.success ? "warning" : "info", "darknet-storm", result.success
        ? "STORM_SEED ausgelöst – Darknet wird neu aufgebaut"
        : "STORM_SEED konnte nicht ausgelöst werden");
    }
  } catch (error) {
    send(ns, "warning", `darknet-support-${ns.getHostname()}`, "Darknet-Hilfsarbeiter wartet", [
      String(error),
    ]);
  }
  restartCrawler(ns, version);
}

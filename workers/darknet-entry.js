import { CONFIG } from "../core/config.js";
import { getDarknetCandidates } from "../lib/darknet-logic.js";

const CRAWLER_FILE = "/workers/darknet-crawler.js";
const SUPPORT_FILES = [
  CRAWLER_FILE,
  "/workers/darknet-support.js",
  "/lib/darknet-logic.js",
  "/core/config.js",
];
const LAST_SENT = new Map();

function send(ns, level, key, title, lines = []) {
  const now = Date.now();
  if (now - Number(LAST_SENT.get(key) ?? 0) < CONFIG.darknetWorkerEventCooldownMs) return;
  LAST_SENT.set(key, now);
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

async function authenticate(ns, host, details) {
  if (details.hasSession) return true;
  for (const password of getDarknetCandidates(details, [], host)) {
    let result = await ns.dnet.authenticate(host, password);
    if (result.code === 408) result = await ns.dnet.authenticate(host, password);
    if (result.success) return true;
  }
  return false;
}

async function freeTargetRam(ns, host, requiredRam) {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (freeRam + 0.0001 >= requiredRam) return true;
    if (ns.dnet.getBlockedRam(host) <= 0) return false;
    const result = await ns.dnet.memoryReallocation(host);
    if (!result.success) return false;
  }
  return false;
}

function matchingCrawler(ns, host, version) {
  return ns.ps(host).find(
    (process) => process.filename === CRAWLER_FILE &&
      String(process.args[0] ?? "") === version,
  );
}

async function seedCrawler(ns, host, version) {
  if (matchingCrawler(ns, host, version)) return "running";
  for (const process of ns.ps(host)) {
    if (process.filename === CRAWLER_FILE) ns.kill(process.pid);
  }

  await ns.scp(SUPPORT_FILES, host, ns.getHostname());
  const scriptRam = ns.getScriptRam(CRAWLER_FILE, host);
  if (scriptRam <= 0 || scriptRam > ns.getServerMaxRam(host)) return "failed";
  if (!(await freeTargetRam(ns, host, scriptRam))) return "failed";

  const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  const threads = Math.max(
    0,
    Math.min(CONFIG.darknetWorkerMaxThreads, Math.floor(freeRam / scriptRam)),
  );
  return threads > 0 && ns.exec(CRAWLER_FILE, host, threads, version) > 0
    ? "started"
    : "failed";
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const version = String(ns.args[0] ?? "unknown");

  while (true) {
    try {
      let charismaBlocked = false;
      for (const host of ns.dnet.probe()) {
        const details = ns.dnet.getServerDetails(host);
        if (!details.isOnline || !details.isConnectedToCurrentServer) continue;
        if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) {
          charismaBlocked = true;
          continue;
        }
        if (!(await authenticate(ns, host, details))) continue;
        if (await seedCrawler(ns, host, version) === "started") {
          send(ns, "success", `darknet-seeded-${host}`, `Darknet-Einstieg geöffnet: ${host}`, [
            "Der vollständige Passwort-Crawler wurde auf dem Nachbarserver gestartet.",
          ]);
        }
      }

      if (charismaBlocked) {
        const result = await ns.dnet.phishingAttack();
        send(ns, "info", `darknet-entry-charisma-${ns.getHostname()}`, "Darknet trainiert Charisma automatisch", [
          String(result.message ?? "Phishing-Angriff abgeschlossen."),
        ]);
      }
    } catch (error) {
      send(ns, "warning", `darknet-entry-${ns.getHostname()}`, "Darknet-Einstiegsarbeiter wartet", [
        String(error),
      ]);
    }
    await ns.sleep(CONFIG.darknetWorkerScanMs);
  }
}

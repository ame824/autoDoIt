import { CONFIG } from "../core/config.js";
import { getDarknetCandidates } from "../lib/darknet-logic.js";

const CRAWLER_FILE = "/workers/darknet-crawler.js";
const ENTRY_FILE = "/workers/darknet-entry.js";
const LAUNCHER_FILE = "/workers/darknet-launcher.js";
const SUPPORT_FILES = [
  ENTRY_FILE,
  LAUNCHER_FILE,
  "/workers/darknet-cache.js",
  CRAWLER_FILE,
  "/workers/darknet-support.js",
  "/lib/darknet-logic.js",
  "/core/config.js",
];
const LAST_SENT = new Map();
const LAST_SEEDED = new Map();
const RESEED_MS = 60_000;

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

async function seedLauncher(ns, host, version) {
  const now = Date.now();
  if (now - Number(LAST_SEEDED.get(host) ?? 0) < RESEED_MS) return false;
  await ns.scp(SUPPORT_FILES, host);
  const pid = ns.exec(LAUNCHER_FILE, host, 1, version);
  if (pid === 0) return false;
  LAST_SEEDED.set(host, now);
  return true;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const version = String(ns.args[0] ?? "unknown");

  while (true) {
    try {
      for (const host of ns.dnet.probe()) {
        const details = ns.dnet.getServerDetails(host);
        if (!details.isOnline || !details.isConnectedToCurrentServer) continue;
        if (!(await authenticate(ns, host, details))) continue;
        if (await seedLauncher(ns, host, version)) {
          send(ns, "success", `darknet-seeded-${host}`, `Darknet-Einstieg geöffnet: ${host}`, [
            "Der RAM- und Crawler-Starter wurde auf dem Nachbarserver gestartet.",
          ]);
        }
      }
    } catch (error) {
      send(ns, "warning", `darknet-entry-${ns.getHostname()}`, "Darknet-Einstiegsarbeiter wartet", [
        String(error),
      ]);
    }
    await ns.sleep(CONFIG.darknetWorkerScanMs);
  }
}

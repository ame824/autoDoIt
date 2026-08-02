import { CONFIG } from "../core/config.js";
import {
  exchangeDarknetIntel,
  getDarknetCandidates,
  getSharedDarknetCandidates,
  parseStasisCommand,
} from "../lib/darknet-logic.js";

const CRAWLER_FILE = "/workers/darknet-crawler.js";
const ENTRY_FILE = "/workers/darknet-entry.js";
const LAUNCHER_FILE = "/workers/darknet-launcher.js";
const CACHE_FILE = "/workers/darknet-cache.js";
const STASIS_FILE = "/workers/darknet-stasis.js";
const SUPPORT_FILES = [
  ENTRY_FILE,
  LAUNCHER_FILE,
  CACHE_FILE,
  CRAWLER_FILE,
  "/workers/darknet-support.js",
  STASIS_FILE,
  "/lib/darknet-logic.js",
  "/core/config.js",
];
const LAST_SENT = new Map();
const LAST_SEEDED = new Map();

function send(ns, level, key, title, lines = []) {
  const now = Date.now();
  if (now - Number(LAST_SENT.get(key) ?? 0) < CONFIG.darknetWorkerEventCooldownMs) return;
  LAST_SENT.set(key, now);
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

function readLocalIntel(ns, current) {
  const intel = [];
  for (const file of ns.ls(current, ".data.txt")) {
    try {
      intel.push(ns.read(file));
    } catch {
      // A moving/restarting server can invalidate a clue file.
    }
  }
  return intel;
}

async function authenticate(ns, current, host, details, localIntel, sharedIntel) {
  if (details.hasSession) return true;
  const candidates = [
    ...getSharedDarknetCandidates(sharedIntel, host, details, current),
    ...getDarknetCandidates(details, localIntel, host),
  ];
  for (const password of new Set(candidates)) {
    let result = await ns.dnet.authenticate(host, password);
    if (result.code === 408) result = await ns.dnet.authenticate(host, password);
    if (result.success) {
      exchangeDarknetIntel(
        ns,
        CONFIG.darknetIntelPort,
        [{ server: host, password: String(password) }],
        current,
      );
      return true;
    }
  }
  return false;
}

async function seedLauncher(ns, host, version) {
  const now = Date.now();
  if (now - Number(LAST_SEEDED.get(host) ?? 0) < CONFIG.darknetWorkerReseedMs) return false;
  await ns.scp(SUPPORT_FILES, host);
  const pid = ns.exec(LAUNCHER_FILE, host, 1, version);
  if (pid === 0) return false;
  LAST_SEEDED.set(host, now);
  return true;
}

function peekStasisCommand(ns, current) {
  const port = ns.getPortHandle(CONFIG.darknetCommandPort);
  if (port.empty()) return null;
  const raw = port.peek();
  const command = parseStasisCommand(raw);
  if (!command) {
    port.read();
    return null;
  }
  return command.target === current ? { ...command, raw } : null;
}

function startStasisWorker(ns, version, enable) {
  const current = ns.getHostname();
  if (!ns.fileExists(STASIS_FILE, current)) return false;
  const currentThreads = Number(ns.getRunningScript()?.threads ?? 1);
  ns.spawn(
    STASIS_FILE,
    { threads: 1, spawnDelay: 100 },
    version,
    Boolean(enable),
    currentThreads,
    ENTRY_FILE,
  );
  return true;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const version = String(ns.args[0] ?? "unknown");

  while (true) {
    try {
      const current = ns.getHostname();
      const localIntel = readLocalIntel(ns, current);
      const sharedIntel = exchangeDarknetIntel(
        ns,
        CONFIG.darknetIntelPort,
        localIntel,
        current,
      );
      const caches = ns.ls(current, ".cache");
      if (caches.length > 0 && ns.fileExists(CACHE_FILE, current)) {
        const threads = Math.max(1, Number(ns.getRunningScript()?.threads ?? 1));
        send(ns, "success", `darknet-cache-sweep-${current}`,
          `Darknet-Cache-Sammler startet auf ${current}`, [
            `${caches.length} Cache-Datei(en) werden vor dem nächsten Seed-Zyklus geöffnet.`,
          ]);
        ns.spawn(CACHE_FILE, { threads: 1, spawnDelay: 100 }, version, ENTRY_FILE, threads);
        return;
      }
      const stasisCommand = peekStasisCommand(ns, current);
      if (stasisCommand && startStasisWorker(ns, version, stasisCommand.enable)) {
        const port = ns.getPortHandle(CONFIG.darknetCommandPort);
        if (String(port.peek()) === String(stasisCommand.raw)) port.read();
        send(ns, "info", `darknet-stasis-request-${current}`,
          `Leichter Darknet-Worker übernimmt Stasis-Auftrag: ${current}`);
        return;
      }
      for (const host of ns.dnet.probe()) {
        const details = ns.dnet.getServerDetails(host);
        if (!details.isOnline || !details.isConnectedToCurrentServer) continue;
        if (!(await authenticate(ns, current, host, details, localIntel, sharedIntel))) continue;
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

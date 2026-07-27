import { CONFIG } from "../core/config.js";
import { getDarknetCandidates } from "../lib/darknet-logic.js";

const WORKER_FILE = "/workers/darknet-crawler.js";
const SUPPORT_FILES = [WORKER_FILE, "/lib/darknet-logic.js", "/core/config.js"];

function send(ns, level, key, title, lines = []) {
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

async function readLogs(ns, host, details) {
  if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) return [];
  try {
    const result = await ns.dnet.heartbleed(host, { peek: true, logsToCapture: 25 });
    return result.success ? result.logs : [];
  } catch {
    return [];
  }
}

async function freeRam(ns, host) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (ns.dnet.getBlockedRam(host) <= 0) return;
    const result = await ns.dnet.memoryReallocation(host);
    if (!result.success) return;
  }
}

async function openCaches(ns, current) {
  for (const file of ns.ls(current, ".cache")) {
    try {
      const reward = ns.dnet.openCache(file, true);
      send(ns, "success", `darknet-cache-${file}`, `Darknet-Cache geöffnet: ${file}`, [
        String(reward.message ?? "Belohnung eingesammelt."),
      ]);
    } catch {
      // A moving server can invalidate a cache between ls() and openCache().
    }
  }
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const current = ns.getHostname();
  let visited;
  try {
    visited = new Set(JSON.parse(String(ns.args[0] ?? "[]")));
  } catch {
    visited = new Set();
  }
  visited.add(current);

  try {
    await openCaches(ns, current);
    const currentDetails = ns.dnet.getServerDetails(current);
    if (Number(currentDetails.depth) >= CONFIG.darknetWorkerDepth) return;

    let launched = 0;
    const neighbors = ns.dnet.probe();
    for (const host of neighbors) {
      if (visited.has(host)) continue;
      const details = ns.dnet.getServerDetails(host);
      if (!details.isOnline || !details.isConnectedToCurrentServer) continue;

      const logs = await readLogs(ns, host, details);
      const candidates = getDarknetCandidates(details, logs, host);
      let authenticated = Boolean(details.hasSession);
      for (const password of candidates) {
        const result = await ns.dnet.authenticate(host, password);
        if (result.success) {
          authenticated = true;
          break;
        }
        if (result.code === 408) {
          const retry = await ns.dnet.authenticate(host, password);
          if (retry.success) {
            authenticated = true;
            break;
          }
        }
      }

      if (!authenticated) {
        send(ns, "warning", `darknet-unsolved-${host}`, `Darknet-Zugang benötigt Hilfe: ${details.modelId}`, [
          `Server: ${host}, Tiefe ${details.depth}`,
          `Hinweis: ${details.passwordHint || "kein statischer Hinweis"}`,
          "autoDoIt prüft Logs und Server später erneut.",
        ]);
        continue;
      }

      send(ns, "success", `darknet-auth-${host}`, `Darknet-Server geöffnet: ${host}`, [
        `Tiefe ${details.depth}, Modell ${details.modelId}`,
      ]);
      await freeRam(ns, host);
      await ns.scp(SUPPORT_FILES, host, current);
      const nextVisited = JSON.stringify([...visited, host].slice(-80));
      if (ns.exec(WORKER_FILE, host, 1, nextVisited) > 0) launched += 1;
    }

    const canStorm =
      CONFIG.darknetAutoStormSeed &&
      launched === 0 &&
      Number(currentDetails.depth) >= CONFIG.darknetStormMinimumDepth &&
      ns.fileExists("STORM_SEED.exe", current);
    if (canStorm) {
      const priorNeighbors = [...neighbors].sort().join("|");
      send(ns, "warning", "darknet-storm-pending", "Darknet ist festgefahren – Webstorm wird vorbereitet", [
        `STORM_SEED auf Tiefe ${currentDetails.depth}; erneute Prüfung in ${Math.round(CONFIG.darknetStormStuckMs / 60_000)} Minuten.`,
      ]);
      await ns.sleep(CONFIG.darknetStormStuckMs);
      await openCaches(ns, current);
      const currentNeighbors = [...ns.dnet.probe()].sort().join("|");
      if (currentNeighbors === priorNeighbors && ns.fileExists("STORM_SEED.exe", current)) {
        const result = ns.dnet.unleashStormSeed();
        send(ns, result.success ? "warning" : "info", "darknet-storm", result.success
          ? "STORM_SEED ausgelöst – Darknet wird neu aufgebaut"
          : "STORM_SEED konnte nicht ausgelöst werden");
      }
    }
  } catch (error) {
    send(ns, "warning", `darknet-worker-${current}`, `Darknet-Arbeiter auf ${current} beendet`, [String(error)]);
  }
}

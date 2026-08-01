import { CONFIG } from "../core/config.js";

const CRAWLER_FILE = "/workers/darknet-crawler.js";
const ENTRY_FILE = "/workers/darknet-entry.js";
const RESTART_FILES = new Set([CRAWLER_FILE, ENTRY_FILE]);

export function resolveStasisRestartFile(value) {
  const requested = String(value ?? CRAWLER_FILE);
  return RESTART_FILES.has(requested) ? requested : CRAWLER_FILE;
}

function send(ns, level, key, title, lines = []) {
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

function respond(ns, target, enable, success, message = "") {
  ns.tryWritePort(CONFIG.darknetCommandResponsePort, JSON.stringify({
    type: "stasis-result",
    target,
    enable,
    success,
    message: String(message),
  }));
}

function boolArg(value) {
  return value === true || String(value).toLowerCase() === "true";
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const version = String(ns.args[0] ?? "unknown");
  const shouldLink = boolArg(ns.args[1]);
  const workerThreads = Math.max(1, Math.floor(Number(ns.args[2]) || 1));
  const restartFile = resolveStasisRestartFile(ns.args[3]);
  const host = ns.getHostname();

  try {
    const result = await ns.dnet.setStasisLink(shouldLink);
    send(ns, result.success ? "success" : "warning", `darknet-stasis-${host}`,
      result.success
        ? `Stasis-Link ${shouldLink ? "gesetzt" : "entfernt"}: ${host}`
        : `Stasis-Link konnte nicht ${shouldLink ? "gesetzt" : "entfernt"} werden: ${host}`,
      [String(result.message ?? "Keine Rückmeldung der Darknet-API.")]);
    respond(ns, host, shouldLink, Boolean(result.success), result.message);
  } catch (error) {
    send(ns, "warning", `darknet-stasis-${host}`, `Stasis-Link wartet auf ${host}`, [
      String(error),
    ]);
    respond(ns, host, shouldLink, false, error);
  }

  ns.spawn(restartFile, { threads: workerThreads, spawnDelay: 100 }, version);
}

import { CONFIG } from "../core/config.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const TURN_WORKER = "/workers/ipvgo-turn.js";

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.ipvGoEnabled) return;
  if (!ns.fileExists(TURN_WORKER, "home")) {
    reportBlocker(ns, "ipvgo-worker", "IPvGO-Zugphase fehlt", [TURN_WORKER]);
    return;
  }
  while (true) {
    if (!ns.scriptRunning(TURN_WORKER, "home")) {
      const required = ns.getScriptRam(TURN_WORKER, "home");
      const free = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      if (required > 0 && free + 0.0001 >= required) ns.run(TURN_WORKER, 1);
      else reportInfo(ns, "ipvgo-worker-ram", "IPvGO-Zug wartet auf freien RAM", [
        `${ns.format.ram(required)} benötigt, ${ns.format.ram(free)} frei.`,
      ], 60_000);
    }
    await ns.sleep(250);
  }
}

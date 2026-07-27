import { WORKER_FILES } from "../core/config.js";
import { scanNetwork } from "../core/network.js";
import { reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const { hosts } = scanNetwork(ns);
  let updated = 0;

  for (const host of hosts) {
    if (host === "home" || !ns.hasRootAccess(host) || ns.getServerMaxRam(host) <= 0) continue;
    const ok = await ns.scp([...WORKER_FILES], host, "home");
    if (ok) updated += 1;
  }

  if (updated > 0) {
    reportSuccess(ns, `workers-${updated}`, "Hacking-Worker verteilt", [
      `${updated} Server besitzen die aktuelle Worker-Version.`,
    ]);
  }
}


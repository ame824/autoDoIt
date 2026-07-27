import { scanNetwork } from "../core/network.js";
import { reportInfo, reportSuccess } from "../core/notifier.js";

const OPENERS = [
  ["BruteSSH.exe", (ns, host) => ns.brutessh(host)],
  ["FTPCrack.exe", (ns, host) => ns.ftpcrack(host)],
  ["relaySMTP.exe", (ns, host) => ns.relaysmtp(host)],
  ["HTTPWorm.exe", (ns, host) => ns.httpworm(host)],
  ["SQLInject.exe", (ns, host) => ns.sqlinject(host)],
];

/** @param {NS} ns */
export async function main(ns) {
  const { hosts } = scanNetwork(ns);
  const available = OPENERS.filter(([file]) => ns.fileExists(file, "home"));
  let rooted = 0;
  let blocked = 0;

  for (const host of hosts) {
    if (host === "home" || ns.hasRootAccess(host)) continue;
    const required = ns.getServerNumPortsRequired(host);
    if (required > available.length) {
      blocked += 1;
      continue;
    }

    for (const [, open] of available) {
      try {
        open(ns, host);
      } catch {
        // A port may already be open or an executable may be unavailable in this BitNode.
      }
    }

    try {
      ns.nuke(host);
      if (ns.hasRootAccess(host)) rooted += 1;
    } catch {
      blocked += 1;
    }
  }

  if (rooted > 0) {
    reportSuccess(ns, `rooted-${rooted}`, `${rooted} neue Server übernommen`, [
      `${hosts.length} Netzwerkziele wurden geprüft.`,
    ]);
  } else if (blocked > 0) {
    const nextProgram = OPENERS.find(([file]) => !ns.fileExists(file, "home"))?.[0];
    if (nextProgram) {
      reportInfo(ns, `root-program-${nextProgram}`, "Weitere Server warten auf ein Port-Programm", [
        `Als Nächstes fehlt wahrscheinlich ${nextProgram}.`,
        "Das Programm-Modul kauft oder erstellt es automatisch, sobald Singularity verfügbar ist.",
      ]);
    }
  }
}


import { scanNetwork } from "../core/network.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { clearStatusEvent } from "../core/status.js";
import { hasApiAccess } from "../lib/logic.js";
import { analyzePortAccess, PORT_PROGRAMS } from "../lib/port-programs.js";

const OPENERS = [
  [PORT_PROGRAMS[0].file, (ns, host) => ns.brutessh(host)],
  [PORT_PROGRAMS[1].file, (ns, host) => ns.ftpcrack(host)],
  [PORT_PROGRAMS[2].file, (ns, host) => ns.relaysmtp(host)],
  [PORT_PROGRAMS[3].file, (ns, host) => ns.httpworm(host)],
  [PORT_PROGRAMS[4].file, (ns, host) => ns.sqlinject(host)],
];
const PORT_BLOCKER_KEY = "blocker:root-port-program";

/** @param {NS} ns */
export async function main(ns) {
  const { hosts } = scanNetwork(ns);
  const available = OPENERS.filter(([file]) => ns.fileExists(file, "home"));
  const availableFiles = new Set(available.map(([file]) => file));
  let rooted = 0;
  const blockedRequirements = [];

  for (const host of hosts) {
    if (host === "home" || ns.hasRootAccess(host)) continue;
    const required = ns.getServerNumPortsRequired(host);
    if (required > available.length) {
      blockedRequirements.push(required);
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
      blockedRequirements.push(required);
    }
  }

  if (rooted > 0) {
    reportSuccess(ns, `rooted-${rooted}`, `${rooted} neue Server übernommen`, [
      `${hosts.length} Netzwerkziele wurden geprüft.`,
    ]);
    return;
  }

  if (blockedRequirements.length === 0) {
    clearStatusEvent(ns, PORT_BLOCKER_KEY);
    return;
  }

  const access = analyzePortAccess(blockedRequirements, availableFiles);
  if (!access.nextProgram) return;
  const details = [
    `${access.blockedCount} Server sind noch durch Port-Anforderungen gesperrt.`,
    `Port-Programme: ${access.availableCount}/${PORT_PROGRAMS.length}; nächste Root-Stufe benötigt ${access.minimumRequiredPorts} offene Ports.`,
    `Als Nächstes fehlt ${access.nextProgram.file}.`,
  ];
  if (access.unlockedByNext > 0) {
    details.push(`${access.unlockedByNext} weitere Server werden damit direkt übernehmbar.`);
  }

  const singularity = hasApiAccess(ns.getResetInfo(), [4], [4]);
  if (singularity) {
    clearStatusEvent(ns, PORT_BLOCKER_KEY);
    reportInfo(ns, `root-program-${access.nextProgram.file}`, "Weitere Server warten auf ein Port-Programm", [
      ...details,
      "Das Programm-Modul kauft es automatisch, sobald genügend Geld verfügbar ist.",
    ]);
    return;
  }

  const hackingLevel = ns.getHackingLevel();
  const action = hackingLevel >= access.nextProgram.hackingLevel
    ? `Im Menü „Create Program“ ${access.nextProgram.file} erstellen.`
    : `Hacking auf ${access.nextProgram.hackingLevel} steigern oder TOR und ${access.nextProgram.file} manuell kaufen.`;
  reportBlocker(
    ns,
    "root-port-program",
    `Netzwerkübernahme wartet auf ${access.nextProgram.file}`,
    [
      action,
      details[1],
      details[0],
      access.unlockedByNext > 0
        ? `${access.unlockedByNext} weitere Server werden damit direkt übernehmbar.`
        : "autoDoIt übernimmt danach sofort alle damit erreichbaren Server.",
    ],
  );
}

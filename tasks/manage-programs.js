import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const PROGRAM_ORDER = [
  "BruteSSH.exe",
  "FTPCrack.exe",
  "relaySMTP.exe",
  "HTTPWorm.exe",
  "SQLInject.exe",
  "ServerProfiler.exe",
  "DeepscanV1.exe",
  "DeepscanV2.exe",
  "AutoLink.exe",
  "Formulas.exe",
];

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-programs", "TOR und Programme können noch nicht automatisiert werden", [
      "Die Singularity-API benötigt BitNode 4 oder Source-File 4.",
    ], [
      "TOR und benötigte Programme vorerst manuell im Terminal/Dark Web kaufen.",
      "BitNode 4 abschließen, um Source-File 4 freizuschalten.",
    ]);
    return;
  }

  if (!ns.hasTorRouter()) {
    if (ns.singularity.purchaseTor()) {
      reportSuccess(ns, "tor-bought", "TOR-Router gekauft");
    } else {
      reportInfo(ns, "tor-saving", "TOR-Router wartet auf ausreichend Geld");
      return;
    }
  }

  const offered = new Set(ns.singularity.getDarkwebPrograms());
  for (const program of PROGRAM_ORDER) {
    if (ns.fileExists(program, "home") || !offered.has(program)) continue;
    const cost = ns.singularity.getDarkwebProgramCost(program);
    if (cost > ns.getPlayer().money) {
      reportInfo(ns, `program-saving-${program}`, `Spare für ${program}`, [
        `Preis: ${ns.format.number(cost)}`,
      ]);
      return;
    }
    if (ns.singularity.purchaseProgram(program)) {
      reportSuccess(ns, `program-${program}`, `${program} gekauft`);
      return;
    }
  }
}


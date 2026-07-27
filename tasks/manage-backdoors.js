import { getCapabilities } from "../core/capabilities.js";
import { scanNetwork, pathTo } from "../core/network.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const PRIORITY = [
  "CSEC",
  "avmnite-02h",
  "I.I.I.I",
  "run4theh111z",
  "fulcrumassets",
  "The-Cave",
];

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-backdoors", "Backdoors müssen noch manuell installiert werden", [
      "Automatisches Verbinden und installBackdoor benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Bei CSEC, avmnite-02h, I.I.I.I und run4theh111z manuell Backdoors installieren.",
    ]);
    return;
  }

  const { hosts, parent } = scanNetwork(ns);
  const hackingLevel = ns.getHackingLevel();
  const ordered = PRIORITY.filter((host) => hosts.includes(host));

  const target = ordered.find((host) => {
    if (host === "home" || !ns.hasRootAccess(host)) return false;
    if (ns.getServerRequiredHackingLevel(host) > hackingLevel) return false;
    try {
      return !ns.getServer(host).backdoorInstalled;
    } catch {
      return false;
    }
  });
  if (!target) return;

  const route = pathTo(parent, target);
  if (route.length === 0 || !ns.singularity.connect("home")) return;
  for (const host of route.slice(1)) {
    if (!ns.singularity.connect(host)) {
      reportInfo(ns, `backdoor-route-${host}`, `Verbindung zu ${host} fehlgeschlagen`);
      ns.singularity.connect("home");
      return;
    }
  }

  await ns.singularity.installBackdoor();
  ns.singularity.connect("home");
  reportSuccess(ns, `backdoor-${target}`, `Backdoor installiert: ${target}`);
}

import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { chooseNextBitNode } from "../lib/logic.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-progression", "BitNode-Abschluss ist noch nicht automatisierbar", [
      "Der Wechsel zum nächsten BitNode benötigt Source-File 4 oder BitNode 4.",
    ], [
      "The Red Pill installieren.",
      "w0r1d_d43m0n finden, Root-Zugriff erhalten und manuell abschließen.",
      "Als frühes Ziel BitNode 4 wählen.",
    ]);
    return;
  }

  const installed = new Set(ns.singularity.getOwnedAugmentations(false));
  if (!installed.has("The Red Pill")) return;
  if (!ns.serverExists("w0r1d_d43m0n") || !ns.hasRootAccess("w0r1d_d43m0n")) {
    reportInfo(ns, "daemon-not-ready", "The Red Pill ist installiert", [
      "w0r1d_d43m0n ist noch nicht entdeckt oder besitzt noch keinen Root-Zugriff.",
    ]);
    return;
  }
  if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel("w0r1d_d43m0n")) return;

  const nextNode = chooseNextBitNode(capabilities.reset, CONFIG.bitNodeOrder);
  reportInfo(ns, `next-bitnode-${nextNode}`, `Wechsel zu BitNode ${nextNode}`, [
    "Fortschritt ist ausreichend; autoDoIt wird nach dem Wechsel neu gestartet.",
  ], 10_000);
  ns.singularity.destroyW0r1dD43m0n(nextNode, "/autoDoIt.js");
}


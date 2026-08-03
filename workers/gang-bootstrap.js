import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const GANG_FACTIONS = Object.freeze([
  "Slum Snakes",
  "Tetrads",
  "The Syndicate",
  "The Dark Army",
  "Speakers for the Dead",
  "NiteSec",
  "The Black Hand",
]);

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.gang) return;
  if (!ns.gang.inGang()) {
    const player = ns.getPlayer();
    const factions = new Set(player.factions ?? []);
    for (const faction of GANG_FACTIONS) {
      if (factions.has(faction) && ns.gang.createGang(faction)) {
        reportSuccess(ns, `gang-created-${faction}`, `Gang gegründet: ${faction}`);
        return;
      }
    }
    if (capabilities.singularity && Number(player.karma) > -54_000) {
      reportInfo(ns, "gang-karma", "Negatives Karma für die Gang wird aufgebaut", [
        `Aktuell: ${player.karma.toFixed(0)} / -54.000`,
        "Der Crime-Manager wählt dafür dynamisch die beste Aktion pro Sekunde.",
      ]);
      return;
    }
    reportBlocker(ns, "gang-create", "Gang kann noch nicht gegründet werden", [
      `Karma: ${player.karma.toFixed(0)} (benötigt normalerweise -54.000).`,
      "Es wird außerdem die Mitgliedschaft in einer geeigneten Gang-Fraktion benötigt.",
    ], [
      "Verbrechen ausführen, bis genügend negatives Karma erreicht ist.",
      "Einer geeigneten Fraktion wie Slum Snakes oder NiteSec beitreten.",
    ]);
    return;
  }

  while (ns.gang.canRecruitMember()) {
    const next = ns.gang.getMemberNames().length + 1;
    if (!ns.gang.recruitMember(`auto-${String(next).padStart(2, "0")}`)) break;
  }
}

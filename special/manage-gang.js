import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const GANG_FACTIONS = [
  "Slum Snakes",
  "Tetrads",
  "The Syndicate",
  "The Dark Army",
  "Speakers for the Dead",
  "NiteSec",
  "The Black Hand",
];

function ascensionGain(result) {
  if (!result) return 0;
  return Math.max(
    Number(result.hack ?? 0),
    Number(result.str ?? 0),
    Number(result.def ?? 0),
    Number(result.dex ?? 0),
    Number(result.agi ?? 0),
    Number(result.cha ?? 0),
  );
}

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.gang) {
    reportBlocker(ns, "gang-api", "Gang-Automatisierung ist gesperrt", [
      "Die Gang-API benötigt BitNode 2 oder Source-File 2.",
    ], [
      "BitNode 2 abschließen, um Source-File 2 zu erhalten.",
    ]);
    return;
  }

  if (!ns.gang.inGang()) {
    const factions = new Set(ns.getPlayer().factions ?? []);
    for (const faction of GANG_FACTIONS) {
      if (factions.has(faction) && ns.gang.createGang(faction)) {
        reportSuccess(ns, `gang-created-${faction}`, `Gang gegründet: ${faction}`);
        return;
      }
    }
    if (capabilities.singularity && Number(ns.getPlayer().karma) > -54_000) {
      const current = ns.singularity.getCurrentWork();
      if (current?.type !== "CRIME") ns.singularity.commitCrime("Homicide", false);
      reportInfo(ns, "gang-karma", "Negatives Karma für die Gang wird aufgebaut", [
        `Aktuell: ${ns.getPlayer().karma.toFixed(0)} / -54.000`,
        "Aktion: Homicide",
      ]);
      return;
    }
    reportBlocker(ns, "gang-create", "Gang kann noch nicht gegründet werden", [
      `Karma: ${ns.getPlayer().karma.toFixed(0)} (benötigt normalerweise -54.000).`,
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

  const gang = ns.gang.getGangInformation();
  const members = ns.gang.getMemberNames();
  const tasks = new Set(ns.gang.getTaskNames());
  const training = gang.isHacking ? "Train Hacking" : "Train Combat";
  const moneyTask = gang.isHacking ? "Money Laundering" : "Human Trafficking";
  const respectTask = gang.isHacking ? "Cyberterrorism" : "Terrorism";
  const wantedTask = gang.isHacking ? "Ethical Hacking" : "Vigilante Justice";

  for (const member of members) {
    const info = ns.gang.getMemberInformation(member);
    const primary = gang.isHacking
      ? Number(info.hack ?? 0)
      : (Number(info.str ?? 0) + Number(info.def ?? 0) + Number(info.dex ?? 0) + Number(info.agi ?? 0)) / 4;

    let task = primary < 250 ? training : moneyTask;
    if (gang.wantedPenalty < 0.90) task = wantedTask;
    else if (gang.respect < ns.gang.respectForNextRecruit()) task = respectTask;
    if (tasks.has(task)) ns.gang.setMemberTask(member, task);

    const result = ns.gang.getAscensionResult(member);
    if (ascensionGain(result) >= 1.5) ns.gang.ascendMember(member);
  }

  if (!readHomeRamFocus(ns).ramOnly) {
    const money = ns.getPlayer().money;
    for (const equipment of ns.gang.getEquipmentNames()) {
      const cost = ns.gang.getEquipmentCost(equipment);
      if (cost > money * CONFIG.gangEquipmentBudgetFraction) continue;
      for (const member of members) {
        const info = ns.gang.getMemberInformation(member);
        const owned = new Set([...(info.upgrades ?? []), ...(info.augmentations ?? [])]);
        if (!owned.has(equipment)) ns.gang.purchaseEquipment(member, equipment);
      }
    }
  }

  const others = ns.gang.getAllGangInformation();
  const rivals = Object.keys(others).filter((name) => name !== gang.faction && others[name]?.territory > 0);
  const safeForWarfare =
    rivals.length > 0 &&
    rivals.every((name) => ns.gang.getChanceToWinClash(name) >= 0.65);
  ns.gang.setTerritoryWarfare(safeForWarfare);

  reportInfo(ns, "gang-active", "Gang wird automatisch verwaltet", [
    `${members.length} Mitglieder, ${ns.format.number(gang.respect)} Respekt.`,
    `Territorialkrieg: ${safeForWarfare ? "aktiv" : "inaktiv"}`,
  ]);
}

import { reportInfo } from "../core/notifier.js";
import {
  chooseGangTaskPlan,
  GANG_REPUTATION_GOAL_FILE,
  parseGangReputationGoal,
} from "../lib/gang-logic.js";

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
  if (!ns.gang.inGang()) return;
  const gang = ns.gang.getGangInformation();
  const members = ns.gang.getMemberNames();
  const tasks = new Set(ns.gang.getTaskNames());
  const reputationGoal = parseGangReputationGoal(ns.read(GANG_REPUTATION_GOAL_FILE), gang.faction);
  const plan = chooseGangTaskPlan({
    gang,
    members: members.map((name) => ({ name, ...ns.gang.getMemberInformation(name) })),
    reputationGoal,
  });
  const taskByRole = {
    training: gang.isHacking ? "Train Hacking" : "Train Combat",
    money: gang.isHacking ? "Money Laundering" : "Human Trafficking",
    respect: gang.isHacking ? "Cyberterrorism" : "Terrorism",
    wanted: gang.isHacking ? "Ethical Hacking" : "Vigilante Justice",
  };

  for (const { name, role } of plan.assignments) {
    const task = taskByRole[role];
    if (tasks.has(task)) ns.gang.setMemberTask(name, task);
    const result = ns.gang.getAscensionResult(name);
    if (plan.allowAscension && ascensionGain(result) >= 1.5) ns.gang.ascendMember(name);
  }

  const title = reputationGoal
    ? "Gang sammelt Reputation für Augmentierung"
    : "Gang wird automatisch verwaltet";
  const details = [
    `${members.length} Mitglieder, ${ns.format.number(gang.respect)} Respekt.`,
    `Respekt-Aufgaben: ${plan.respectCount}; Geld-Aufgaben: ${plan.moneyCount}; Fahndungsabbau: ${plan.wantedCount}.`,
  ];
  if (reputationGoal) {
    details.unshift(
      `Ziel: ${reputationGoal.augmentation}`,
      `Reputation: ${ns.format.number(reputationGoal.factionRep)} / ${ns.format.number(reputationGoal.requirement)}`,
    );
  }
  reportInfo(ns, "gang-assignments", title, details);
}

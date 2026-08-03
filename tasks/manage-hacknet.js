import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import {
  accrueBudget,
  storeRemainingBudget,
} from "../lib/investment-budget.js";
import { reportInfo, reportSuccess } from "../core/notifier.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

export const HACKNET_BUDGET_FILE = "/data/autoDoIt-hacknet-budget.txt";

export function getCheapestHacknetChoice(ns) {
  const choices = [];
  const nodeCost = ns.hacknet.getPurchaseNodeCost();

  if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
    choices.push({ cost: nodeCost, type: "node", index: -1 });
  }

  for (let index = 0; index < ns.hacknet.numNodes(); index += 1) {
    choices.push(
      { cost: ns.hacknet.getLevelUpgradeCost(index, 1), type: "level", index },
      { cost: ns.hacknet.getRamUpgradeCost(index, 1), type: "ram", index },
      { cost: ns.hacknet.getCoreUpgradeCost(index, 1), type: "core", index },
    );
    try {
      choices.push({ cost: ns.hacknet.getCacheUpgradeCost(index, 1), type: "cache", index });
    } catch {
      // Cache upgrades only exist after Hacknet Servers are unlocked.
    }
  }

  return choices
    .filter((choice) => Number.isFinite(choice.cost) && choice.cost >= 0)
    .sort((a, b) => a.cost - b.cost)[0] ?? null;
}

function buyChoice(ns, choice) {
  if (choice.type === "node") return ns.hacknet.purchaseNode() >= 0;
  if (choice.type === "level") return ns.hacknet.upgradeLevel(choice.index, 1);
  if (choice.type === "ram") return ns.hacknet.upgradeRam(choice.index, 1);
  if (choice.type === "core") return ns.hacknet.upgradeCore(choice.index, 1);
  if (choice.type === "cache") return ns.hacknet.upgradeCache(choice.index, 1);
  return false;
}

/** @param {NS} ns */
export async function main(ns) {
  const focus = readHomeRamFocus(ns);
  const money = ns.getPlayer().money;
  const spendable = spendableMoney(money, readNodeRushState(ns));
  const budgetFraction = focus.ramOnly
    ? CONFIG.ramFocusHacknetBudgetFraction
    : CONFIG.hacknetBudgetFraction;
  const bankLimitFraction = focus.ramOnly
    ? CONFIG.ramFocusInfrastructureBudgetBankFraction
    : budgetFraction;
  let budget = accrueBudget(
    ns,
    HACKNET_BUDGET_FILE,
    spendable,
    budgetFraction,
    bankLimitFraction,
  );
  budget = Math.min(budget, spendable);
  let spent = 0;
  let upgrades = 0;
  const counts = { node: 0, level: 0, ram: 0, core: 0, cache: 0 };

  for (let attempt = 0; attempt < 512; attempt += 1) {
    const next = getCheapestHacknetChoice(ns);
    if (!next || next.cost > budget) break;
    if (!buyChoice(ns, next)) break;
    budget -= next.cost;
    storeRemainingBudget(ns, HACKNET_BUDGET_FILE, budget, spendable, bankLimitFraction);
    spent += next.cost;
    upgrades += 1;
    counts[next.type] += 1;
  }

  if (upgrades > 0) {
    const summary = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`)
      .join(" · ");
    reportSuccess(ns, `hacknet-batch-${upgrades}-${Math.round(spent)}`, "Hacknet schneller erweitert", [
      `${upgrades} Käufe für ${ns.format.number(spent)}.`,
      summary,
    ]);
    return;
  }

  const next = getCheapestHacknetChoice(ns);
  if (next) {
    reportInfo(ns, "hacknet-saving", "Hacknet wartet auf Budget", [
      `Nächstes Upgrade: ${ns.format.number(next.cost)}.`,
      `Angespartes Hacknet-Budget: ${ns.format.number(budget)}.`,
    ]);
  }
}

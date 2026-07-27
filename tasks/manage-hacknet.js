import { CONFIG } from "../core/config.js";
import { affordable } from "../lib/logic.js";
import { reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const money = ns.getPlayer().money;
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
  }

  const next = choices
    .filter((choice) => Number.isFinite(choice.cost) && choice.cost >= 0)
    .sort((a, b) => a.cost - b.cost)[0];
  if (!next) return;

  if (!affordable(next.cost, money, CONFIG.hacknetBudgetFraction)) {
    reportInfo(ns, "hacknet-saving", "Hacknet wartet auf Budget", [
      `Nächstes Upgrade: ${ns.format.number(next.cost)}.`,
    ]);
    return;
  }

  let result = false;
  if (next.type === "node") result = ns.hacknet.purchaseNode() >= 0;
  if (next.type === "level") result = ns.hacknet.upgradeLevel(next.index, 1);
  if (next.type === "ram") result = ns.hacknet.upgradeRam(next.index, 1);
  if (next.type === "core") result = ns.hacknet.upgradeCore(next.index, 1);

  if (result) {
    reportSuccess(ns, `hacknet-${next.type}-${next.index}`, "Hacknet erweitert", [
      `${next.type}${next.index >= 0 ? ` auf Node ${next.index}` : ""}`,
    ]);
  }
}


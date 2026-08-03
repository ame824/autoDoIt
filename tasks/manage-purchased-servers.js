import { CONFIG } from "../core/config.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import {
  accrueBudget,
  storeRemainingBudget,
} from "../lib/investment-budget.js";
import { reportInfo, reportSuccess } from "../core/notifier.js";
import { readNodeRushState, spendableMoney } from "../lib/node-rush.js";

export const CLOUD_BUDGET_FILE = "/data/autoDoIt-cloud-budget.txt";

export function chooseInitialCloudRam(cloud, maximumRam, budget) {
  let ram = Math.min(CONFIG.purchasedServerStartRam, maximumRam);
  while (ram * 2 <= maximumRam && cloud.getServerCost(ram * 2) <= budget) ram *= 2;
  return ram;
}

export function nextCloudServerName(existing, limit) {
  const names = new Set(existing);
  for (let index = 0; index < limit; index += 1) {
    const name = `${CONFIG.purchasedServerPrefix}-${String(index).padStart(2, "0")}`;
    if (!names.has(name)) return name;
  }
  return "";
}

/** @param {NS} ns */
export async function main(ns) {
  const focus = readHomeRamFocus(ns);
  const money = ns.getPlayer().money;
  const spendable = spendableMoney(money, readNodeRushState(ns));
  const cloud = ns.cloud;
  const servers = [...cloud.getServerNames()];
  const limit = cloud.getServerLimit();
  const maxRam = cloud.getRamLimit();
  const budgetFraction = focus.ramOnly
    ? CONFIG.ramFocusPurchasedServerBudgetFraction
    : CONFIG.purchasedServerBudgetFraction;
  const bankLimitFraction = focus.ramOnly
    ? CONFIG.ramFocusInfrastructureBudgetBankFraction
    : budgetFraction;
  let budget = accrueBudget(
    ns,
    CLOUD_BUDGET_FILE,
    spendable,
    budgetFraction,
    bankLimitFraction,
  );
  budget = Math.min(budget, spendable);
  let purchasedCount = 0;
  let purchasedRam = 0;

  while (servers.length < limit) {
    const remainingSlots = limit - servers.length;
    const ram = chooseInitialCloudRam(cloud, maxRam, budget / remainingSlots);
    const cost = cloud.getServerCost(ram);
    if (cost > budget) break;
    const name = nextCloudServerName(servers, limit);
    if (!name) break;
    const purchased = cloud.purchaseServer(name, ram);
    if (!purchased) break;
    servers.push(purchased);
    budget -= cost;
    storeRemainingBudget(ns, CLOUD_BUDGET_FILE, budget, spendable, bankLimitFraction);
    purchasedCount += 1;
    purchasedRam += ram;
  }

  if (purchasedCount > 0) {
    reportSuccess(ns, `pserv-batch-${purchasedCount}-${purchasedRam}`, "Cloudserver gekauft", [
      `${purchasedCount} neue Server mit zusammen ${ns.format.ram(purchasedRam)} RAM.`,
      "Hacking-Worker verwenden sie automatisch.",
    ]);
  }

  let upgradedCount = 0;
  let addedRam = 0;
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const weakest = servers
      .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
      .filter(({ ram }) => ram < maxRam)
      .sort((a, b) => a.ram - b.ram)[0];
    if (!weakest) break;

    const nextRam = Math.min(maxRam, weakest.ram * 2);
    const cost = cloud.getServerUpgradeCost(weakest.host, nextRam);
    if (cost > budget) break;
    if (!cloud.upgradeServer(weakest.host, nextRam)) break;
    budget -= cost;
    storeRemainingBudget(ns, CLOUD_BUDGET_FILE, budget, spendable, bankLimitFraction);
    upgradedCount += 1;
    addedRam += nextRam - weakest.ram;
  }

  if (upgradedCount > 0) {
    reportSuccess(ns, `pserv-up-batch-${upgradedCount}-${addedRam}`, "Cloudserver erweitert", [
      `${upgradedCount} Upgrades, zusätzlich ${ns.format.ram(addedRam)} RAM.`,
      "Bestehende Server werden sicher erweitert statt gelöscht.",
    ]);
  } else if (purchasedCount === 0) {
    if (servers.length < limit) {
      const starterRam = Math.min(CONFIG.purchasedServerStartRam, maxRam);
      reportInfo(ns, "pserv-saving-first", "Cloudserver spart auf den Erstkauf", [
        `Kleinster geplanter Server: ${ns.format.ram(starterRam)} für ${ns.format.number(cloud.getServerCost(starterRam))}.`,
        `Angespartes Cloud-Budget: ${ns.format.number(budget)}.`,
      ]);
    } else if (servers.some((host) => ns.getServerMaxRam(host) < maxRam)) {
      reportInfo(ns, "pserv-saving", "Cloudserver warten auf Upgrade-Budget", [
        `Angespartes Cloud-Budget: ${ns.format.number(budget)}.`,
        "Bei vollem Limit wird immer der schwächste Server erweitert.",
      ]);
    }
  }
}

import { CONFIG } from "../core/config.js";
import { affordable } from "../lib/logic.js";
import { reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const money = ns.getPlayer().money;
  const cloud = ns.cloud;
  const servers = cloud.getServerNames();
  const limit = cloud.getServerLimit();
  const maxRam = cloud.getRamLimit();

  if (servers.length < limit) {
    const ram = Math.min(CONFIG.purchasedServerStartRam, maxRam);
    const cost = cloud.getServerCost(ram);
    if (affordable(cost, money, CONFIG.purchasedServerBudgetFraction)) {
      const name = `${CONFIG.purchasedServerPrefix}-${String(servers.length).padStart(2, "0")}`;
      const purchased = cloud.purchaseServer(name, ram);
      if (purchased) {
        reportSuccess(ns, `pserv-${purchased}`, "Server gekauft", [
          `${purchased}: ${ns.format.ram(ram)}`,
        ]);
      }
      return;
    }
  }

  const candidates = servers
    .map((host) => ({ host, ram: ns.getServerMaxRam(host) }))
    .filter(({ ram }) => ram < maxRam)
    .sort((a, b) => a.ram - b.ram);
  const weakest = candidates[0];
  if (!weakest) return;

  const nextRam = Math.min(maxRam, weakest.ram * 2);
  const cost = cloud.getServerUpgradeCost(weakest.host, nextRam);
  if (!affordable(cost, money, CONFIG.purchasedServerBudgetFraction)) {
    reportInfo(ns, "pserv-saving", "Gekaufte Server warten auf Budget", [
      `${weakest.host} → ${ns.format.ram(nextRam)} kostet ${ns.format.number(cost)}.`,
    ]);
    return;
  }

  if (cloud.upgradeServer(weakest.host, nextRam)) {
    reportSuccess(ns, `pserv-up-${weakest.host}-${nextRam}`, "Server erweitert", [
      `${weakest.host}: ${ns.format.ram(nextRam)}`,
    ]);
  }
}

import { CONFIG, WORKER_FILES } from "../core/config.js";
import { scanNetwork } from "../core/network.js";
import {
  calculateHomeReserve,
  selectBestTarget,
  selectHackingAction,
} from "../lib/logic.js";
import { readHomeRamFocus } from "../lib/home-ram.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const HOME_RAM_UPGRADER = "/tasks/manage-home-ram.js";

export function serverSnapshot(ns, host, hackingLevel) {
  const server = ns.getServer(host);
  const maxMoney = Number(server.moneyMax ?? 0);
  if (server.purchasedByPlayer || !Number.isFinite(maxMoney) || maxMoney <= 0) {
    return {
      host,
      rooted: server.hasAdminRights,
      maxMoney: 0,
      requiredLevel: Infinity,
      hackingLevel,
      weakenTime: Infinity,
      hackChance: 0,
    };
  }

  return {
    host,
    rooted: server.hasAdminRights,
    maxMoney,
    requiredLevel: Number(server.requiredHackingSkill ?? Infinity),
    hackingLevel,
    weakenTime: ns.getWeakenTime(host),
    hackChance: ns.hackAnalyzeChance(host),
  };
}

function workerFor(action) {
  return `/workers/${action}.js`;
}

/** @param {NS} ns */
export async function main(ns) {
  const { hosts } = scanNetwork(ns);
  const hackingLevel = ns.getHackingLevel();
  const target = selectBestTarget(hosts.map((host) => serverSnapshot(ns, host, hackingLevel)));

  if (!target || !Number.isFinite(target.maxMoney) || target.maxMoney <= 0) {
    reportBlocker(ns, "no-hack-target", "Kein geeignetes Hacking-Ziel", [
      `Aktuelles Hacking-Level: ${hackingLevel}.`,
      "Noch kein erreichbarer Server besitzt Geld und Root-Zugriff.",
    ], [
      "Einige Male n00dles manuell hacken oder das Root-Modul weiterlaufen lassen.",
    ]);
    return;
  }

  const metrics = {
    security: ns.getServerSecurityLevel(target.host),
    minSecurity: ns.getServerMinSecurityLevel(target.host),
    money: ns.getServerMoneyAvailable(target.host),
    maxMoney: target.maxMoney,
  };
  const action = selectHackingAction(metrics, CONFIG);
  const worker = workerFor(action);

  if (!ns.fileExists(worker, "home")) {
    reportBlocker(ns, `missing-${worker}`, "Worker-Datei fehlt", [worker], [
      "Die vollständige Repository-Struktur erneut nach Bitburner kopieren.",
    ]);
    return;
  }

  let desiredThreads = Infinity;
  if (action === "weaken") {
    desiredThreads = Math.max(
      1,
      Math.ceil((metrics.security - metrics.minSecurity) / ns.weakenAnalyze(1)),
    );
  } else if (action === "grow") {
    const currentMoney = Math.max(1, metrics.money);
    desiredThreads = Math.max(
      1,
      Math.ceil(ns.growthAnalyze(target.host, metrics.maxMoney / currentMoney)),
    );
  } else {
    const perThread = ns.hackAnalyze(target.host);
    desiredThreads = Math.max(
      1,
      Math.floor(CONFIG.hackMoneyFraction / Math.max(perThread, Number.EPSILON)),
    );
  }

  const ramPerThread = ns.getScriptRam(worker, "home");
  const homeFocus = readHomeRamFocus(ns);
  const priorityRam = homeFocus.active
    ? ns.getScriptRam(HOME_RAM_UPGRADER, "home")
    : 0;
  let remaining = desiredThreads;
  let launched = 0;
  const runners = hosts
    .filter((host) => ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0)
    .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));

  for (const runner of runners) {
    if (remaining <= 0) break;
    if (ns.ps(runner).some((process) => WORKER_FILES.includes(process.filename))) continue;
    if (runner !== "home" && !ns.fileExists(worker, runner)) {
      await ns.scp([...WORKER_FILES], runner, "home");
    }

    const maxRam = ns.getServerMaxRam(runner);
    const reserve = runner === "home"
      ? Math.max(calculateHomeReserve(maxRam), priorityRam)
      : 0;
    const freeRam = Math.max(0, maxRam - ns.getServerUsedRam(runner) - reserve);
    const capacity = Math.floor(freeRam / ramPerThread);
    const threads = Math.min(capacity, remaining);
    if (threads < 1) continue;

    const pid = ns.exec(worker, runner, threads, target.host);
    if (pid > 0) {
      remaining -= threads;
      launched += threads;
    }
  }

  if (launched > 0) {
    reportInfo(ns, `hgw-${action}-${target.host}`, `${action.toUpperCase()} auf ${target.host}`, [
      `${launched} Threads gestartet.`,
      `Geld: ${ns.format.number(metrics.money)} / ${ns.format.number(metrics.maxMoney)}`,
      `Sicherheit: ${metrics.security.toFixed(2)} / ${metrics.minSecurity.toFixed(2)}`,
    ], 60_000);
  } else {
    reportBlocker(ns, "no-worker-ram", "Kein freier RAM für Hacking-Worker", [
      `${worker} benötigt ${ns.format.ram(ramPerThread)} pro Thread.`,
    ], [
      "Home-RAM erweitern oder einen Server mit freiem RAM übernehmen.",
    ]);
  }
}

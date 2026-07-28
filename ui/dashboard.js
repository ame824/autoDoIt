import { CONFIG, TASKS, WORKER_FILES } from "../core/config.js";
import { scanNetwork } from "../core/network.js";
import { readStatus } from "../core/status.js";
import { isLightweightMode, tasksForMode } from "../lib/scheduler-mode.js";

const COLOR = Object.freeze({
  reset: "\u001b[0m",
  dim: "\u001b[38;5;244m",
  cyan: "\u001b[38;5;51m",
  green: "\u001b[38;5;82m",
  yellow: "\u001b[38;5;226m",
  red: "\u001b[38;5;196m",
  white: "\u001b[38;5;255m",
});
const BLOCKER_VISIBLE_MS = 15 * 60_000;

function normalizePath(path) {
  return String(path).replace(/^\/+/, "");
}

export function progressBar(value, maximum, width = 24) {
  const ratio = maximum > 0 ? Math.min(1, Math.max(0, value / maximum)) : 0;
  const filled = Math.round(ratio * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

export function formatAge(timestamp, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - Number(timestamp)) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3_600)}h`;
}

function truncate(text, maximum = 72) {
  const value = String(text);
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

function eventColor(level) {
  if (level === "warning") return COLOR.yellow;
  if (level === "error") return COLOR.red;
  if (level === "success") return COLOR.green;
  return COLOR.cyan;
}

function collectSnapshot(ns) {
  const player = ns.getPlayer();
  const reset = ns.getResetInfo();
  const { hosts } = scanNetwork(ns);
  const rootedHosts = hosts.filter((host) => ns.hasRootAccess(host));
  const homeRamMax = ns.getServerMaxRam("home");
  const homeRamUsed = ns.getServerUsedRam("home");
  const lightweight = isLightweightMode(homeRamMax, CONFIG.fullModeHomeRam);
  const plannedTasks = tasksForMode(TASKS, lightweight).length;
  const taskPaths = new Set(TASKS.map(({ file }) => normalizePath(file)));
  const workerPaths = new Set(WORKER_FILES.map(normalizePath));
  let activeTasks = 0;
  let workerProcesses = 0;
  let workerThreads = 0;

  for (const host of rootedHosts) {
    for (const process of ns.ps(host)) {
      const filename = normalizePath(process.filename);
      if (host === "home" && taskPaths.has(filename)) activeTasks += 1;
      if (workerPaths.has(filename)) {
        workerProcesses += 1;
        workerThreads += process.threads;
      }
    }
  }

  return {
    time: Date.now(),
    player,
    reset,
    hosts: hosts.length,
    rooted: rootedHosts.length,
    homeRamMax,
    homeRamUsed,
    lightweight,
    plannedTasks,
    schedulerRunning: ns.scriptRunning("/autoDoIt.js", "home"),
    activeTasks,
    workerProcesses,
    workerThreads,
    dashboardRam: ns.getScriptRam(ns.getScriptName(), "home"),
    events: readStatus(ns).events,
  };
}

export function buildDashboardLines(ns, snapshot) {
  const {
    player,
    reset,
    hosts,
    rooted,
    homeRamMax,
    homeRamUsed,
    lightweight,
    plannedTasks,
    schedulerRunning,
    activeTasks,
    workerProcesses,
    workerThreads,
    dashboardRam,
    events,
    time,
  } = snapshot;
  const ramRatio = homeRamMax > 0 ? homeRamUsed / homeRamMax : 0;
  const rootRatio = hosts > 0 ? rooted / hosts : 0;
  const blockers = events
    .filter(({ level, time: eventTime }) => level === "warning" && time - eventTime <= BLOCKER_VISIBLE_MS)
    .slice(-3)
    .reverse();
  const activity = events.filter(({ level }) => level !== "warning").slice(-5).reverse();
  const statusColor = schedulerRunning ? COLOR.green : COLOR.red;
  const statusText = schedulerRunning ? "ONLINE" : "GESTOPPT";
  const modeColor = lightweight ? COLOR.yellow : COLOR.green;
  const modeText = lightweight ? "STARTPHASE (leicht)" : "VOLLBETRIEB";
  const lines = [
    `${COLOR.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLOR.reset}`,
    `${COLOR.cyan}║${COLOR.reset}  ${COLOR.white}autoDoIt CONTROL CENTER${COLOR.reset}`,
    `${COLOR.cyan}╚══════════════════════════════════════════════════════════════════════╝${COLOR.reset}`,
    `${statusColor}● ${statusText}${COLOR.reset}  ${COLOR.dim}${new Date(time).toLocaleTimeString()}  ·  BitNode ${reset.currentNode}  ·  ${player.city}${COLOR.reset}`,
    "",
    `${COLOR.white}SPIELER${COLOR.reset}`,
    `  Geld        ${COLOR.green}${ns.format.number(player.money)}${COLOR.reset}`,
    `  Hacking     ${COLOR.cyan}${ns.format.number(player.skills.hacking)}${COLOR.reset}`,
    `  SourceFiles ${COLOR.white}${reset.ownedSF.size}${COLOR.reset}`,
    "",
    `${COLOR.white}RESSOURCEN${COLOR.reset}`,
    `  Home-RAM    ${progressBar(homeRamUsed, homeRamMax)} ${(ramRatio * 100).toFixed(0).padStart(3)}%`,
    `              ${ns.format.ram(homeRamUsed)} / ${ns.format.ram(homeRamMax)}`,
    `  Netzwerk    ${progressBar(rooted, hosts)} ${(rootRatio * 100).toFixed(0).padStart(3)}%`,
    `              ${rooted} / ${hosts} Server mit Root-Zugriff`,
    "",
    `${COLOR.white}AUTOMATISIERUNG${COLOR.reset}`,
    `  Modus       ${modeColor}${modeText}${COLOR.reset}`,
    lightweight
      ? `              Home-Ausbau: ${ns.format.ram(homeRamMax)} / ${ns.format.ram(CONFIG.fullModeHomeRam)}`
      : `              Alle Module ab ${ns.format.ram(CONFIG.fullModeHomeRam)} freigegeben`,
    `  Module      ${activeTasks} gerade aktiv · ${plannedTasks}/${TASKS.length} freigegeben`,
    `  Hacking     ${workerProcesses} Prozesse · ${workerThreads} Threads`,
    `  Dashboard   ${ns.format.ram(dashboardRam)} RAM`,
    "",
    `${COLOR.white}MANUELLE AKTIONEN${COLOR.reset}`,
  ];

  if (blockers.length === 0) {
    lines.push(`  ${COLOR.green}✓ Keine aktuellen Hinweise${COLOR.reset}`);
  } else {
    for (const event of blockers) {
      lines.push(
        `  ${eventColor(event.level)}!${COLOR.reset} ${truncate(event.title, 62)} ${COLOR.dim}(${formatAge(event.time, time)})${COLOR.reset}`,
      );
      if (event.lines[0]) lines.push(`    ${COLOR.dim}${truncate(event.lines[0], 66)}${COLOR.reset}`);
    }
  }

  lines.push("", `${COLOR.white}LETZTE AKTIVITÄT${COLOR.reset}`);
  if (activity.length === 0) {
    lines.push(`  ${COLOR.dim}Noch keine Aktivität gemeldet.${COLOR.reset}`);
  } else {
    for (const event of activity) {
      lines.push(
        `  ${eventColor(event.level)}•${COLOR.reset} ${truncate(event.title, 62)} ${COLOR.dim}(${formatAge(event.time, time)})${COLOR.reset}`,
      );
    }
  }
  return lines;
}

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ["refresh", 2_000],
    ["no-open", false],
  ]);
  const refresh = Math.max(500, Number(flags.refresh) || 2_000);
  ns.disableLog("ALL");

  if (!flags["no-open"]) {
    ns.ui.openTail();
    ns.ui.resizeTail(760, 650);
    ns.ui.setTailTitle("autoDoIt Control Center");
    ns.ui.setTailFontSize(13);
  }

  while (true) {
    try {
      const snapshot = collectSnapshot(ns);
      ns.clearLog();
      for (const line of buildDashboardLines(ns, snapshot)) ns.print(line);
      ns.ui.renderTail();
    } catch (error) {
      ns.clearLog();
      ns.print(`${COLOR.red}Dashboard-Fehler: ${String(error)}${COLOR.reset}`);
    }
    await ns.sleep(refresh);
  }
}

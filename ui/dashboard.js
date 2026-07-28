import { CONFIG, TASKS, WORKER_FILES } from "../core/config.js";
import {
  LANGUAGE,
  dashboardText,
  localizeEvent,
  normalizeLanguage,
  readLanguage,
  writeLanguage,
} from "../core/localization.js";
import { scanNetwork } from "../core/network.js";
import { readStatus } from "../core/status.js";
import {
  SCHEDULER_MODE,
  schedulerMode,
  taskFitsRam,
  taskRamCapacity,
  tasksForMode,
} from "../lib/scheduler-mode.js";

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
const CREDIT = "© ame824 · grz-gamerz.de";
const DASHBOARD_TEXT_WIDTH = 72;

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

export function creditLine(width = DASHBOARD_TEXT_WIDTH) {
  return CREDIT.padStart(Math.max(CREDIT.length, width));
}

export function buildLanguageSelector(reactApi, language, onSelect) {
  const current = normalizeLanguage(language);
  const button = (code, label) => reactApi.createElement("button", {
    key: code,
    type: "button",
    "aria-pressed": current === code,
    onClick: () => onSelect(code),
    style: {
      color: current === code ? "#adff2f" : "#777",
      background: "transparent",
      border: current === code ? "1px solid #4c8" : "1px solid #444",
      borderRadius: "3px",
      fontFamily: "monospace",
      fontSize: "11px",
      lineHeight: "16px",
      padding: "0 5px",
      cursor: "pointer",
      opacity: current === code ? 0.9 : 0.55,
    },
  }, label);

  return reactApi.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "4px",
      width: "100%",
      minHeight: "18px",
      opacity: 0.8,
    },
  },
  reactApi.createElement("span", {
    style: { color: "#777", fontFamily: "monospace", fontSize: "11px" },
  }, `${dashboardText(current, "language")}:`),
  button(LANGUAGE.de, "DE"),
  button(LANGUAGE.en, "EN"));
}

export function resolveReactApi(scope = globalThis) {
  let reactApi = scope?.React;
  if (!reactApi) {
    try {
      reactApi = eval("React");
    } catch {
      reactApi = null;
    }
  }
  return typeof reactApi?.createElement === "function" ? reactApi : null;
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
  const mode = schedulerMode(
    homeRamMax,
    CONFIG.lightweightModeHomeRam,
    CONFIG.fullModeHomeRam,
  );
  const phaseTasks = tasksForMode(TASKS, mode);
  const schedulerRam = ns.getScriptRam("/autoDoIt.js", "home");
  const dashboardRam = ns.getScriptRam(ns.getScriptName(), "home");
  const capacity = taskRamCapacity(homeRamMax, schedulerRam, dashboardRam);
  const executableTasks = phaseTasks.filter((task) =>
    ns.fileExists(task.file, "home") &&
    taskFitsRam(ns.getScriptRam(task.file, "home"), capacity)
  ).length;
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
    mode,
    phaseTasks: phaseTasks.length,
    executableTasks,
    schedulerRunning: ns.scriptRunning("/autoDoIt.js", "home"),
    activeTasks,
    workerProcesses,
    workerThreads,
    dashboardRam: ns.getScriptRam(ns.getScriptName(), "home"),
    events: readStatus(ns).events,
  };
}

export function buildDashboardLines(ns, snapshot, language = LANGUAGE.de) {
  const lang = normalizeLanguage(language);
  const text = (key, values) => dashboardText(lang, key, values);
  const {
    player,
    reset,
    hosts,
    rooted,
    homeRamMax,
    homeRamUsed,
    mode,
    phaseTasks,
    executableTasks,
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
    .reverse()
    .map((event) => localizeEvent(event, lang));
  const activity = events
    .filter(({ level }) => level !== "warning")
    .slice(-5)
    .reverse()
    .map((event) => localizeEvent(event, lang));
  const statusColor = schedulerRunning ? COLOR.green : COLOR.red;
  const statusText = schedulerRunning ? text("online") : text("stopped");
  const modeColor = mode === SCHEDULER_MODE.full ? COLOR.green : COLOR.yellow;
  const modeText = mode === SCHEDULER_MODE.bootstrap
    ? text("bootstrap")
    : mode === SCHEDULER_MODE.lightweight
      ? text("lightweight")
      : text("full");
  const locale = lang === LANGUAGE.en ? "en-US" : "de-DE";
  const lines = [
    `${COLOR.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLOR.reset}`,
    `${COLOR.cyan}║${COLOR.reset}  ${COLOR.white}autoDoIt CONTROL CENTER${COLOR.reset}`,
    `${COLOR.cyan}╚══════════════════════════════════════════════════════════════════════╝${COLOR.reset}`,
    `${statusColor}● ${statusText}${COLOR.reset}  ${COLOR.dim}${new Date(time).toLocaleTimeString(locale)}  ·  BitNode ${reset.currentNode}  ·  ${player.city}${COLOR.reset}`,
    "",
    `${COLOR.white}${text("player")}${COLOR.reset}`,
    `  ${text("money").padEnd(11)} ${COLOR.green}${ns.format.number(player.money)}${COLOR.reset}`,
    `  ${text("hacking").padEnd(11)} ${COLOR.cyan}${ns.format.number(player.skills.hacking)}${COLOR.reset}`,
    `  ${text("sourceFiles").padEnd(11)} ${COLOR.white}${reset.ownedSF.size}${COLOR.reset}`,
    "",
    `${COLOR.white}${text("resources")}${COLOR.reset}`,
    `  ${text("homeRam").padEnd(11)} ${progressBar(homeRamUsed, homeRamMax)} ${(ramRatio * 100).toFixed(0).padStart(3)}%`,
    `              ${ns.format.ram(homeRamUsed)} / ${ns.format.ram(homeRamMax)}`,
    `  ${text("network").padEnd(11)} ${progressBar(rooted, hosts)} ${(rootRatio * 100).toFixed(0).padStart(3)}%`,
    `              ${rooted} / ${hosts} ${text("rootedServers")}`,
    "",
    `${COLOR.white}${text("automation")}${COLOR.reset}`,
    `  ${text("mode").padEnd(11)} ${modeColor}${modeText}${COLOR.reset}`,
    mode !== SCHEDULER_MODE.full
      ? `              ${text("homeExpansion")}: ${ns.format.ram(homeRamMax)} / ${ns.format.ram(CONFIG.fullModeHomeRam)}`
      : `              ${text("allModulesReleased", { ram: ns.format.ram(CONFIG.fullModeHomeRam) })}`,
    `  ${text("modules").padEnd(11)} ${activeTasks} ${text("active")} · ${executableTasks}/${phaseTasks} ${text("executable")} · ${phaseTasks}/${TASKS.length} ${text("phase")}`,
    `  ${text("hacking").padEnd(11)} ${workerProcesses} ${text("processes")} · ${workerThreads} ${text("threads")}`,
    `  ${text("dashboard").padEnd(11)} ${ns.format.ram(dashboardRam)} RAM`,
    "",
    `${COLOR.white}${text("manualActions")}${COLOR.reset}`,
  ];

  if (blockers.length === 0) {
    lines.push(`  ${COLOR.green}✓ ${text("noNotices")}${COLOR.reset}`);
  } else {
    for (const event of blockers) {
      lines.push(
        `  ${eventColor(event.level)}!${COLOR.reset} ${truncate(event.title, 62)} ${COLOR.dim}(${formatAge(event.time, time)})${COLOR.reset}`,
      );
      if (event.lines[0]) lines.push(`    ${COLOR.dim}${truncate(event.lines[0], 66)}${COLOR.reset}`);
    }
  }

  lines.push("", `${COLOR.white}${text("recentActivity")}${COLOR.reset}`);
  if (activity.length === 0) {
    lines.push(`  ${COLOR.dim}${text("noActivity")}${COLOR.reset}`);
  } else {
    for (const event of activity) {
      lines.push(
        `  ${eventColor(event.level)}•${COLOR.reset} ${truncate(event.title, 62)} ${COLOR.dim}(${formatAge(event.time, time)})${COLOR.reset}`,
      );
    }
  }
  lines.push("", `${COLOR.dim}${creditLine()}${COLOR.reset}`);
  return lines;
}

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ["refresh", 2_000],
    ["no-open", false],
    ["lang", ""],
  ]);
  const refresh = Math.max(500, Number(flags.refresh) || 2_000);
  const requestedLanguage = String(flags.lang ?? "").trim();
  let language = requestedLanguage
    ? writeLanguage(ns, requestedLanguage)
    : readLanguage(ns);
  const reactApi = resolveReactApi();
  const selectLanguage = (nextLanguage) => {
    language = writeLanguage(ns, nextLanguage);
  };
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
      if (reactApi && typeof ns.printRaw === "function") {
        ns.printRaw(buildLanguageSelector(reactApi, language, selectLanguage));
      }
      for (const line of buildDashboardLines(ns, snapshot, language)) ns.print(line);
      ns.ui.renderTail();
    } catch (error) {
      ns.clearLog();
      ns.print(`${COLOR.red}${dashboardText(language, "dashboardError")}: ${String(error)}${COLOR.reset}`);
    }
    await ns.sleep(refresh);
  }
}

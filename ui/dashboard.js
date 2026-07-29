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
import { readHomeRamFocus } from "../lib/home-ram.js";

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

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${totalSeconds % 60}s`;
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
      alignItems: "center",
      gap: "4px",
      width: `${DASHBOARD_TEXT_WIDTH}ch`,
      maxWidth: "100%",
      minHeight: "24px",
      boxSizing: "border-box",
      borderLeft: "1px solid #00ffff",
      borderRight: "1px solid #00ffff",
      padding: "1px 8px",
      fontFamily: "monospace",
    },
  },
  reactApi.createElement("span", {
    style: {
      color: "#ffffff",
      fontSize: "12px",
      fontWeight: 600,
    },
  }, "autoDoIt CONTROL CENTER"),
  reactApi.createElement("span", {
    style: {
      color: "#777",
      fontSize: "11px",
      marginLeft: "auto",
    },
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

export function resolveDocument(scope = globalThis) {
  let documentApi = scope?.document;
  if (!documentApi) {
    try {
      documentApi = eval("document");
    } catch {
      documentApi = null;
    }
  }
  return typeof documentApi?.getElementById === "function" ? documentApi : null;
}

export function createLanguageSelectionQueue() {
  let pendingLanguage = null;
  return {
    select(nextLanguage) {
      pendingLanguage = normalizeLanguage(nextLanguage);
    },
    take() {
      const nextLanguage = pendingLanguage;
      pendingLanguage = null;
      return nextLanguage;
    },
  };
}

export function buildOverviewStats(ns, snapshot, language = LANGUAGE.de) {
  const lang = normalizeLanguage(language);
  const text = (key) => dashboardText(lang, key);
  const elapsedMs = Math.max(0, snapshot.time - Number(snapshot.reset.lastAugReset ?? snapshot.time));
  const elapsedSeconds = Math.max(1, elapsedMs / 1_000);
  const runTotal = Number(snapshot.moneySources?.sinceInstall?.total ?? 0);
  const moneyRate = Number.isFinite(runTotal) ? runTotal / elapsedSeconds : 0;
  const rateSign = moneyRate > 0 ? "+" : moneyRate < 0 ? "-" : "";
  const homeRatio = snapshot.homeRamMax > 0
    ? snapshot.homeRamUsed / snapshot.homeRamMax
    : 0;

  return {
    labels: [
      "autoDoIt",
      text("moneyPerSecond"),
      text("runTime"),
      text("augmentations"),
      text("workers"),
      text("homeRam"),
    ],
    values: [
      text("efficiency"),
      `${rateSign}$${ns.format.number(Math.abs(moneyRate))}/s`,
      formatDuration(elapsedMs),
      String(snapshot.reset.ownedAugs?.size ?? 0),
      `${snapshot.workerProcesses} / ${snapshot.workerThreads}t`,
      `${(homeRatio * 100).toFixed(0)}%`,
    ],
  };
}

const OVERVIEW_HOOK_IDS = Object.freeze([
  "overview-extra-hook-0",
  "overview-extra-hook-1",
  "overview-extra-hook-2",
]);

export function renderOverviewStats(documentApi, stats) {
  const hooks = OVERVIEW_HOOK_IDS.map((id) => documentApi.getElementById(id));
  if (!hooks[0] || !hooks[1] || !hooks[2]) return false;
  hooks[0].textContent = stats.labels.join("\n");
  hooks[1].textContent = stats.values.join("\n");
  hooks[2].textContent = "";
  for (const hook of hooks) {
    hook.style.whiteSpace = "pre-line";
    hook.style.lineHeight = "1.35";
    hook.style.fontSize = "0.75rem";
  }
  hooks[0].style.textAlign = "left";
  hooks[1].style.textAlign = "right";
  return true;
}

export function clearOverviewStats(documentApi) {
  for (const id of OVERVIEW_HOOK_IDS) {
    const hook = documentApi?.getElementById(id);
    if (hook) hook.textContent = "";
  }
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
    homeRamFocus: readHomeRamFocus(ns),
    mode,
    phaseTasks: phaseTasks.length,
    executableTasks,
    schedulerRunning: ns.scriptRunning("/autoDoIt.js", "home"),
    activeTasks,
    workerProcesses,
    workerThreads,
    dashboardRam: ns.getScriptRam(ns.getScriptName(), "home"),
    moneySources: ns.getMoneySources(),
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
    homeRamFocus = { active: false, target: CONFIG.fullModeHomeRam },
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
    homeRamFocus.active
      ? `              ${text("homeExpansion")}: ${ns.format.ram(homeRamMax)} / ${ns.format.ram(homeRamFocus.target)}`
      : `              ${text("allModulesReleased", { ram: ns.format.ram(homeRamFocus.target || CONFIG.fullModeHomeRam) })}`,
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
  const overviewDocument = CONFIG.overviewStatsEnabled ? resolveDocument() : null;
  const languageSelections = createLanguageSelectionQueue();
  ns.disableLog("ALL");
  if (overviewDocument) ns.atExit(() => clearOverviewStats(overviewDocument));

  if (!flags["no-open"]) {
    ns.ui.openTail();
    ns.ui.resizeTail(760, 650);
    ns.ui.setTailTitle("autoDoIt Control Center");
    ns.ui.setTailFontSize(13);
  }

  while (true) {
    try {
      const selectedLanguage = languageSelections.take();
      if (selectedLanguage) language = writeLanguage(ns, selectedLanguage);
      const snapshot = collectSnapshot(ns);
      if (overviewDocument) {
        try {
          renderOverviewStats(
            overviewDocument,
            buildOverviewStats(ns, snapshot, language),
          );
        } catch {
          // The Overview can be temporarily unavailable while the game changes pages.
        }
      }
      ns.clearLog();
      const lines = buildDashboardLines(ns, snapshot, language);
      if (reactApi && typeof ns.printRaw === "function") {
        ns.print(lines[0]);
        ns.printRaw(buildLanguageSelector(reactApi, language, languageSelections.select));
        for (const line of lines.slice(2)) ns.print(line);
      } else {
        for (const line of lines) ns.print(line);
      }
      ns.ui.renderTail();
    } catch (error) {
      ns.clearLog();
      ns.print(`${COLOR.red}${dashboardText(language, "dashboardError")}: ${String(error)}${COLOR.reset}`);
    }
    await ns.sleep(refresh);
  }
}

import { CONFIG, TASKS } from "./core/config.js";
import { writeLanguage } from "./core/localization.js";
import {
  SCHEDULER_MODE,
  schedulerMode,
  sortTasksForMode,
  taskFitsRam,
  taskRamCapacity,
  tasksForMode,
} from "./lib/scheduler-mode.js";

const DASHBOARD_FILE = "/ui/dashboard.js";
const POST_EXCLUSIVE_FILE = "/data/autoDoIt-post-exclusive.txt";
const EXPLOIT_FILE = "/special/manage-exploits.js";

export function taskArguments(task, exploitRiskApproved) {
  return task.file === EXPLOIT_FILE && exploitRiskApproved
    ? ["--agree-exploit-risk"]
    : [];
}

function tryStartDashboard(ns, disabled) {
  if (disabled || !ns.fileExists(DASHBOARD_FILE, "home")) return false;
  if (ns.getServerMaxRam("home") < CONFIG.dashboardMinimumHomeRam) return false;
  if (ns.scriptRunning(DASHBOARD_FILE, "home")) return true;
  const ram = ns.getScriptRam(DASHBOARD_FILE, "home");
  const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
  if (ram <= 0 || freeRam + 0.0001 < ram) return false;
  return ns.run(DASHBOARD_FILE, 1) > 0;
}

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ["once", false],
    ["no-ui", false],
    ["agree-exploit-risk", false],
    ["aggree-exploit-risk", false],
    ["lang", ""],
  ]);
  const requestedLanguage = String(flags.lang ?? "").trim();
  if (requestedLanguage) writeLanguage(ns, requestedLanguage);
  const exploitRiskApproved = Boolean(
    flags["agree-exploit-risk"] || flags["aggree-exploit-risk"],
  );
  ns.disableLog("sleep");
  ns.disableLog("run");
  ns.disableLog("scriptRunning");
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");

  if (exploitRiskApproved) {
    ns.tprint(
      "[autoDoIt] RISIKO-MODUS bestätigt: Die drei manuellen SF-1-Einträge dürfen nach automatischer Sicherung im Save ergänzt werden.",
    );
  }

  const allTasks = [...TASKS];
  const lastAttempt = new Map();
  const onceAttempted = new Set();
  let lastDashboardAttempt = 0;
  let exclusiveWasRunning = false;
  let burstNextTick = false;
  let lastCompletionSignal = ns.read(POST_EXCLUSIVE_FILE);

  while (true) {
    const now = Date.now();
    const homeRam = ns.getServerMaxRam("home");
    const mode = schedulerMode(
      homeRam,
      CONFIG.lightweightModeHomeRam,
      CONFIG.fullModeHomeRam,
    );
    const constrained = mode !== SCHEDULER_MODE.full;
    const schedulerRam = ns.getScriptRam(ns.getScriptName(), "home");
    const dashboardRam = ns.scriptRunning(DASHBOARD_FILE, "home")
      ? ns.getScriptRam(DASHBOARD_FILE, "home")
      : 0;
    const ramCapacity = taskRamCapacity(homeRam, schedulerRam, dashboardRam);
    const phaseTasks = tasksForMode(allTasks, mode);
    const tasks = sortTasksForMode(
      phaseTasks.filter((task) => {
        if (!ns.fileExists(task.file, "home")) return true;
        return taskFitsRam(ns.getScriptRam(task.file, "home"), ramCapacity);
      }),
      mode,
    );
    let startedThisTick = 0;
    const completionSignal = ns.read(POST_EXCLUSIVE_FILE);
    if (completionSignal && completionSignal !== lastCompletionSignal) {
      lastCompletionSignal = completionSignal;
      exclusiveWasRunning = true;
    }
    const exclusiveRunning = allTasks.some(
      (task) => task.exclusive && ns.scriptRunning(task.file, "home"),
    );
    const managedTaskRunning = constrained && allTasks.some(
      (task) => ns.scriptRunning(task.file, "home"),
    );

    if (now - lastDashboardAttempt >= 30_000) {
      tryStartDashboard(ns, Boolean(flags["no-ui"]));
      lastDashboardAttempt = now;
    }

    if (exclusiveRunning) {
      exclusiveWasRunning = true;
      await ns.sleep(CONFIG.schedulerTickMs);
      continue;
    }
    if (managedTaskRunning) {
      await ns.sleep(CONFIG.schedulerTickMs);
      continue;
    }

    const preparationTick = exclusiveWasRunning;
    const runnableTasks = preparationTick
      ? tasks.filter((task) => task.preflightAfterExclusive)
      : tasks;
    const taskLimit = constrained
      ? CONFIG.lightweightMaxTasksPerTick
      : burstNextTick && !preparationTick
        ? tasks.length
        : CONFIG.maxTasksPerTick;
    if (preparationTick) burstNextTick = true;
    else burstNextTick = false;
    exclusiveWasRunning = false;

    for (const task of runnableTasks) {
      if (startedThisTick >= taskLimit) break;
      if (flags.once && onceAttempted.has(task.file)) continue;
      if (!ns.fileExists(task.file, "home")) {
        if (!onceAttempted.has(`missing:${task.file}`)) {
          ns.tprint(`[autoDoIt] Datei fehlt: ${task.file}`);
          onceAttempted.add(`missing:${task.file}`);
        }
        onceAttempted.add(task.file);
        continue;
      }
      if (ns.scriptRunning(task.file, "home")) {
        if (flags.once) onceAttempted.add(task.file);
        continue;
      }

      const last = Number(lastAttempt.get(task.file) ?? 0);
      const dueAfter = last === 0 ? 0 : task.intervalMs;
      if (now - last < dueAfter) continue;

      const ram = ns.getScriptRam(task.file, "home");
      const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      lastAttempt.set(task.file, now);
      onceAttempted.add(task.file);

      if (ram <= 0 || freeRam + 0.0001 < ram) {
        lastAttempt.set(task.file, now - task.intervalMs + CONFIG.failedTaskRetryMs);
        continue;
      }

      const pid = ns.run(task.file, 1, ...taskArguments(task, exploitRiskApproved));
      if (pid === 0) {
        ns.print(`Start fehlgeschlagen: ${task.file}`);
        lastAttempt.set(task.file, now - task.intervalMs + CONFIG.failedTaskRetryMs);
        continue;
      }
      startedThisTick += 1;
      if (task.exclusive) break;
    }

    if (flags.once && tasks.every((task) => onceAttempted.has(task.file))) {
      ns.tprint("[autoDoIt] Einmaliger Durchlauf abgeschlossen.");
      return;
    }
    await ns.sleep(CONFIG.schedulerTickMs);
  }
}

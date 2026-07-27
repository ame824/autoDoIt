import { CONFIG, TASKS } from "./core/config.js";

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([["once", false]]);
  ns.disableLog("sleep");
  ns.disableLog("run");
  ns.disableLog("isRunning");
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");

  const tasks = [...TASKS].sort((a, b) => b.priority - a.priority);
  const lastAttempt = new Map();
  const onceAttempted = new Set();

  ns.tprint(`[autoDoIt] Scheduler gestartet (${tasks.length} Module).`);

  while (true) {
    const now = Date.now();
    let startedThisTick = 0;

    for (const task of tasks) {
      if (startedThisTick >= CONFIG.maxTasksPerTick) break;
      if (flags.once && onceAttempted.has(task.file)) continue;
      if (!ns.fileExists(task.file, "home")) {
        if (!onceAttempted.has(`missing:${task.file}`)) {
          ns.tprint(`[autoDoIt] Datei fehlt: ${task.file}`);
          onceAttempted.add(`missing:${task.file}`);
        }
        onceAttempted.add(task.file);
        continue;
      }
      if (ns.isRunning(task.file, "home")) continue;

      const last = Number(lastAttempt.get(task.file) ?? 0);
      const dueAfter = last === 0 ? 0 : task.intervalMs;
      if (now - last < dueAfter) continue;

      const ram = ns.getScriptRam(task.file, "home");
      const freeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      lastAttempt.set(task.file, now);
      onceAttempted.add(task.file);

      if (ram <= 0 || freeRam + 0.0001 < ram) {
        ns.print(`Warte auf RAM: ${task.file} benötigt ${ns.format.ram(ram)}, frei ${ns.format.ram(freeRam)}`);
        lastAttempt.set(task.file, now - task.intervalMs + CONFIG.failedTaskRetryMs);
        continue;
      }

      const pid = ns.run(task.file, 1);
      if (pid === 0) {
        ns.print(`Start fehlgeschlagen: ${task.file}`);
        lastAttempt.set(task.file, now - task.intervalMs + CONFIG.failedTaskRetryMs);
        continue;
      }
      startedThisTick += 1;
    }

    if (flags.once && tasks.every((task) => onceAttempted.has(task.file))) {
      ns.tprint("[autoDoIt] Einmaliger Durchlauf abgeschlossen.");
      return;
    }
    await ns.sleep(CONFIG.schedulerTickMs);
  }
}

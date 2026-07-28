export const SCHEDULER_MODE = Object.freeze({
  bootstrap: "bootstrap",
  lightweight: "lightweight",
  full: "full",
});

export function schedulerMode(homeRam, lightweightHomeRam, fullModeHomeRam) {
  const ram = Number(homeRam);
  if (ram < Number(lightweightHomeRam)) return SCHEDULER_MODE.bootstrap;
  if (ram < Number(fullModeHomeRam)) return SCHEDULER_MODE.lightweight;
  return SCHEDULER_MODE.full;
}

export function isLightweightMode(homeRam, fullModeHomeRam) {
  return Number(homeRam) < Number(fullModeHomeRam);
}

export function tasksForMode(tasks, mode) {
  if (mode === SCHEDULER_MODE.bootstrap) {
    return tasks.filter((task) => task.bootstrap);
  }
  if (mode === SCHEDULER_MODE.lightweight || mode === true) {
    return tasks.filter((task) => task.lightweight);
  }
  return [...tasks];
}

export function sortTasksForMode(tasks, mode) {
  const constrained = mode === SCHEDULER_MODE.bootstrap ||
    mode === SCHEDULER_MODE.lightweight ||
    mode === true;
  const priority = (task) => constrained
    ? Number(task.lightweightPriority ?? task.priority)
    : Number(task.priority);
  return [...tasks].sort((a, b) => priority(b) - priority(a));
}

export function taskRamCapacity(homeRam, schedulerRam, dashboardRam = 0) {
  return Math.max(
    0,
    Number(homeRam) - Number(schedulerRam) - Number(dashboardRam),
  );
}

export function taskFitsRam(taskRam, capacity) {
  const required = Number(taskRam);
  return required > 0 && required <= Number(capacity) + 0.0001;
}

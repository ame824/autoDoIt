export const SCHEDULER_MODE = Object.freeze({
  bootstrap: "bootstrap",
  lightweight: "lightweight",
  medium: "medium",
  full: "full",
});

export function schedulerMode(homeRam, lightweightHomeRam, mediumHomeRam, fullModeHomeRam) {
  const ram = Number(homeRam);
  if (ram < Number(lightweightHomeRam)) return SCHEDULER_MODE.bootstrap;
  if (ram < Number(mediumHomeRam)) return SCHEDULER_MODE.lightweight;
  if (ram < Number(fullModeHomeRam)) return SCHEDULER_MODE.medium;
  return SCHEDULER_MODE.full;
}

export function isLightweightMode(homeRam, fullModeHomeRam) {
  return Number(homeRam) < Number(fullModeHomeRam);
}

export function tasksForMode(tasks, mode, currentNode = 0) {
  if (mode === SCHEDULER_MODE.bootstrap) {
    return tasks.filter((task) => task.bootstrap);
  }
  if (mode === SCHEDULER_MODE.lightweight || mode === true) {
    return tasks.filter((task) => task.lightweight);
  }
  if (mode === SCHEDULER_MODE.medium) {
    return tasks.filter((task) =>
      !task.bootstrapOnly && (
        task.lightweight ||
        task.medium ||
        task.bitNodes?.includes(Number(currentNode))
      )
    );
  }
  return tasks.filter((task) => !task.bootstrapOnly);
}

export function sortTasksForMode(tasks, mode) {
  const priority = (task) => {
    if (mode === SCHEDULER_MODE.bootstrap ||
        mode === SCHEDULER_MODE.lightweight ||
        mode === true) {
      return Number(task.lightweightPriority ?? task.priority);
    }
    if (mode === SCHEDULER_MODE.medium) {
      return Number(task.mediumPriority ?? task.lightweightPriority ?? task.priority);
    }
    return Number(task.priority);
  };
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

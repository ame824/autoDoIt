export function isLightweightMode(homeRam, fullModeHomeRam) {
  return Number(homeRam) < Number(fullModeHomeRam);
}

export function tasksForMode(tasks, lightweight) {
  return lightweight
    ? tasks.filter((task) => task.lightweight)
    : [...tasks];
}

export function sortTasksForMode(tasks, lightweight) {
  const priority = (task) => lightweight
    ? Number(task.lightweightPriority ?? task.priority)
    : Number(task.priority);
  return [...tasks].sort((a, b) => priority(b) - priority(a));
}

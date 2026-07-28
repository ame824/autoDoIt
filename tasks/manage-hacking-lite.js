const TARGETS = [
  "n00dles",
  "foodnstuff",
  "sigma-cosmetics",
  "joesguns",
  "hong-fang-tea",
  "harakiri-sushi",
];
const RUNNERS = ["home", ...TARGETS];

function selectTarget(ns) {
  const hackingLevel = ns.getHackingLevel();
  return TARGETS
    .filter((host) =>
      ns.hasRootAccess(host) &&
      ns.getServerRequiredHackingLevel(host) <= hackingLevel &&
      ns.getServerMaxMoney(host) > 0
    )
    .sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a))[0] ?? null;
}

function selectAction(ns, target) {
  const security = ns.getServerSecurityLevel(target);
  const minimum = ns.getServerMinSecurityLevel(target);
  if (security > minimum + 5) return "weaken";
  const money = ns.getServerMoneyAvailable(target);
  const maximum = ns.getServerMaxMoney(target);
  return money < maximum * 0.75 ? "grow" : "hack";
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const target = selectTarget(ns);
  if (!target) return;

  const worker = `/workers/${selectAction(ns, target)}.js`;
  const workerRam = ns.getScriptRam(worker, "home");
  if (workerRam <= 0 || !ns.fileExists(worker, "home")) return;

  for (const runner of RUNNERS) {
    if (!ns.hasRootAccess(runner) || !ns.fileExists(worker, runner)) continue;
    const free = ns.getServerMaxRam(runner) - ns.getServerUsedRam(runner);
    const threads = Math.floor(free / workerRam);
    if (threads < 1) continue;
    ns.exec(worker, runner, threads, target);
  }
}

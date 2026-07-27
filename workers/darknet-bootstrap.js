/** @param {NS} ns */
export async function main(ns) {
  const host = String(ns.args[0] ?? "darkweb");
  const requiredFreeRam = Math.max(0, Number(ns.args[1]) || 0);
  ns.disableLog("ALL");

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (freeRam + 0.0001 >= requiredFreeRam) return;
    if (ns.dnet.getBlockedRam(host) <= 0) return;

    const result = await ns.dnet.memoryReallocation(host);
    if (!result.success) return;
  }
}


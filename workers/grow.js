/** @param {NS} ns */
export async function main(ns) {
  const target = String(ns.args[0] ?? "");
  if (!target) throw new Error("workers/grow.js requires a target hostname.");
  await ns.grow(target);
}


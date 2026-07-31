const DARKNET_PORT = 19;

function send(ns, level, key, title, lines = []) {
  ns.tryWritePort(DARKNET_PORT, JSON.stringify({ level, key, title, lines }));
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const current = ns.getHostname();
  const version = String(ns.args[0] ?? "unknown");
  const nextFile = String(ns.args[1] ?? "");
  const nextThreads = Math.max(0, Math.floor(Number(ns.args[2]) || 0));

  try {
    for (const file of ns.ls(current, ".cache")) {
      try {
        const reward = ns.dnet.openCache(file, true);
        if (!reward.success) continue;
        send(ns, "success", `darknet-cache-${current}-${file}`, `Darknet-Cache geöffnet: ${file}`, [
          String(reward.message ?? "Belohnung eingesammelt."),
        ]);
      } catch {
        // A moving server can invalidate a cache between ls() and openCache().
      }
    }
  } finally {
    if (nextFile && nextThreads > 0) ns.spawn(nextFile, nextThreads, version);
  }
}

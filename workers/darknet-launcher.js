const LAUNCHER_FILE = "/workers/darknet-launcher.js";
const ENTRY_FILE = "/workers/darknet-entry.js";
const CRAWLER_FILE = "/workers/darknet-crawler.js";
const DARKNET_PORT = 19;
const MAX_THREADS = 64;

function send(ns, level, key, title, lines = []) {
  ns.tryWritePort(DARKNET_PORT, JSON.stringify({ level, key, title, lines }));
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const current = ns.getHostname();
  const version = String(ns.args[0] ?? "unknown");

  const launcherRam = ns.getScriptRam(LAUNCHER_FILE, current);
  const entryRam = ns.getScriptRam(ENTRY_FILE, current);
  const crawlerRam = ns.getScriptRam(CRAWLER_FILE, current);
  const maximumRam = ns.getServerMaxRam(current);
  const workerFile = crawlerRam > 0 && crawlerRam <= maximumRam
    ? CRAWLER_FILE
    : ENTRY_FILE;
  const workerRam = workerFile === CRAWLER_FILE ? crawlerRam : entryRam;
  if (ns.isRunning(workerFile, current, version)) return;
  if (workerRam <= 0 || workerRam > maximumRam) {
    send(ns, "warning", `darknet-launcher-ram-${current}`, `Darknet-Arbeiter passt nicht auf ${current}`, [
      `${workerRam.toFixed(2)} GiB benötigt, ${maximumRam.toFixed(2)} GiB vorhanden.`,
    ]);
    return;
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const usedAfterExit = Math.max(0, ns.getServerUsedRam(current) - launcherRam);
    const freeAfterExit = maximumRam - usedAfterExit;
    if (freeAfterExit + 0.0001 >= workerRam) break;
    if (ns.dnet.getBlockedRam(current) <= 0) return;
    const result = await ns.dnet.memoryReallocation();
    if (!result.success) return;
  }

  const usedAfterExit = Math.max(0, ns.getServerUsedRam(current) - launcherRam);
  const freeAfterExit = maximumRam - usedAfterExit;
  const threads = Math.max(0, Math.min(MAX_THREADS, Math.floor(freeAfterExit / workerRam)));
  if (threads < 1) return;

  const fullCrawler = workerFile === CRAWLER_FILE;
  send(ns, "success", `darknet-worker-start-${current}`, fullCrawler
    ? `Darknet-Crawler startet auf ${current}`
    : `Leichter Darknet-Seeder startet auf ${current}`, [
    fullCrawler
      ? `${threads} Threads übernehmen Passwörter, Labyrinthe und die weitere Verteilung.`
      : "Der Server verteilt den leichten Passwort-Seeder weiter, bis genug RAM für den vollständigen Crawler verfügbar ist.",
  ]);
  ns.spawn(workerFile, threads, version);
}

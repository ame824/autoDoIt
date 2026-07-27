import { TASKS, WORKER_FILES } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { scanNetwork } from "../core/network.js";

const SUPPORT_FILES = [
  "/autoDoIt.js",
  "/git-pull.js",
  "/core/config.js",
  "/core/network.js",
  "/core/notifier.js",
  "/core/status.js",
  "/core/capabilities.js",
  "/lib/logic.js",
  "/lib/go-logic.js",
  "/lib/darknet-logic.js",
  "/ui/dashboard.js",
  "/workers/darknet-bootstrap.js",
  "/workers/darknet-crawler.js",
];

/** @param {NS} ns */
export async function main(ns) {
  const files = [...SUPPORT_FILES, ...WORKER_FILES, ...TASKS.map((task) => task.file)];
  const uniqueFiles = [...new Set(files)];
  const missing = uniqueFiles.filter((file) => !ns.fileExists(file, "home"));
  const capabilities = getCapabilities(ns);
  const { hosts } = scanNetwork(ns);

  ns.tprint("\n[autoDoIt self-test]");
  ns.tprint(`Dateien: ${uniqueFiles.length - missing.length}/${uniqueFiles.length} vorhanden`);
  for (const file of missing) ns.tprint(`  FEHLT: ${file}`);

  ns.tprint(`Netzwerk: ${hosts.length} Server entdeckt`);
  ns.tprint(`BitNode: ${capabilities.reset.currentNode}`);
  ns.tprint(
    `APIs: Singularity=${capabilities.singularity}, Gang=${capabilities.gang}, ` +
      `Corporation=${capabilities.corporation}, Sleeves=${capabilities.sleeves}, ` +
      `Bladeburner=${capabilities.bladeburner}`,
  );

  ns.tprint("\nRAM-Kosten der ausführbaren Module:");
  for (const file of [
    "/autoDoIt.js",
    "/ui/dashboard.js",
    ...WORKER_FILES,
    ...TASKS.map((task) => task.file),
  ]) {
    if (!ns.fileExists(file, "home")) continue;
    const ram = ns.getScriptRam(file, "home");
    ns.tprint(`  ${file.padEnd(42)} ${ns.format.ram(ram)}`);
  }

  if (missing.length > 0) {
    ns.tprint("\nERGEBNIS: FEHLER – Dateien erneut vollständig importieren.");
    return;
  }
  ns.tprint("\nERGEBNIS: OK – Struktur und verfügbare Basisschnittstellen sind verwendbar.");
  ns.tprint("Starte danach: run autoDoIt.js");
}

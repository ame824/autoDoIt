import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { localizeEvent, readLanguage } from "../core/localization.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { clearStatusEvent, recordStatusEvent } from "../core/status.js";

const ENTRY_FILE = "/workers/darknet-entry.js";
const WORKER_FILE = "/workers/darknet-crawler.js";
const BOOTSTRAP_FILE = "/workers/darknet-bootstrap.js";
const SUPPORT_FILES = [
  ENTRY_FILE,
  "/workers/darknet-launcher.js",
  WORKER_FILE,
  "/workers/darknet-support.js",
  "/lib/darknet-logic.js",
  "/core/config.js",
];

export function calculateBootstrapThreads(freeRam, scriptRam, maximum) {
  if (!Number.isFinite(scriptRam) || scriptRam <= 0) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(Math.max(0, freeRam) / scriptRam)));
}

function handleEvent(ns, event) {
  const lines = Array.isArray(event.lines) ? event.lines : [];
  if (event.level === "warning") {
    const localized = localizeEvent({ title: event.title, lines }, readLanguage(ns));
    recordStatusEvent(ns, {
      key: event.key,
      level: "warning",
      title: event.title,
      lines,
    });
    ns.toast(`[autoDoIt] ${localized.title}`, "warning", 8_000);
  } else if (event.level === "success") {
    reportSuccess(ns, event.key, event.title, lines);
  } else {
    reportInfo(ns, event.key, event.title, lines);
  }
}

async function ensureDarknetWorkerRam(ns, host, requiredRam) {
  const getFreeRam = () => ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  if (getFreeRam() + 0.0001 >= requiredRam) return true;
  if (ns.dnet.getBlockedRam(host) <= 0 || !ns.fileExists(BOOTSTRAP_FILE, "home")) return false;

  const bootstrapRam = ns.getScriptRam(BOOTSTRAP_FILE, "home");
  const homeFreeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home") - 32;
  const threads = calculateBootstrapThreads(
    homeFreeRam,
    bootstrapRam,
    CONFIG.darknetBootstrapMaxThreads,
  );
  if (threads < 1) return false;

  reportInfo(ns, `darknet-free-ram-${host}`, `Darknet-RAM wird automatisch freigegeben`, [
    `${host}: ${ns.format.ram(getFreeRam())} frei, ${ns.format.ram(requiredRam)} benötigt.`,
    `RAM-Freigabe läuft mit ${threads} Threads.`,
  ], 60_000);

  const alreadyRunning = ns.ps("home").some(
    (process) => process.filename === BOOTSTRAP_FILE && String(process.args[0]) === host,
  );
  if (!alreadyRunning) {
    ns.run(BOOTSTRAP_FILE, threads, host, requiredRam);
  }
  return false;
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.darknetEnabled) return;
  ns.disableLog("ALL");

  if (!ns.fileExists("DarkscapeNavigator.exe", "home")) {
    const capabilities = getCapabilities(ns);
    if (!capabilities.singularity) {
      reportBlocker(ns, "darknet-navigator", "Darknet benötigt DarkscapeNavigator.exe", [
        "Ohne Source-File 4 kann autoDoIt das Programm noch nicht selbst kaufen.",
      ], [
        "TOR kaufen und im Terminal „buy DarkscapeNavigator.exe“ ausführen.",
      ]);
    }
    return;
  }
  if (!ns.dnet || typeof ns.dnet.probe !== "function") return;
  clearStatusEvent(ns, "blocker:darknet-worker-ram");

  const port = ns.getPortHandle(CONFIG.darknetPort);
  try {
    while (!port.empty()) {
      const raw = port.read();
      try {
        handleEvent(ns, JSON.parse(String(raw)));
      } catch {
        // Ignore messages not owned by autoDoIt.
      }
    }

    const entry = ns.dnet.probe().find((host) => host === "darkweb") ?? "darkweb";
    if (!ns.serverExists(entry)) {
      reportInfo(ns, "darknet-waiting", "Darknet-Einstieg ist momentan instabil");
      return;
    }

    await ns.scp(SUPPORT_FILES, entry, "home");
    const version = String(ns.read("/version.txt") || "unknown").trim();
    const processes = ns.ps(entry).filter((process) => process.filename === ENTRY_FILE);
    if (processes.some((process) => String(process.args[0] ?? "") === version)) return;
    for (const process of processes) ns.kill(process.pid);

    const scriptRam = ns.getScriptRam(ENTRY_FILE, entry);
    const desiredThreads = calculateBootstrapThreads(
      ns.getServerMaxRam(entry),
      scriptRam,
      CONFIG.darknetWorkerMaxThreads,
    );
    const requiredRam = scriptRam * desiredThreads;
    const ramReady = desiredThreads > 0 && await ensureDarknetWorkerRam(ns, entry, requiredRam);
    if (!ramReady) {
      reportInfo(ns, "darknet-worker-ram", "Darknet bereitet einen schnellen Arbeiter vor", [
        `${entry}: ${ns.format.ram(ns.getServerMaxRam(entry) - ns.getServerUsedRam(entry))} frei.`,
        `Einstiegsarbeiter: ${ns.format.ram(scriptRam)} pro Thread, maximal ${ns.format.ram(ns.getServerMaxRam(entry))}.`,
      ], 60_000);
      return;
    }

    const threads = calculateBootstrapThreads(
      ns.getServerMaxRam(entry) - ns.getServerUsedRam(entry),
      scriptRam,
      CONFIG.darknetWorkerMaxThreads,
    );
    const pid = ns.exec(ENTRY_FILE, entry, threads, version);
    if (pid === 0) {
      reportInfo(ns, "darknet-worker-start", "Darknet-Arbeiter wird erneut gestartet", [
        "Der Einstiegsserver hat sich während des Starts verändert.",
      ], 60_000);
    } else {
      reportSuccess(ns, "darknet-started", "Beschleunigte Darknet-Erkundung gestartet", [
        `${threads} Einstiegs-Threads öffnen Nachbarserver und verteilen die vollständigen Crawler.`,
      ]);
    }
  } catch (error) {
    reportInfo(ns, "darknet-instability", "Darknet-Verbindung wird erneut aufgebaut", [
      String(error),
    ], 60_000);
  }
}

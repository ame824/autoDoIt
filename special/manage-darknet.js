import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { localizeEvent, readLanguage } from "../core/localization.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { clearStatusEvent, recordStatusEvent } from "../core/status.js";

const WORKER_FILE = "/workers/darknet-crawler.js";
const BOOTSTRAP_FILE = "/workers/darknet-bootstrap.js";
const SUPPORT_FILES = [WORKER_FILE, "/lib/darknet-logic.js", "/core/config.js"];

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

  const pid = ns.run(BOOTSTRAP_FILE, threads, host, requiredRam);
  if (pid === 0) return false;
  while (ns.isRunning(pid, "home")) await ns.sleep(250);

  const ready = getFreeRam() + 0.0001 >= requiredRam;
  if (ready) {
    reportSuccess(ns, `darknet-ram-ready-${host}`, `Darknet-RAM freigegeben: ${host}`, [
      `${ns.format.ram(getFreeRam())} sind jetzt verfügbar.`,
    ]);
  }
  return ready;
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
  while (true) {
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
        await ns.sleep(30_000);
        continue;
      }

      await ns.scp(SUPPORT_FILES, entry, "home");
      if (!ns.scriptRunning(WORKER_FILE, entry)) {
        const requiredRam = ns.getScriptRam(WORKER_FILE, "home");
        const ramReady = await ensureDarknetWorkerRam(ns, entry, requiredRam);
        if (!ramReady) {
          reportInfo(ns, "darknet-worker-ram", "Darknet wartet auf automatisch freigegebenen RAM", [
            `${entry}: ${ns.format.ram(ns.getServerMaxRam(entry) - ns.getServerUsedRam(entry))} frei.`,
            `Worker benötigt ${ns.format.ram(requiredRam)}; autoDoIt versucht es erneut.`,
          ], 60_000);
          await ns.sleep(15_000);
          continue;
        }
        const pid = ns.exec(WORKER_FILE, entry, 1, JSON.stringify(["home", entry]));
        if (pid === 0) {
          reportInfo(ns, "darknet-worker-start", "Darknet-Arbeiter wird erneut gestartet", [
            "Der Einstiegsserver hat sich während des Starts verändert.",
          ], 60_000);
        } else {
          reportInfo(ns, "darknet-started", "Darknet-Erkundung gestartet", [
            "Caches, Passworthinweise und erreichbare Server werden automatisch bearbeitet.",
          ], 60_000);
        }
      }
    } catch (error) {
      reportInfo(ns, "darknet-instability", "Darknet-Verbindung wird erneut aufgebaut", [
        String(error),
      ], 60_000);
    }
    await ns.sleep(15_000);
  }
}

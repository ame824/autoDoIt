import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";
import { recordStatusEvent } from "../core/status.js";

const WORKER_FILE = "/workers/darknet-crawler.js";
const SUPPORT_FILES = [WORKER_FILE, "/lib/darknet-logic.js", "/core/config.js"];

function handleEvent(ns, event) {
  const lines = Array.isArray(event.lines) ? event.lines : [];
  if (event.level === "warning") {
    recordStatusEvent(ns, {
      key: event.key,
      level: "warning",
      title: event.title,
      lines,
    });
    ns.toast(`[autoDoIt] ${event.title}`, "warning", 8_000);
  } else if (event.level === "success") {
    reportSuccess(ns, event.key, event.title, lines);
  } else {
    reportInfo(ns, event.key, event.title, lines);
  }
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
        const pid = ns.exec(WORKER_FILE, entry, 1, JSON.stringify(["home", entry]));
        if (pid === 0) {
          reportBlocker(ns, "darknet-worker-ram", "Darknet-Arbeiter konnte nicht starten", [
            "Auf darkweb ist derzeit nicht genug freier RAM vorhanden.",
          ]);
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


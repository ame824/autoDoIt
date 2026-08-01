import { readLanguage } from "../core/localization.js";
import { CONFIG } from "../core/config.js";

const DARKNET_PAGE_ID = "draggableBackgroundTarget";
const REFRESH_MS = 500;
const HOME = "home";
const DARKWEB = "darkweb";

const TEXT = Object.freeze({
  de: {
    title: "autoDoIt Darknet-Konsole",
    progress: "Fortschritt",
    authenticated: "authentifiziert",
    deepest: "tiefste sichtbare Ebene",
    stasis: "Stasis",
    lastTarget: "Terminal",
    home: "HOME",
    noServers: "Noch keine Darknet-Server auf der Karte sichtbar.",
    help: "Klick verbindet dein Terminal über einen gültigen Weg.",
    unavailable: "Terminalwechsel benötigt BitNode 4 oder Source-File 4.",
    connecting: "Verbinde",
    connected: "Verbunden mit",
    noRoute: "Kein authentifizierter Weg zu",
    failed: "Verbindung fehlgeschlagen bei",
    stasisSet: "Stasis-Link setzen",
    stasisRemove: "Stasis-Link entfernen",
    stasisQueued: "Stasis-Auftrag an den Server gesendet:",
    stasisQueueFull: "Stasis-Auftrag konnte nicht eingereiht werden:",
    stasisApplied: "Stasis-Link wurde gesetzt:",
    stasisRemoved: "Stasis-Link wurde entfernt:",
    stasisFailed: "Stasis-Auftrag fehlgeschlagen:",
    stasisTimeout: "Kein Crawler hat den Stasis-Auftrag rechtzeitig übernommen:",
  },
  en: {
    title: "autoDoIt Darknet Console",
    progress: "Progress",
    authenticated: "authenticated",
    deepest: "deepest visible level",
    stasis: "Stasis",
    lastTarget: "Terminal",
    home: "HOME",
    noServers: "No Darknet servers are visible on the map yet.",
    help: "Click to connect your terminal through a valid route.",
    unavailable: "Terminal switching requires BitNode 4 or Source-File 4.",
    connecting: "Connecting",
    connected: "Connected to",
    noRoute: "No authenticated route to",
    failed: "Connection failed at",
    stasisSet: "Apply stasis link",
    stasisRemove: "Remove stasis link",
    stasisQueued: "Stasis request sent to the server:",
    stasisQueueFull: "Stasis request could not be queued:",
    stasisApplied: "Stasis link applied:",
    stasisRemoved: "Stasis link removed:",
    stasisFailed: "Stasis request failed:",
    stasisTimeout: "No crawler handled the stasis request in time:",
  },
});

function text(language) {
  return TEXT[language === "en" ? "en" : "de"];
}

export function resolveReactApi(scope = globalThis) {
  let reactApi = scope?.React;
  if (!reactApi) {
    try {
      reactApi = eval("React");
    } catch {
      reactApi = null;
    }
  }
  return typeof reactApi?.createElement === "function" ? reactApi : null;
}

export function resolveDocument(scope = globalThis) {
  let documentApi = scope?.document;
  if (!documentApi) {
    try {
      documentApi = eval("document");
    } catch {
      documentApi = null;
    }
  }
  return typeof documentApi?.getElementById === "function" ? documentApi : null;
}

export function isDarknetPage(documentApi) {
  return Boolean(documentApi?.getElementById?.(DARKNET_PAGE_ID));
}

export function serverFromElement(element) {
  if (!element || typeof element !== "object") return null;
  const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? element[fiberKey] : null;
  for (let depth = 0; fiber && depth < 24; depth += 1, fiber = fiber.return) {
    const server = fiber.memoizedProps?.server ?? fiber.pendingProps?.server;
    if (server && typeof server.hostname === "string" && Array.isArray(server.serversOnNetwork)) {
      return server;
    }
  }
  return null;
}

function plainServer(server) {
  return {
    hostname: String(server.hostname),
    ip: String(server.ip ?? ""),
    neighbors: [...new Set(server.serversOnNetwork.map(String))],
    depth: Math.max(0, Number(server.depth) || 0),
    hasAdminRights: Boolean(server.hasAdminRights),
    hasStasisLink: Boolean(server.hasStasisLink),
    backdoorInstalled: Boolean(server.backdoorInstalled),
  };
}

export function extractDarknetTopology(documentApi) {
  const root = documentApi?.getElementById?.(DARKNET_PAGE_ID);
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const byHostname = new Map();
  for (const element of root.querySelectorAll("button")) {
    const server = serverFromElement(element);
    if (server) byHostname.set(String(server.hostname), plainServer(server));
  }
  return [...byHostname.values()].sort((a, b) => a.depth - b.depth || a.hostname.localeCompare(b.hostname));
}

export function planDarknetRoute(servers, targetHostname) {
  const target = String(targetHostname);
  if (target === HOME) return [HOME];
  const byName = new Map(servers.map((server) => [String(server.hostname), server]));
  const destination = byName.get(target);
  if (!destination?.hasAdminRights) return [];
  if (destination.hasStasisLink || destination.backdoorInstalled) return [HOME, target];

  const allowed = new Set(
    servers.filter((server) => server.hasAdminRights).map((server) => String(server.hostname)),
  );
  allowed.add(HOME);
  const adjacency = new Map([[HOME, new Set([DARKWEB])]]);
  for (const server of servers) {
    const name = String(server.hostname);
    if (!allowed.has(name)) continue;
    if (!adjacency.has(name)) adjacency.set(name, new Set());
    for (const neighbor of server.neighbors ?? []) {
      if (!allowed.has(String(neighbor))) continue;
      adjacency.get(name).add(String(neighbor));
      if (!adjacency.has(String(neighbor))) adjacency.set(String(neighbor), new Set());
      adjacency.get(String(neighbor)).add(name);
    }
  }
  if (allowed.has(DARKWEB)) {
    adjacency.get(HOME).add(DARKWEB);
    if (!adjacency.has(DARKWEB)) adjacency.set(DARKWEB, new Set());
    adjacency.get(DARKWEB).add(HOME);
  }

  const queue = [HOME];
  const previous = new Map([[HOME, null]]);
  while (queue.length > 0 && !previous.has(target)) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current) ?? []) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  if (!previous.has(target)) return [];
  const route = [];
  for (let current = target; current; current = previous.get(current)) route.push(current);
  route.reverse();
  return route;
}

export function createTargetQueue() {
  let pending = "";
  return Object.freeze({
    select: (hostname) => { pending = String(hostname); },
    take: () => {
      const selected = pending;
      pending = "";
      return selected;
    },
  });
}

export function createStasisActionQueue() {
  let pending = null;
  return Object.freeze({
    select: (target, enable) => { pending = { target: String(target), enable: Boolean(enable) }; },
    take: () => {
      const selected = pending;
      pending = null;
      return selected;
    },
  });
}

export function createStasisCommand(target, enable, requestedAt = Date.now()) {
  return JSON.stringify({
    type: "stasis",
    target: String(target),
    enable: Boolean(enable),
    requestedAt: Number(requestedAt),
    expiresAt: Number(requestedAt) + 2 * 60_000,
  });
}

export function queueStasis(ns, target, enable, requestedAt = Date.now()) {
  return ns.tryWritePort(
    CONFIG.darknetCommandPort,
    createStasisCommand(target, enable, requestedAt),
  );
}

export function parseStasisResponse(raw) {
  try {
    const response = JSON.parse(String(raw));
    if (
      response?.type !== "stasis-result" ||
      typeof response.target !== "string" ||
      !response.target ||
      typeof response.success !== "boolean"
    ) return null;
    return {
      target: response.target,
      enable: Boolean(response.enable),
      success: response.success,
      message: String(response.message ?? ""),
    };
  } catch {
    return null;
  }
}

function takeStasisResponse(ns) {
  const port = ns.getPortHandle(CONFIG.darknetCommandResponsePort);
  let response = null;
  while (!port.empty()) {
    const candidate = parseStasisResponse(port.read());
    if (candidate) response = candidate;
  }
  return response;
}

export async function executeRoute(ns, route) {
  for (const hostname of route) {
    if (!ns.singularity.connect(hostname)) return hostname;
    await ns.sleep(10);
  }
  return "";
}

export function calculateConsoleLayout(viewportWidth, viewportHeight) {
  const width = Math.min(560, Math.max(300, Math.floor(Number(viewportWidth) * 0.36)));
  const height = Math.min(650, Math.max(260, Math.floor(Number(viewportHeight) * 0.72)));
  return { width, height, x: Math.max(8, Number(viewportWidth) - width - 12), y: 8 };
}

function buildConsole(React, language, servers, state, select, selectStasis) {
  const t = text(language);
  const authenticated = servers.filter((server) => server.hasAdminRights).length;
  const deepest = servers.reduce((value, server) => Math.max(value, server.depth), 0);
  const buttonStyle = (enabled, highlighted = false) => ({
    background: highlighted ? "#003b45" : "#080808",
    border: `1px solid ${enabled ? "#00ff66" : "#555"}`,
    color: enabled ? "#00ff66" : "#777",
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "monospace",
    fontSize: "12px",
    padding: "5px 7px",
    textAlign: "left",
  });
  const buttons = [
    React.createElement("button", {
      key: HOME,
      disabled: state.singularityAvailable === false,
      style: buttonStyle(state.singularityAvailable !== false, state.lastTarget === HOME),
      onClick: () => state.singularityAvailable !== false && select(HOME),
    }, `⌂ ${t.home}`),
    ...servers.map((server) => {
      const enabled = server.hasAdminRights && state.singularityAvailable !== false;
      const mark = server.hasStasisLink ? "★" : server.backdoorInstalled ? "◆" : server.hasAdminRights ? "✓" : "·";
      const stasisPending = state.stasisTarget === server.hostname;
      const stasisBusy = Boolean(state.stasisTarget);
      return React.createElement("div", {
        key: server.hostname,
        style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 38px", gap: "3px" },
      },
      React.createElement("button", {
          disabled: !enabled,
          style: buttonStyle(enabled, state.lastTarget === server.hostname),
          title: `${server.ip} · depth ${server.depth}`,
          onClick: () => enabled && select(server.hostname),
        }, `${mark} ${server.hostname}  [${server.depth}]`),
      React.createElement("button", {
          disabled: !server.hasAdminRights || stasisBusy,
          style: {
            ...buttonStyle(server.hasAdminRights && !stasisBusy, server.hasStasisLink),
            color: server.hasStasisLink || stasisPending ? "#ffcc00" : "#00ffff",
            padding: "3px",
            textAlign: "center",
          },
          title: server.hasStasisLink ? t.stasisRemove : t.stasisSet,
          onClick: () => server.hasAdminRights && !stasisBusy &&
            selectStasis(server.hostname, !server.hasStasisLink),
        }, stasisPending ? "…" : server.hasStasisLink ? "S−" : "S+"));
    }),
  ];
  return React.createElement("div", {
    style: { color: "#00ff66", fontFamily: "monospace", padding: "3px", fontSize: "12px" },
  },
  React.createElement("div", { style: { color: "#00ffff", fontWeight: 700, marginBottom: "5px" } }, t.title),
  React.createElement("div", null, `${t.progress}: ${authenticated}/${servers.length} ${t.authenticated} · ${t.deepest}: ${deepest}`),
  React.createElement("div", null, `${t.stasis}: ${state.stasisLinked}/${state.stasisLimit}`),
  React.createElement("div", null, `${t.lastTarget}: ${state.lastTarget || HOME}`),
  React.createElement("div", { style: { color: state.error ? "#ff5555" : "#999", margin: "5px 0" } }, state.message || t.help),
  servers.length === 0
    ? React.createElement("div", { style: { color: "#ffcc00" } }, t.noServers)
    : React.createElement("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "4px" },
    }, ...buttons));
}

function applyLayout(ns, previous = "") {
  const [viewportWidth, viewportHeight] = ns.ui.windowSize();
  const key = `${viewportWidth}x${viewportHeight}`;
  if (key === previous) return key;
  const layout = calculateConsoleLayout(viewportWidth, viewportHeight);
  ns.ui.resizeTail(layout.width, layout.height);
  ns.ui.moveTail(layout.x, layout.y);
  ns.ui.setTailFontSize(12);
  return key;
}

/** @param {NS} ns */
export async function main(ns) {
  const documentApi = resolveDocument();
  const React = resolveReactApi();
  const targets = createTargetQueue();
  const stasisActions = createStasisActionQueue();
  const state = {
    lastTarget: HOME,
    message: "",
    error: false,
    singularityAvailable: null,
    stasisTarget: "",
    stasisExpected: false,
    stasisRequestedAt: 0,
    stasisLinked: 0,
    stasisLimit: "?",
  };
  let openedThisVisit = false;
  let lastLayout = "";
  ns.disableLog("ALL");
  ns.atExit(() => {
    try { ns.ui.closeTail(); } catch { /* Tail may already be closed. */ }
  });

  while (true) {
    const visible = isDarknetPage(documentApi);
    if (!visible) {
      if (openedThisVisit) ns.ui.closeTail();
      openedThisVisit = false;
      await ns.sleep(REFRESH_MS);
      continue;
    }
    if (!openedThisVisit) {
      ns.ui.openTail();
      ns.ui.setTailTitle(text(readLanguage(ns)).title);
      lastLayout = applyLayout(ns, "");
      openedThisVisit = true;
    } else {
      lastLayout = applyLayout(ns, lastLayout);
    }

    const language = readLanguage(ns);
    const t = text(language);
    const servers = extractDarknetTopology(documentApi);
    try {
      state.stasisLinked = ns.dnet.getStasisLinkedServers().length;
      state.stasisLimit = ns.dnet.getStasisLinkLimit();
    } catch {
      state.stasisLinked = servers.filter((server) => server.hasStasisLink).length;
      state.stasisLimit = "?";
    }
    if (state.stasisTarget) {
      const response = takeStasisResponse(ns);
      const stasisServer = servers.find((server) => server.hostname === state.stasisTarget);
      if (response && response.target === state.stasisTarget) {
        state.message = response.success
          ? `${response.enable ? t.stasisApplied : t.stasisRemoved} ${response.target}`
          : `${t.stasisFailed} ${response.target}${response.message ? ` · ${response.message}` : ""}`;
        state.error = !response.success;
        state.stasisTarget = "";
      } else if (stasisServer && stasisServer.hasStasisLink === state.stasisExpected) {
        state.message = `${state.stasisExpected ? t.stasisApplied : t.stasisRemoved} ${state.stasisTarget}`;
        state.error = false;
        state.stasisTarget = "";
      } else if (Date.now() - state.stasisRequestedAt > 2 * 60_000) {
        state.message = `${t.stasisTimeout} ${state.stasisTarget}`;
        state.error = true;
        state.stasisTarget = "";
      }
    }
    const stasisAction = stasisActions.take();
    if (stasisAction) {
      if (queueStasis(ns, stasisAction.target, stasisAction.enable)) {
        state.stasisTarget = stasisAction.target;
        state.stasisExpected = stasisAction.enable;
        state.stasisRequestedAt = Date.now();
        state.message = `${t.stasisQueued} ${stasisAction.target}`;
        state.error = false;
      } else {
        state.message = `${t.stasisQueueFull} ${stasisAction.target}`;
        state.error = true;
      }
    }
    const target = targets.take();
    if (target) {
      const route = target === HOME ? [HOME] : planDarknetRoute(servers, target);
      if (route.length === 0) {
        state.message = `${t.noRoute} ${target}`;
        state.error = true;
      } else {
        state.message = `${t.connecting}: ${route.join(" → ")}`;
        state.error = false;
        try {
          const failedAt = await executeRoute(ns, route);
          state.singularityAvailable = true;
          if (failedAt) {
            state.message = `${t.failed}: ${failedAt}`;
            state.error = true;
          } else {
            state.lastTarget = target;
            state.message = `${t.connected} ${target}`;
          }
        } catch {
          state.singularityAvailable = false;
          state.message = t.unavailable;
          state.error = true;
        }
      }
    }

    ns.clearLog();
    if (React && typeof ns.printRaw === "function") {
      ns.printRaw(buildConsole(
        React,
        language,
        servers,
        state,
        targets.select,
        stasisActions.select,
      ));
    } else {
      ns.print(`${t.title}\n${t.progress}: ${servers.filter((server) => server.hasAdminRights).length}/${servers.length}\n${state.message || t.help}`);
    }
    ns.ui.renderTail();
    await ns.sleep(REFRESH_MS);
  }
}

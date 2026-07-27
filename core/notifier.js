import { CONFIG } from "./config.js";
import { recordStatusEvent } from "./status.js";

const NOTICE_FILE = "/data/autoDoIt-notices.txt";

function readNotices(ns) {
  const raw = ns.read(NOTICE_FILE);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function emit(ns, key, title, lines, variant, cooldownMs) {
  const notices = readNotices(ns);
  const now = Date.now();
  if (now - Number(notices[key] ?? 0) < cooldownMs) return false;

  const message = [
    "",
    `[autoDoIt] ${title}`,
    ...lines.map((line) => `  ${line}`),
  ].join("\n");

  recordStatusEvent(ns, { key, level: variant, title, lines });
  if (variant === "warning" || variant === "error") ns.tprint(message);
  ns.toast(`[autoDoIt] ${title}`, variant, 8_000);
  notices[key] = now;
  ns.write(NOTICE_FILE, JSON.stringify(notices), "w");
  return true;
}

export function reportBlocker(ns, key, title, details, steps = []) {
  return emit(
    ns,
    `blocker:${key}`,
    `MANUELLE AKTION: ${title}`,
    [
      ...details,
      ...(steps.length > 0 ? ["Nächste Schritte:", ...steps.map((step, i) => `${i + 1}. ${step}`)] : []),
      "autoDoIt prüft diese Voraussetzung später erneut.",
    ],
    "warning",
    CONFIG.noticeCooldownMs,
  );
}

export function reportInfo(ns, key, title, details = [], cooldownMs = CONFIG.noticeCooldownMs) {
  return emit(ns, `info:${key}`, title, details, "info", cooldownMs);
}

export function reportSuccess(ns, key, title, details = []) {
  return emit(ns, `success:${key}`, title, details, "success", 60_000);
}

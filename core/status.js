export const STATUS_FILE = "/data/autoDoIt-status.txt";
const MAX_EVENTS = 16;

export function readStatus(ns) {
  const raw = ns.read(STATUS_FILE);
  if (!raw) return { events: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      events: Array.isArray(parsed?.events) ? parsed.events : [],
    };
  } catch {
    return { events: [] };
  }
}

export function recordStatusEvent(ns, event) {
  const status = readStatus(ns);
  const nextEvent = {
    time: Date.now(),
    key: String(event.key),
    level: String(event.level),
    title: String(event.title),
    lines: Array.isArray(event.lines) ? event.lines.map(String).slice(0, 4) : [],
  };
  const events = [
    ...status.events.filter(({ key }) => key !== nextEvent.key),
    nextEvent,
  ].slice(-MAX_EVENTS);
  ns.write(STATUS_FILE, JSON.stringify({ events }), "w");
  return nextEvent;
}

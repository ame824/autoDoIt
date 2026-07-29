export const UPDATE_STATUS_FILE = "/data/autoDoIt-update-status.txt";

export function readUpdateStatus(ns) {
  try {
    const status = JSON.parse(String(ns.read(UPDATE_STATUS_FILE) || "{}"));
    return {
      state: String(status.state || "unknown"),
      version: String(status.version || ""),
      checkedAt: Number(status.checkedAt || 0),
    };
  } catch {
    return { state: "unknown", version: "", checkedAt: 0 };
  }
}

export function writeUpdateStatus(ns, state, version = "", checkedAt = Date.now()) {
  const status = {
    state: String(state || "unknown"),
    version: String(version || ""),
    checkedAt: Number(checkedAt || Date.now()),
  };
  ns.write(UPDATE_STATUS_FILE, JSON.stringify(status), "w");
  return status;
}

import { CONFIG } from "../core/config.js";
import { dashboardText, readLanguage } from "../core/localization.js";

const LAST_CHECK_FILE = "/data/autoDoIt-update-last-check.txt";
const INSTALLED_VERSION_FILE = "/data/autoDoIt-installed-version.txt";
const REMOTE_VERSION_FILE = "/data/autoDoIt-remote-version.json";
const UPDATER_FILE = "/git-pull.js";

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function validBranch(value) {
  return /^[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..");
}

export function shouldCheckForUpdate(lastCheck, now, intervalMs) {
  return Number(now) - Number(lastCheck || 0) >= Number(intervalMs);
}

export function parseRemoteVersion(value) {
  try {
    const version = String(JSON.parse(String(value)).sha ?? "").toLowerCase();
    return /^[a-f0-9]{40}$/.test(version) ? version : "";
  } catch {
    return "";
  }
}

function commitApiUrl(repository, branch, cacheKey) {
  return `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}?v=${cacheKey}`;
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.autoUpdateEnabled) return;
  const repository = String(CONFIG.autoUpdateRepository);
  const branch = String(CONFIG.autoUpdateBranch);
  if (!validRepository(repository) || !validBranch(branch)) return;

  const now = Date.now();
  if (!shouldCheckForUpdate(
    ns.read(LAST_CHECK_FILE),
    now,
    CONFIG.autoUpdateIntervalMs,
  )) return;
  ns.write(LAST_CHECK_FILE, String(now), "w");

  const language = readLanguage(ns);
  const downloaded = await ns.wget(
    commitApiUrl(repository, branch, now),
    REMOTE_VERSION_FILE,
    "home",
  );
  if (!downloaded) {
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  const remoteVersion = parseRemoteVersion(ns.read(REMOTE_VERSION_FILE));
  if (!remoteVersion) {
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  const installedVersion = String(ns.read(INSTALLED_VERSION_FILE)).trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(installedVersion)) {
    // The first check after installing this feature establishes a safe baseline.
    ns.write(INSTALLED_VERSION_FILE, remoteVersion, "w");
    return;
  }
  if (installedVersion === remoteVersion) return;

  if (!ns.fileExists(UPDATER_FILE, "home")) {
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFound")}`, "info", 8_000);
  ns.spawn(
    UPDATER_FILE,
    { threads: 1, spawnDelay: 250 },
    "--repo",
    repository,
    "--branch",
    branch,
    "--skip-test",
    "--auto",
    "--version",
    remoteVersion,
  );
}

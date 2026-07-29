import { CONFIG } from "../core/config.js";
import { dashboardText, readLanguage } from "../core/localization.js";
import { writeUpdateStatus } from "../lib/update-status.js";

const LAST_CHECK_FILE = "/data/autoDoIt-update-last-check.txt";
const LOCAL_VERSION_FILE = "/version.txt";
const REMOTE_VERSION_FILE = "/data/autoDoIt-remote-version.txt";
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
  const version = String(value).trim();
  return /^[A-Za-z0-9._-]{1,80}$/.test(version) ? version : "";
}

function rawVersionUrl(repository, branch, cacheKey) {
  const encodedBranch = branch
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${repository}/${encodedBranch}/version.txt?v=${cacheKey}`;
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.autoUpdateEnabled) {
    writeUpdateStatus(ns, "disabled");
    return;
  }
  const repository = String(CONFIG.autoUpdateRepository);
  const branch = String(CONFIG.autoUpdateBranch);
  if (!validRepository(repository) || !validBranch(branch)) {
    writeUpdateStatus(ns, "failed");
    return;
  }

  const now = Date.now();
  if (!shouldCheckForUpdate(
    ns.read(LAST_CHECK_FILE),
    now,
    CONFIG.autoUpdateIntervalMs,
  )) return;
  ns.write(LAST_CHECK_FILE, String(now), "w");
  writeUpdateStatus(ns, "checking", "", now);

  const language = readLanguage(ns);
  const downloaded = await ns.wget(
    rawVersionUrl(repository, branch, now),
    REMOTE_VERSION_FILE,
    "home",
  );
  if (!downloaded) {
    writeUpdateStatus(ns, "failed", "", now);
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  const remoteVersion = parseRemoteVersion(ns.read(REMOTE_VERSION_FILE));
  if (!remoteVersion) {
    writeUpdateStatus(ns, "failed", "", now);
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  const installedVersion = parseRemoteVersion(ns.read(LOCAL_VERSION_FILE));
  if (installedVersion === remoteVersion) {
    writeUpdateStatus(ns, "current", remoteVersion, now);
    return;
  }

  if (!ns.fileExists(UPDATER_FILE, "home")) {
    writeUpdateStatus(ns, "failed", remoteVersion, now);
    ns.toast(`[autoDoIt] ${dashboardText(language, "autoUpdateFailed")}`, "warning", 8_000);
    return;
  }

  writeUpdateStatus(ns, "found", remoteVersion, now);
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

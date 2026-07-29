const DEFAULT_REPOSITORY = "ame824/autoDoIt";
const DEFAULT_BRANCH = "main";
const MANIFEST_TARGET = "/data/autoDoIt-runtime-manifest.txt";
const INSTALLED_VERSION_FILE = "/data/autoDoIt-installed-version.txt";
const UPDATE_STATUS_FILE = "/data/autoDoIt-update-status.txt";

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function validBranch(value) {
  return /^[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..");
}

function encodePath(path) {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function rawUrl(repository, branch, path, cacheKey) {
  const encodedBranch = branch
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${repository}/${encodedBranch}/${encodePath(path)}?v=${cacheKey}`;
}

/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ["repo", DEFAULT_REPOSITORY],
    ["branch", DEFAULT_BRANCH],
    ["start", false],
    ["skip-test", false],
    ["auto", false],
    ["version", ""],
  ]);
  const repository = String(flags.repo);
  const branch = String(flags.branch);
  const automatic = Boolean(flags.auto);
  const version = String(flags.version ?? "").trim().toLowerCase();
  const status = (message) => automatic ? ns.print(message) : ns.tprint(message);

  if (!validRepository(repository)) {
    ns.tprint(`[autoDoIt updater] Ungültiges Repository: ${repository}`);
    return;
  }
  if (!validBranch(branch)) {
    ns.tprint(`[autoDoIt updater] Ungültiger Branch: ${branch}`);
    return;
  }
  if (version && !/^[A-Za-z0-9._-]{1,80}$/.test(version)) {
    ns.tprint("[autoDoIt updater] FEHLER: Ungültige Versionskennung.");
    return;
  }

  const cacheKey = Date.now();
  status(`[autoDoIt updater] Lade ${repository}@${branch} ...`);
  const manifestOk = await ns.wget(
    rawUrl(repository, branch, "/runtime-manifest.txt", cacheKey),
    MANIFEST_TARGET,
    "home",
  );
  if (!manifestOk) {
    ns.tprint("[autoDoIt updater] FEHLER: runtime-manifest.txt konnte nicht geladen werden.");
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(ns.read(MANIFEST_TARGET));
  } catch (error) {
    ns.tprint(`[autoDoIt updater] FEHLER: Manifest ist ungültig: ${String(error)}`);
    return;
  }
  if (
    manifest?.format !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.some((file) => typeof file !== "string" || !file.startsWith("/"))
  ) {
    ns.tprint("[autoDoIt updater] FEHLER: Unbekanntes Manifestformat.");
    return;
  }

  const schedulerProcess = typeof ns.getRunningScript === "function"
    ? ns.getRunningScript("/autoDoIt.js", "home")
    : null;
  const schedulerWasRunning = Boolean(schedulerProcess) ||
    ns.scriptRunning("/autoDoIt.js", "home");
  const schedulerArgs = Array.isArray(schedulerProcess?.args)
    ? schedulerProcess.args
    : [];
  if (schedulerWasRunning) {
    ns.scriptKill("/autoDoIt.js", "home");
    await ns.sleep(100);
  }

  const files = [...new Set(manifest.files)].sort((a, b) => {
    if (a === "/git-pull.js") return 1;
    if (b === "/git-pull.js") return -1;
    return a.localeCompare(b);
  });
  const failures = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    ns.print(`[${index + 1}/${files.length}] ${file}`);
    const ok = await ns.wget(
      rawUrl(repository, branch, file, `${cacheKey}-${index}`),
      file,
      "home",
    );
    if (!ok || !ns.fileExists(file, "home")) failures.push(file);
  }

  if (failures.length > 0) {
    ns.tprint("\n[autoDoIt updater] UPDATE UNVOLLSTÄNDIG");
    for (const file of failures) ns.tprint(`  Fehlgeschlagen: ${file}`);
    ns.tprint("Scheduler wurde aus Sicherheitsgründen nicht neu gestartet.");
    return;
  }

  const installedVersion = version || String(ns.read("/version.txt")).trim();
  if (/^[A-Za-z0-9._-]{1,80}$/.test(installedVersion)) {
    ns.write(INSTALLED_VERSION_FILE, installedVersion, "w");
    ns.write(UPDATE_STATUS_FILE, JSON.stringify({
      state: "current",
      version: installedVersion,
      checkedAt: Date.now(),
    }), "w");
  }
  status(`\n[autoDoIt updater] ${files.length} Dateien erfolgreich aktualisiert.`);
  if (automatic) {
    const english = String(ns.read("/data/autoDoIt-language.txt")).trim() === "en";
    ns.toast(
      english ? "[autoDoIt] Update installed" : "[autoDoIt] Update installiert",
      "success",
      8_000,
    );
  }

  let testPid = 0;
  if (!flags["skip-test"] && ns.fileExists("/tools/self-test.js", "home")) {
    testPid = ns.run("/tools/self-test.js", 1);
    if (testPid === 0) {
      ns.tprint("[autoDoIt updater] Selbsttest konnte wegen fehlendem RAM nicht gestartet werden.");
    }
  }

  if (flags.start || schedulerWasRunning) {
    for (let attempt = 0; testPid > 0 && ns.isRunning(testPid) && attempt < 50; attempt += 1) {
      await ns.sleep(100);
    }
    status("[autoDoIt updater] Scheduler wird nach Freigabe des Updater-RAMs gestartet.");
    ns.spawn("/autoDoIt.js", { threads: 1, spawnDelay: 500 }, ...schedulerArgs);
    return;
  } else {
    status("[autoDoIt updater] Start mit: run autoDoIt.js");
  }
}

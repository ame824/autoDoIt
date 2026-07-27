const DEFAULT_REPOSITORY = "ame824/autoDoIt";
const DEFAULT_BRANCH = "main";
const MANIFEST_TARGET = "/data/autoDoIt-runtime-manifest.txt";

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
  ]);
  const repository = String(flags.repo);
  const branch = String(flags.branch);

  if (!validRepository(repository)) {
    ns.tprint(`[autoDoIt updater] Ungültiges Repository: ${repository}`);
    return;
  }
  if (!validBranch(branch)) {
    ns.tprint(`[autoDoIt updater] Ungültiger Branch: ${branch}`);
    return;
  }

  const cacheKey = Date.now();
  ns.tprint(`[autoDoIt updater] Lade ${repository}@${branch} ...`);
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

  const schedulerWasRunning = ns.scriptRunning("/autoDoIt.js", "home");
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

  ns.tprint(`\n[autoDoIt updater] ${files.length} Dateien erfolgreich aktualisiert.`);

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
    ns.tprint("[autoDoIt updater] Scheduler wird nach Freigabe des Updater-RAMs gestartet.");
    ns.spawn("/autoDoIt.js", { threads: 1, spawnDelay: 500 });
    return;
  } else {
    ns.tprint("[autoDoIt updater] Start mit: run autoDoIt.js");
  }
}

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
  ]);
  const repository = String(flags.repo);
  const branch = String(flags.branch);

  if (!validRepository(repository) || !validBranch(branch)) {
    ns.tprint("[autoDoIt lite updater] Ungültiges Repository oder ungültiger Branch.");
    return;
  }

  const cacheKey = Date.now();
  ns.tprint(`[autoDoIt lite updater] Lade ${repository}@${branch} ...`);
  const manifestOk = await ns.wget(
    rawUrl(repository, branch, "/runtime-manifest.txt", cacheKey),
    MANIFEST_TARGET,
    "home",
  );
  if (!manifestOk) {
    ns.tprint("[autoDoIt lite updater] FEHLER: Manifest konnte nicht geladen werden.");
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(ns.read(MANIFEST_TARGET));
  } catch {
    ns.tprint("[autoDoIt lite updater] FEHLER: Manifest ist ungültig.");
    return;
  }
  if (
    manifest?.format !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.some((file) => typeof file !== "string" || !file.startsWith("/"))
  ) {
    ns.tprint("[autoDoIt lite updater] FEHLER: Unbekanntes Manifestformat.");
    return;
  }

  const schedulerWasRunning = ns.scriptKill("/autoDoIt.js", "home");
  const files = [...new Set(manifest.files)].sort((a, b) => {
    if (a === "/git-pull-lite.js") return 1;
    if (b === "/git-pull-lite.js") return -1;
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
    ns.tprint("\n[autoDoIt lite updater] UPDATE UNVOLLSTÄNDIG");
    for (const file of failures) ns.tprint(`  Fehlgeschlagen: ${file}`);
    ns.tprint("Scheduler bleibt aus, bis das Update vollständig ist.");
    return;
  }

  ns.tprint(`\n[autoDoIt lite updater] ${files.length} Dateien erfolgreich aktualisiert.`);
  ns.tprint(
    schedulerWasRunning
      ? "[autoDoIt lite updater] Alter Scheduler wurde beendet. Neustart mit: run autoDoIt.js"
      : "[autoDoIt lite updater] Start mit: run autoDoIt.js",
  );
}

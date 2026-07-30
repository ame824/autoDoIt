import { CONFIG } from "../core/config.js";
import {
  combinePrimeRemainders,
  commonFixedLengthSubstring,
  darknetCharacterSet,
  findDarknetFeedback,
  getDarknetCandidates,
  parseRomanRange,
  passwordFromSortedRms,
} from "../lib/darknet-logic.js";

const WORKER_FILE = "/workers/darknet-crawler.js";
const SUPPORT_FILE = "/workers/darknet-support.js";
const SUPPORT_FILES = [
  WORKER_FILE,
  SUPPORT_FILE,
  "/lib/darknet-logic.js",
  "/core/config.js",
];
const LABYRINTH_MODEL = "(The Labyrinth)";
const DIRECTIONS = [
  ["north", 0, -2, "south"],
  ["east", 2, 0, "west"],
  ["south", 0, 2, "north"],
  ["west", -2, 0, "east"],
];
const SMALL_PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
  71, 73, 79, 83, 89, 97,
];
const LARGE_PRIMES = [
  1069, 1409, 1471, 1567, 1597, 1601, 1697, 1747, 1801, 1889, 1979, 1999,
  2063, 2207, 2371, 2503, 2539, 2693, 2741, 2753, 2801, 2819, 2837, 2909,
  2939, 3169, 3389, 3571, 3761, 3881, 4217, 4289, 4547, 4729, 4789, 4877,
  4943, 4951, 4957, 5393, 5417, 5419, 5441, 5519, 5527, 5647, 5779, 5881,
  6007, 6089, 6133, 6389, 6451, 6469, 6547, 6661, 6719, 6841, 7103, 7549,
  7559, 7573, 7691, 7753, 7867, 8053, 8081, 8221, 8329, 8599, 8677, 8761,
  8839, 8963, 9103, 9199, 9343, 9467, 9551, 9601, 9739, 9749, 9859,
];
const LAST_SENT = new Map();

function send(ns, level, key, title, lines = []) {
  const now = Date.now();
  if (now - Number(LAST_SENT.get(key) ?? 0) < CONFIG.darknetWorkerEventCooldownMs) return;
  LAST_SENT.set(key, now);
  ns.tryWritePort(CONFIG.darknetPort, JSON.stringify({ level, key, title, lines }));
}

export function calculateDarknetWorkerThreads(freeRam, scriptRam, maximum) {
  if (!Number.isFinite(scriptRam) || scriptRam <= 0) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(Math.max(0, freeRam) / scriptRam)));
}

async function readLogs(ns, host, details, count = 100) {
  if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) return [];
  try {
    const result = await ns.dnet.heartbleed(host, { peek: true, logsToCapture: count });
    return result.success ? result.logs : [];
  } catch {
    return [];
  }
}

function readLocalIntel(ns, current) {
  const intel = [];
  for (const file of ns.ls(current, ".data.txt")) {
    try {
      intel.push(ns.read(file));
    } catch {
      // A moving/restarting server can invalidate a clue file.
    }
  }
  return intel;
}

async function attempt(ns, host, password) {
  let result = await ns.dnet.authenticate(host, String(password));
  if (result.code === 408) result = await ns.dnet.authenticate(host, String(password));
  return result;
}

async function attemptWithFeedback(ns, host, details, password) {
  const result = await attempt(ns, host, password);
  if (result.success) return { success: true, result, feedback: null };
  const logs = await readLogs(ns, host, details, 8);
  return {
    success: false,
    result,
    feedback: findDarknetFeedback(logs, String(password)),
  };
}

function feedbackData(attemptResult) {
  return String(attemptResult.feedback?.data ?? "");
}

async function tryCandidates(ns, host, candidates) {
  for (const password of candidates) {
    if ((await attempt(ns, host, password)).success) return true;
  }
  return false;
}

async function solveRange(ns, host, details) {
  let [low, high] = details.modelId === "BellaCuore"
    ? parseRomanRange(details.data, details.passwordLength)
    : [0, 10 ** Math.max(1, Number(details.passwordLength)) - 1];
  while (low <= high) {
    const guess = Math.floor((low + high) / 2);
    const response = await attemptWithFeedback(ns, host, details, guess);
    if (response.success) return true;
    const data = feedbackData(response);
    if (data === "Lower" || data === "ALTUS NIMIS") high = guess - 1;
    else if (data === "Higher" || data === "PARUM BREVIS") low = guess + 1;
    else return false;
  }
  return false;
}

async function solveExactPositions(ns, host, details) {
  const length = Number(details.passwordLength);
  const answer = Array(length).fill("");
  for (const character of darknetCharacterSet(details.passwordFormat)) {
    const guess = character.repeat(length);
    const response = await attemptWithFeedback(ns, host, details, guess);
    if (response.success) return true;
    const positions = feedbackData(response).split(",");
    for (let index = 0; index < length; index += 1) {
      if (positions[index] === "yes") answer[index] = character;
    }
    if (answer.every(Boolean)) return (await attempt(ns, host, answer.join(""))).success;
  }
  return false;
}

function exactScore(model, data) {
  if (model === "DeepGreen") return Number(data.split(",")[0]);
  if (model === "RateMyPix.Auth") return (data.match(/🌶️/gu) ?? []).length;
  return NaN;
}

function totalScore(model, data) {
  if (model === "DeepGreen") {
    const [exact, misplaced] = data.split(",").map(Number);
    return exact + misplaced;
  }
  return exactScore(model, data);
}

async function solveScoredPositions(ns, host, details) {
  const length = Number(details.passwordLength);
  const characters = [...darknetCharacterSet(details.passwordFormat)];
  const counts = new Map();
  let filler = "";
  for (const character of characters) {
    const response = await attemptWithFeedback(ns, host, details, character.repeat(length));
    if (response.success) return true;
    const count = totalScore(details.modelId, feedbackData(response));
    if (count > 0) counts.set(character, count);
    else if (!filler) filler = character;
    const knownCharacters = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (filler && knownCharacters >= length) break;
  }
  if (!filler) return false;

  const answer = Array(length).fill(filler);
  for (let index = 0; index < length; index += 1) {
    let found = false;
    for (const [character, remaining] of counts) {
      if (remaining <= 0) continue;
      const guess = Array(length).fill(filler);
      guess[index] = character;
      const response = await attemptWithFeedback(ns, host, details, guess.join(""));
      if (response.success) return true;
      if (exactScore(details.modelId, feedbackData(response)) === 1) {
        answer[index] = character;
        counts.set(character, remaining - 1);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return (await attempt(ns, host, answer.join(""))).success;
}

async function solveTiming(ns, host, details) {
  const length = Number(details.passwordLength);
  const characters = [...darknetCharacterSet(details.passwordFormat)];
  const answer = Array(length).fill(characters[0]);
  for (let index = 0; index < length; index += 1) {
    let found = false;
    for (const character of characters) {
      answer[index] = character;
      const response = await attemptWithFeedback(ns, host, details, answer.join(""));
      if (response.success) return true;
      const mismatch = Number(String(response.feedback?.message ?? "").match(/\((-?\d+)\)/)?.[1]);
      if (mismatch > index || mismatch === -1) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return (await attempt(ns, host, answer.join(""))).success;
}

function rmsValue(data) {
  return Number(String(data).match(/RMS Deviation:([\d.]+)/)?.[1]);
}

async function solveSortedEcho(ns, host, details) {
  const length = Number(details.passwordLength);
  if (length < 5) return false;
  const baseline = await attemptWithFeedback(ns, host, details, "0".repeat(length));
  if (baseline.success) return true;
  const baselineRms = rmsValue(feedbackData(baseline));
  if (!Number.isFinite(baselineRms)) return false;
  const probes = [];
  for (let index = 0; index < length; index += 1) {
    const guess = Array(length).fill("0");
    guess[index] = "1";
    const response = await attemptWithFeedback(ns, host, details, guess.join(""));
    if (response.success) return true;
    probes.push(rmsValue(feedbackData(response)));
  }
  const password = passwordFromSortedRms(length, baselineRms, probes);
  return Boolean(password) && (await attempt(ns, host, password)).success;
}

async function solveDivisibility(ns, host, details) {
  let password = 1;
  for (const prime of [...SMALL_PRIMES, ...LARGE_PRIMES]) {
    let power = prime;
    while (power <= Number.MAX_SAFE_INTEGER) {
      const response = await attemptWithFeedback(ns, host, details, power);
      if (response.success) return true;
      if (feedbackData(response) !== "true") break;
      password *= prime;
      if (!Number.isSafeInteger(password)) return false;
      power *= prime;
    }
  }
  return (await attempt(ns, host, password)).success;
}

async function solveTripleModulo(ns, host, details) {
  const pairs = [];
  let product = 1;
  for (const prime of [31, 29, 23, 19, 17, 13, 11, 7, 5, 3, 2]) {
    const response = await attemptWithFeedback(ns, host, details, prime);
    if (response.success) return true;
    const remainder = Number(feedbackData(response));
    if (!Number.isInteger(remainder)) return false;
    pairs.push([prime, remainder]);
    product *= prime;
    if (product >= 10 ** Number(details.passwordLength)) break;
  }
  return (await attempt(ns, host, combinePrimeRemainders(pairs))).success;
}

async function solvePacketSniffer(ns, host, details) {
  const packets = [];
  for (let index = 0; index < 6; index += 1) {
    const response = await attemptWithFeedback(ns, host, details, "0");
    if (response.success) return true;
    packets.push(feedbackData(response));
    const candidates = getDarknetCandidates(details, [feedbackData(response)], host);
    if (await tryCandidates(ns, host, candidates)) return true;
  }
  const password = commonFixedLengthSubstring(packets, Number(details.passwordLength));
  return Boolean(password) && (await attempt(ns, host, password)).success;
}

async function altitude(ns, host, details, value) {
  const response = await attemptWithFeedback(ns, host, details, Math.round(value));
  if (response.success) return { success: true, value: 10_000 };
  return { success: false, value: Number(feedbackData(response)) };
}

async function solveKingOfTheHill(ns, host, details) {
  const length = Number(details.passwordLength);
  const low = length === 1 ? 0 : 10 ** (length - 1);
  const high = 10 ** length - 1;
  const samples = 100;
  const step = Math.max(1, Math.floor((high - low) / samples));
  let best = { x: low, altitude: -Infinity };
  for (let x = low; x <= high; x += step) {
    const result = await altitude(ns, host, details, x);
    if (result.success) return true;
    if (result.value > best.altitude) best = { x, altitude: result.value };
  }
  let left = Math.max(low, best.x - step);
  let right = Math.min(high, best.x + step);
  while (right - left > 3) {
    const first = Math.floor((left * 2 + right) / 3);
    const second = Math.floor((left + right * 2) / 3);
    const firstResult = await altitude(ns, host, details, first);
    if (firstResult.success) return true;
    const secondResult = await altitude(ns, host, details, second);
    if (secondResult.success) return true;
    if (firstResult.value < secondResult.value) left = first + 1;
    else right = second - 1;
  }
  for (let value = left; value <= right; value += 1) {
    if ((await attempt(ns, host, value)).success) return true;
  }
  return false;
}

async function solveInteractive(ns, host, details) {
  if (details.modelId === "AccountsManager_4.2" || details.modelId === "BellaCuore") {
    return solveRange(ns, host, details);
  }
  if (details.modelId === "NIL") return solveExactPositions(ns, host, details);
  if (details.modelId === "DeepGreen" || details.modelId === "RateMyPix.Auth") {
    return solveScoredPositions(ns, host, details);
  }
  if (details.modelId === "2G_cellular") return solveTiming(ns, host, details);
  if (details.modelId === "PHP 5.4") return solveSortedEcho(ns, host, details);
  if (details.modelId === "Factori-Os") return solveDivisibility(ns, host, details);
  if (details.modelId === "BigMo%od") return solveTripleModulo(ns, host, details);
  if (details.modelId === "OpenWebAccessPoint") return solvePacketSniffer(ns, host, details);
  if (details.modelId === "KingOfTheHill") return solveKingOfTheHill(ns, host, details);
  return false;
}

async function solveLabyrinth(ns, host, details) {
  if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) return false;
  const initial = await ns.dnet.labreport();
  if (!initial.success || !Array.isArray(initial.coords)) return false;

  const reports = new Map();
  const visited = new Set();
  const backtrack = [];
  let position = [...initial.coords];
  reports.set(position.join(","), initial);

  for (let steps = 0; steps < CONFIG.darknetLabyrinthMaximumSteps; steps += 1) {
    const key = position.join(",");
    visited.add(key);
    let report = reports.get(key);
    if (!report) {
      report = await ns.dnet.labreport();
      if (!report.success) return false;
      reports.set(key, report);
    }

    const direction = DIRECTIONS.find(([name, dx, dy]) =>
      report[name] && !visited.has(`${position[0] + dx},${position[1] + dy}`),
    );
    const move = direction ?? (backtrack.length ? backtrack.pop() : null);
    if (!move) return false;

    const [name, dx, dy, opposite] = move;
    const result = await attempt(ns, host, `go ${name}`);
    if (result.success) return true;
    if (result.code === 408) {
      if (!direction) backtrack.push(move);
      continue;
    }
    if (!direction && String(result.message).includes("cannot go")) return false;
    position = [position[0] + dx, position[1] + dy];
    if (direction) backtrack.push([opposite, -dx, -dy, name]);
  }
  return false;
}

async function freeRam(ns, host, requiredRam) {
  for (let attemptIndex = 0; attemptIndex < 64; attemptIndex += 1) {
    const free = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (free + 0.0001 >= requiredRam || ns.dnet.getBlockedRam(host) <= 0) return;
    const result = await ns.dnet.memoryReallocation(host);
    if (!result.success) return;
  }
}

async function openCaches(ns, current) {
  for (const file of ns.ls(current, ".cache")) {
    try {
      const reward = ns.dnet.openCache(file, true);
      send(ns, "success", `darknet-cache-${file}`, `Darknet-Cache geöffnet: ${file}`, [
        String(reward.message ?? "Belohnung eingesammelt."),
      ]);
    } catch {
      // A moving server can invalidate a cache between ls() and openCache().
    }
  }
}

function matchingWorker(ns, host, version) {
  try {
    return ns.ps(host).find(
      (process) => process.filename === WORKER_FILE && String(process.args[0] ?? "") === version,
    );
  } catch {
    return null;
  }
}

async function ensureWorker(ns, host, source, version) {
  if (matchingWorker(ns, host, version)) return true;
  try {
    for (const process of ns.ps(host)) {
      if (process.filename === WORKER_FILE) ns.kill(process.pid);
    }
  } catch {
    // The server may move between authentication and process inspection.
  }

  await ns.scp(SUPPORT_FILES, host, source);
  const scriptRam = ns.getScriptRam(WORKER_FILE, host);
  const maximumThreads = calculateDarknetWorkerThreads(
    ns.getServerMaxRam(host),
    scriptRam,
    CONFIG.darknetWorkerMaxThreads,
  );
  if (maximumThreads < 1) return false;
  await freeRam(ns, host, maximumThreads * scriptRam);
  const threads = calculateDarknetWorkerThreads(
    ns.getServerMaxRam(host) - ns.getServerUsedRam(host),
    scriptRam,
    CONFIG.darknetWorkerMaxThreads,
  );
  return threads > 0 && ns.exec(WORKER_FILE, host, threads, version) > 0;
}

async function authenticateNeighbor(ns, host, details, localIntel) {
  if (details.hasSession) return true;
  if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) return false;
  if (details.modelId === LABYRINTH_MODEL) return solveLabyrinth(ns, host, details);

  const logs = [...localIntel, ...await readLogs(ns, host, details)];
  const candidates = getDarknetCandidates(details, logs, host);
  if (await tryCandidates(ns, host, candidates)) return true;
  return solveInteractive(ns, host, details);
}

function startSupportWorker(ns, version, migrationTarget, trainCharisma, useStormSeed) {
  if (!ns.fileExists(SUPPORT_FILE, ns.getHostname())) return false;
  const supportRam = ns.getScriptRam(SUPPORT_FILE, ns.getHostname());
  const currentRam = ns.getScriptRam(WORKER_FILE, ns.getHostname());
  const currentThreads = Number(ns.getRunningScript()?.threads ?? 1);
  const usedAfterExit = Math.max(
    0,
    ns.getServerUsedRam(ns.getHostname()) - currentRam * currentThreads,
  );
  const freeAfterExit = ns.getServerMaxRam(ns.getHostname()) - usedAfterExit;
  const threads = calculateDarknetWorkerThreads(
    freeAfterExit,
    supportRam,
    CONFIG.darknetWorkerMaxThreads,
  );
  if (threads < 1) return false;
  ns.spawn(
    SUPPORT_FILE,
    threads,
    version,
    String(migrationTarget ?? ""),
    Boolean(trainCharisma),
    Boolean(useStormSeed),
  );
  return true;
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  const current = ns.getHostname();
  const version = String(ns.args[0] ?? "unknown");
  let stalledSince = Date.now();

  while (true) {
    try {
      await openCaches(ns, current);
      const currentDetails = ns.dnet.getServerDetails(current);
      const localIntel = readLocalIntel(ns, current);
      const neighbors = ns.dnet.probe();
      const migrationTargets = [];
      let progressed = false;
      let charismaBlocked = false;

      for (const host of neighbors) {
        const details = ns.dnet.getServerDetails(host);
        if (!details.isOnline || !details.isConnectedToCurrentServer) continue;
        if (ns.getPlayer().skills.charisma < Number(details.requiredCharismaSkill ?? 0)) {
          charismaBlocked = true;
          continue;
        }

        const authenticated = await authenticateNeighbor(ns, host, details, localIntel);
        if (!authenticated) {
          send(ns, "warning", `darknet-unsolved-${host}`, `Darknet löst ${details.modelId} erneut`, [
            `Server: ${host}, Tiefe ${details.depth}`,
            "Passworthinweise, Daten und aktive Rückmeldungen werden weiter ausgewertet.",
          ]);
          continue;
        }

        const workerAlreadyRunning = Boolean(matchingWorker(ns, host, version));
        const workerStarted = await ensureWorker(ns, host, current, version);
        const newlyStarted = workerStarted && !workerAlreadyRunning;
        progressed ||= newlyStarted;
        if (!details.isStationary && workerStarted && Number(details.depth) >= Number(currentDetails.depth)) {
          migrationTargets.push(host);
        }
        if (!details.hasSession || newlyStarted) {
          send(ns, "success", `darknet-auth-${host}`, `Darknet-Server geöffnet: ${host}`, [
            `Tiefe ${details.depth}, Modell ${details.modelId}`,
          ]);
        }
      }

      if (progressed) stalledSince = Date.now();
      const depth = Number(currentDetails.depth);
      const migrationTarget = depth >= 6 && depth % 8 >= 6
        ? migrationTargets[0]
        : "";
      const canStorm =
        CONFIG.darknetAutoStormSeed &&
        Date.now() - stalledSince >= CONFIG.darknetStormStuckMs &&
        depth >= CONFIG.darknetStormMinimumDepth &&
        ns.fileExists("STORM_SEED.exe", current);
      if (
        (charismaBlocked || migrationTarget || canStorm) &&
        startSupportWorker(ns, version, migrationTarget, charismaBlocked, canStorm)
      ) {
        return;
      }
    } catch (error) {
      send(ns, "warning", `darknet-worker-${current}`, `Darknet-Arbeiter auf ${current} wartet`, [
        String(error),
      ]);
    }
    await ns.sleep(CONFIG.darknetWorkerScanMs);
  }
}

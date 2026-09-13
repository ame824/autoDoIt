import { scanNetwork } from "../core/network.js";
import {
  reportBlocker,
  reportInfo,
  reportSuccess,
} from "../core/notifier.js";
import { solveContract } from "../lib/contract-solvers.js";

export const CONTRACT_FAILURE_FILE = "/data/autoDoIt-contract-failures.txt";
const CONTRACT_FAILURE_STATE_VERSION = 1;
const MAX_CONTRACT_FAILURES = 128;

function fingerprintValue(value) {
  if (typeof value === "bigint") return `bigint:${value}`;
  if (typeof value === "number") return `number:${Object.is(value, -0) ? "-0" : value}`;
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `array:[${value.map(fingerprintValue).join(",")}]`;
  if (typeof value === "object") {
    return `object:{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${fingerprintValue(value[key])}`
    ).join(",")}}`;
  }
  return `${typeof value}:${String(value)}`;
}

export function contractFailureKey(host, file, type, data) {
  return [host, file, type, fingerprintValue(data)].map(String).join("\u0000");
}

function readContractFailures(ns) {
  try {
    const state = JSON.parse(String(ns.read(CONTRACT_FAILURE_FILE) || "{}"));
    if (state?.version !== CONTRACT_FAILURE_STATE_VERSION || !Array.isArray(state.failures)) return [];
    return state.failures.filter((entry) =>
      entry && typeof entry.key === "string" && typeof entry.type === "string"
    ).slice(-MAX_CONTRACT_FAILURES);
  } catch {
    return [];
  }
}

function writeContractFailures(ns, failures) {
  ns.write(CONTRACT_FAILURE_FILE, JSON.stringify({
    version: CONTRACT_FAILURE_STATE_VERSION,
    failures: [...failures].slice(-MAX_CONTRACT_FAILURES),
  }), "w");
}

export function findCodingContracts(ns) {
  const { hosts } = scanNetwork(ns);
  return hosts.flatMap((host) =>
    ns.ls(host, ".cct").map((file) => ({ host, file }))
  );
}

/** @param {NS} ns */
export async function main(ns) {
  const entries = findCodingContracts(ns);
  if (entries.length === 0) {
    if (readContractFailures(ns).length > 0) writeContractFailures(ns, []);
    reportInfo(ns, "contracts-none", "Keine Coding Contracts gefunden");
    return;
  }

  const savedFailures = readContractFailures(ns);
  const prepared = [];
  for (const { host, file } of entries) {
    let contract;
    try {
      contract = ns.codingcontract.getContract(file, host);
    } catch (error) {
      reportBlocker(ns, "contract-read-failed", "Coding Contract konnte nicht gelesen werden", [
        `${host}: ${file}`,
        String(error),
      ]);
      return;
    }

    prepared.push({
      host,
      file,
      contract,
      failureKey: contractFailureKey(host, file, contract.type, contract.data),
    });
  }

  // Keep locks only while the exact contract still exists. A newly generated
  // contract may reuse a filename, so type and input data are part of the key.
  const activeKeys = new Set(prepared.map(({ failureKey }) => failureKey));
  const failureMap = new Map(savedFailures
    .filter(({ key }) => activeKeys.has(key))
    .map((entry) => [entry.key, entry]));
  if (failureMap.size !== savedFailures.length) writeContractFailures(ns, failureMap.values());

  const solved = [];
  const unsupported = [];
  for (const { host, file, contract, failureKey } of prepared) {
    const lockedFailure = failureMap.get(failureKey);
    if (lockedFailure) {
      reportBlocker(ns, `contract-locked-${host}-${file}`, "Coding Contract ist sicherheitsgesperrt", [
        `Typ: ${contract.type}`,
        `${host}: ${file}`,
        "Eine frühere Antwort auf genau diesen Contract wurde abgelehnt.",
      ], [
        "Contract manuell lösen oder auf einen korrigierten autoDoIt-Solver warten.",
      ]);
      continue;
    }

    let solution;
    try {
      solution = solveContract(contract.type, contract.data);
    } catch (error) {
      reportBlocker(ns, `contract-solver-${contract.type}`, "Contract-Solver benötigt eine Korrektur", [
        `Typ: ${contract.type}`,
        `${host}: ${file}`,
        String(error),
      ], [
        "Contract vorläufig manuell lösen oder auf ein autoDoIt-Update warten.",
      ]);
      return;
    }

    if (!solution.supported) {
      unsupported.push({ host, file, type: contract.type });
      continue;
    }

    const triesBefore = Number(contract.numTriesRemaining());
    if (triesBefore <= 0) continue;

    let reward = "";
    try {
      reward = contract.submit(solution.answer);
    } catch (error) {
      failureMap.set(failureKey, {
        key: failureKey,
        type: String(contract.type),
        failedAt: Date.now(),
        reason: "submit-error",
      });
      writeContractFailures(ns, failureMap.values());
      reportBlocker(ns, `contract-format-${contract.type}`, "Contract-Antwortformat wurde abgelehnt", [
        `Typ: ${contract.type}`,
        `${host}: ${file}`,
        String(error),
      ], [
        "Kein weiterer automatischer Versuch wird in diesem Durchlauf ausgeführt.",
      ]);
      return;
    }

    if (!reward) {
      failureMap.set(failureKey, {
        key: failureKey,
        type: String(contract.type),
        failedAt: Date.now(),
        reason: "rejected",
      });
      writeContractFailures(ns, failureMap.values());
      reportBlocker(ns, `contract-wrong-${contract.type}`, "Coding-Contract-Lösung wurde abgelehnt", [
        `Typ: ${contract.type}`,
        `${host}: ${file}`,
        `Vorherige Versuche verfügbar: ${triesBefore}.`,
      ], [
        "Kein weiterer automatischer Versuch wird in diesem Durchlauf ausgeführt.",
        "Contract vorläufig manuell lösen oder auf ein korrigiertes autoDoIt-Update warten.",
      ]);
      return;
    }
    solved.push({ host, file, type: contract.type, reward });
  }

  if (solved.length > 0) {
    reportSuccess(ns, `contracts-${solved.length}-${entries.length}`, "Coding Contracts automatisch gelöst", [
      `${solved.length} von ${entries.length} gefundenen Contracts gelöst.`,
      ...solved.slice(0, 2).map(({ type, reward }) => `${type}: ${reward}`),
    ]);
  }

  if (unsupported.length > 0) {
    const types = [...new Set(unsupported.map(({ type }) => type))];
    reportBlocker(ns, `contracts-unsupported-${types.join("|")}`, "Unbekannter Coding-Contract-Typ gefunden", [
      `${unsupported.length} Contract(s) wurden sicher übersprungen.`,
      ...types.slice(0, 2).map((type) => `Typ: ${type}`),
    ], [
      "Den unbekannten Typ für das nächste autoDoIt-Update melden.",
      "Bis dahin keine Versuche für diesen Contract verbrauchen.",
    ]);
  }
}

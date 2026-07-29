import { scanNetwork } from "../core/network.js";
import {
  reportBlocker,
  reportInfo,
  reportSuccess,
} from "../core/notifier.js";
import { solveContract } from "../lib/contract-solvers.js";

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
    reportInfo(ns, "contracts-none", "Keine Coding Contracts gefunden");
    return;
  }

  const solved = [];
  const unsupported = [];
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

import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

export function chooseJobPlan(player) {
  const jobs = player?.jobs ?? {};
  const currentCompany =
    CONFIG.companyTargets.find((company) => Boolean(jobs[company])) ??
    Object.keys(jobs)[0] ??
    "";
  return {
    currentCompany,
    currentPosition: currentCompany ? String(jobs[currentCompany]) : "",
    preferredField: CONFIG.jobFields[0] ?? "Software",
    fallbackField: CONFIG.jobFields[1] ?? "IT",
  };
}

/** @param {NS} ns */
export async function main(ns) {
  const plan = chooseJobPlan(ns.getPlayer());
  const capabilities = getCapabilities(ns);

  if (capabilities.singularity) {
    reportInfo(ns, "job-control-ready", "Automatische Jobsteuerung verfügbar", [
      `Berufspriorität: ${plan.preferredField}, danach ${plan.fallbackField}.`,
      "Das Jobmodul übernimmt Bewerbungen, Beförderungen und Firmenarbeit, sobald es in den freien RAM passt.",
    ]);
    return;
  }

  if (plan.currentCompany) {
    reportInfo(ns, "job-current-manual", "Jobentscheidung erkannt", [
      `Aktuell: ${plan.currentCompany}: ${plan.currentPosition}.`,
      `autoDoIt bevorzugt ${plan.preferredField}, danach ${plan.fallbackField}.`,
    ]);
    return;
  }

  reportBlocker(ns, "singularity-jobs", "Jobs können noch nicht automatisiert werden", [
    "Bewerbungen und Firmenarbeit benötigen Source-File 4 oder BitNode 4.",
    `autoDoIt hat ${plan.preferredField} als bevorzugtes Berufsfeld festgelegt; ${plan.fallbackField} ist die Ausweichwahl.`,
  ], [
    `Vorläufig manuell den bestmöglichen ${plan.preferredField}-Job annehmen; falls nicht verfügbar, ${plan.fallbackField} wählen.`,
  ]);
}

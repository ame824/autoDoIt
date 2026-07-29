import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";
import { clearStatusEvent } from "../core/status.js";
import { chooseManualJobRecommendation } from "../lib/job-advisor.js";

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
  const player = ns.getPlayer();
  const plan = chooseJobPlan(player);
  const capabilities = getCapabilities(ns);

  if (capabilities.singularity) {
    clearStatusEvent(ns, "blocker:singularity-jobs");
    reportInfo(ns, "job-control-ready", "Automatische Jobsteuerung verfügbar", [
      `Berufspriorität: ${plan.preferredField}, danach ${plan.fallbackField}.`,
      "Das Jobmodul übernimmt Bewerbungen, Beförderungen und Firmenarbeit, sobald es in den freien RAM passt.",
    ]);
    return;
  }

  const recommendation = chooseManualJobRecommendation(player);
  if (!recommendation) {
    reportBlocker(ns, "singularity-jobs", "Jobs können noch nicht automatisiert werden", [
      "Bewerbungen und Firmenarbeit benötigen Source-File 4 oder BitNode 4.",
    ], [
      `Vorläufig manuell den bestmöglichen ${plan.preferredField}-Job annehmen; falls nicht verfügbar, ${plan.fallbackField} wählen.`,
    ]);
    return;
  }

  const steps = [];
  if (recommendation.city !== player.city) {
    steps.push(`Nach ${recommendation.city} reisen.`);
  }
  if (recommendation.kind === "application") {
    steps.push(`Bei ${recommendation.company} als ${recommendation.position} bewerben.`);
  }
  steps.push(
    `Bei ${recommendation.company} die Firmenarbeit als ${recommendation.position} starten.`,
  );

  reportBlocker(ns, "singularity-jobs", `Bester manueller Job: ${recommendation.company}`, [
    `Empfehlung: ${recommendation.position}.`,
    `Stadt: ${recommendation.city}.`,
    `Geschätzter Grundverdienst: ${ns.format.number(recommendation.estimatedSalaryPerSecond)} pro Sekunde.`,
    "Source-File 4 fehlt; autoDoIt kann Bewerbung und Firmenarbeit noch nicht selbst starten.",
  ], steps);
}

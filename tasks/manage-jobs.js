import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

/** @param {NS} ns */
export async function main(ns) {
  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "singularity-jobs", "Jobs können noch nicht automatisiert werden", [
      "Bewerbungen und Firmenarbeit benötigen Source-File 4 oder BitNode 4.",
    ], [
      "Vorläufig manuell einen Software- oder IT-Job annehmen.",
    ]);
    return;
  }

  let promotion = null;
  for (const company of CONFIG.companyTargets) {
    for (const field of CONFIG.jobFields) {
      try {
        const position = ns.singularity.applyToCompany(company, field);
        if (position) {
          promotion = { company, position };
          break;
        }
      } catch {
        // A company/field may not be available in the current BitNode.
      }
    }
    if (promotion) break;
  }

  if (promotion) {
    reportSuccess(ns, `job-${promotion.company}-${promotion.position}`, "Job oder Beförderung erhalten", [
      `${promotion.company}: ${promotion.position}`,
    ]);
  }

  const currentWork = ns.singularity.getCurrentWork();
  if (currentWork) return;

  const jobs = ns.getPlayer().jobs ?? {};
  const company = CONFIG.companyTargets.find((name) => Boolean(jobs[name])) ?? Object.keys(jobs)[0];
  if (!company) {
    reportInfo(ns, "job-no-offer", "Noch kein passender Firmenjob verfügbar", [
      "autoDoIt versucht es nach weiteren Skill-Steigerungen erneut.",
    ]);
    return;
  }

  if (ns.singularity.workForCompany(company, false)) {
    reportInfo(ns, `job-work-${company}`, `Firmenarbeit bei ${company} gestartet`);
  }
}


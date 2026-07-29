// Compact copies of the stable v3.0.1 job data needed before Singularity is available.
// Global BitNode, favor, and Source-File multipliers do not change the base ranking.
const BASE_SALARIES = Object.freeze({
  "Software Engineering Intern": 33,
  "Junior Software Engineer": 80,
  "Senior Software Engineer": 165,
  "Lead Software Developer": 500,
  "Head of Software": 800,
  "Head of Engineering": 1650,
  "Vice President of Technology": 2310,
  "Chief Technology Officer": 2640,
  "IT Intern": 26,
  "IT Analyst": 66,
  "IT Manager": 132,
  "Systems Administrator": 410,
  "Security Engineer": 121,
  "Network Engineer": 121,
  "Network Administrator": 410,
  "Business Intern": 46,
  "Business Analyst": 100,
  "Business Manager": 200,
  "Operations Manager": 660,
  "Chief Financial Officer": 1950,
  "Chief Executive Officer": 3900,
  "Security Guard": 50,
  "Security Officer": 195,
  "Security Supervisor": 660,
  "Head of Security": 1320,
  "Field Agent": 330,
  "Secret Agent": 990,
  "Special Operative": 2000,
  Employee: 22,
  "Part-time Employee": 20,
  Waiter: 22,
  "Part-time Waiter": 20,
  "Software Consultant": 66,
  "Senior Software Consultant": 132,
  "Business Consultant": 66,
  "Senior Business Consultant": 525,
});

const ENTRY_POSITIONS = Object.freeze({
  software: {
    title: "Software Engineering Intern",
    baseSalary: 33,
    requirements: { hacking: 1 },
  },
  it: {
    title: "IT Intern",
    baseSalary: 26,
    requirements: { hacking: 1 },
  },
  business: {
    title: "Business Intern",
    baseSalary: 46,
    requirements: { hacking: 1, charisma: 1 },
  },
  security: {
    title: "Security Guard",
    baseSalary: 50,
    requirements: {
      strength: 51,
      defense: 51,
      dexterity: 51,
      agility: 51,
      charisma: 1,
    },
  },
  softwareConsultant: {
    title: "Software Consultant",
    baseSalary: 66,
    requirements: { hacking: 51 },
  },
  businessConsultant: {
    title: "Business Consultant",
    baseSalary: 66,
    requirements: { hacking: 6, charisma: 51 },
  },
  employee: {
    title: "Employee",
    baseSalary: 22,
    requirements: {},
  },
  waiter: {
    title: "Waiter",
    baseSalary: 22,
    requirements: {},
  },
});

const COMPANIES = Object.freeze([
  ["ECorp", "Aevum", 3, 249, ["software", "it", "business", "security"]],
  ["MegaCorp", "Sector-12", 3, 249, ["software", "it", "business", "security"]],
  ["Bachman & Associates", "Aevum", 2.6, 224, ["software", "it", "business", "security"]],
  ["Blade Industries", "Sector-12", 2.75, 224, ["software", "it", "business", "security"]],
  ["NWO", "Volhaven", 2.75, 249, ["software", "it", "business", "security"]],
  ["Clarke Incorporated", "Aevum", 2.25, 224, ["software", "it", "business", "security"]],
  ["OmniTek Incorporated", "Volhaven", 2.25, 224, ["software", "it", "business", "security"]],
  ["Four Sigma", "Sector-12", 2.5, 224, ["software", "it", "business", "security"]],
  ["KuaiGong International", "Chongqing", 2.2, 224, ["software", "it", "business", "security"]],
  ["Fulcrum Technologies", "Aevum", 2, 224, ["software", "it", "business"]],
  ["Storm Technologies", "Ishima", 1.8, 199, ["software", "it", "business", "softwareConsultant"]],
  ["DefComm", "New Tokyo", 1.75, 199, ["software", "it", "softwareConsultant", "businessConsultant"]],
  ["Helios Labs", "Volhaven", 1.8, 199, ["software", "it", "softwareConsultant", "businessConsultant"]],
  ["VitaLife", "New Tokyo", 1.8, 199, ["software", "it", "business", "softwareConsultant"]],
  ["Icarus Microsystems", "Sector-12", 1.9, 199, ["software", "it", "business", "softwareConsultant"]],
  ["Universal Energy", "Sector-12", 2, 199, ["software", "it", "business", "softwareConsultant"]],
  ["Galactic Cybersystems", "Aevum", 1.9, 199, ["software", "it", "business", "softwareConsultant"]],
  ["AeroCorp", "Aevum", 1.7, 199, ["software", "it", "security", "businessConsultant"]],
  ["Omnia Cybersystems", "Volhaven", 1.7, 199, ["software", "it", "security", "businessConsultant"]],
  ["Solaris Space Systems", "Chongqing", 1.7, 199, ["software", "it", "security", "businessConsultant"]],
  ["DeltaOne", "Sector-12", 1.6, 199, ["software", "it", "security", "businessConsultant"]],
  ["Global Pharmaceuticals", "New Tokyo", 1.8, 224, ["software", "it", "business", "security", "softwareConsultant"]],
  ["Nova Medical", "Ishima", 1.75, 199, ["software", "it", "business", "security", "softwareConsultant"]],
  ["Central Intelligence Agency", "Sector-12", 2, 149, ["software", "it", "security"]],
  ["National Security Agency", "Sector-12", 2, 149, ["software", "it", "security"]],
  ["Watchdog Security", "Aevum", 1.5, 124, ["software", "it", "security", "softwareConsultant"]],
  ["LexoCorp", "Volhaven", 1.4, 99, ["software", "it", "business", "security", "softwareConsultant"]],
  ["Rho Construction", "Aevum", 1.3, 49, ["software", "business"]],
  ["Alpha Enterprises", "Sector-12", 1.5, 99, ["software", "business", "softwareConsultant"]],
  ["Aevum Police Headquarters", "Aevum", 1.3, 99, ["software", "security"]],
  ["SysCore Securities", "Volhaven", 1.3, 124, ["software", "it"]],
  ["CompuTek", "Volhaven", 1.2, 74, ["software", "it"]],
  ["NetLink Technologies", "Aevum", 1.2, 99, ["software", "it"]],
  ["Carmichael Security", "Sector-12", 1.2, 74, ["software", "it", "security", "softwareConsultant"]],
  ["FoodNStuff", "Sector-12", 1, 0, ["employee"]],
  ["Joe's Guns", "Sector-12", 1, 0, ["employee"]],
  ["Omega Software", "Ishima", 1.1, 49, ["software", "it", "softwareConsultant"]],
  ["Noodle Bar", "New Tokyo", 1, 0, ["waiter"]],
].map(([name, city, salaryMultiplier, statOffset, fields]) => Object.freeze({
  name,
  city,
  salaryMultiplier,
  statOffset,
  fields,
})));

function qualifies(skills, position, offset) {
  return Object.entries(position.requirements).every(([skill, base]) => {
    const requirement = base > 0 ? base + offset : 0;
    return Number(skills?.[skill] ?? 0) >= requirement;
  });
}

function estimatedSalaryPerSecond(baseSalary, companyMultiplier, player) {
  const workMultiplier = Number(player?.mults?.work_money ?? 1);
  return baseSalary * companyMultiplier * Math.max(0, workMultiplier) * 5;
}

function orderRecommendations(a, b, currentCity) {
  return b.baseScore - a.baseScore ||
    Number(b.city === currentCity) - Number(a.city === currentCity) ||
    Number(b.kind === "current") - Number(a.kind === "current") ||
    a.company.localeCompare(b.company) ||
    a.position.localeCompare(b.position);
}

export function chooseManualJobRecommendation(player) {
  const currentCity = String(player?.city ?? "");
  const companyByName = new Map(COMPANIES.map((company) => [company.name, company]));
  const recommendations = [];

  for (const [companyName, position] of Object.entries(player?.jobs ?? {})) {
    const company = companyByName.get(companyName);
    const baseSalary = BASE_SALARIES[String(position)];
    if (!company || !Number.isFinite(baseSalary)) continue;
    recommendations.push({
      kind: "current",
      company: company.name,
      city: company.city,
      position: String(position),
      baseScore: baseSalary * company.salaryMultiplier,
      estimatedSalaryPerSecond: estimatedSalaryPerSecond(
        baseSalary,
        company.salaryMultiplier,
        player,
      ),
    });
  }

  for (const company of COMPANIES) {
    for (const field of company.fields) {
      const position = ENTRY_POSITIONS[field];
      if (!position || !qualifies(player?.skills, position, company.statOffset)) continue;
      recommendations.push({
        kind: "application",
        company: company.name,
        city: company.city,
        position: position.title,
        baseScore: position.baseSalary * company.salaryMultiplier,
        estimatedSalaryPerSecond: estimatedSalaryPerSecond(
          position.baseSalary,
          company.salaryMultiplier,
          player,
        ),
      });
    }
  }

  return recommendations.sort((a, b) => orderRecommendations(a, b, currentCity))[0] ?? null;
}

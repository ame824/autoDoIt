export const CORPORATION_NAME = "autoDoIt Industries";
export const AGRICULTURE_DIVISION = "autoDoIt Agriculture";
export const PRODUCT_DIVISION = "autoDoIt Tobacco";
export const PRODUCT_INDUSTRY = "Tobacco";
export const CORPORATION_CITIES = Object.freeze([
  "Sector-12",
  "Aevum",
  "Chongqing",
  "New Tokyo",
  "Ishima",
  "Volhaven",
]);
export const BOOST_MATERIALS = Object.freeze([
  ["Hardware", "hardwareFactor"],
  ["Robots", "robotFactor"],
  ["AI Cores", "aiCoreFactor"],
  ["Real Estate", "realEstateFactor"],
]);
export const CORPORATION_UPGRADES = Object.freeze([
  "Smart Factories",
  "Smart Storage",
  "Wilson Analytics",
  "Nuoptimal Nootropic Injector Implants",
  "Speech Processor Implants",
  "Neural Accelerators",
  "FocusWires",
  "ABC SalesBots",
  "Project Insight",
]);
export const CORPORATION_RESEARCH = Object.freeze([
  "Hi-Tech R&D Laboratory",
  "Market-TA.I",
  "Market-TA.II",
  "uPgrade: Capacity.I",
  "uPgrade: Capacity.II",
  "AutoBrew",
  "AutoPartyManager",
  "Drones",
  "Drones - Assembly",
  "Drones - Transport",
  "Self-Correcting Assemblers",
  "Overclock",
  "Sti.mu",
]);

export function getIndustryStartingCost(industry) {
  const cost = Number(industry?.startingCost);
  return Number.isFinite(cost) ? cost : Infinity;
}

export function nextCorporationPhase(current, count) {
  const phases = Math.max(1, Math.floor(Number(count) || 1));
  const index = Math.max(0, Math.floor(Number(current) || 0));
  return (index + 1) % phases;
}

export function officeTargetSize(division, city, funds) {
  const productHeadquarters = Boolean(division?.makesProducts) && city === "Aevum";
  const base = productHeadquarters ? 30 : Boolean(division?.makesProducts) ? 9 : 6;
  const capital = Math.max(0, Number(funds) || 0);
  const growthSteps = Math.max(0, Math.min(10, Math.floor(Math.log10(Math.max(1, capital)) - 10)));
  return base + growthSteps * (productHeadquarters ? 15 : 3);
}

export function jobAllocation(size, makesProducts, headquarters = false) {
  const total = Math.max(0, Math.floor(Number(size) || 0));
  if (total === 0) return {};
  const ratios = makesProducts
    ? headquarters
      ? { Operations: 0.20, Engineer: 0.35, Business: 0.10, Management: 0.20, "Research & Development": 0.15 }
      : { Operations: 0.30, Engineer: 0.30, Business: 0.15, Management: 0.15, "Research & Development": 0.10 }
    : { Operations: 0.30, Engineer: 0.30, Business: 0.15, Management: 0.15, "Research & Development": 0.10 };
  const allocation = {};
  let assigned = 0;
  const entries = Object.entries(ratios);
  for (let index = 0; index < entries.length; index += 1) {
    const [job, ratio] = entries[index];
    const amount = index === entries.length - 1
      ? total - assigned
      : Math.floor(total * ratio);
    allocation[job] = amount;
    assigned += amount;
  }
  return allocation;
}

export function boostMaterialTargets(industry, warehouseSize, materialSizes, capacityFraction = 0.55) {
  const weighted = BOOST_MATERIALS
    .map(([material, factorKey]) => ({
      material,
      factor: Math.max(0, Number(industry?.[factorKey]) || 0),
      size: Math.max(0, Number(materialSizes?.[material]) || 0),
    }))
    .filter(({ factor, size }) => factor > 0 && size > 0);
  const totalFactor = weighted.reduce((sum, { factor }) => sum + factor, 0);
  const capacity = Math.max(0, Number(warehouseSize) || 0) * Math.max(0, Math.min(0.75, Number(capacityFraction) || 0));
  return Object.fromEntries(weighted.map(({ material, factor, size }) => [
    material,
    Math.floor(capacity * (factor / totalFactor) / size),
  ]));
}

export function shouldAcceptInvestment(offer, corporation) {
  const round = Math.floor(Number(offer?.round) || 0);
  const funds = Math.max(0, Number(offer?.funds) || 0);
  if (round < 1 || round > 4 || funds <= 0) return false;
  const thresholds = [30e9, 1e12, 100e12, 1e15];
  const currentFunds = Math.max(1, Number(corporation?.funds) || 0);
  const profit = Math.max(0, Number(corporation?.revenue) - Number(corporation?.expenses));
  return funds >= thresholds[round - 1] || funds >= currentFunds * 20 || (profit > 0 && funds >= profit * 600);
}

export function productInvestment(funds, profit) {
  const available = Math.max(0, Number(funds) || 0);
  const income = Math.max(0, Number(profit) || 0);
  return Math.max(0, Math.min(available * 0.02, Math.max(1e9, income * 60)));
}

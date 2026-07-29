export function calculateAccruedBudget(
  savedBudget,
  currentMoney,
  allocationFraction,
  maximumFraction,
) {
  const money = Math.max(0, Number(currentMoney) || 0);
  const saved = Math.max(0, Number(savedBudget) || 0);
  const allocation = money * Math.max(0, Number(allocationFraction) || 0);
  const maximum = money * Math.max(0, Number(maximumFraction) || 0);
  return Math.min(maximum, saved + allocation);
}

export function readAccruedBudget(ns, file) {
  const value = Number(ns.read(file));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function accrueBudget(ns, file, money, allocationFraction, maximumFraction) {
  const budget = calculateAccruedBudget(
    readAccruedBudget(ns, file),
    money,
    allocationFraction,
    maximumFraction,
  );
  ns.write(file, String(budget), "w");
  return budget;
}

export function storeRemainingBudget(ns, file, budget, money, maximumFraction) {
  const maximum = Math.max(0, Number(money) || 0) *
    Math.max(0, Number(maximumFraction) || 0);
  const remaining = Math.min(maximum, Math.max(0, Number(budget) || 0));
  ns.write(file, String(remaining), "w");
  return remaining;
}

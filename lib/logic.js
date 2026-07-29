export function sourceFileLevel(resetInfo, sourceFile) {
  const owned = resetInfo?.ownedSF;
  if (owned instanceof Map) return Number(owned.get(sourceFile) ?? 0);
  if (Array.isArray(owned)) {
    const entry = owned.find((item) =>
      Array.isArray(item) ? Number(item[0]) === sourceFile : Number(item?.n) === sourceFile,
    );
    return Number(Array.isArray(entry) ? entry[1] : entry?.lvl ?? 0);
  }
  if (owned && typeof owned === "object") return Number(owned[sourceFile] ?? 0);
  return 0;
}

export function hasApiAccess(resetInfo, bitNodes, sourceFiles = bitNodes) {
  const current = Number(resetInfo?.currentNode ?? 0);
  if (bitNodes.includes(current)) return true;
  return sourceFiles.some((number) => sourceFileLevel(resetInfo, number) > 0);
}

export function calculateHomeReserve(maxRam) {
  return Math.min(32, Math.max(2, Number(maxRam) * 0.10));
}

export function selectHackingAction(metrics, config) {
  if (metrics.security > metrics.minSecurity + config.securityTolerance) return "weaken";
  if (metrics.money < metrics.maxMoney * config.growMoneyThreshold) return "grow";
  return "hack";
}

export function scoreTarget(server, bitNodeRush = false) {
  if (!server.rooted || server.maxMoney <= 0 || server.requiredLevel > server.hackingLevel) {
    return -Infinity;
  }
  const time = Math.max(1, server.weakenTime);
  const incomeScore = (server.maxMoney * Math.max(0.01, server.hackChance)) / time;
  if (!bitNodeRush) return incomeScore;
  const levelRatio = Math.max(
    0,
    Math.min(1, server.requiredLevel / Math.max(1, server.hackingLevel)),
  );
  return incomeScore * (1 + 4 * Math.sqrt(levelRatio));
}

export function selectBestTarget(servers, bitNodeRush = false) {
  return [...servers]
    .sort((a, b) => scoreTarget(b, bitNodeRush) - scoreTarget(a, bitNodeRush))[0] ?? null;
}

export function chooseFactionWorkType(types) {
  const available = new Set(types ?? []);
  for (const preferred of ["hacking", "field", "security"]) {
    if (available.has(preferred)) return preferred;
  }
  return types?.[0] ?? null;
}

export function chooseNextBitNode(resetInfo, order) {
  const current = Number(resetInfo?.currentNode ?? 1);
  const candidates = order.filter((node) => node !== current);
  const missing = candidates.find((node) => sourceFileLevel(resetInfo, node) === 0);
  if (missing !== undefined) return missing;
  const incomplete = candidates.find((node) => sourceFileLevel(resetInfo, node) < 3);
  if (incomplete !== undefined) return incomplete;
  return current === 1 ? 12 : 1;
}

export function affordable(cost, money, fraction, reserve = 0) {
  return Number.isFinite(cost) && cost >= 0 && cost <= Math.max(0, money * fraction - reserve);
}

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

export function scoreTarget(server) {
  if (!server.rooted || server.maxMoney <= 0 || server.requiredLevel > server.hackingLevel) {
    return -Infinity;
  }
  const time = Math.max(1, server.weakenTime);
  return (server.maxMoney * Math.max(0.01, server.hackChance)) / time;
}

export function selectBestTarget(servers) {
  return [...servers].sort((a, b) => scoreTarget(b) - scoreTarget(a))[0] ?? null;
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
  for (const node of order) {
    if (node !== current && sourceFileLevel(resetInfo, node) < 3) return node;
  }
  return current === 1 ? 12 : 1;
}

export function affordable(cost, money, fraction, reserve = 0) {
  return Number.isFinite(cost) && cost >= 0 && cost <= Math.max(0, money * fraction - reserve);
}


import { CONFIG } from "../core/config.js";

export function orderFactionInvitations(invitations) {
  const preferred = new Map(CONFIG.preferredCityFactions.map((name, index) => [name, index]));
  return [...invitations].sort((left, right) => {
    const leftRank = preferred.has(left) ? preferred.get(left) : Number.MAX_SAFE_INTEGER;
    const rightRank = preferred.has(right) ? preferred.get(right) : Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

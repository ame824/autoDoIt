export const NEUROFLUX_GOVERNOR = "NeuroFlux Governor";

export function collectFactionAugmentationOptions(ns, factions, owned, includeNeuroFlux = false) {
  const options = new Map();
  for (const faction of factions) {
    let factionRep;
    let names;
    try {
      factionRep = ns.singularity.getFactionRep(faction);
      names = ns.singularity.getAugmentationsFromFaction(faction);
    } catch {
      continue;
    }

    for (const name of names) {
      const isNeuroFlux = name === NEUROFLUX_GOVERNOR;
      if (isNeuroFlux !== includeNeuroFlux) continue;
      if (!isNeuroFlux && owned.has(name)) continue;

      try {
        const requirement = ns.singularity.getAugmentationRepReq(name);
        const prerequisites = isNeuroFlux
          ? []
          : ns.singularity.getAugmentationPrereq(name);
        const option = {
          name,
          faction,
          price: ns.singularity.getAugmentationPrice(name),
          requirement,
          factionRep,
          gap: Math.max(0, requirement - factionRep),
          prerequisitesMet: prerequisites.every((prerequisite) => owned.has(prerequisite)),
        };
        const key = isNeuroFlux ? `${name}\u0000${faction}` : name;
        const previous = options.get(key);
        if (
          !previous ||
          option.gap < previous.gap ||
          (option.gap === previous.gap && option.faction < previous.faction)
        ) {
          options.set(key, option);
        }
      } catch {
        // An augmentation may be unavailable in the current BitNode.
      }
    }
  }
  return [...options.values()];
}

export function chooseCheapestFactionAugmentation(options) {
  return [...options]
    .filter(({ prerequisitesMet }) => prerequisitesMet)
    .sort((a, b) =>
      a.price - b.price ||
      a.gap - b.gap ||
      a.requirement - b.requirement ||
      a.name.localeCompare(b.name)
    )[0] ?? null;
}

export function chooseNeuroFluxFaction(options) {
  return [...options].sort((a, b) =>
    a.gap - b.gap ||
    b.factionRep - a.factionRep ||
    a.faction.localeCompare(b.faction)
  )[0] ?? null;
}

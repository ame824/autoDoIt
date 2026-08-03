export const DARKNET_LABYRINTH_AUGMENTATIONS = Object.freeze([
  "The Broken Wings", "The Boots", "The Hammer", "The Staff",
  "The Law", "The Sword", "The Red Pill",
]);
const DARKNET_LABYRINTH_AUGMENTATION_SET = new Set(DARKNET_LABYRINTH_AUGMENTATIONS);

export function queuedAugmentations(installed, installedAndQueued) {
  const installedCounts = new Map();
  for (const name of installed ?? []) {
    installedCounts.set(name, Number(installedCounts.get(name) ?? 0) + 1);
  }
  return [...(installedAndQueued ?? [])].filter((name) => {
    const remaining = Number(installedCounts.get(name) ?? 0);
    if (remaining <= 0) return true;
    installedCounts.set(name, remaining - 1);
    return false;
  });
}

export function requiresImmediateAugmentationInstall(_currentNode, purchased) {
  return (purchased ?? []).some((name) => DARKNET_LABYRINTH_AUGMENTATION_SET.has(name));
}

export const PORT_PROGRAMS = Object.freeze([
  Object.freeze({ file: "BruteSSH.exe", hackingLevel: 50 }),
  Object.freeze({ file: "FTPCrack.exe", hackingLevel: 100 }),
  Object.freeze({ file: "relaySMTP.exe", hackingLevel: 250 }),
  Object.freeze({ file: "HTTPWorm.exe", hackingLevel: 500 }),
  Object.freeze({ file: "SQLInject.exe", hackingLevel: 750 }),
]);

export function analyzePortAccess(blockedRequirements, availableFiles) {
  const files = availableFiles instanceof Set
    ? availableFiles
    : new Set(availableFiles ?? []);
  const availableCount = PORT_PROGRAMS.filter(({ file }) => files.has(file)).length;
  const requirements = [...(blockedRequirements ?? [])].map(Number)
    .filter(Number.isFinite);
  const nextProgram = PORT_PROGRAMS.find(({ file }) => !files.has(file)) ?? null;

  return {
    availableCount,
    blockedCount: requirements.length,
    minimumRequiredPorts: requirements.length > 0
      ? Math.min(...requirements)
      : 0,
    nextProgram,
    unlockedByNext: nextProgram
      ? requirements.filter((required) => required <= availableCount + 1).length
      : 0,
  };
}

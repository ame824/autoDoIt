export const CONFIG = Object.freeze({
  schedulerTickMs: 1_000,
  failedTaskRetryMs: 15_000,
  maxTasksPerTick: 3,
  noticeCooldownMs: 5 * 60_000,

  hackMoneyFraction: 0.10,
  growMoneyThreshold: 0.75,
  securityTolerance: 5,

  purchasedServerPrefix: "autodoit",
  purchasedServerStartRam: 8,
  purchasedServerBudgetFraction: 0.15,
  homeUpgradeBudgetFraction: 0.25,

  hacknetBudgetFraction: 0.05,
  stockBudgetFraction: 0.10,
  gangEquipmentBudgetFraction: 0.01,
  sleeveAugBudgetFraction: 0.01,

  minimumAugsBeforeInstall: 5,
  augmentationMoneyReserve: 1_000_000,

  casinoEnabled: true,
  casinoMinimumMoney: 1_000_000,
  casinoMaximumBet: 100_000_000,
  casinoTargetEarnings: 10_000_000_000,

  ipvGoEnabled: true,
  ipvGoBoardSize: 9,
  ipvGoOpponents: ["Netburners", "Slum Snakes", "The Black Hand", "Tetrads", "Daedalus", "Illuminati"],

  darknetEnabled: true,
  darknetPort: 19,
  darknetWorkerDepth: 40,
  darknetBootstrapMaxThreads: 512,
  darknetAutoStormSeed: true,
  darknetStormMinimumDepth: 15,
  darknetStormStuckMs: 10 * 60_000,

  preferredCityFactions: ["Sector-12", "Aevum"],
  companyTargets: [
    "ECorp",
    "MegaCorp",
    "KuaiGong International",
    "Four Sigma",
    "NWO",
    "Blade Industries",
    "OmniTek Incorporated",
    "Bachman & Associates",
    "Clarke Incorporated",
    "Fulcrum Technologies",
  ],
  jobFields: ["Software", "IT", "Security", "Business"],

  bitNodeOrder: [4, 5, 10, 2, 3, 7, 9, 8, 6, 11, 12, 13, 14, 1],
});

export const WORKER_FILES = Object.freeze([
  "/workers/hack.js",
  "/workers/grow.js",
  "/workers/weaken.js",
  "/workers/share.js",
]);

export const TASKS = Object.freeze([
  { file: "/special/manage-casino.js", intervalMs: 45_000, priority: 110, exclusive: true },
  { file: "/tasks/root-network.js", intervalMs: 15_000, priority: 100 },
  { file: "/tasks/deploy-workers.js", intervalMs: 30_000, priority: 95 },
  { file: "/tasks/manage-hacking.js", intervalMs: 5_000, priority: 90 },
  { file: "/tasks/manage-programs.js", intervalMs: 60_000, priority: 75 },
  { file: "/tasks/manage-home.js", intervalMs: 15_000, priority: 74, preflightAfterExclusive: true },
  { file: "/tasks/manage-backdoors.js", intervalMs: 120_000, priority: 70 },
  { file: "/tasks/manage-factions.js", intervalMs: 30_000, priority: 65 },
  { file: "/tasks/manage-jobs.js", intervalMs: 120_000, priority: 60 },
  { file: "/tasks/manage-augmentations.js", intervalMs: 60_000, priority: 55 },
  { file: "/tasks/manage-progression.js", intervalMs: 60_000, priority: 54 },
  { file: "/tasks/manage-purchased-servers.js", intervalMs: 15_000, priority: 50, preflightAfterExclusive: true },
  { file: "/tasks/manage-hacknet.js", intervalMs: 10_000, priority: 45 },
  { file: "/special/manage-gang.js", intervalMs: 10_000, priority: 40 },
  { file: "/special/manage-darknet.js", intervalMs: 30_000, priority: 38 },
  { file: "/special/manage-sleeves.js", intervalMs: 20_000, priority: 35 },
  { file: "/special/manage-bladeburner.js", intervalMs: 10_000, priority: 30 },
  { file: "/special/manage-corporation.js", intervalMs: 20_000, priority: 25 },
  { file: "/special/manage-stocks.js", intervalMs: 10_000, priority: 20 },
  { file: "/special/manage-ipvgo.js", intervalMs: 60_000, priority: 15 },
]);

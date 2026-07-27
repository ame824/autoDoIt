# autoDoIt

`autoDoIt` is a modular Bitburner v3 automation system. It detects the current
progress, uses every API that is already available, and prints an actionable
instruction when the game still requires a manual step.

The project targets the current stable
[`NS` interface](https://github.com/bitburner-official/bitburner-src/blob/stable/markdown/bitburner.ns.md).

## Start

Copy the repository files to `home` in Bitburner and run:

```text
run autoDoIt.js
```

Optional commands:

```text
run autoDoIt.js --once
run tools/self-test.js
```

`--once` starts every due task once and then exits. It is useful for diagnosing
low-RAM starts.

## Design

- `autoDoIt.js` is a small scheduler. Expensive APIs are not imported into it.
- `workers/` contains minimal hack, grow, weaken, and share scripts that can be
  copied to rooted servers.
- `tasks/` contains one-shot jobs for normal game systems.
- `special/` contains one-shot jobs for Source-File/BitNode gated systems.
- Every task checks its own prerequisites and exits after one pass.
- Missing capabilities are reported with a concrete player action and are
  checked again automatically later.

The scheduler never keeps a Singularity, Gang, Corporation, Sleeve, Bladeburner,
or Stock module in RAM when it is not doing work.

## Current modules

| Area | File | Behaviour |
| --- | --- | --- |
| Network/root | `tasks/root-network.js` | Scans, opens available ports, nukes servers |
| Deployment | `tasks/deploy-workers.js` | Copies minimal workers to rooted RAM hosts |
| Hacking | `tasks/manage-hacking.js` | Selects a target and distributes HGW work |
| Cloud servers | `tasks/manage-purchased-servers.js` | Purchases and upgrades v3 cloud servers |
| Hacknet | `tasks/manage-hacknet.js` | Buys the cheapest useful node upgrade |
| Programs | `tasks/manage-programs.js` | Buys TOR and dark-web programs with Singularity |
| Home | `tasks/manage-home.js` | Purchases RAM and core upgrades with a safe budget |
| Jobs | `tasks/manage-jobs.js` | Applies for promotions and starts company work |
| Factions | `tasks/manage-factions.js` | Joins safe invitations and works for augmentation rep |
| Augmentations | `tasks/manage-augmentations.js` | Purchases affordable augs and installs in batches |
| Backdoors | `tasks/manage-backdoors.js` | Connects through discovered paths and installs backdoors |
| BitNode progress | `tasks/manage-progression.js` | Chooses the configured next BitNode when possible |
| Gang | `special/manage-gang.js` | Creates and manages members, tasks, ascension, gear |
| Sleeves | `special/manage-sleeves.js` | Handles shock, synchronization, crime, and augs |
| Bladeburner | `special/manage-bladeburner.js` | Joins, upgrades skills, and chooses safe actions |
| Corporation | `special/manage-corporation.js` | Creates and bootstraps an Agriculture corporation |
| Stocks | `special/manage-stocks.js` | Buys API access and trades when 4S data is available |

Bitburner does not expose a separate "faction quest" API. Faction invitations,
requirements, work, reputation, augmentations, and faction-related backdoors are
covered by the faction, augmentation, and backdoor modules.

## Testing

The repository contains two test layers:

1. `tests/logic.test.mjs` tests pure scheduling and selection logic with Node.
2. `tools/self-test.js` runs inside Bitburner and verifies that all required
   files exist, reports their RAM costs, checks API gates, and validates network
   discovery without making purchases or resetting the game.

External tests cannot reproduce Bitburner's RAM analyser or a live save. Run the
in-game self-test after importing the files.

## Configuration

Safe defaults live in `core/config.js`. Important settings include the hack
fraction, augmentation-install threshold, budget fractions, preferred city
factions, and BitNode order.

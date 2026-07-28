# autoDoIt

`autoDoIt` is a modular Bitburner v3 automation system. It detects the current
progress, uses every API that is already available, and prints an actionable
instruction when the game still requires a manual step.

The project targets the current stable
[`NS` interface](https://github.com/bitburner-official/bitburner-src/blob/stable/markdown/bitburner.ns.md).

## Install directly inside Bitburner

Only the updater has to be downloaded manually. Run these commands in the
Bitburner terminal:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull.js git-pull.js
run git-pull.js --start
```

`git-pull.js` downloads the runtime manifest and all required files. If
`autoDoIt.js` is already running, an ordinary update automatically stops and
restarts it:

```text
run git-pull.js
```

Useful options:

```text
run git-pull.js --branch main
run git-pull.js --repo ame824/autoDoIt --start
run git-pull.js --skip-test
```

## Start manually

Copy the repository files to `home` in Bitburner and run:

```text
run autoDoIt.js
```

Optional commands:

```text
run autoDoIt.js --once
run autoDoIt.js --no-ui
run autoDoIt.js --agree-exploit-risk
run ui/dashboard.js
run tools/self-test.js
```

`--once` starts every due task once and then exits. It is useful for diagnosing
low-RAM starts.

## Control Center

`autoDoIt` starts a separate, colored dashboard window automatically when
enough home RAM is available. It shows player progress, home RAM, rooted
servers, active modules, hacking workers, manual actions, and recent activity.
The window refreshes every two seconds.

Routine information and success messages are written to the dashboard instead
of the Terminal. Only errors, blockers that require a manual action, updater
output, and explicitly requested self-test output remain in the Terminal.

Use `--no-ui` to disable the automatic dashboard, or start it separately with:

```text
run ui/dashboard.js
run ui/dashboard.js --refresh 5000
```

The v3 tail-window functions themselves cost 0 GB. The dashboard is still a
normal script and therefore uses its base RAM plus its lightweight status
queries; its exact live cost is displayed inside the window.

## Design

- `autoDoIt.js` is a small scheduler. Expensive APIs are not imported into it.
- `workers/` contains minimal hack, grow, weaken, and share scripts that can be
  copied to rooted servers.
- `tasks/` contains one-shot jobs for normal game systems.
- `special/` contains one-shot jobs for Source-File/BitNode gated systems.
- Long-running special modules (IPvGO and Darknet) stay active only while their
  game system is being automated.
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
| Cloud servers | `tasks/manage-purchased-servers.js` | Batch-purchases and upgrades v3 cloud servers; hacking uses their RAM automatically |
| Hacknet | `tasks/manage-hacknet.js` | Repeatedly buys the cheapest node/server upgrades within its 5% budget |
| Programs | `tasks/manage-programs.js` | Buys TOR and dark-web programs with Singularity |
| Home | `tasks/manage-home.js` | Prioritizes and batch-purchases RAM, then core upgrades, with a fixed budget |
| Jobs | `tasks/manage-jobs.js` | Applies for promotions and starts company work |
| Factions | `tasks/manage-factions.js` | Accepts every compatible invitation automatically and works for augmentation rep |
| Augmentations | `tasks/manage-augmentations.js` | Purchases affordable augs and installs in batches |
| Backdoors | `tasks/manage-backdoors.js` | Connects through discovered paths and installs backdoors |
| BitNode progress | `tasks/manage-progression.js` | Chooses the configured next BitNode when possible |
| Gang | `special/manage-gang.js` | Creates and manages members, tasks, ascension, gear |
| Casino | `special/manage-casino.js` | Runs an exclusive blackjack start phase and reloads losses |
| Source-File -1 | `special/manage-exploits.js` | Attempts eight safe hidden exploits and guides the remaining three manual steps |
| Darknet | `special/manage-darknet.js` | Frees blocked Darknet RAM with a threaded bootstrap, explores servers, opens caches, and safely uses STORM_SEED when stuck |
| IPvGO | `special/manage-ipvgo.js` | Continuously plays legal games through the official v3 Go API |
| Sleeves | `special/manage-sleeves.js` | Handles shock, synchronization, crime, and augs |
| Bladeburner | `special/manage-bladeburner.js` | Joins, upgrades skills, and chooses safe actions |
| Corporation | `special/manage-corporation.js` | Creates and bootstraps an Agriculture corporation |
| Stocks | `special/manage-stocks.js` | Buys API access and trades when 4S data is available |
| Dashboard | `ui/dashboard.js` | Shows live status in a separate low-RAM tail window |
| Updater | `git-pull.js` | Downloads and updates every runtime file from GitHub |

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
factions, Casino/IPvGO/Darknet switches, STORM_SEED safety delay, and BitNode
order. Casino automation uses Bitburner's visible blackjack interface because
there is no official Netscript Casino API. Set `casinoEnabled` to `false` if
you do not want save/reload gambling at the start of an installation.

After Casino completion, autoDoIt closes obstructing Offline/Faction dialogs,
opens the Stats page, upgrades Home and cloud RAM first, and then starts one
immediate pass of every remaining module.

## Source-File -1

The optional exploit module targets the eleven easter eggs behind Source-File
`-1`. It automatically attempts Bypass, the undocumented Netscript call,
Rainbow, the development menu, Unclickable, N00dles, Prototype Tampering, and
Time Compression. The prototype check can take up to 15 minutes and changes
only the formatting behaviour of the number `55` while it waits.

Three entries normally remain guided manual actions because the game requires a
debugger, a trusted cross-origin arcade event, or an externally edited save:

1. **Reality Alteration:** pause `ns.alterReality()` in the script debugger and
   set its local `x` variable to `true` before the final check.
2. **True Recursion:** travel to New Tokyo, enter the Arcade, and complete the
   embedded Bitburner Classic cabinet.
3. **Edit Save File:** export the save, keep an untouched backup, add the exact
   string `"EditSaveFile"` to the player's `exploits` array in the decoded save,
   and re-import it.

These reminders stay in the dashboard rather than filling the Terminal.
Set `exploitsEnabled` to `false` in `core/config.js` to disable the module.

### Explicit SF-1 risk mode

The Desktop version can automate those final three entries through a deliberately
opt-in save edit:

```text
run autoDoIt.js --agree-exploit-risk
```

Without an explicit risk option, autoDoIt never changes the save. For convenience,
the misspelled `--aggree-exploit-risk` is accepted as an alias. With approval,
the module saves the current game, downloads an untouched
timestamped backup, validates the v3 save structure, adds only
`RealityAlteration`, `TrueRecursion`, and `EditSaveFile` when missing, and uses
Bitburner's official two-stage import flow. The game reloads after the import.

Keep the downloaded backup until Stats shows `11 / 11`. If the save structure,
compression support, Desktop bridge, or import controls do not match the
expected v3 implementation, the operation stops instead of importing.

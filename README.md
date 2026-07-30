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

### Low-RAM updater

For Home servers below 16 GiB, use the standalone lite updater. It costs about
2.7 GiB, downloads the same complete runtime, and stops an old scheduler before
overwriting files:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull-lite.js git-pull-lite.js
run git-pull-lite.js
run autoDoIt.js
```

To stay below 4 GiB, `git-pull-lite.js` deliberately does not launch the
self-test or restart the scheduler automatically. The ordinary `git-pull.js`
remains the convenient updater once enough RAM is available.

### Automatic updates

From 32 GiB Home RAM onward, autoDoIt checks the configured GitHub branch every
15 minutes. The dashboard displays a live countdown to the next check. The check compares the repository's downloaded `version.txt` marker
with the installed marker and does not restart anything when both match. When a new version exists, the
existing full updater downloads and validates every runtime file, then restarts
the scheduler with its previous command-line options. Network or API failures
leave the current installation running. The Control Center shows whether the
check is current, running, failed, or has found an update.

Set `autoUpdateEnabled` to `false` in `core/config.js` to disable this behavior.
The repository, branch, and interval can be changed there as well.

## Start manually

Copy the repository files to `home` in Bitburner and run:

```text
run autoDoIt.js
```

Optional commands:

```text
run autoDoIt.js --once
run autoDoIt.js --no-ui
run autoDoIt.js --lang en
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
The lower-right corner carries the subtle project credit
`© ame824 · grz-gamerz.de`.

The upper-right `DE` / `EN` controls switch the complete Control Center,
including current activity titles, action hints, terminal blockers, and toast
notifications. The selection is stored across restarts. English can also be
selected before the dashboard has enough RAM:

```text
run autoDoIt.js --lang en
```

While the dashboard is running, Bitburner's right-side Overview also shows a
compact DE/EN efficiency block with average run money per second, time since
the last augmentation installation, installed augmentations, hacking-worker
load, and Home RAM utilization. Set `overviewStatsEnabled` to `false` in
`core/config.js` to disable it.

### Home RAM focus

The scheduler calculates a dynamic power-of-two RAM goal for one simultaneous
instance of every installed module plus a safety reserve. Below 50% of that
goal, Home RAM has primary spending priority while Hacknet and cloud servers
each retain a 1% growth budget per pass. Unused infrastructure allocations are
banked up to a safe 15% ceiling, so an upgrade costing more than a single 1%
allocation cannot remain blocked forever. Income generation, rooting, programs,
and Casino continue. At 50%, autoDoIt enters a middle stage:
Home RAM expansion and fast BitNode completion receive equal top priority.
Factions, backdoors, augmentations, and progression are released, along with
the system relevant to the current BitNode (Gang in BN2, Corporation in BN3,
Bladeburner in BN6/7, Stocks in BN8, Sleeves in BN10, IPvGO in BN14, and
Darknet in BN15). All remaining modules are released when the full RAM goal is
reached.

The BitNode route discovers every still-missing Source-File in the configured
priority order before repeating already-owned BitNodes to raise their levels.
This unlocks the broadest automation capabilities as early as possible.

The Control Center shows the calculated goal and whether Home RAM is automatic,
manual-only, waiting for money, or complete. The lightweight availability
check runs even during the 8 GiB bootstrap phase. Automatic Home upgrades
require BitNode 4 or Source-File 4. With Source-File 4 level 1, Bitburner's RAM
multiplier makes even the reduced purchasing module require roughly 50 GiB, so
Home may need to be raised manually to 64 GiB once before it can take over.

Routine information and success messages are written to the dashboard instead
of the Terminal. Only errors, blockers that require a manual action, updater
output, and explicitly requested self-test output remain in the Terminal.

Use `--no-ui` to disable the automatic dashboard, or start it separately with:

```text
run ui/dashboard.js
run ui/dashboard.js --refresh 5000
```

The dashboard tail automatically scales and repositions itself when the
Bitburner window size changes. Width, height, and font size are reduced on
smaller browser or game windows. Start it with `--no-auto-fit` to keep the
traditional fixed 760 × 650 pixel size and position the window manually.

The v3 tail-window functions themselves cost 0 GB. The dashboard is still a
normal script and therefore uses its base RAM plus its lightweight status
queries; its exact live cost is displayed inside the window.
The optional Overview efficiency block uses `getMoneySources()` and adds the
documented 1.0 GB cost of that query to the dashboard.

## Design

- `autoDoIt.js` is a small scheduler. Expensive APIs are not imported into it.
- Below 32 GiB Home RAM, the scheduler uses a minimal bootstrap phase containing
  only rooting, worker deployment, and a sub-4-GiB starter hacking manager.
- From 32 to 128 GiB it uses the lightweight start phase. It runs at most one
  management module at a time and prioritizes the normal hacking manager so RAM
  remains available for income-generating workers.
- At 128 GiB Home RAM the scheduler switches to full operation automatically;
  no restart or command-line option is required.
- In every phase, a module is started only when its current BitNode-adjusted RAM
  cost can actually fit beside the scheduler and dashboard.
- `workers/` contains minimal hack, grow, weaken, and share scripts that can be
  copied to rooted servers.
- `tasks/` contains one-shot jobs for normal game systems.
- `special/` contains one-shot jobs for Source-File/BitNode gated systems.
- Coding Contracts are discovered across the whole network. All 30 v3.0.1
  types are solved locally; unknown future types are skipped without consuming
  an attempt.
- Long-running special modules (IPvGO and Darknet) stay active only while their
  game system is being automated.
- Every task checks its own prerequisites and exits after one pass.
- Missing capabilities are reported with a concrete player action and are
  checked again automatically later.

The scheduler never keeps a Singularity, Gang, Corporation, Sleeve, Bladeburner,
or Stock module in RAM when it is not doing work.

### Lightweight start phase

Below 32 GiB, `tasks/manage-hacking-lite.js` targets early rooted servers using
only a small set of APIs. Alongside rooting and deployment, this can generate
starter income without loading the normal 10+ GiB manager. The dashboard stays
closed in this phase to preserve RAM.

From 32 GiB to the dynamic 50% threshold, Casino, rooting, worker deployment,
normal hacking, program purchases, Home upgrades, cloud servers, Hacknet, and
automatic job control become candidates. The job module runs as soon as both
Singularity and enough free RAM are available. On a fresh BN1 save without
Source-File 4, a tiny bootstrap check instead tells the player to prefer
Software and use IT as the fallback. Factions, augmentations, backdoors,
progression and the high-RAM special systems remain gated.

Only one of those management files runs at a time. Hacking workers already
running across rooted or purchased servers continue normally. The dashboard
starts automatically from 32 GiB onward. Its automation section distinguishes
`BOOTSTRAP (minimal)`, `STARTPHASE (leicht)`, and `VOLLBETRIEB`, and shows both
the phase candidates and how many currently fit into RAM. Once Home reaches
128 GiB the complete task list becomes eligible, while individually oversized
modules wait silently until a later RAM upgrade.

## Current modules

| Area | File | Behaviour |
| --- | --- | --- |
| Network/root | `tasks/root-network.js` | Prioritizes full network takeover, opens every available port, nukes servers, and names the exact missing port program and Hacking requirement when progress is blocked |
| Deployment | `tasks/deploy-workers.js` | Copies minimal workers to rooted RAM hosts |
| Hacking | `tasks/manage-hacking.js` | Selects an income target early; full operation favors useful high-level progression targets and distributes HGW work |
| Starter hacking | `tasks/manage-hacking-lite.js` | Sub-32-GiB bootstrap manager for early rooted servers |
| Cloud servers | `tasks/manage-purchased-servers.js` | Starts with affordable 2 GiB servers, banks its 1% RAM-focus allocation, then safely upgrades the weakest server in place when the limit is full |
| Hacknet | `tasks/manage-hacknet.js` | Repeatedly buys the cheapest node/server upgrades; banks its 1% RAM-focus allocation and uses 5% normally |
| Programs | `tasks/manage-programs.js` | Buys TOR and dark-web programs with Singularity |
| Home RAM | `tasks/manage-home-ram.js` | Saves for a dynamic all-modules RAM goal and batch-purchases RAM first |
| Home cores | `tasks/manage-home.js` | Purchases core upgrades only after the Home RAM goal is reached |
| Job check | `tasks/check-job.js` | Uses stable v3 salaries, company multipliers, cities, and current stats to recommend the best safely reachable manual job before Source-File 4 |
| Jobs | `tasks/manage-jobs.js` | Applies for promotions and starts company work as soon as Singularity and RAM permit |
| Factions | `tasks/manage-factions.js` | Accepts compatible invitations and works toward the cheapest actionable faction-specific augmentation |
| Augmentations | `tasks/manage-augmentations.js` | Purchases the cheapest actionable faction-specific aug, uses NeuroFlux only after those are complete, and installs in batches |
| Backdoors | `tasks/manage-backdoors.js` | Connects through discovered paths and installs backdoors |
| BitNode progress | `tasks/manage-progression.js` | Rushes missing Source-Files before repeat levels and destroys the current BitNode as soon as possible |
| Gang | `special/manage-gang.js` | Creates and manages members, tasks, ascension, gear |
| Casino | `special/manage-casino.js` | Runs an exclusive blackjack start phase and reloads losses |
| Coding Contracts | `special/manage-contracts.js` | Finds network-wide `.cct` files and safely solves all 30 current v3 contract types |
| Source-File -1 | `special/manage-exploits.js` | Attempts eight safe hidden exploits, guides the final three, and permanently retires itself after confirming 11/11 |
| Darknet | `special/manage-darknet.js` | Keeps a lightweight password seeder on the fixed 16 GiB entry server, launches full crawlers on opened neighbors, solves every v3 password family and labyrinth, and delegates expensive support actions |
| IPvGO | `special/manage-ipvgo.js` | Continuously plays legal games through the official v3 Go API |
| Sleeves | `special/manage-sleeves.js` | Handles shock, synchronization, crime, and augs |
| Bladeburner | `special/manage-bladeburner.js` | Joins, drains accumulated skill points with balanced batch upgrades, and chooses safe actions |
| Corporation | `special/manage-corporation.js` | Creates and bootstraps an Agriculture corporation |
| Stocks | `special/manage-stocks.js` | Buys API access and trades when 4S data is available |
| Dashboard | `ui/dashboard.js` | Shows live status in a separate low-RAM tail window |
| Auto-updater | `tools/auto-updater.js` | Checks the repository version every 15 minutes, displays its state, and installs new releases |
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
Once Stats confirms `11 / 11`, the module writes
`/data/autoDoIt-source-file--1-complete.txt`; the scheduler then removes the
finished exploit task permanently.
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

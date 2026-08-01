import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

const COMPLETION_FILE = "/data/autoDoIt-casino-complete.txt";
const POST_EXCLUSIVE_FILE = "/data/autoDoIt-post-exclusive.txt";
const UI_SETTLE_MS = 10;
const UI_POLL_MS = 10;
const MAINTENANCE_INTERVAL_MS = 2_000;
const MAINTENANCE_HAND_INTERVAL = 25;

export function shouldHitBlackjack(counts) {
  const values = [...counts].map(Number).filter(Number.isFinite);
  const playable = values.filter((value) => value <= 21);
  return playable.length > 0 && Math.max(...playable) < 17;
}

export function calculateCasinoBet(money, maximumBet) {
  const available = Math.max(0, Number(money) || 0);
  const limit = Math.max(0, Number(maximumBet) || 0);
  return Math.floor(Math.min(limit, available * 0.9));
}

export function casinoMaintenanceDue(
  now,
  lastMaintenance,
  handsSinceMaintenance,
  intervalMs = MAINTENANCE_INTERVAL_MS,
  handInterval = MAINTENANCE_HAND_INTERVAL,
) {
  return Number(handsSinceMaintenance) >= handInterval ||
    Number(now) - Number(lastMaintenance) >= intervalMs;
}

function textOf(element) {
  return String(element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function findButton(doc, wanted) {
  const normalized = wanted.toLowerCase();
  return [...doc.querySelectorAll("button")].find(
    (button) => textOf(button).toLowerCase() === normalized,
  ) ?? null;
}

function reactProps(element) {
  const key = Object.keys(element ?? {}).find((name) => name.startsWith("__reactProps$"));
  return key ? element[key] : null;
}

async function clickElement(ns, element) {
  if (!element) throw new Error("Benötigtes Bedienelement wurde nicht gefunden.");
  const handler = reactProps(element)?.onClick;
  if (typeof handler === "function") await handler({ isTrusted: true });
  else element.click();
  await ns.sleep(UI_SETTLE_MS);
}

async function setInput(ns, input, value) {
  if (!input) throw new Error("Das Einsatzfeld wurde nicht gefunden.");
  const handler = reactProps(input)?.onChange;
  if (typeof handler === "function") {
    await handler({ isTrusted: true, target: { value: String(value) } });
  } else {
    const win = input.ownerDocument.defaultView;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
  }
  await ns.sleep(UI_SETTLE_MS);
}

async function waitFor(ns, finder, attempts = 300, delay = UI_POLL_MS) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = finder();
    if (result) return result;
    await ns.sleep(delay);
  }
  return null;
}

function findSaveButton(doc) {
  return [...doc.querySelectorAll("button")].find((button) =>
    String(button.getAttribute("aria-label") ?? "").toLowerCase().includes("save game"),
  ) ?? null;
}

async function exposeSaveButton(ns, doc) {
  let save = findSaveButton(doc);
  if (save) return save;
  const overviewText = [...doc.querySelectorAll("button,[role='button'],div")]
    .find((element) => textOf(element) === "Overview");
  const overviewControl = overviewText?.closest("button,[role='button']") ?? overviewText?.parentElement;
  if (overviewControl) await clickElement(ns, overviewControl);
  save = await waitFor(ns, () => findSaveButton(doc), 100, UI_POLL_MS);
  return save;
}

function isCloseButton(button) {
  const aria = String(button?.getAttribute("aria-label") ?? "").toLowerCase();
  const className = String(button?.className ?? "").toLowerCase();
  return aria.includes("close") || className.includes("closebutton") || textOf(button) === "×";
}

function findNearbyButton(element, matcher) {
  let current = element;
  for (let level = 0; current && level < 10; level += 1) {
    const button = [...current.querySelectorAll("button")].find(matcher);
    if (button) return button;
    current = current.parentElement;
  }
  return null;
}

async function joinPendingFactions(ns) {
  try {
    const preferred = new Map(CONFIG.preferredCityFactions.map((name, index) => [name, index]));
    const invitations = [...ns.singularity.checkFactionInvitations()].sort((a, b) => {
      const aRank = preferred.has(a) ? preferred.get(a) : Number.MAX_SAFE_INTEGER;
      const bRank = preferred.has(b) ? preferred.get(b) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });
    for (const faction of invitations) {
      if (ns.singularity.joinFaction(faction)) {
        reportSuccess(ns, `faction-join-${faction}`, `Fraktion beigetreten: ${faction}`);
      }
    }
  } catch {
    // Casino navigation remains usable without Singularity faction access.
  }
}

async function dismissObstructingModals(ns, doc, waitForLateModal = false) {
  const maximumAttempts = waitForLateModal ? 20 : 2;
  const quietTarget = waitForLateModal ? 4 : 1;
  let quietChecks = 0;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    let dismissed = false;
    const elements = [...doc.querySelectorAll("p,span,h1,h2,h3,h4,div")];

    const offline = elements
      .filter((element) => /Offline for .+seconds/i.test(textOf(element)))
      .sort((a, b) => textOf(a).length - textOf(b).length)[0];
    if (offline) {
      const close = findNearbyButton(offline, isCloseButton);
      if (close) {
        await clickElement(ns, close);
        dismissed = true;
      }
    }

    if (/You received a faction invitation/i.test(textOf(doc.body))) {
      await joinPendingFactions(ns);
      const decideLater = [...doc.querySelectorAll("button")].find(
        (button) => /Decide later/i.test(textOf(button)),
      );
      if (decideLater) {
        await clickElement(ns, decideLater);
        dismissed = true;
      }
    }

    quietChecks = dismissed ? 0 : quietChecks + 1;
    if (quietChecks >= quietTarget) return;
    if (attempt + 1 < maximumAttempts) await ns.sleep(UI_POLL_MS);
  }
}

async function routeToStats(ns, doc) {
  await dismissObstructingModals(ns, doc);
  const label = await waitFor(
    ns,
    () => [...doc.querySelectorAll("p,span,div")].find((element) => textOf(element) === "Stats"),
    40,
    UI_POLL_MS,
  );
  if (!label) return false;
  const control = label.closest("[role='button'],button") ??
    label.parentElement?.closest("[role='button'],button") ??
    label.parentElement;
  if (!control) return false;
  await clickElement(ns, control);
  return true;
}

function resetKey(ns) {
  return String(ns.getResetInfo().lastAugReset ?? "");
}

async function finishCasino(ns, title, details = []) {
  const doc = eval("document");
  await joinPendingFactions(ns);
  await dismissObstructingModals(ns, doc, true);
  await routeToStats(ns, doc);
  ns.write(COMPLETION_FILE, resetKey(ns), "w");
  ns.write(POST_EXCLUSIVE_FILE, `${resetKey(ns)}:${Date.now()}`, "w");
  reportSuccess(ns, "casino-complete", title, details);
}

function readOutcome(doc) {
  const text = [...doc.querySelectorAll("p,span")].map(textOf).join("\n");
  if (/alright cheater get out of here/i.test(text)) return "complete";
  if (/\b(lost|lose)\b/i.test(text)) return "lose";
  if (/\b(won|win)\b/i.test(text)) return "win";
  if (/\btie\b/i.test(text)) return "tie";
  return null;
}

function readCounts(doc) {
  const element = [...doc.querySelectorAll("p")].find((node) => /Count:/i.test(textOf(node)));
  if (!element) return [];
  const spans = [...element.querySelectorAll("span")]
    .map((span) => Number(textOf(span)))
    .filter(Number.isFinite);
  if (spans.length > 0) return spans;
  return (textOf(element).match(/\d+/g) ?? []).map(Number);
}

async function reloadWithoutSaving(ns) {
  const win = eval("window");
  win.onbeforeunload = null;
  await ns.sleep(UI_SETTLE_MS);
  win.location.reload();
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.casinoEnabled) return;
  ns.disableLog("ALL");

  const casinoEarnings = Number(ns.getMoneySources()?.sinceInstall?.casino ?? 0);
  if (casinoEarnings >= CONFIG.casinoTargetEarnings) {
    if (ns.read(COMPLETION_FILE) !== resetKey(ns)) {
      await finishCasino(ns, "Casino-Ziel erreicht", [
        `${ns.format.number(casinoEarnings)} Gewinn seit der letzten Installation.`,
        "Weiterleitung zu Stats; alle übrigen Module werden jetzt gestartet.",
      ]);
    }
    return;
  }
  if (ns.getPlayer().money < CONFIG.casinoMinimumMoney) return;

  const capabilities = getCapabilities(ns);
  if (!capabilities.singularity) {
    reportBlocker(ns, "casino-singularity", "Casino wartet auf Source-File 4", [
      "Für automatisches Reisen und Öffnen des Casinos wird die Singularity-API benötigt.",
    ], [
      "Bis dahin kann Blackjack manuell gespielt werden.",
    ]);
    return;
  }

  try {
    const doc = eval("document");
    await joinPendingFactions(ns);
    await dismissObstructingModals(ns, doc, true);
    ns.singularity.stopAction();
    if (ns.getPlayer().city !== "Aevum" && !ns.singularity.travelToCity("Aevum")) return;
    if (!ns.singularity.goToLocation("Iker Molina Casino")) {
      throw new Error("Das Iker Molina Casino konnte nicht geöffnet werden.");
    }

    const casinoHeading = await waitFor(
      ns,
      () => [...doc.querySelectorAll("h1,h2,h3,h4")].find((element) => /Iker Molina Casino/i.test(textOf(element))),
    );
    if (!casinoHeading) throw new Error("Die Casino-Oberfläche wurde nicht gerendert.");

    const blackjack = await waitFor(
      ns,
      () => [...doc.querySelectorAll("button")].find((button) => /blackjack/i.test(textOf(button))),
    );
    await clickElement(ns, blackjack);

    const wager = await waitFor(ns, () => doc.querySelector("input[type='number']"));
    const saveButton = await exposeSaveButton(ns, doc);
    if (!saveButton) {
      throw new Error("Der Overview-Speicherknopf ist nicht sichtbar. Overview einmal aufklappen.");
    }
    await clickElement(ns, saveButton);
    reportInfo(ns, "casino-active", "Casino-Startphase aktiv", [
      "Blackjack läuft im Schnellmodus; Gewinne werden gesichert und Verluste zurückgesetzt.",
    ], 60_000);

    let handsSinceMaintenance = 0;
    let lastMaintenance = Date.now();
    let lastBet = null;
    while (true) {
      const now = Date.now();
      if (casinoMaintenanceDue(now, lastMaintenance, handsSinceMaintenance)) {
        await joinPendingFactions(ns);
        await dismissObstructingModals(ns, doc);
        handsSinceMaintenance = 0;
        lastMaintenance = now;
      }
      const currentEarnings = Number(ns.getMoneySources()?.sinceInstall?.casino ?? 0);
      if (currentEarnings >= CONFIG.casinoTargetEarnings) {
        await finishCasino(ns, "Casino-Ziel erreicht", [
          `${ns.format.number(currentEarnings)} Gewinn seit der letzten Installation.`,
          "Weiterleitung zu Stats; alle übrigen Module werden jetzt gestartet.",
        ]);
        return;
      }

      const bet = calculateCasinoBet(ns.getPlayer().money, CONFIG.casinoMaximumBet);
      if (bet < 1) return;
      if (bet !== lastBet) {
        await setInput(ns, wager, bet);
        lastBet = bet;
      }

      const start = await waitFor(ns, () => findButton(doc, "Start"), 100, UI_POLL_MS);
      await clickElement(ns, start);
      await waitFor(
        ns,
        () => readOutcome(doc) || (findButton(doc, "Hit") && findButton(doc, "Stay") ? "turn" : null),
        100,
        UI_POLL_MS,
      );

      let outcome = readOutcome(doc);
      while (!outcome) {
        const hit = findButton(doc, "Hit");
        const stay = findButton(doc, "Stay");
        if (!hit || !stay) {
          await ns.sleep(UI_POLL_MS);
          outcome = readOutcome(doc);
          continue;
        }
        await clickElement(ns, shouldHitBlackjack(readCounts(doc)) ? hit : stay);
        outcome = readOutcome(doc);
      }

      handsSinceMaintenance += 1;
      if (outcome === "lose") {
        reportInfo(ns, "casino-reload", "Casino-Verlust wird zurückgesetzt", [], 60_000);
        await reloadWithoutSaving(ns);
        return;
      }
      if (outcome === "win") await clickElement(ns, saveButton);
      if (outcome === "complete") {
        await finishCasino(ns, "Casino vollständig abgeschlossen", [
          "Weiterleitung zu Stats; alle übrigen Module werden jetzt gestartet.",
        ]);
        return;
      }
    }
  } catch (error) {
    reportBlocker(ns, "casino-ui", "Casino-Automatik braucht einmal Hilfe", [
      String(error),
    ], [
      "Overview aufklappen und das Spiel im Vordergrund lassen.",
      "autoDoIt versucht die Casino-Startphase danach erneut.",
    ]);
  }
}

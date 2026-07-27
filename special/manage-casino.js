import { CONFIG } from "../core/config.js";
import { getCapabilities } from "../core/capabilities.js";
import { reportBlocker, reportInfo, reportSuccess } from "../core/notifier.js";

export function shouldHitBlackjack(counts) {
  const values = [...counts].map(Number).filter(Number.isFinite);
  const playable = values.filter((value) => value <= 21);
  return playable.length > 0 && Math.max(...playable) < 17;
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
  await ns.sleep(20);
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
  await ns.sleep(20);
}

async function waitFor(ns, finder, attempts = 60, delay = 50) {
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
  save = await waitFor(ns, () => findSaveButton(doc), 20, 50);
  return save;
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
  await ns.sleep(50);
  win.location.reload();
  await ns.sleep(10_000);
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.casinoEnabled) return;
  ns.disableLog("ALL");

  const casinoEarnings = Number(ns.getMoneySources()?.sinceInstall?.casino ?? 0);
  if (casinoEarnings >= CONFIG.casinoTargetEarnings) return;
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
      "Blackjack wird exklusiv gespielt; bei einem Verlust wird der letzte Speicherstand geladen.",
    ], 60_000);

    while (true) {
      const currentEarnings = Number(ns.getMoneySources()?.sinceInstall?.casino ?? 0);
      if (currentEarnings >= CONFIG.casinoTargetEarnings) {
        reportSuccess(ns, "casino-complete", "Casino-Ziel erreicht", [
          `${ns.format.number(currentEarnings)} Gewinn seit der letzten Installation.`,
        ]);
        return;
      }

      const bet = Math.floor(Math.min(CONFIG.casinoMaximumBet, ns.getPlayer().money * 0.9));
      if (bet < 1) return;
      await setInput(ns, wager, bet);

      const start = await waitFor(ns, () => findButton(doc, "Start"), 20, 25);
      await clickElement(ns, start);
      await ns.sleep(30);

      let outcome = readOutcome(doc);
      while (!outcome) {
        const hit = findButton(doc, "Hit");
        const stay = findButton(doc, "Stay");
        if (!hit || !stay) {
          await ns.sleep(30);
          outcome = readOutcome(doc);
          continue;
        }
        await clickElement(ns, shouldHitBlackjack(readCounts(doc)) ? hit : stay);
        outcome = readOutcome(doc);
      }

      if (outcome === "lose") {
        reportInfo(ns, "casino-reload", "Casino-Verlust wird zurückgesetzt", [], 60_000);
        await reloadWithoutSaving(ns);
        return;
      }
      if (outcome === "win") await clickElement(ns, saveButton);
      if (outcome === "complete") {
        reportSuccess(ns, "casino-complete", "Casino vollständig abgeschlossen");
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

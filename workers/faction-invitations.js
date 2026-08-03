import { orderFactionInvitations } from "../lib/faction-invitations.js";
import { reportSuccess } from "../core/notifier.js";

const textOf = (element) => String(element?.textContent ?? "").replace(/\s+/g, " ").trim();

async function dismissFactionInvitation() {
  try {
    const doc = eval("document");
    if (!/You received a faction invitation/i.test(textOf(doc.body))) return;
    const button = [...doc.querySelectorAll("button")].find((item) => /Decide later/i.test(textOf(item)));
    if (!button) return;
    const key = Object.keys(button).find((name) => name.startsWith("__reactProps$"));
    const handler = key ? button[key]?.onClick : null;
    if (typeof handler === "function") await handler({ isTrusted: true });
    else button.click();
  } catch {
    // The invitation was already handled or no browser UI is available.
  }
}

/** @param {NS} ns */
export async function main(ns) {
  for (const faction of orderFactionInvitations(ns.singularity.checkFactionInvitations())) {
    if (ns.singularity.joinFaction(faction)) {
      reportSuccess(ns, `faction-join-${faction}`, `Fraktion beigetreten: ${faction}`);
    }
  }
  await dismissFactionInvitation();
}

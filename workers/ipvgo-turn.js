import { CONFIG } from "../core/config.js";
import { chooseGoMove } from "../lib/go-logic.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

const MOVE_FILE = "/data/autoDoIt-ipvgo-moves.txt";

function nextOpponent(current) {
  const opponents = CONFIG.ipvGoOpponents;
  const index = opponents.indexOf(current);
  return opponents[(index + 1 + opponents.length) % opponents.length];
}

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.go || typeof ns.go.getBoardState !== "function") {
    reportBlocker(ns, "ipvgo-api", "IPvGO ist in diesem Spielstand noch nicht verfügbar", [
      "autoDoIt startet das IPvGO-Modul automatisch, sobald die API freigeschaltet ist.",
    ]);
    await ns.sleep(5_000);
    return;
  }
  try {
    const currentPlayer = ns.go.getCurrentPlayer();
    if (currentPlayer === "None") {
      const opponent = nextOpponent(ns.go.getOpponent());
      ns.go.resetBoardState(opponent, CONFIG.ipvGoBoardSize);
      ns.write(MOVE_FILE, "0", "w");
      reportInfo(ns, "ipvgo-new-game", `IPvGO-Partie gegen ${opponent} gestartet`, [
        `Brettgröße: ${CONFIG.ipvGoBoardSize} × ${CONFIG.ipvGoBoardSize}`,
      ], 60_000);
      return;
    }
    if (currentPlayer !== "Black") {
      await ns.go.opponentNextTurn(false);
      return;
    }
    const move = chooseGoMove(ns.go.getBoardState(), ns.go.analysis.getValidMoves());
    if (move) await ns.go.makeMove(move.x, move.y);
    else await ns.go.passTurn();
    const moves = Math.max(0, Number(ns.read(MOVE_FILE)) || 0) + 1;
    ns.write(MOVE_FILE, String(moves), "w");
    if (moves % 25 === 0) reportInfo(ns, "ipvgo-active", "IPvGO spielt selbstständig", [
      `${moves} eigene Züge seit Modulstart.`,
      `Aktueller Gegner: ${ns.go.getOpponent()}`,
    ], 5 * 60_000);
  } catch (error) {
    reportBlocker(ns, "ipvgo-runtime", "IPvGO konnte nicht fortgesetzt werden", [String(error)], [
      "IPvGO einmal im linken Menü öffnen; autoDoIt versucht es danach erneut.",
    ]);
    await ns.sleep(5_000);
  }
}

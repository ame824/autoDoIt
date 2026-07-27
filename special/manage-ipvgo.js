import { CONFIG } from "../core/config.js";
import { chooseGoMove } from "../lib/go-logic.js";
import { reportBlocker, reportInfo } from "../core/notifier.js";

function nextOpponent(current) {
  const opponents = CONFIG.ipvGoOpponents;
  const index = opponents.indexOf(current);
  return opponents[(index + 1 + opponents.length) % opponents.length];
}

/** @param {NS} ns */
export async function main(ns) {
  if (!CONFIG.ipvGoEnabled) return;
  ns.disableLog("ALL");

  if (!ns.go || typeof ns.go.getBoardState !== "function") {
    reportBlocker(ns, "ipvgo-api", "IPvGO ist in diesem Spielstand noch nicht verfügbar", [
      "autoDoIt startet das IPvGO-Modul automatisch, sobald die API freigeschaltet ist.",
    ]);
    return;
  }

  let moves = 0;
  while (true) {
    try {
      const currentPlayer = ns.go.getCurrentPlayer();
      if (currentPlayer === "None") {
        const opponent = nextOpponent(ns.go.getOpponent());
        ns.go.resetBoardState(opponent, CONFIG.ipvGoBoardSize);
        reportInfo(ns, "ipvgo-new-game", `IPvGO-Partie gegen ${opponent} gestartet`, [
          `Brettgröße: ${CONFIG.ipvGoBoardSize} × ${CONFIG.ipvGoBoardSize}`,
        ], 60_000);
        await ns.sleep(50);
        continue;
      }

      if (currentPlayer !== "Black") {
        await ns.go.opponentNextTurn(false);
        continue;
      }

      const board = ns.go.getBoardState();
      const validMoves = ns.go.analysis.getValidMoves();
      const move = chooseGoMove(board, validMoves);
      if (move) await ns.go.makeMove(move.x, move.y);
      else await ns.go.passTurn();

      moves += 1;
      if (moves % 25 === 0) {
        reportInfo(ns, "ipvgo-active", "IPvGO spielt selbstständig", [
          `${moves} eigene Züge seit Modulstart.`,
          `Aktueller Gegner: ${ns.go.getOpponent()}`,
        ], 5 * 60_000);
      }
    } catch (error) {
      reportBlocker(ns, "ipvgo-runtime", "IPvGO konnte nicht fortgesetzt werden", [
        String(error),
      ], [
        "IPvGO einmal im linken Menü öffnen; autoDoIt versucht es danach erneut.",
      ]);
      return;
    }
  }
}

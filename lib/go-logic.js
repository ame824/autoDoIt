function neighbors(board, x, y) {
  const points = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  return points.filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < board.length && ny < board[nx].length);
}

function groupAt(board, startX, startY) {
  const color = board[startX]?.[startY];
  if (color !== "X" && color !== "O") return { stones: [], liberties: new Set() };

  const pending = [[startX, startY]];
  const visited = new Set();
  const liberties = new Set();
  const stones = [];

  while (pending.length > 0) {
    const [x, y] = pending.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    stones.push([x, y]);

    for (const [nx, ny] of neighbors(board, x, y)) {
      const value = board[nx][ny];
      if (value === ".") liberties.add(`${nx},${ny}`);
      else if (value === color && !visited.has(`${nx},${ny}`)) pending.push([nx, ny]);
    }
  }
  return { stones, liberties };
}

function scoreMove(board, x, y) {
  let score = 0;
  const size = board.length;
  const center = (size - 1) / 2;
  const adjacent = neighbors(board, x, y);

  for (const [nx, ny] of adjacent) {
    if (board[nx][ny] === "O") {
      const group = groupAt(board, nx, ny);
      if (group.liberties.size === 1) score += 1_000 + group.stones.length * 100;
      else if (group.liberties.size === 2) score += 35;
    }
    if (board[nx][ny] === "X") {
      const group = groupAt(board, nx, ny);
      score += group.liberties.size === 1 ? 500 + group.stones.length * 20 : 20;
    }
    if (board[nx][ny] === ".") score += 9;
  }

  const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y);
  score += Math.min(edgeDistance, 2) * 8;
  score -= (Math.abs(x - center) + Math.abs(y - center)) * 0.35;
  return score;
}

export function chooseGoMove(board, validMoves) {
  const candidates = [];
  for (let x = 0; x < validMoves.length; x += 1) {
    for (let y = 0; y < validMoves[x].length; y += 1) {
      if (!validMoves[x][y]) continue;
      candidates.push({ x, y, score: scoreMove(board, x, y) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.x - b.x || a.y - b.y);
  return candidates[0] ?? null;
}


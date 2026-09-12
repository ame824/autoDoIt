import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_TYPES,
  lzDecompress,
  solveContract,
} from "../lib/contract-solvers.js";

function answer(type, data) {
  const result = solveContract(type, data);
  assert.equal(result.supported, true, type);
  return result.answer;
}

function createRandom(seed = 0x41c6ce57) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function bruteLargestPrimeFactor(value) {
  let largest = 1;
  for (let factor = 2; factor <= value; factor += 1) {
    while (value % factor === 0) {
      largest = factor;
      value /= factor;
    }
  }
  return largest;
}

function bruteMaximumSubarray(values) {
  let best = -Infinity;
  for (let start = 0; start < values.length; start += 1) {
    let total = 0;
    for (let end = start; end < values.length; end += 1) {
      total += values[end];
      best = Math.max(best, total);
    }
  }
  return best;
}

function bruteCountSums(target, values, index = 0) {
  if (target === 0) return 1;
  if (target < 0 || index >= values.length) return 0;
  return bruteCountSums(target - values[index], values, index) +
    bruteCountSums(target, values, index + 1);
}

function bruteMinimumJumps(values) {
  const distances = Array(values.length).fill(Infinity);
  distances[0] = 0;
  for (let index = 0; index < values.length; index += 1) {
    for (let jump = 1; jump <= values[index] && index + jump < values.length; jump += 1) {
      distances[index + jump] = Math.min(distances[index + jump], distances[index] + 1);
    }
  }
  return Number.isFinite(distances.at(-1)) ? distances.at(-1) : 0;
}

function bruteStockProfit(prices, maximumTransactions) {
  const memo = new Map();
  function search(day, remaining, holding) {
    if (day === prices.length) return holding ? -Infinity : 0;
    const key = `${day}:${remaining}:${holding ? 1 : 0}`;
    if (memo.has(key)) return memo.get(key);
    let best = search(day + 1, remaining, holding);
    if (holding && remaining > 0) {
      best = Math.max(best, prices[day] + search(day + 1, remaining - 1, false));
    } else if (!holding && remaining > 0) {
      best = Math.max(best, -prices[day] + search(day + 1, remaining, true));
    }
    memo.set(key, best);
    return best;
  }
  return search(0, maximumTransactions, false);
}

function bruteTriangle(triangle, row = 0, column = 0) {
  if (row === triangle.length - 1) return triangle[row][column];
  return triangle[row][column] + Math.min(
    bruteTriangle(triangle, row + 1, column),
    bruteTriangle(triangle, row + 1, column + 1),
  );
}

function brutePaths(grid, row = 0, column = 0, memo = new Map()) {
  if (row >= grid.length || column >= grid[0].length || grid[row][column] === 1) return 0;
  if (row === grid.length - 1 && column === grid[0].length - 1) return 1;
  const key = `${row}:${column}`;
  if (!memo.has(key)) {
    memo.set(key, brutePaths(grid, row + 1, column, memo) + brutePaths(grid, row, column + 1, memo));
  }
  return memo.get(key);
}

function isPrime(value) {
  if (value < 2) return false;
  for (let factor = 2; factor * factor <= value; factor += 1) {
    if (value % factor === 0) return false;
  }
  return true;
}

test("randomized numeric contracts agree with independent brute-force oracles", () => {
  const random = createRandom();
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const primeInput = integer(random, 2, 20_000);
    assert.equal(answer(CONTRACT_TYPES.primeFactor, primeInput), bruteLargestPrimeFactor(primeInput));

    const values = Array.from({ length: integer(random, 1, 9) }, () => integer(random, -15, 15));
    assert.equal(answer(CONTRACT_TYPES.maxSubarray, values), bruteMaximumSubarray(values));

    const target = integer(random, 2, 12);
    const parts = Array.from({ length: target - 1 }, (_unused, index) => index + 1);
    assert.equal(answer(CONTRACT_TYPES.totalWays, target), bruteCountSums(target, parts));
    const coins = parts.filter(() => random() < 0.45);
    if (coins.length === 0) coins.push(1);
    assert.equal(answer(CONTRACT_TYPES.totalWaysII, [target, coins]), bruteCountSums(target, coins));

    const prices = Array.from({ length: integer(random, 2, 8) }, () => integer(random, 1, 30));
    const transactions = integer(random, 1, 4);
    assert.equal(answer(CONTRACT_TYPES.traderI, prices), bruteStockProfit(prices, 1));
    assert.equal(answer(CONTRACT_TYPES.traderII, prices), bruteStockProfit(prices, prices.length));
    assert.equal(answer(CONTRACT_TYPES.traderIII, prices), bruteStockProfit(prices, 2));
    assert.equal(answer(CONTRACT_TYPES.traderIV, [transactions, prices]), bruteStockProfit(prices, transactions));

    const rows = integer(random, 1, 5);
    const triangle = Array.from({ length: rows }, (_unused, row) =>
      Array.from({ length: row + 1 }, () => integer(random, 0, 20))
    );
    assert.equal(answer(CONTRACT_TYPES.triangle, triangle), bruteTriangle(triangle));

    const pathRows = integer(random, 1, 6);
    const pathColumns = integer(random, 1, 6);
    const openGrid = Array.from({ length: pathRows }, () => Array(pathColumns).fill(0));
    assert.equal(answer(CONTRACT_TYPES.pathsI, [pathRows, pathColumns]), brutePaths(openGrid));
    const obstacleGrid = openGrid.map((row) => row.map(() => random() < 0.25 ? 1 : 0));
    assert.equal(answer(CONTRACT_TYPES.pathsII, obstacleGrid), brutePaths(obstacleGrid));

    const low = integer(random, 0, 2_000);
    const high = low + integer(random, 1, 250);
    const expectedPrimes = Array.from({ length: high - low + 1 }, (_unused, index) => low + index)
      .filter(isPrime).length;
    assert.equal(answer(CONTRACT_TYPES.primeCount, [low, high]), expectedPrimes);
  }
});

function bruteSpiral(matrix) {
  const rows = matrix.length;
  const columns = matrix[0].length;
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const seen = new Set();
  const result = [];
  let row = 0;
  let column = 0;
  let direction = 0;
  for (let visited = 0; visited < rows * columns; visited += 1) {
    result.push(matrix[row][column]);
    seen.add(`${row}:${column}`);
    let [dr, dc] = directions[direction];
    let nextRow = row + dr;
    let nextColumn = column + dc;
    if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns ||
      seen.has(`${nextRow}:${nextColumn}`)) {
      direction = (direction + 1) % directions.length;
      [dr, dc] = directions[direction];
      nextRow = row + dr;
      nextColumn = column + dc;
    }
    row = nextRow;
    column = nextColumn;
  }
  return result;
}

function bruteIpAddresses(digits) {
  const result = [];
  for (let a = 1; a <= 3; a += 1) {
    for (let b = a + 1; b <= a + 3; b += 1) {
      for (let c = b + 1; c <= b + 3; c += 1) {
        const parts = [digits.slice(0, a), digits.slice(a, b), digits.slice(b, c), digits.slice(c)];
        if (parts.some((part) => part.length < 1 || part.length > 3)) continue;
        if (parts.some((part) => part.length > 1 && part[0] === "0")) continue;
        if (parts.some((part) => Number(part) > 255)) continue;
        result.push(parts.join("."));
      }
    }
  }
  return result.sort();
}

function validateMergedIntervals(input, output) {
  for (let index = 1; index < output.length; index += 1) {
    assert.ok(output[index - 1][1] < output[index][0]);
  }
  const minimum = Math.min(...input.map(([start]) => start));
  const maximum = Math.max(...input.map(([, end]) => end));
  for (let point = minimum; point <= maximum; point += 0.5) {
    const before = input.some(([start, end]) => start <= point && point <= end);
    const after = output.some(([start, end]) => start <= point && point <= end);
    assert.equal(after, before);
  }
}

function hasTwoColoring(vertexCount, edges) {
  for (let mask = 0; mask < 2 ** vertexCount; mask += 1) {
    if (edges.every(([left, right]) => ((mask >> left) & 1) !== ((mask >> right) & 1))) return true;
  }
  return false;
}

function shortestDistance(grid) {
  if (grid[0][0] !== 0 || grid.at(-1).at(-1) !== 0) return Infinity;
  const queue = [[0, 0, 0]];
  const seen = new Set(["0:0"]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [row, column, distance] = queue[cursor];
    if (row === grid.length - 1 && column === grid[0].length - 1) return distance;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextRow = row + dr;
      const nextColumn = column + dc;
      const key = `${nextRow}:${nextColumn}`;
      if (nextRow < 0 || nextRow >= grid.length || nextColumn < 0 ||
        nextColumn >= grid[0].length || grid[nextRow][nextColumn] !== 0 || seen.has(key)) continue;
      seen.add(key);
      queue.push([nextRow, nextColumn, distance + 1]);
    }
  }
  return Infinity;
}

function validatePath(grid, path) {
  let row = 0;
  let column = 0;
  for (const symbol of path) {
    if (symbol === "D") row += 1;
    else if (symbol === "U") row -= 1;
    else if (symbol === "R") column += 1;
    else if (symbol === "L") column -= 1;
    else return false;
    if (row < 0 || row >= grid.length || column < 0 || column >= grid[0].length || grid[row][column] !== 0) {
      return false;
    }
  }
  return row === grid.length - 1 && column === grid[0].length - 1;
}

function bruteLargestRectangle(matrix) {
  let bestArea = 0;
  for (let top = 0; top < matrix.length; top += 1) {
    for (let left = 0; left < matrix[0].length; left += 1) {
      for (let bottom = top; bottom < matrix.length; bottom += 1) {
        for (let right = left; right < matrix[0].length; right += 1) {
          let clear = true;
          for (let row = top; clear && row <= bottom; row += 1) {
            clear = matrix[row].slice(left, right + 1).every((value) => value === 0);
          }
          if (clear) bestArea = Math.max(bestArea, (bottom - top + 1) * (right - left + 1));
        }
      }
    }
  }
  return bestArea;
}

test("randomized traversal and geometry answers remain valid and optimal", () => {
  const random = createRandom(0x9e3779b9);
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const rows = integer(random, 1, 6);
    const columns = integer(random, 1, 6);
    const matrix = Array.from({ length: rows }, (_unused, row) =>
      Array.from({ length: columns }, (_unused2, column) => row * columns + column)
    );
    assert.deepEqual(answer(CONTRACT_TYPES.spiral, matrix), bruteSpiral(matrix));

    const jumps = Array.from({ length: integer(random, 1, 12) }, () => integer(random, 0, 5));
    const minimum = bruteMinimumJumps(jumps);
    assert.equal(answer(CONTRACT_TYPES.jumpI, jumps), jumps.length === 1 || minimum > 0 ? 1 : 0);
    assert.equal(answer(CONTRACT_TYPES.jumpII, jumps), minimum);

    const digits = Array.from({ length: integer(random, 4, 12) }, () => integer(random, 0, 9)).join("");
    assert.deepEqual(answer(CONTRACT_TYPES.generateIPs, digits).sort(), bruteIpAddresses(digits));

    const intervals = Array.from({ length: integer(random, 1, 9) }, () => {
      const start = integer(random, -10, 20);
      return [start, start + integer(random, 0, 10)];
    });
    validateMergedIntervals(intervals, answer(CONTRACT_TYPES.mergeIntervals, intervals));

    const vertexCount = integer(random, 1, 8);
    const edges = [];
    for (let left = 0; left < vertexCount; left += 1) {
      for (let right = left + 1; right < vertexCount; right += 1) {
        if (random() < 0.3) edges.push([left, right]);
      }
    }
    const coloring = answer(CONTRACT_TYPES.twoColoring, [vertexCount, edges]);
    if (coloring.length === 0) {
      assert.equal(hasTwoColoring(vertexCount, edges), false);
    } else {
      assert.equal(coloring.length, vertexCount);
      assert.equal(edges.every(([left, right]) => coloring[left] !== coloring[right]), true);
    }

    const gridRows = integer(random, 2, 6);
    const gridColumns = integer(random, 2, 6);
    const grid = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridColumns }, () => random() < 0.28 ? 1 : 0)
    );
    grid[0][0] = 0;
    grid.at(-1)[gridColumns - 1] = 0;
    const distance = shortestDistance(grid);
    const path = answer(CONTRACT_TYPES.shortestPath, grid);
    if (Number.isFinite(distance)) {
      assert.equal(path.length, distance);
      assert.equal(validatePath(grid, path), true);
    } else {
      assert.equal(path, "");
    }

    const binaryMatrix = Array.from({ length: integer(random, 2, 6) }, () =>
      Array.from({ length: integer(random, 2, 6) }, () => random() < 0.35 ? 1 : 0)
    );
    const width = Math.min(...binaryMatrix.map((row) => row.length));
    for (const row of binaryMatrix) row.length = width;
    binaryMatrix[0][0] = 0;
    const [[top, left], [bottom, right]] = answer(CONTRACT_TYPES.largestRectangle, binaryMatrix);
    const resultArea = (bottom - top + 1) * (right - left + 1);
    assert.equal(resultArea, bruteLargestRectangle(binaryMatrix));
    for (let row = top; row <= bottom; row += 1) {
      assert.equal(binaryMatrix[row].slice(left, right + 1).every((value) => value === 0), true);
    }
  }
});

function allMinimalParenthesisRepairs(value) {
  const parentheses = [...value].filter((character) => character === "(" || character === ")").length;
  for (let removals = 0; removals <= parentheses; removals += 1) {
    const results = new Set();
    function search(index, removed, candidate) {
      if (removed > removals) return;
      if (index === value.length) {
        if (removed === removals) {
          let depth = 0;
          for (const character of candidate) {
            if (character === "(") depth += 1;
            if (character === ")") depth -= 1;
            if (depth < 0) return;
          }
          if (depth === 0) results.add(candidate);
        }
        return;
      }
      const character = value[index];
      if (character === "(" || character === ")") search(index + 1, removed + 1, candidate);
      search(index + 1, removed, candidate + character);
    }
    search(0, 0, "");
    if (results.size > 0) return [...results].sort();
  }
  return [""];
}

function evaluateExpression(expression) {
  const tokens = expression.match(/\d+|[+*-]/g) ?? [];
  const values = [Number(tokens[0])];
  const operators = [];
  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const value = Number(tokens[index + 1]);
    if (operator === "*") values[values.length - 1] *= value;
    else {
      operators.push(operator);
      values.push(value);
    }
  }
  return values.slice(1).reduce(
    (total, value, index) => operators[index] === "+" ? total + value : total - value,
    values[0],
  );
}

function validateMathExpressions(digits, target, expressions) {
  for (const expression of expressions) {
    assert.equal(expression.replace(/[+*-]/g, ""), digits);
    assert.equal(/(^|[+*-])0\d/.test(expression), false);
    assert.equal(evaluateExpression(expression), target);
  }
}

function bruteMathExpressions(digits, target) {
  if (digits.length === 0) return [];
  const choices = ["", "+", "-", "*"];
  const results = [];
  const combinations = 4 ** (digits.length - 1);
  for (let mask = 0; mask < combinations; mask += 1) {
    let selector = mask;
    let expression = digits[0];
    for (let index = 1; index < digits.length; index += 1) {
      expression += choices[selector % 4] + digits[index];
      selector = Math.floor(selector / 4);
    }
    if (/(^|[+*-])0\d/.test(expression)) continue;
    if (evaluateExpression(expression) === target) results.push(expression);
  }
  return results.sort();
}

function expectedRle(value) {
  return value.match(/(.)\1{0,8}/gs)?.map((run) => `${run.length}${run[0]}`).join("") ?? "";
}

test("randomized string, encoding, and compression contracts are self-consistent", () => {
  const random = createRandom(0xc0decafe);
  const alphabet = "abcXYZ012";
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const parentheses = Array.from({ length: integer(random, 1, 9) }, () => "()ab"[integer(random, 0, 3)]).join("");
    assert.deepEqual(answer(CONTRACT_TYPES.sanitizeParentheses, parentheses), allMinimalParenthesisRepairs(parentheses));

    const digits = Array.from({ length: integer(random, 1, 7) }, () => integer(random, 0, 9)).join("");
    const target = integer(random, -20, 40);
    const expressions = answer(CONTRACT_TYPES.mathExpressions, [digits, target]);
    assert.equal(new Set(expressions).size, expressions.length);
    validateMathExpressions(digits, target, expressions);
    assert.deepEqual([...expressions].sort(), bruteMathExpressions(digits, target));

    const integerValue = integer(random, 1, 500_000);
    const encoded = answer(CONTRACT_TYPES.hammingEncode, integerValue);
    assert.equal(answer(CONTRACT_TYPES.hammingDecode, encoded), integerValue);
    const bit = integer(random, 0, encoded.length - 1);
    const corrupted = encoded.slice(0, bit) + (encoded[bit] === "0" ? "1" : "0") + encoded.slice(bit + 1);
    assert.equal(answer(CONTRACT_TYPES.hammingDecode, corrupted), integerValue);

    const plain = Array.from({ length: integer(random, 1, 28) }, () => alphabet[integer(random, 0, alphabet.length - 1)]).join("");
    assert.equal(answer(CONTRACT_TYPES.rle, plain), expectedRle(plain));
    const compressed = answer(CONTRACT_TYPES.lzEncode, plain);
    assert.equal(lzDecompress(compressed), plain);
    assert.equal(answer(CONTRACT_TYPES.lzDecode, compressed), plain);

    const word = Array.from({ length: integer(random, 1, 20) }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ "[integer(random, 0, 26)]
    ).join("");
    const shift = integer(random, 0, 25);
    const caesar = answer(CONTRACT_TYPES.caesar, [word, shift]);
    assert.equal(caesar.length, word.length);
    assert.equal(answer(CONTRACT_TYPES.caesar, [caesar, 26 - shift]), word);

    const key = Array.from({ length: integer(random, 1, 8) }, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[integer(random, 0, 25)]
    ).join("");
    const vigenere = answer(CONTRACT_TYPES.vigenere, [word, key]);
    assert.equal(vigenere.length, word.length);
    assert.equal(vigenere, [...word].map((character, index) => {
      if (character === " ") return character;
      const shift = key.charCodeAt(index % key.length) - 65;
      return String.fromCharCode(((character.charCodeAt(0) - 65 + shift) % 26) + 65);
    }).join(""));

    const root = BigInt(integer(random, 1, 1_000_000));
    assert.equal(answer(CONTRACT_TYPES.squareRoot, root * root - root + 1n), root);
    assert.equal(answer(CONTRACT_TYPES.squareRoot, root * root + root), root);
    assert.equal(answer(CONTRACT_TYPES.squareRoot, root * root + root + 1n), root + 1n);
  }
});

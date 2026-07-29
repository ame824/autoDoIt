export const CONTRACT_TYPES = Object.freeze({
  primeFactor: "Find Largest Prime Factor",
  maxSubarray: "Subarray with Maximum Sum",
  totalWays: "Total Ways to Sum",
  totalWaysII: "Total Ways to Sum II",
  spiral: "Spiralize Matrix",
  jumpI: "Array Jumping Game",
  jumpII: "Array Jumping Game II",
  mergeIntervals: "Merge Overlapping Intervals",
  generateIPs: "Generate IP Addresses",
  traderI: "Algorithmic Stock Trader I",
  traderII: "Algorithmic Stock Trader II",
  traderIII: "Algorithmic Stock Trader III",
  traderIV: "Algorithmic Stock Trader IV",
  triangle: "Minimum Path Sum in a Triangle",
  pathsI: "Unique Paths in a Grid I",
  pathsII: "Unique Paths in a Grid II",
  shortestPath: "Shortest Path in a Grid",
  sanitizeParentheses: "Sanitize Parentheses in Expression",
  mathExpressions: "Find All Valid Math Expressions",
  hammingEncode: "HammingCodes: Integer to Encoded Binary",
  hammingDecode: "HammingCodes: Encoded Binary to Integer",
  twoColoring: "Proper 2-Coloring of a Graph",
  rle: "Compression I: RLE Compression",
  lzDecode: "Compression II: LZ Decompression",
  lzEncode: "Compression III: LZ Compression",
  caesar: "Encryption I: Caesar Cipher",
  vigenere: "Encryption II: Vigenère Cipher",
  squareRoot: "Square Root",
  primeCount: "Total Number of Primes",
  largestRectangle: "Largest Rectangle in a Matrix",
});

function largestPrimeFactor(value) {
  let number = Number(value);
  let factor = 2;
  let largest = 1;
  while (factor * factor <= number) {
    while (number % factor === 0) {
      largest = factor;
      number /= factor;
    }
    factor += factor === 2 ? 1 : 2;
  }
  return number > 1 ? number : largest;
}

function maximumSubarray(values) {
  let best = -Infinity;
  let current = -Infinity;
  for (const value of values) {
    current = Math.max(value, current + value);
    best = Math.max(best, current);
  }
  return best;
}

function countSums(target, values) {
  const ways = Array(target + 1).fill(0);
  ways[0] = 1;
  for (const value of values) {
    for (let total = value; total <= target; total += 1) {
      ways[total] += ways[total - value];
    }
  }
  return ways[target];
}

function spiralize(matrix) {
  const result = [];
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let column = left; column <= right; column += 1) result.push(matrix[top][column]);
    top += 1;
    for (let row = top; row <= bottom; row += 1) result.push(matrix[row][right]);
    right -= 1;
    if (top <= bottom) {
      for (let column = right; column >= left; column -= 1) result.push(matrix[bottom][column]);
      bottom -= 1;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row -= 1) result.push(matrix[row][left]);
      left += 1;
    }
  }
  return result;
}

function canReachEnd(values) {
  let reach = 0;
  for (let index = 0; index <= reach && index < values.length; index += 1) {
    reach = Math.max(reach, index + values[index]);
  }
  return reach >= values.length - 1 ? 1 : 0;
}

function minimumJumps(values) {
  if (values.length <= 1) return 0;
  let jumps = 0;
  let currentEnd = 0;
  let farthest = 0;
  for (let index = 0; index < values.length - 1; index += 1) {
    farthest = Math.max(farthest, index + values[index]);
    if (index !== currentEnd) continue;
    if (farthest <= index) return 0;
    jumps += 1;
    currentEnd = farthest;
    if (currentEnd >= values.length - 1) return jumps;
  }
  return 0;
}

function mergeIntervals(intervals) {
  const ordered = intervals.map((entry) => [...entry]).sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const interval of ordered) {
    const previous = result.at(-1);
    if (!previous || interval[0] > previous[1]) result.push(interval);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return result;
}

function generateIPAddresses(digits) {
  const result = [];
  function visit(position, parts) {
    if (parts.length === 4) {
      if (position === digits.length) result.push(parts.join("."));
      return;
    }
    const remainingParts = 4 - parts.length;
    const remainingDigits = digits.length - position;
    if (remainingDigits < remainingParts || remainingDigits > remainingParts * 3) return;
    for (let length = 1; length <= 3 && position + length <= digits.length; length += 1) {
      const part = digits.slice(position, position + length);
      if (part.length > 1 && part.startsWith("0")) break;
      if (Number(part) > 255) break;
      visit(position + length, [...parts, part]);
    }
  }
  visit(0, []);
  return result;
}

function stockProfit(prices, maximumTransactions) {
  const transactions = Math.max(0, Math.floor(maximumTransactions));
  if (transactions === 0 || prices.length < 2) return 0;
  if (transactions >= Math.floor(prices.length / 2)) {
    return prices.slice(1).reduce(
      (profit, price, index) => profit + Math.max(0, price - prices[index]),
      0,
    );
  }
  const hold = Array(transactions + 1).fill(-Infinity);
  const cash = Array(transactions + 1).fill(0);
  for (const price of prices) {
    for (let count = transactions; count >= 1; count -= 1) {
      cash[count] = Math.max(cash[count], hold[count] + price);
      hold[count] = Math.max(hold[count], cash[count - 1] - price);
    }
  }
  return cash[transactions];
}

function minimumTrianglePath(triangle) {
  const totals = [...triangle.at(-1)];
  for (let row = triangle.length - 2; row >= 0; row -= 1) {
    for (let column = 0; column < triangle[row].length; column += 1) {
      totals[column] = triangle[row][column] + Math.min(totals[column], totals[column + 1]);
    }
  }
  return totals[0];
}

function uniquePaths(rows, columns) {
  const paths = Array(columns).fill(1);
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      paths[column] += paths[column - 1];
    }
  }
  return paths.at(-1);
}

function uniquePathsWithObstacles(grid) {
  const paths = Array(grid[0].length).fill(0);
  paths[0] = grid[0][0] === 0 ? 1 : 0;
  for (let row = 0; row < grid.length; row += 1) {
    for (let column = 0; column < grid[row].length; column += 1) {
      if (grid[row][column] === 1) paths[column] = 0;
      else if (column > 0) paths[column] += paths[column - 1];
    }
  }
  return paths.at(-1);
}

function shortestGridPath(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const queue = [[0, 0, ""]];
  const seen = new Set(["0,0"]);
  const directions = [
    [1, 0, "D"],
    [0, 1, "R"],
    [-1, 0, "U"],
    [0, -1, "L"],
  ];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [row, column, path] = queue[cursor];
    if (row === height - 1 && column === width - 1) return path;
    for (const [dr, dc, symbol] of directions) {
      const nextRow = row + dr;
      const nextColumn = column + dc;
      const key = `${nextRow},${nextColumn}`;
      if (
        nextRow < 0 ||
        nextRow >= height ||
        nextColumn < 0 ||
        nextColumn >= width ||
        grid[nextRow][nextColumn] !== 0 ||
        seen.has(key)
      ) continue;
      seen.add(key);
      queue.push([nextRow, nextColumn, path + symbol]);
    }
  }
  return "";
}

function validParentheses(value) {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function sanitizeParentheses(value) {
  let level = new Set([value]);
  while (level.size > 0) {
    const valid = [...level].filter(validParentheses);
    if (valid.length > 0) return [...new Set(valid)].sort();
    const next = new Set();
    for (const candidate of level) {
      for (let index = 0; index < candidate.length; index += 1) {
        if (candidate[index] !== "(" && candidate[index] !== ")") continue;
        next.add(candidate.slice(0, index) + candidate.slice(index + 1));
      }
    }
    level = next;
  }
  return [""];
}

function validMathExpressions([digits, target]) {
  const result = [];
  function visit(position, expression, total, previous) {
    if (position === digits.length) {
      if (total === target) result.push(expression);
      return;
    }
    for (let end = position + 1; end <= digits.length; end += 1) {
      if (end > position + 1 && digits[position] === "0") break;
      const token = digits.slice(position, end);
      const value = Number(token);
      if (position === 0) {
        visit(end, token, value, value);
        continue;
      }
      visit(end, `${expression}+${token}`, total + value, value);
      visit(end, `${expression}-${token}`, total - value, -value);
      visit(
        end,
        `${expression}*${token}`,
        total - previous + previous * value,
        previous * value,
      );
    }
  }
  visit(0, "", 0, 0);
  return result;
}

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function hammingEncode(value) {
  const dataBits = Number(value).toString(2).split("").map(Number);
  const encoded = [0];
  let dataIndex = 0;
  for (let index = 1; dataIndex < dataBits.length; index += 1) {
    encoded[index] = isPowerOfTwo(index) ? 0 : dataBits[dataIndex++];
  }
  let syndrome = 0;
  for (let index = 1; index < encoded.length; index += 1) {
    if (encoded[index] === 1) syndrome ^= index;
  }
  for (let bit = 0; 2 ** bit < encoded.length; bit += 1) {
    encoded[2 ** bit] = (syndrome >> bit) & 1;
  }
  encoded[0] = encoded.slice(1).reduce((sum, bit) => sum + bit, 0) % 2;
  return encoded.join("");
}

function hammingDecode(value) {
  const bits = String(value).split("").map(Number);
  let syndrome = 0;
  for (let index = 1; index < bits.length; index += 1) {
    if (bits[index] === 1) syndrome ^= index;
  }
  if (syndrome > 0 && syndrome < bits.length) bits[syndrome] ^= 1;
  const data = bits
    .slice(1)
    .filter((_bit, offset) => !isPowerOfTwo(offset + 1))
    .join("");
  return Number.parseInt(data || "0", 2);
}

function twoColorGraph([vertexCount, edges]) {
  const adjacency = Array.from({ length: vertexCount }, () => []);
  for (const [left, right] of edges) {
    adjacency[left].push(right);
    adjacency[right].push(left);
  }
  const colors = Array(vertexCount).fill(-1);
  for (let start = 0; start < vertexCount; start += 1) {
    if (colors[start] !== -1) continue;
    colors[start] = 0;
    const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const vertex = queue[cursor];
      for (const neighbor of adjacency[vertex]) {
        if (colors[neighbor] === -1) {
          colors[neighbor] = 1 - colors[vertex];
          queue.push(neighbor);
        } else if (colors[neighbor] === colors[vertex]) {
          return [];
        }
      }
    }
  }
  return colors;
}

function runLengthEncode(value) {
  let result = "";
  for (let start = 0; start < value.length;) {
    let length = 1;
    while (
      length < 9 &&
      start + length < value.length &&
      value[start + length] === value[start]
    ) length += 1;
    result += `${length}${value[start]}`;
    start += length;
  }
  return result;
}

export function lzDecompress(value) {
  let output = "";
  let position = 0;
  let literal = true;
  while (position < value.length) {
    const length = Number(value[position]);
    if (!Number.isInteger(length) || length < 0 || length > 9) return null;
    position += 1;
    if (length === 0) {
      literal = !literal;
      continue;
    }
    if (literal) {
      if (position + length > value.length) return null;
      output += value.slice(position, position + length);
      position += length;
    } else {
      if (position >= value.length) return null;
      const offset = Number(value[position]);
      position += 1;
      if (!Number.isInteger(offset) || offset < 1 || offset > 9 || offset > output.length) {
        return null;
      }
      for (let index = 0; index < length; index += 1) {
        output += output[output.length - offset];
      }
    }
    literal = !literal;
  }
  return output;
}

function chooseShorter(current, candidate) {
  if (candidate === null) return current;
  if (current === null || candidate.length < current.length) return candidate;
  if (candidate.length === current.length && candidate < current) return candidate;
  return current;
}

export function lzCompress(plain) {
  const memo = new Map();
  function search(position, literal, maySkip) {
    if (position === plain.length) return "";
    const key = `${position}:${literal ? 1 : 0}:${maySkip ? 1 : 0}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;

    if (literal) {
      for (let length = 1; length <= 9 && position + length <= plain.length; length += 1) {
        const rest = search(position + length, false, true);
        if (rest !== null) {
          best = chooseShorter(best, `${length}${plain.slice(position, position + length)}${rest}`);
        }
      }
    } else {
      for (let offset = 1; offset <= 9 && offset <= position; offset += 1) {
        for (let length = 1; length <= 9 && position + length <= plain.length; length += 1) {
          let matches = true;
          for (let index = 0; index < length; index += 1) {
            if (plain[position + index] !== plain[position + index - offset]) {
              matches = false;
              break;
            }
          }
          if (!matches) break;
          const rest = search(position + length, true, true);
          if (rest !== null) best = chooseShorter(best, `${length}${offset}${rest}`);
        }
      }
    }

    if (maySkip) {
      const rest = search(position, !literal, false);
      if (rest !== null) best = chooseShorter(best, `0${rest}`);
    }
    memo.set(key, best);
    return best;
  }
  return search(0, true, true) ?? "";
}

function caesarCipher([text, shift]) {
  return [...text].map((character) => {
    if (character === " ") return character;
    return String.fromCharCode(((character.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
  }).join("");
}

function vigenereCipher([text, key]) {
  return [...text].map((character, index) => {
    if (character === " ") return character;
    const shift = key.charCodeAt(index % key.length) - 65;
    return String.fromCharCode(((character.charCodeAt(0) - 65 + shift) % 26) + 65);
  }).join("");
}

function integerSquareRoot(value) {
  const number = BigInt(value);
  if (number < 2n) return number;
  const bitLength = number.toString(2).length;
  let estimate = 1n << BigInt(Math.ceil(bitLength / 2));
  while (true) {
    const next = (estimate + number / estimate) >> 1n;
    if (next >= estimate) break;
    estimate = next;
  }
  const upper = estimate + 1n;
  return number - estimate * estimate < upper * upper - number ? estimate : upper;
}

function countPrimes([rangeStart, rangeEnd]) {
  let low = Math.max(2, Number(rangeStart));
  const high = Number(rangeEnd);
  if (high < low) return 0;
  const root = Math.floor(Math.sqrt(high));
  const compositeBase = new Uint8Array(root + 1);
  const primes = [];
  for (let value = 2; value <= root; value += 1) {
    if (compositeBase[value]) continue;
    primes.push(value);
    if (value * value <= root) {
      for (let multiple = value * value; multiple <= root; multiple += value) {
        compositeBase[multiple] = 1;
      }
    }
  }
  const composite = new Uint8Array(high - low + 1);
  for (const prime of primes) {
    const first = Math.max(prime * prime, Math.ceil(low / prime) * prime);
    for (let multiple = first; multiple <= high; multiple += prime) {
      composite[multiple - low] = 1;
    }
  }
  let count = 0;
  for (const marked of composite) if (marked === 0) count += 1;
  return count;
}

function largestZeroRectangle(matrix) {
  const columns = matrix[0].length;
  const heights = Array(columns).fill(0);
  let best = { area: 0, top: 0, left: 0, bottom: 0, right: 0 };
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      heights[column] = matrix[row][column] === 0 ? heights[column] + 1 : 0;
    }
    const stack = [];
    for (let column = 0; column <= columns; column += 1) {
      const height = column === columns ? 0 : heights[column];
      while (stack.length > 0 && heights[stack.at(-1)] > height) {
        const index = stack.pop();
        const rectangleHeight = heights[index];
        const left = stack.length === 0 ? 0 : stack.at(-1) + 1;
        const right = column - 1;
        const area = rectangleHeight * (right - left + 1);
        if (area > best.area) {
          best = {
            area,
            top: row - rectangleHeight + 1,
            left,
            bottom: row,
            right,
          };
        }
      }
      stack.push(column);
    }
  }
  return [[best.top, best.left], [best.bottom, best.right]];
}

const SOLVERS = Object.freeze({
  [CONTRACT_TYPES.primeFactor]: largestPrimeFactor,
  [CONTRACT_TYPES.maxSubarray]: maximumSubarray,
  [CONTRACT_TYPES.totalWays]: (target) =>
    countSums(target, Array.from({ length: target - 1 }, (_unused, index) => index + 1)),
  [CONTRACT_TYPES.totalWaysII]: ([target, values]) => countSums(target, values),
  [CONTRACT_TYPES.spiral]: spiralize,
  [CONTRACT_TYPES.jumpI]: canReachEnd,
  [CONTRACT_TYPES.jumpII]: minimumJumps,
  [CONTRACT_TYPES.mergeIntervals]: mergeIntervals,
  [CONTRACT_TYPES.generateIPs]: generateIPAddresses,
  [CONTRACT_TYPES.traderI]: (prices) => stockProfit(prices, 1),
  [CONTRACT_TYPES.traderII]: (prices) => stockProfit(prices, Math.floor(prices.length / 2)),
  [CONTRACT_TYPES.traderIII]: (prices) => stockProfit(prices, 2),
  [CONTRACT_TYPES.traderIV]: ([maximum, prices]) => stockProfit(prices, maximum),
  [CONTRACT_TYPES.triangle]: minimumTrianglePath,
  [CONTRACT_TYPES.pathsI]: ([rows, columns]) => uniquePaths(rows, columns),
  [CONTRACT_TYPES.pathsII]: uniquePathsWithObstacles,
  [CONTRACT_TYPES.shortestPath]: shortestGridPath,
  [CONTRACT_TYPES.sanitizeParentheses]: sanitizeParentheses,
  [CONTRACT_TYPES.mathExpressions]: validMathExpressions,
  [CONTRACT_TYPES.hammingEncode]: hammingEncode,
  [CONTRACT_TYPES.hammingDecode]: hammingDecode,
  [CONTRACT_TYPES.twoColoring]: twoColorGraph,
  [CONTRACT_TYPES.rle]: runLengthEncode,
  [CONTRACT_TYPES.lzDecode]: (value) => lzDecompress(value) ?? "",
  [CONTRACT_TYPES.lzEncode]: lzCompress,
  [CONTRACT_TYPES.caesar]: caesarCipher,
  [CONTRACT_TYPES.vigenere]: vigenereCipher,
  [CONTRACT_TYPES.squareRoot]: integerSquareRoot,
  [CONTRACT_TYPES.primeCount]: countPrimes,
  [CONTRACT_TYPES.largestRectangle]: largestZeroRectangle,
});

export function supportedContractTypes() {
  return Object.keys(SOLVERS);
}

export function solveContract(type, data) {
  const solver = SOLVERS[String(type)];
  if (!solver) return { supported: false, answer: undefined };
  return { supported: true, answer: solver(data) };
}

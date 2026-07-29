import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_TYPES,
  lzCompress,
  lzDecompress,
  solveContract,
  supportedContractTypes,
} from "../lib/contract-solvers.js";
import {
  findCodingContracts,
  main as manageContracts,
} from "../special/manage-contracts.js";

function answer(type, data) {
  const result = solveContract(type, data);
  assert.equal(result.supported, true, type);
  return result.answer;
}

test("solver covers every v3.0.1 Coding Contract type", () => {
  assert.equal(supportedContractTypes().length, 30);
  assert.equal(new Set(supportedContractTypes()).size, 30);
});

test("solves arithmetic, dynamic-programming, and traversal contracts", () => {
  assert.equal(answer(CONTRACT_TYPES.primeFactor, 13_195), 29);
  assert.equal(answer(CONTRACT_TYPES.maxSubarray, [-2, 1, -3, 4, -1, 2, 1, -5, 4]), 6);
  assert.equal(answer(CONTRACT_TYPES.totalWays, 4), 4);
  assert.equal(answer(CONTRACT_TYPES.totalWaysII, [10, [2, 5, 3, 6]]), 5);
  assert.deepEqual(
    answer(CONTRACT_TYPES.spiral, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
    [1, 2, 3, 6, 9, 8, 7, 4, 5],
  );
  assert.equal(answer(CONTRACT_TYPES.jumpI, [1, 0, 1]), 0);
  assert.equal(answer(CONTRACT_TYPES.jumpI, [2, 0, 0]), 1);
  assert.equal(answer(CONTRACT_TYPES.jumpII, [2, 3, 1, 1, 4]), 2);
  assert.equal(answer(CONTRACT_TYPES.jumpII, [1, 0, 1]), 0);
  assert.deepEqual(
    answer(CONTRACT_TYPES.mergeIntervals, [[1, 3], [8, 10], [2, 6], [10, 16]]),
    [[1, 6], [8, 16]],
  );
  assert.deepEqual(
    answer(CONTRACT_TYPES.generateIPs, "25525511135").sort(),
    ["255.255.11.135", "255.255.111.35"].sort(),
  );
});

test("solves stock, path, and expression contracts", () => {
  assert.equal(answer(CONTRACT_TYPES.traderI, [7, 1, 5, 3, 6, 4]), 5);
  assert.equal(answer(CONTRACT_TYPES.traderII, [7, 1, 5, 3, 6, 4]), 7);
  assert.equal(answer(CONTRACT_TYPES.traderIII, [3, 3, 5, 0, 0, 3, 1, 4]), 6);
  assert.equal(answer(CONTRACT_TYPES.traderIV, [2, [3, 3, 5, 0, 0, 3, 1, 4]]), 6);
  assert.equal(
    answer(CONTRACT_TYPES.triangle, [[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]),
    11,
  );
  assert.equal(answer(CONTRACT_TYPES.pathsI, [3, 7]), 28);
  assert.equal(answer(CONTRACT_TYPES.pathsII, [[0, 0, 0], [0, 1, 0], [0, 0, 0]]), 2);
  const path = answer(CONTRACT_TYPES.shortestPath, [[0, 1, 0, 0, 0], [0, 0, 0, 1, 0]]);
  assert.equal(path.length, 7);
  assert.deepEqual(
    answer(CONTRACT_TYPES.sanitizeParentheses, "()())()"),
    ["(())()", "()()()"],
  );
  assert.deepEqual(
    answer(CONTRACT_TYPES.mathExpressions, ["123", 6]).sort(),
    ["1+2+3", "1*2*3"].sort(),
  );
});

test("solves encodings, compression, graphs, and new v3 contracts", () => {
  assert.equal(answer(CONTRACT_TYPES.hammingEncode, 8), "11110000");
  assert.equal(answer(CONTRACT_TYPES.hammingDecode, "1001101010"), 21);
  for (const value of [1, 2, 8, 21, 255, 65_535]) {
    const encoded = answer(CONTRACT_TYPES.hammingEncode, value);
    assert.equal(answer(CONTRACT_TYPES.hammingDecode, encoded), value);
    for (let index = 0; index < encoded.length; index += 1) {
      const flipped = encoded.slice(0, index) +
        (encoded[index] === "0" ? "1" : "0") +
        encoded.slice(index + 1);
      assert.equal(answer(CONTRACT_TYPES.hammingDecode, flipped), value);
    }
  }
  assert.deepEqual(
    answer(CONTRACT_TYPES.twoColoring, [3, [[0, 1], [0, 2], [1, 2]]]),
    [],
  );
  const coloring = answer(CONTRACT_TYPES.twoColoring, [4, [[0, 2], [0, 3], [1, 2], [1, 3]]]);
  assert.ok([[0, 0, 1, 1], [1, 1, 0, 0]].some((valid) =>
    valid.every((value, index) => value === coloring[index])
  ));
  assert.equal(answer(CONTRACT_TYPES.rle, "aaaaabccc"), "5a1b3c");
  assert.equal(answer(CONTRACT_TYPES.lzDecode, "5aaabb450723abb"), "aaabbaaababababaabb");

  for (const [plain, maximumLength] of [
    ["abracadabra", 10],
    ["mississippi", 11],
    ["aaaaaaaaaaaa", 6],
    ["abcdefghijk", 14],
  ]) {
    const compressed = lzCompress(plain);
    assert.equal(lzDecompress(compressed), plain);
    assert.ok(compressed.length <= maximumLength, `${plain}: ${compressed}`);
  }

  assert.equal(answer(CONTRACT_TYPES.caesar, ["BCD XYZ", 1]), "ABC WXY");
  assert.equal(answer(CONTRACT_TYPES.vigenere, ["ABC", "BCD"]), "BDF");
  assert.equal(answer(CONTRACT_TYPES.squareRoot, 15n), 4n);
  assert.equal(answer(CONTRACT_TYPES.squareRoot, 24n), 5n);
  const hugeRoot = 10n ** 100n + 123_456_789n;
  assert.equal(
    answer(CONTRACT_TYPES.squareRoot, hugeRoot * hugeRoot + hugeRoot),
    hugeRoot,
  );
  assert.equal(
    answer(CONTRACT_TYPES.squareRoot, hugeRoot * hugeRoot + hugeRoot + 1n),
    hugeRoot + 1n,
  );
  assert.equal(answer(CONTRACT_TYPES.primeCount, [0, 20]), 8);

  const matrix = [[1, 0, 0], [0, 0, 0]];
  const rectangle = answer(CONTRACT_TYPES.largestRectangle, matrix);
  const [[top, left], [bottom, right]] = rectangle;
  assert.equal((bottom - top + 1) * (right - left + 1), 4);
  for (let row = top; row <= bottom; row += 1) {
    assert.ok(matrix[row].slice(left, right + 1).every((value) => value === 0));
  }
});

test("unknown future types are never treated as solved", () => {
  assert.deepEqual(solveContract("Future Contract", [1, 2, 3]), {
    supported: false,
    answer: undefined,
  });
});

function createContractNs(contractsByHost) {
  const files = new Map();
  const terminal = [];
  return {
    files,
    terminal,
    read: (file) => files.get(file) ?? "",
    write: (file, value) => files.set(file, String(value)),
    scan: (host) => host === "home" ? ["n00dles"] : ["home"],
    ls: (host, suffix) => Object.keys(contractsByHost[host] ?? {}).filter((file) => file.endsWith(suffix)),
    codingcontract: {
      getContract: (file, host) => contractsByHost[host][file],
    },
    toast: () => {},
    tprint: (message) => terminal.push(String(message)),
  };
}

test("contract manager scans every host and submits supported answers", async () => {
  let submitted;
  const contract = {
    type: CONTRACT_TYPES.primeFactor,
    data: 13_195,
    numTriesRemaining: () => 10,
    submit: (value) => {
      submitted = value;
      return value === 29 ? "Money" : "";
    },
  };
  const ns = createContractNs({ home: {}, n00dles: { "alpha.cct": contract } });

  assert.deepEqual(findCodingContracts(ns), [{ host: "n00dles", file: "alpha.cct" }]);
  await manageContracts(ns);
  assert.equal(submitted, 29);
  assert.equal(ns.terminal.length, 0);
});

test("contract manager skips unknown types without submitting", async () => {
  let submitted = false;
  const contract = {
    type: "Future Contract",
    data: [1, 2, 3],
    numTriesRemaining: () => 10,
    submit: () => {
      submitted = true;
      return "";
    },
  };
  const ns = createContractNs({ home: {}, n00dles: { "future.cct": contract } });

  await manageContracts(ns);
  assert.equal(submitted, false);
  assert.equal(ns.terminal.length, 1);
  assert.match(ns.terminal[0], /Future Contract/);
});

test("contract manager stops immediately after a rejected answer", async () => {
  let secondSubmitted = false;
  const rejected = {
    type: CONTRACT_TYPES.primeFactor,
    data: 13_195,
    numTriesRemaining: () => 10,
    submit: () => "",
  };
  const untouched = {
    type: CONTRACT_TYPES.maxSubarray,
    data: [1, 2, 3],
    numTriesRemaining: () => 10,
    submit: () => {
      secondSubmitted = true;
      return "Reward";
    },
  };
  const ns = createContractNs({
    home: {},
    n00dles: {
      "a-rejected.cct": rejected,
      "b-untouched.cct": untouched,
    },
  });

  await manageContracts(ns);
  assert.equal(secondSubmitted, false);
  assert.equal(ns.terminal.length, 1);
  assert.match(ns.terminal[0], /abgelehnt/);
});

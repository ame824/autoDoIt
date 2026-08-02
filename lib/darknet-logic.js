function romanToNumber(value) {
  if (String(value).toLowerCase() === "nulla") return 0;
  const numbers = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1_000 };
  let total = 0;
  let previous = 0;
  for (const character of String(value).toUpperCase().split("").reverse()) {
    const current = numbers[character];
    if (!current) return NaN;
    total += current < previous ? -current : current;
    previous = current;
  }
  return total;
}

export function parseStasisCommand(raw, now = Date.now()) {
  try {
    const command = JSON.parse(String(raw));
    if (
      command?.type !== "stasis" ||
      typeof command.target !== "string" ||
      !command.target ||
      !Number.isFinite(Number(command.expiresAt)) ||
      Number(command.expiresAt) < Number(now)
    ) return null;
    return {
      target: command.target,
      enable: Boolean(command.enable),
      expiresAt: Number(command.expiresAt),
    };
  } catch {
    return null;
  }
}

function largestPrimeFactor(input) {
  let value = Math.abs(Number(input));
  let factor = 2;
  let largest = 1;
  while (factor * factor <= value) {
    if (value % factor === 0) {
      largest = factor;
      value /= factor;
    } else {
      factor += factor === 2 ? 1 : 2;
    }
  }
  return Math.max(largest, value);
}

function baseToDecimal(numberString, base) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const [whole, fraction = ""] = String(numberString).toUpperCase().split(".");
  let result = 0;
  for (const character of whole) result = result * base + alphabet.indexOf(character);
  for (let index = 0; index < fraction.length; index += 1) {
    result += alphabet.indexOf(fraction[index]) * base ** -(index + 1);
  }
  return result;
}

export function evaluateDarknetExpression(expression) {
  const clean = String(expression)
    .replaceAll("ҳ", "*")
    .replaceAll("÷", "/")
    .replaceAll("➕", "+")
    .replaceAll("➖", "-")
    .replaceAll("ns.exit(),", "")
    .split(",")[0];
  if (!/^[\d+\-*/().\s]+$/.test(clean)) return NaN;

  const tokens = clean.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let position = 0;
  const parseFactor = () => {
    const token = tokens[position++];
    if (token === "(") {
      const value = parseExpression();
      if (tokens[position++] !== ")") return NaN;
      return value;
    }
    if (token === "-") return -parseFactor();
    return Number(token);
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const right = parseFactor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const parseExpression = () => {
    let value = parseTerm();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = parseExpression();
  return position === tokens.length ? result : NaN;
}

function decodeBinary(data) {
  const bytes = String(data).trim().split(/\s+/);
  if (!bytes.every((byte) => /^[01]{8}$/.test(byte))) return "";
  return bytes.map((byte) => String.fromCharCode(Number.parseInt(byte, 2))).join("");
}

function decodeXor(data) {
  const separator = String(data).indexOf(";");
  if (separator < 0) return "";
  const encoded = String(data).slice(0, separator);
  const masks = String(data).slice(separator + 1).trim().split(/\s+/);
  if (masks.length !== encoded.length) return "";
  return [...encoded].map((character, index) =>
    String.fromCharCode(character.charCodeAt(0) ^ Number.parseInt(masks[index], 2)),
  ).join("");
}

function matchesDetails(value, details) {
  if (typeof value !== "string" || value.length !== Number(details.passwordLength)) return false;
  if (details.passwordFormat === "numeric") return /^\d+$/.test(value) || value === "";
  if (details.passwordFormat === "alphabetic") return /^[A-Za-z]+$/.test(value);
  if (details.passwordFormat === "alphanumeric") return /^[A-Za-z0-9]+$/.test(value);
  return true;
}

const COMMON_PASSWORDS = [
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234",
  "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football",
  "monkey", "letmein", "696969", "shadow", "master", "666666", "qwertyuiop",
  "123321", "mustang", "1234567890", "michael", "654321", "superman",
  "1qaz2wsx", "7777777", "121212", "0", "qazwsx", "123qwe", "trustno1",
  "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster", "soccer",
  "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "2000",
  "charlie", "robert", "thomas", "hockey", "ranger", "daniel", "starwars",
  "112233", "george", "computer", "michelle", "jessica", "pepper", "1111",
  "zxcvbn", "555555", "11111111", "131313", "freedom", "777777", "pass",
  "maggie", "159753", "aaaaaa", "ginger", "princess", "joshua", "cheese",
  "amanda", "summer", "love", "ashley", "6969", "nicole", "chelsea", "biteme",
  "matthew", "access", "yankees", "987654321", "dallas", "austin", "thunder",
  "taylor", "matrix",
];

const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Republic of Cyprus",
  "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany",
  "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
  "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
  "Slovenia", "Spain", "Sweden",
];

export function darknetCharacterSet(format) {
  if (format === "numeric") return "0123456789";
  if (format === "alphabetic") return "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
}

export function permuteUnique(value) {
  if (value.length < 2) return [value];
  const output = [];
  for (const character of new Set(value)) {
    const index = value.indexOf(character);
    const remaining = value.slice(0, index) + value.slice(index + 1);
    for (const suffix of permuteUnique(remaining)) output.push(character + suffix);
  }
  return output;
}

function stringsFrom(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    try {
      const parsed = JSON.parse(value);
      stringsFrom(parsed, output);
    } catch {
      // Plain log line.
    }
  } else if (Array.isArray(value)) {
    for (const item of value) stringsFrom(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) stringsFrom(item, output);
  }
  return output;
}

function objectsFrom(value, output = []) {
  if (typeof value === "string") {
    try {
      objectsFrom(JSON.parse(value), output);
    } catch {
      // Plain log line.
    }
  } else if (Array.isArray(value)) {
    for (const item of value) objectsFrom(item, output);
  } else if (value && typeof value === "object") {
    output.push(value);
    for (const item of Object.values(value)) objectsFrom(item, output);
  }
  return output;
}

const DARKNET_INTEL_FORMAT = 1;
const DARKNET_INTEL_TTL_MS = 6 * 60 * 60_000;
const DARKNET_INTEL_MAX_CREDENTIALS = 256;
const DARKNET_INTEL_MAX_CANDIDATES = 128;
const DARKNET_INTEL_MAX_HINTS = 256;

function cleanIntelValue(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function recentIntelRecord(record, now) {
  const seenAt = Number(record?.seenAt);
  return Number.isFinite(seenAt) && seenAt <= now + 60_000 && now - seenAt <= DARKNET_INTEL_TTL_MS;
}

function newestUnique(records, key, maximum) {
  const unique = new Map();
  for (const record of [...records].sort((left, right) => Number(right.seenAt) - Number(left.seenAt))) {
    const recordKey = key(record);
    if (recordKey && !unique.has(recordKey)) unique.set(recordKey, record);
  }
  return [...unique.values()].slice(0, maximum);
}

export function normalizeDarknetIntel(raw, now = Date.now()) {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== "object") parsed = {};

  const credentials = (Array.isArray(parsed.credentials) ? parsed.credentials : [])
    .filter((record) => recentIntelRecord(record, now))
    .map((record) => ({
      host: cleanIntelValue(record.host),
      password: cleanIntelValue(record.password),
      sourceHost: cleanIntelValue(record.sourceHost),
      seenAt: Number(record.seenAt),
    }))
    .filter((record) => record.host && record.password);
  const candidates = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
    .filter((record) => recentIntelRecord(record, now))
    .map((record) => ({
      password: cleanIntelValue(record.password),
      kind: record.kind === "common" ? "common" : "neighbor",
      sourceHost: cleanIntelValue(record.sourceHost),
      seenAt: Number(record.seenAt),
    }))
    .filter((record) => record.password);
  const hints = (Array.isArray(parsed.hints) ? parsed.hints : [])
    .filter((record) => recentIntelRecord(record, now))
    .map((record) => ({
      host: cleanIntelValue(record.host),
      characters: [...new Set((Array.isArray(record.characters) ? record.characters : [])
        .map(cleanIntelValue)
        .filter(Boolean))],
      sourceHost: cleanIntelValue(record.sourceHost),
      seenAt: Number(record.seenAt),
    }))
    .filter((record) => record.host && record.characters.length > 0);

  return {
    format: DARKNET_INTEL_FORMAT,
    updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : now,
    credentials: newestUnique(
      credentials,
      (record) => `${record.host}\u0000${record.password}`,
      DARKNET_INTEL_MAX_CREDENTIALS,
    ),
    candidates: newestUnique(
      candidates,
      (record) => `${record.kind}\u0000${record.sourceHost}\u0000${record.password}`,
      DARKNET_INTEL_MAX_CANDIDATES,
    ),
    hints: newestUnique(
      hints,
      (record) => `${record.host}\u0000${record.characters.slice().sort().join("")}`,
      DARKNET_INTEL_MAX_HINTS,
    ),
  };
}

export function extractDarknetIntel(payloads, sourceHost = "", seenAt = Date.now()) {
  const credentials = [];
  const candidates = [];
  const hints = [];
  const source = cleanIntelValue(sourceHost);
  const addCredential = (host, password) => {
    const cleanHost = cleanIntelValue(host);
    const cleanPassword = cleanIntelValue(password);
    if (cleanHost && cleanPassword) credentials.push({
      host: cleanHost,
      password: cleanPassword,
      sourceHost: source,
      seenAt,
    });
  };
  const addCandidate = (password, kind) => {
    const cleanPassword = cleanIntelValue(password);
    if (cleanPassword) candidates.push({
      password: cleanPassword,
      kind,
      sourceHost: source,
      seenAt,
    });
  };

  for (const object of objectsFrom(payloads)) {
    const host = object.hostname ?? object.host ?? object.server;
    const password = object.password ?? object.credential;
    if (typeof host === "string" && typeof password === "string") addCredential(host, password);
  }

  for (const line of stringsFrom(payloads)) {
    for (const match of line.matchAll(/Server:\s*(.+?)\s+Password:\s*["']([^"']+)["']/gi)) {
      addCredential(match[1], match[2]);
    }
    for (const match of line.matchAll(/Connecting to\s+(.+):([A-Za-z0-9]+)\s+\.\.\./gi)) {
      addCredential(match[1], match[2]);
    }
    for (const match of line.matchAll(/Some common passwords include\s+([^\r\n]+)/gi)) {
      for (const password of match[1].split(",")) addCandidate(password, "common");
    }
    for (const match of line.matchAll(/Remember this password:\s*([^\s,;]+)/gi)) {
      addCandidate(match[1], "neighbor");
    }
    for (const match of line.matchAll(/The password for\s+(.+?)\s+contains\s+(\S)\s+and\s+(\S)/gi)) {
      hints.push({
        host: cleanIntelValue(match[1]),
        characters: [cleanIntelValue(match[2]), cleanIntelValue(match[3])].filter(Boolean),
        sourceHost: source,
        seenAt,
      });
    }
  }

  return normalizeDarknetIntel({ credentials, candidates, hints, updatedAt: seenAt }, seenAt);
}

export function mergeDarknetIntel(raw, payloads = [], sourceHost = "", now = Date.now()) {
  const current = normalizeDarknetIntel(raw, now);
  const discovered = extractDarknetIntel(payloads, sourceHost, now);
  return normalizeDarknetIntel({
    updatedAt: now,
    credentials: [...current.credentials, ...discovered.credentials],
    candidates: [...current.candidates, ...discovered.candidates],
    hints: [...current.hints, ...discovered.hints],
  }, now);
}

export function getSharedDarknetCandidates(raw, hostname, details, currentHost = "", now = Date.now()) {
  const intel = normalizeDarknetIntel(raw, now);
  const host = String(hostname);
  const requiredCharacters = new Set(
    intel.hints.filter((hint) => hint.host === host).flatMap((hint) => hint.characters),
  );
  const exact = intel.credentials
    .filter((record) => record.host === host)
    .map((record) => record.password);
  const contextual = intel.candidates
    .filter((record) =>
      (record.kind === "common" && String(details.modelId) === "TopPass") ||
      (record.kind === "neighbor" && record.sourceHost === String(currentHost)),
    )
    .map((record) => record.password)
    .filter((password) => [...requiredCharacters].every((character) => password.includes(character)));
  return [...new Set([...exact, ...contextual].filter((value) => matchesDetails(value, details)))];
}

export function exchangeDarknetIntel(ns, portNumber, payloads = [], sourceHost = "", now = Date.now()) {
  const port = ns.getPortHandle(portNumber);
  let previous = {};
  while (!port.empty()) previous = port.read();
  const merged = mergeDarknetIntel(previous, payloads, sourceHost, now);
  ns.tryWritePort(portNumber, JSON.stringify(merged));
  return merged;
}

export function findDarknetFeedback(logs, attemptedPassword) {
  return objectsFrom(logs).find(
    (entry) => String(entry.passwordAttempted ?? "") === String(attemptedPassword),
  ) ?? null;
}

export function parseRomanRange(data, passwordLength) {
  const [minimum, maximum] = String(data).split(",");
  const low = Number.isFinite(romanToNumber(minimum)) ? romanToNumber(minimum) : 0;
  const fallbackHigh = 10 ** Math.max(1, Number(passwordLength) || 1) - 1;
  const high = Number.isFinite(romanToNumber(maximum)) ? romanToNumber(maximum) : fallbackHigh;
  return [Math.max(0, low), Math.max(low, high)];
}

export function passwordFromSortedRms(length, baselineRms, probeRmsValues) {
  const baselineError = Number(baselineRms) ** 2 * length;
  const digits = probeRmsValues.map((rms) => {
    const probeError = Number(rms) ** 2 * length;
    return Math.round((baselineError + 1 - probeError) / 2);
  });
  if (digits.some((digit) => digit < 0 || digit > 9 || !Number.isFinite(digit))) return "";
  return digits.join("");
}

export function combinePrimeRemainders(pairs) {
  let value = 0;
  let modulus = 1;
  for (const [nextModulus, nextRemainder] of pairs) {
    let candidate = value;
    while (candidate % nextModulus !== nextRemainder) candidate += modulus;
    value = candidate;
    modulus *= nextModulus;
  }
  return value;
}

export function commonFixedLengthSubstring(values, length) {
  const strings = values.filter((value) => typeof value === "string" && value.length >= length);
  if (strings.length < 2 || length < 1) return "";
  const first = strings[0];
  for (let index = 0; index <= first.length - length; index += 1) {
    const candidate = first.slice(index, index + length);
    if (strings.slice(1).every((value) => value.includes(candidate))) return candidate;
  }
  return "";
}

export function extractLogCandidates(logs, hostname, details) {
  const candidates = [];
  const escapedHost = String(hostname).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escapedHost}:([^\\s,;]+)`, "gi"),
    /pass(?:word|code)\s*[:=]\s*["']?([^\s"',;]+)/gi,
    /--([A-Za-z0-9]+)--/g,
  ];
  for (const line of stringsFrom(logs)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) candidates.push(match[1]);
    }
  }
  return [...new Set(candidates.filter((value) => matchesDetails(value, details)))];
}

export function getDarknetCandidates(details, logs = [], hostname = "") {
  const model = String(details.modelId ?? "");
  const data = String(details.data ?? "");
  const hint = String(details.passwordHint ?? "");
  const candidates = [];

  if (model === "ZeroLogon") candidates.push("");
  if (model === "DeskMemo_3.1") {
    const match = hint.match(/([A-Za-z0-9]+)\s*$/);
    if (match) candidates.push(match[1]);
  }
  if (model === "FreshInstall_1.0") {
    candidates.push("admin", "password", "0000", "12345");
  }
  if (model === "Laika4") candidates.push("fido", "spot", "rover", "max");
  if (model === "TopPass") candidates.push(...COMMON_PASSWORDS);
  if (model === "EuroZone Free") candidates.push(...EU_COUNTRIES);
  if (model === "PHP 5.4" && data.length < 5) candidates.push(...permuteUnique(data));
  if (model === "CloudBlare(tm)") candidates.push(data.replace(/\D/g, ""));
  if (model === "Pr0verFl0") candidates.push("■".repeat(Number(details.passwordLength) * 2));
  if (model === "110100100") candidates.push(decodeBinary(data));
  if (model === "OrdoXenos") candidates.push(decodeXor(data));
  if (model === "PrimeTime 2") candidates.push(String(largestPrimeFactor(data)));
  if (model === "BellaCuore" && data && !data.includes(",")) candidates.push(String(romanToNumber(data)));
  if (model === "OctantVoxel") {
    const [base, encoded] = data.split(",");
    candidates.push(String(baseToDecimal(encoded, Number(base))));
  }
  if (model === "MathML") candidates.push(String(evaluateDarknetExpression(data)));

  candidates.push(...extractLogCandidates(logs, hostname, details));
  return [...new Set(candidates.filter((value) => matchesDetails(value, details)))];
}

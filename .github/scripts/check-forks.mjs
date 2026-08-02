import { pathToFileURL } from "node:url";

const UPSTREAM = process.env.GITHUB_REPOSITORY || "ame824/autoDoIt";
const API_URL = process.env.GITHUB_API_URL || "https://api.github.com";
const TOKEN = process.env.GITHUB_TOKEN || "";
const ISSUE_TITLE = "[Fork monitor] Attribution review required";
const ALLOWED_CONFIG_PATHS = new Set(["core/config.js"]);
const UPLOAD_SIGNATURE_PATHS = new Set([
  "autoDoIt.js",
  "runtime-manifest.txt",
  "core/capabilities.js",
  "core/status.js",
  "lib/scheduler-mode.js",
  "special/manage-casino.js",
  "special/manage-darknet.js",
  "tasks/manage-progression.js",
  "ui/dashboard.js",
  "workers/darknet-crawler.js",
]);

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function classifyFork({ fullName, readme = "", aheadBy = 0, changedFiles = [] }) {
  const missing = [];
  if (!/©\s*ame824|copyright\s*(?:©|\(c\))?\s*ame824/i.test(readme)) {
    missing.push("copyright notice");
  }
  if (!/github\.com\/ame824\/autoDoIt/i.test(readme)) {
    missing.push("upstream link");
  }
  if (missing.length > 0) {
    return {
      fullName,
      scope: "fork",
      status: "violation",
      reason: `README is missing: ${missing.join(", ")}`,
      changedFiles,
    };
  }

  const changed = [...new Set(changedFiles)].filter(Boolean);
  const nonConfigChanges = changed.filter((file) => !ALLOWED_CONFIG_PATHS.has(file));
  if (Number(aheadBy) > 0 && nonConfigChanges.length > 0) {
    return {
      fullName,
      scope: "fork",
      status: "review",
      reason: `non-configuration changes: ${nonConfigChanges.join(", ")}`,
      changedFiles: changed,
    };
  }
  if (Number(aheadBy) > 0) {
    return {
      fullName,
      scope: "fork",
      status: "allowed",
      reason: "configuration-only fork with intact attribution",
      changedFiles: changed,
    };
  }
  return {
    fullName,
    scope: "fork",
    status: "allowed",
    reason: "unmodified fork with intact attribution",
    changedFiles: changed,
  };
}

export function classifyStandaloneUpload({
  fullName,
  fork = false,
  archived = false,
  matchingPaths = [],
  exactMatches = [],
}) {
  if (fork || archived) {
    return {
      fullName,
      scope: "watched account",
      status: "allowed",
      reason: fork ? "repository remains a GitHub fork" : "archived repository ignored",
      changedFiles: [],
    };
  }

  const paths = [...new Set(matchingPaths)].filter((path) => UPLOAD_SIGNATURE_PATHS.has(path));
  const exact = [...new Set(exactMatches)].filter((path) => paths.includes(path));
  if (exact.length >= 3) {
    return {
      fullName,
      scope: "standalone upload",
      status: "review",
      reason: `standalone repository contains ${exact.length} exact autoDoIt file fingerprints: ${exact.join(", ")}`,
      changedFiles: paths,
    };
  }
  if (paths.length >= 5) {
    return {
      fullName,
      scope: "standalone upload",
      status: "review",
      reason: `standalone repository mirrors ${paths.length} characteristic autoDoIt paths; ${exact.length} are exact matches`,
      changedFiles: paths,
    };
  }
  return {
    fullName,
    scope: "watched account",
    status: "allowed",
    reason: "no substantial autoDoIt fingerprint detected",
    changedFiles: paths,
  };
}

export function buildIssueBody(results, checkedAt = new Date().toISOString()) {
  const findings = results.filter(({ status }) => status !== "allowed");
  const lines = [
    "The scheduled autoDoIt fork monitor found repositories that need a human review.",
    "",
    `Checked: ${checkedAt}`,
    "",
    "| Repository | Scope | Classification | Reason |",
    "| --- | --- | --- | --- |",
    ...findings.map(({ fullName, scope = "fork", status, reason }) =>
      `| [${escapeMarkdown(fullName)}](https://github.com/${encodeURI(fullName)}) | ${escapeMarkdown(scope)} | ${status} | ${escapeMarkdown(reason)} |`),
    "",
    "`violation` means required attribution was not detected in a fork. `review` means either that a fork extends beyond the allowed configuration file or that a watched public account has a standalone repository with substantial autoDoIt fingerprints. Review before contacting or reporting anyone, and verify all evidence manually.",
    "",
    "This issue is maintained automatically by `.github/scripts/check-forks.mjs`.",
  ];
  return lines.join("\n");
}

async function github(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (response.status === 404 && options.allowMissing) return null;
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  if (response.status === 204) return null;
  return response.json();
}

async function listDirectForks(repository) {
  const forks = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(`/repos/${repository}/forks?sort=newest&per_page=100&page=${page}`);
    forks.push(...batch);
    if (batch.length < 100) break;
  }
  return forks;
}

async function collectForkNetwork() {
  const queue = [UPSTREAM];
  const visitedRepositories = new Set([UPSTREAM.toLowerCase()]);
  const forks = new Map();
  while (queue.length > 0 && forks.size < 500) {
    const repository = queue.shift();
    for (const fork of await listDirectForks(repository)) {
      const key = String(fork.full_name).toLowerCase();
      if (visitedRepositories.has(key)) continue;
      visitedRepositories.add(key);
      forks.set(key, fork);
      queue.push(fork.full_name);
    }
  }
  return [...forks.values()];
}

function watchedAccounts() {
  return [...new Set(String(process.env.WATCHED_ACCOUNTS ?? "")
    .split(",")
    .map((account) => account.trim())
    .filter(Boolean))];
}

async function listPublicRepositories(account) {
  const repositories = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(`/users/${encodeURIComponent(account)}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

async function readTree(repository, branch) {
  const tree = await github(
    `/repos/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { allowMissing: true },
  );
  return (tree?.tree ?? []).filter(({ type }) => type === "blob");
}

async function loadUpstreamSignatures() {
  const tree = await readTree(UPSTREAM, "main");
  return new Map(tree
    .filter(({ path }) => UPLOAD_SIGNATURE_PATHS.has(path))
    .map(({ path, sha }) => [path, sha]));
}

async function inspectWatchedAccounts(knownForks) {
  const accounts = watchedAccounts();
  if (accounts.length === 0) return [];
  const upstreamSignatures = await loadUpstreamSignatures();
  const results = [];
  for (const account of accounts) {
    for (const repository of await listPublicRepositories(account)) {
      const key = String(repository.full_name).toLowerCase();
      if (key === UPSTREAM.toLowerCase() || knownForks.has(key) || repository.fork) continue;
      const tree = await readTree(repository.full_name, repository.default_branch);
      const candidateFiles = new Map(tree.map(({ path, sha }) => [path, sha]));
      const matchingPaths = [...UPLOAD_SIGNATURE_PATHS].filter((path) => candidateFiles.has(path));
      const exactMatches = matchingPaths.filter((path) =>
        upstreamSignatures.get(path) === candidateFiles.get(path));
      results.push(classifyStandaloneUpload({
        fullName: repository.full_name,
        archived: repository.archived,
        matchingPaths,
        exactMatches,
      }));
    }
  }
  return results;
}

async function readReadme(repository) {
  const data = await github(`/repos/${repository}/readme`, { allowMissing: true });
  if (!data?.content) return "";
  return Buffer.from(String(data.content).replaceAll("\n", ""), "base64").toString("utf8");
}

async function compareFork(fork) {
  const upstreamBranch = "main";
  const head = encodeURIComponent(`${fork.owner.login}:${fork.default_branch}`);
  const comparison = await github(
    `/repos/${UPSTREAM}/compare/${encodeURIComponent(upstreamBranch)}...${head}`,
    { allowMissing: true },
  );
  return {
    aheadBy: Number(comparison?.ahead_by ?? 0),
    changedFiles: (comparison?.files ?? []).map(({ filename }) => filename),
  };
}

async function findMonitorIssue() {
  const issues = await github(`/repos/${UPSTREAM}/issues?state=all&per_page=100`);
  return issues.find(({ pull_request: pullRequest, title }) => !pullRequest && title === ISSUE_TITLE) ?? null;
}

async function synchronizeIssue(results) {
  const findings = results.filter(({ status }) => status !== "allowed");
  const existing = await findMonitorIssue();
  if (findings.length === 0) {
    if (existing?.state === "open") {
      await github(`/repos/${UPSTREAM}/issues/${existing.number}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      });
    }
    return;
  }

  const body = buildIssueBody(results);
  if (existing) {
    await github(`/repos/${UPSTREAM}/issues/${existing.number}`, {
      method: "PATCH",
      body: JSON.stringify({ body, state: "open" }),
    });
  } else {
    await github(`/repos/${UPSTREAM}/issues`, {
      method: "POST",
      body: JSON.stringify({ title: ISSUE_TITLE, body }),
    });
  }
}

export async function runForkMonitor() {
  const forks = await collectForkNetwork();
  const knownForks = new Set(forks.map(({ full_name: fullName }) => String(fullName).toLowerCase()));
  const results = [];
  for (const fork of forks) {
    const [readme, comparison] = await Promise.all([
      readReadme(fork.full_name),
      compareFork(fork),
    ]);
    results.push(classifyFork({
      fullName: fork.full_name,
      readme,
      ...comparison,
    }));
  }
  results.push(...await inspectWatchedAccounts(knownForks));
  await synchronizeIssue(results);
  for (const result of results) {
    console.log(`${result.status.toUpperCase()} ${result.fullName}: ${result.reason}`);
  }
  return results;
}

const executedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executedDirectly) {
  runForkMonitor().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

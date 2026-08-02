import test from "node:test";
import assert from "node:assert/strict";
import { buildIssueBody, classifyFork } from "../.github/scripts/check-forks.mjs";

const attributedReadme = `
# autoDoIt config fork

Fork of https://github.com/ame824/autoDoIt

© ame824 · grz-gamerz.de
`;

test("fork monitor accepts unmodified and configuration-only forks", () => {
  assert.equal(classifyFork({
    fullName: "user/autoDoIt",
    readme: attributedReadme,
    aheadBy: 0,
    changedFiles: [],
  }).status, "allowed");

  const configured = classifyFork({
    fullName: "user/autoDoIt",
    readme: attributedReadme,
    aheadBy: 2,
    changedFiles: ["core/config.js"],
  });
  assert.equal(configured.status, "allowed");
  assert.match(configured.reason, /configuration-only/);
});

test("fork monitor flags missing attribution and reviews non-config changes", () => {
  const violation = classifyFork({
    fullName: "user/rebranded",
    readme: "I made this project",
    aheadBy: 1,
    changedFiles: ["autoDoIt.js"],
  });
  assert.equal(violation.status, "violation");
  assert.match(violation.reason, /copyright notice/);
  assert.match(violation.reason, /upstream link/);

  const review = classifyFork({
    fullName: "user/experimental",
    readme: attributedReadme,
    aheadBy: 1,
    changedFiles: ["tasks/manage-hacking.js"],
  });
  assert.equal(review.status, "review");
});

test("monitor issue body avoids accusations and links the reviewed forks", () => {
  const body = buildIssueBody([
    { fullName: "user/rebranded", status: "violation", reason: "README is missing: upstream link" },
    { fullName: "user/config", status: "allowed", reason: "configuration-only fork" },
  ], "2026-08-02T20:00:00.000Z");
  assert.match(body, /user\/rebranded/);
  assert.doesNotMatch(body, /user\/config/);
  assert.match(body, /Review before contacting or reporting anyone/);
});

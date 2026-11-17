import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");
const config = readFileSync(new URL("../dist/config.js", import.meta.url), "utf8");

test("is wired to Quest 19176 and Pollinations BYOP", () => {
  assert.match(html, /Quest #19176/);
  assert.match(html, /<polli-connect/);
  assert.match(html, /budget="2\.5"/);
  assert.match(html, /vllm-sr\/d3/);
});

test("uses the native typed decision endpoint with three free models", () => {
  assert.match(js, /alpha\/decisions/);
  assert.match(js, /microsoft\/microsoft-decision-1/);
  assert.match(js, /vllm-sr\/d3/);
  assert.match(js, /respan\/span-01-lite/);
  assert.match(js, /Promise\.all\(MODELS\.map/);
});

test("computes transparent consensus and calibration scores", () => {
  assert.match(js, /consensusFor/);
  assert.match(js, /scoreVotes/);
  assert.match(js, /1 - \(\(p - target\) \*\* 2\)/);
  assert.match(html, /Brier-style score/);
});

test("includes a zero-Pollen demo and trusted-click spending guard", () => {
  assert.match(html, /ZERO-POLLEN DEMO ROUND/);
  assert.match(js, /event\.isTrusted/);
  assert.match(js, /if \(!demo && !trusted\) return/);
});

test("does not ship a secret key", () => {
  assert.doesNotMatch(config, /sk_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(js, /localStorage/);
  assert.match(html, /temporary key/);
});

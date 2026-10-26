/**
 * Unit checks for pure logic (verify.ts, grounding.ts parse).
 * Run: npm test  (tsx src/unit.test.ts). No network, no keys.
 * Exits non-zero on any failure.
 */
import assert from "node:assert/strict";
import {
  normalize,
  longestPhraseRun,
  numbersIn,
  mechanicalCheck,
  composeVerdict,
} from "./verify.js";
import { parseGroundingResponse } from "./grounding.js";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

// normalize
check("normalize lowercases and strips punctuation", () => {
  assert.equal(normalize("Hello,  World! (v5.0)"), "hello world v5.0");
});

// phrase match: true quote
check("phrase run finds a true quote", () => {
  const run = longestPhraseRun(
    "React Query is described as powerful asynchronous state management for React",
    "TanStack Query: Powerful asynchronous state management for TS/JS, React, Solid, Vue and Angular.",
  );
  assert.ok(run >= 5, `expected run >= 5, got ${run}`);
});

// phrase match: stale claim must NOT match
check("phrase run rejects an unrelated stale claim", () => {
  const run = longestPhraseRun(
    "SWR was discontinued in 2019 and has no releases since",
    "SWR is a React Hooks library for data fetching, maintained by Vercel.",
  );
  assert.ok(run < 5, `expected run < 5, got ${run}`);
});

// numbers
check("numbersIn extracts comma numbers and percents", () => {
  assert.deepEqual(numbersIn("50,000 stars, up 12.5%"), ["50000", "12.5%"]);
});

// mechanical: phrase hit (a genuine 5+ word quote)
check("mechanicalCheck verifies a true quote", () => {
  const m = mechanicalCheck(
    "TanStack Query provides powerful asynchronous state management for TS/JS",
    ["TanStack Query: Powerful asynchronous state management for TS/JS, React, Solid, Vue."],
  );
  assert.equal(m.matched, true);
});

// mechanical: figure hit via entity facts
check("mechanicalCheck verifies a star count against facts", () => {
  const m = mechanicalCheck(
    "TanStack/query has 50482 stars on GitHub",
    ["TanStack/query (GitHub)"],
    "TanStack/query stars 50482 health 90",
  );
  assert.equal(m.matched, true);
});

// mechanical: stale figure must NOT match
check("mechanicalCheck rejects a stale figure", () => {
  const m = mechanicalCheck(
    "SWR has 99999999 stars on GitHub",
    ["vercel/swr (GitHub) · 32000 stars"],
    "vercel/swr stars 32000",
  );
  assert.equal(m.matched, false);
});

// mechanical: empty excerpts
check("mechanicalCheck with no excerpts does not match", () => {
  const m = mechanicalCheck("Anything at all here", []);
  assert.equal(m.matched, false);
});

// verdict composition
check("composeVerdict needs both stages for verified", () => {
  const ok = composeVerdict({ matched: true, excerpt: "x", reason: "q" }, true);
  assert.equal(ok.verdict, "verified");
  assert.equal(composeVerdict({ matched: true, excerpt: "x", reason: "q" }, false).verdict, "needs-review");
  assert.equal(composeVerdict({ matched: false, excerpt: null, reason: "n" }, true).verdict, "needs-review");
  assert.equal(composeVerdict({ matched: true, excerpt: "x", reason: "q" }, null).verdict, "needs-review");
  assert.match(composeVerdict({ matched: true, excerpt: "x", reason: "q" }, null).reason, /judge unavailable/);
});

// grounding parse: citations + dedupe + title fallback
check("parseGroundingResponse collects url_citations, dedupes, falls back to domain", () => {
  const payload = {
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "TanStack Query is v5.105.0.",
            annotations: [
              { type: "url_citation", url: "https://example.com/docs", title: "Docs" },
              { type: "url_citation", url: "https://example.com/docs", title: "Docs" },
              { type: "url_citation", url: "https://registry.npmjs.org/x", title: "{\"dist\":{}}" },
            ],
          },
        ],
      },
    ],
  };
  const r = parseGroundingResponse(payload);
  assert.equal(r.summary, "TanStack Query is v5.105.0.");
  assert.equal(r.hits.length, 2);
  assert.equal(r.hits[0].title, "Docs");
  assert.equal(r.hits[1].title, "registry.npmjs.org");
});

// grounding parse: no citations
check("parseGroundingResponse with no citations returns empty hits", () => {
  const r = parseGroundingResponse({ output: [{ type: "message", content: [{ type: "output_text", text: "hi" }] }] });
  assert.equal(r.hits.length, 0);
  assert.equal(r.summary, "hi");
});

// grounding parse: punctuation-only title falls back to domain
check("parseGroundingResponse falls back to domain for a punctuation-only title", () => {
  const r = parseGroundingResponse({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "SWR docs.",
            annotations: [{ type: "url_citation", url: "https://swr.vercel.app/", title: "---" }],
          },
        ],
      },
    ],
  });
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].title, "swr.vercel.app");
});

console.log(`\n${passed} unit checks passed`);

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
  judgeClaims,
  verifyClaims,
  JUDGE_MAX_TOKENS,
} from "./verify.js";
import { SYNTHESIS_MAX_TOKENS } from "./research.js";
import { parseGroundingResponse } from "./grounding.js";

let passed = 0;
const pending: Promise<void>[] = [];
function check(name: string, fn: () => unknown) {
  const r = fn();
  if (r instanceof Promise) {
    pending.push(
      r.then(() => {
        passed++;
        console.log(`ok - ${name}`);
      }),
    );
  } else {
    passed++;
    console.log(`ok - ${name}`);
  }
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

// QA S3 C1 regression: caps must stay far above reasoning usage.
check("judge + synthesis caps are >= 8000 (QA S3 C1)", () => {
  assert.ok(JUDGE_MAX_TOKENS >= 8000, `judge cap ${JUDGE_MAX_TOKENS}`);
  assert.ok(SYNTHESIS_MAX_TOKENS >= 8000, `synthesis cap ${SYNTHESIS_MAX_TOKENS}`);
});

// QA S3 m4: facts match has no single verifying excerpt.
check("mechanicalCheck facts match returns no excerpt (QA S3 m4)", () => {
  const m = mechanicalCheck(
    "TanStack/query has 50482 stars on GitHub",
    ["TanStack/query (GitHub)"],
    "TanStack/query stars 50482 health 90",
  );
  assert.equal(m.matched, true);
  assert.equal(m.excerpt, null);
});

// QA S3 m5: multi-message grounding preserves all message text.
check("parseGroundingResponse preserves all message texts (QA S3 m5)", () => {
  const r = parseGroundingResponse({
    output: [
      { type: "message", content: [{ type: "output_text", text: "First part.", annotations: [] }] },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Second part.",
            annotations: [{ type: "url_citation", url: "https://example.com/", title: "Ex" }],
          },
        ],
      },
    ],
  });
  assert.match(r.summary, /First part\./);
  assert.match(r.summary, /Second part\./);
  assert.equal(r.hits.length, 1);
});

// QA S3 C1 regression: judge path over a multi-claim input via a stub
// LLM (no network). Proves the batched judge mapping works; the cap
// pin above guards the truncation failure mode.
check("judgeClaims maps a multi-claim batch via stub LLM", async () => {
  const stub = {
    provider: "test",
    model: "test",
    completeJSON: async () => ({
      verdicts: [
        { index: 0, supported: true, reason: "stated" },
        { index: 1, supported: false, reason: "not stated" },
        { index: 2, supported: true, reason: "stated" },
      ],
    }),
    ground: async () => {
      throw new Error("unused");
    },
  };
  const map = await judgeClaims(
    stub as never,
    [
      { text: "c0", sourceIds: ["s1"] },
      { text: "c1", sourceIds: ["s1"] },
      { text: "c2", sourceIds: ["s1"] },
    ],
    [{ id: "s1", excerpt: "some excerpt text here" }],
  );
  assert.ok(map !== null);
  assert.equal(map.get(0)?.supported, true);
  assert.equal(map.get(1)?.supported, false);
  assert.equal(map.get(2)?.supported, true);
});

// QA S3 m4 end-to-end: a facts-verified claim must NOT display an
// unrelated excerpt as evidence.
check("verifyClaims facts-verified claim has null excerpt (QA S3 m4)", async () => {
  const stub = {
    provider: "test",
    model: "test",
    completeJSON: async () => ({ verdicts: [{ index: 0, supported: true, reason: "figures match" }] }),
    ground: async () => {
      throw new Error("unused");
    },
  };
  const out = await verifyClaims(
    stub as never,
    [{ text: "TanStack/query has 50482 stars on GitHub", sourceIds: ["s1"] }],
    [{ id: "s1", excerpt: "TanStack/query (GitHub)" }],
    "TanStack/query stars 50482 health 90",
  );
  assert.equal(out[0].verdict, "verified");
  assert.equal(out[0].excerpt, null);
});

// QA S3 m4 residual: a facts match the judge REJECTS must also keep
// a null excerpt — previously verifyClaims substituted excerpts[0],
// so a rejected stars claim displayed an unrelated descriptive blurb
// as its "verifying excerpt". Verdict stays needs-review; only the
// misleading excerpt is gone.
check("verifyClaims judge-rejected facts match keeps null excerpt (QA S3 m4 residual)", async () => {
  const stub = {
    provider: "test",
    model: "test",
    completeJSON: async () => ({ verdicts: [{ index: 0, supported: false, reason: "not stated" }] }),
    ground: async () => {
      throw new Error("unused");
    },
  };
  const out = await verifyClaims(
    stub as never,
    [{ text: "TanStack/query has 50482 stars on GitHub", sourceIds: ["s1"] }],
    [{ id: "s1", excerpt: "TanStack Query is a data fetching library for web applications" }],
    "TanStack/query stars 50482 health 90",
  );
  assert.equal(out[0].verdict, "needs-review");
  assert.equal(out[0].excerpt, null);
});

// Retained behavior: a claim with NO mechanical match left on
// needs-review still shows the closest cited excerpt, so the reviewer
// can see what was checked. Only facts matches lose the substitution.
check("verifyClaims unmatched needs-review claim still shows closest excerpt", async () => {
  const stub = {
    provider: "test",
    model: "test",
    completeJSON: async () => ({ verdicts: [{ index: 0, supported: false, reason: "not stated" }] }),
    ground: async () => {
      throw new Error("unused");
    },
  };
  const out = await verifyClaims(
    stub as never,
    [{ text: "React Query supports offline caching strategies", sourceIds: ["s1"] }],
    [{ id: "s1", excerpt: "Something entirely unrelated about cooking" }],
    "",
  );
  assert.equal(out[0].verdict, "needs-review");
  assert.equal(out[0].excerpt, "Something entirely unrelated about cooking");
});

await Promise.all(pending);
console.log(`\n${passed} unit checks passed`);

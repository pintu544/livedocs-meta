/**
 * Slice 3 (T-5) — claim verification.
 *
 * Two stages, both required for Verified (DESIGN.md):
 *  1. Mechanical: a contiguous quote (≥5 normalized words) from the
 *     claim must appear in a cited source excerpt, OR every figure in
 *     the claim must appear in a cited excerpt / entity facts.
 *  2. Muse Spark judge: one batched structured-JSON call over all
 *     claims, judging each against its cited excerpts.
 * Anything else is "needs-review" with a reason — never "contradicted",
 * because a failed match may be paraphrase, not falsehood.
 *
 * Pure functions (normalize, phrase match, mechanical check, verdict
 * composition) are unit-tested in unit.test.ts. No provider error
 * bodies are ever surfaced (QA S5).
 */

import type { LLMClient } from "./llm.js";

export type Verdict = "verified" | "needs-review";

export interface ClaimInput {
  text: string;
  sourceIds: string[];
}

export interface SourceInput {
  id: string;
  excerpt: string | null;
}

export interface ClaimVerification {
  verdict: Verdict;
  excerpt: string | null;
  reason: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was", "were",
  "it", "its", "as", "by", "at", "from", "that", "this", "has", "have", "be", "been",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

function contentWords(text: string): string[] {
  return words(text).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Longest contiguous run of claim words appearing in the excerpt. */
export function longestPhraseRun(claim: string, excerpt: string): number {
  const c = words(claim);
  const e = words(excerpt);
  if (c.length === 0 || e.length === 0) return 0;
  const eJoined = ` ${e.join(" ")} `;
  let best = 0;
  for (let len = Math.min(c.length, 20); len >= 1; len--) {
    for (let i = 0; i + len <= c.length; i++) {
      if (eJoined.includes(` ${c.slice(i, i + len).join(" ")} `)) {
        best = Math.max(best, len);
        if (best >= 5) return best;
      }
    }
    if (best > 0) return best;
  }
  return best;
}

export function numbersIn(text: string): string[] {
  const found = text.match(/\d[\d,]*(\.\d+)?%?/g) ?? [];
  return found.map((n) => n.replace(/,/g, ""));
}

export interface MechanicalResult {
  matched: boolean;
  excerpt: string | null;
  reason: string;
}

/**
 * Strict mechanical check. Phrase hit: ≥5-word quote in an excerpt.
 * Fact hit: every figure in the claim appears in an excerpt or in the
 * entity-facts text, and the claim shares ≥2 content words with that
 * excerpt. Otherwise no match.
 */
export function mechanicalCheck(
  claim: string,
  excerpts: string[],
  factsText = "",
): MechanicalResult {
  for (const ex of excerpts) {
    if (longestPhraseRun(claim, ex) >= 5) {
      return { matched: true, excerpt: ex, reason: "Quote found in cited source" };
    }
  }
  const nums = numbersIn(claim);
  if (nums.length > 0) {
    const corpusNums = new Set(numbersIn([...excerpts, factsText].join("\n")));
    if (nums.every((n) => corpusNums.has(n))) {
      // A single excerpt is evidence ONLY if it contains every
      // figure itself (QA S3 m4): an excerpt that merely shares
      // words with the claim must never be displayed as if it
      // proved the figures.
      for (const ex of excerpts) {
        const exNums = new Set(numbersIn(ex));
        const shared = contentWords(claim).filter((w) => words(ex).includes(w));
        if (nums.every((n) => exNums.has(n)) && shared.length >= 2) {
          return { matched: true, excerpt: ex, reason: "Claim figures match cited source" };
        }
      }
      if (factsText) {
        const factsNums = new Set(numbersIn(factsText));
        const shared = contentWords(claim).filter((w) => words(factsText).includes(w));
        if (nums.every((n) => factsNums.has(n)) && shared.length >= 2) {
          return { matched: true, excerpt: null, reason: "Claim figures match repository data" };
        }
      }
      // Figures spread across excerpts: the claim matches, but no
      // single excerpt is evidence — show none rather than mislead.
      for (const ex of excerpts) {
        const shared = contentWords(claim).filter((w) => words(ex).includes(w));
        if (shared.length >= 2) {
          return { matched: true, excerpt: null, reason: "Claim figures match cited sources combined" };
        }
      }
    }
  }
  return { matched: false, excerpt: null, reason: "No matching quote or figure in cited sources" };
}

/** Verdict composition. Both stages must agree for Verified. */
export function composeVerdict(
  mechanical: MechanicalResult,
  judgeSupported: boolean | null,
  judgeReason?: string,
): ClaimVerification {
  if (mechanical.matched && judgeSupported === true) {
    return { verdict: "verified", excerpt: mechanical.excerpt, reason: mechanical.reason };
  }
  if (judgeSupported === null) {
    return {
      verdict: "needs-review",
      excerpt: mechanical.excerpt,
      reason: "Verification judge unavailable — mechanical match alone cannot verify",
    };
  }
  if (!mechanical.matched && judgeSupported === false) {
    return { verdict: "needs-review", excerpt: null, reason: `Neither quote-match nor judge supports this claim${judgeReason ? `: ${judgeReason}` : ""}` };
  }
  if (!mechanical.matched) {
    return { verdict: "needs-review", excerpt: null, reason: "No matching quote in cited sources (judge agreed, but quote-match is required)" };
  }
  return { verdict: "needs-review", excerpt: mechanical.excerpt, reason: `Judge did not support this claim${judgeReason ? `: ${judgeReason}` : ""}` };
}

/** Token cap (QA S3 C1, 2026-10-27): Muse Spark spends most of its
 * completion budget on reasoning (QA observed 1998/2000 reasoning
 * tokens on a judge call, which truncated the JSON answer and made
 * every claim needs-review). The cap must stay far above reasoning
 * usage; the unit tests pin it at >= 8000 so a future cut re-breaks
 * verification loudly instead of silently. */
export const JUDGE_MAX_TOKENS = 8000;

interface JudgeVerdict {
  index?: number;
  supported?: boolean;
  reason?: string;
}

/**
 * One batched judge call for all claims. Returns a map index →
 * { supported, reason }, or null if the judge call fails at all
 * (callers then mark everything needs-review, never verified).
 */
export async function judgeClaims(
  llm: LLMClient,
  claims: ClaimInput[],
  sources: SourceInput[],
): Promise<Map<number, { supported: boolean; reason: string }> | null> {
  if (claims.length === 0) return new Map();
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const block = claims
    .map((c, i) => {
      const excerpts = c.sourceIds
        .map((id) => sourceById.get(id))
        .filter((s): s is SourceInput => Boolean(s))
        .map((s) => `[${s.id}] ${(s.excerpt ?? "no excerpt").slice(0, 800)}`)
        .join("\n");
      return `Claim ${i}: ${c.text}\nCited excerpts:\n${excerpts || "(none)"}`;
    })
    .join("\n\n");
  try {
    const out = await llm.completeJSON<{ verdicts?: JudgeVerdict[] }>(
      `You judge whether each claim is supported by its cited excerpts. A claim is supported ONLY if the excerpts state it or directly imply it — never use outside knowledge. Return ONLY JSON: {"verdicts": [{"index": 0, "supported": true, "reason": "..."}]} with one verdict per claim index, in order.`,
      block,
      JUDGE_MAX_TOKENS,
    );
    const map = new Map<number, { supported: boolean; reason: string }>();
    for (const v of out.verdicts ?? []) {
      if (typeof v.index === "number" && v.index >= 0 && v.index < claims.length && typeof v.supported === "boolean") {
        map.set(v.index, { supported: v.supported, reason: typeof v.reason === "string" ? v.reason : "" });
      }
    }
    return map;
  } catch {
    return null;
  }
}

/** Full pipeline step: mechanical per claim + one batched judge call. */
export async function verifyClaims(
  llm: LLMClient,
  claims: ClaimInput[],
  sources: SourceInput[],
  factsText = "",
): Promise<ClaimVerification[]> {
  const judge = await judgeClaims(llm, claims, sources);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  return claims.map((c, i) => {
    const excerpts = c.sourceIds
      .map((id) => sourceById.get(id))
      .filter((s): s is SourceInput => Boolean(s))
      .map((s) => s.excerpt ?? "")
      .filter(Boolean);
    const mechanical = mechanicalCheck(c.text, excerpts, factsText);
    const j = judge?.get(i) ?? null;
    const v = composeVerdict(mechanical, j ? j.supported : null, j?.reason);
    // Show the closest cited excerpt when a claim is left on
    // needs-review, so the reviewer can see what was checked. Never
    // substitute an excerpt for a verified claim whose evidence is
    // repository data (QA S3 m4): a verified facts match has no
    // single verifying excerpt, and displaying excerpts[0] would
    // present unrelated text as evidence.
    if (!v.excerpt && v.verdict !== "verified" && excerpts.length > 0) v.excerpt = excerpts[0];
    return v;
  });
}

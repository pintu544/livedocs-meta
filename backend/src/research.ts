import { randomUUID } from "node:crypto";
import type { LLMClient } from "./llm.js";
import { planEntities } from "./plan.js";
import { enrichFromGitHub, type RepoStats } from "./github.js";
import { verifyClaims } from "./verify.js";

export interface Source {
  id: string;
  url: string;
  title: string;
  kind: "Repo" | "Docs" | "Release" | "Page";
  excerpt: string | null;
  /** True when this source came from Meta Responses web_search (M-2). */
  grounded?: boolean;
}

export interface Entity {
  name: string;
  repo: string | null;
  url: string | null;
  stars: number | null;
  lastRelease: string | null;
  healthScore: number;
  healthSignals: string[];
}

export interface Claim {
  text: string;
  sourceIds: string[];
  /** Slice 3 (T-5): verification badge, excerpt, and reason. */
  verdict?: "verified" | "needs-review";
  excerpt?: string | null;
  reason?: string;
}

export interface Report {
  id: string;
  query: string;
  method: "split" | "discovery" | "single";
  createdAt: string;
  entities: Entity[];
  sources: Source[];
  claims: Claim[];
  verdict: { winner: string; text: string };
  provider: { name: string; model: string };
}

/** Synthesis token cap (QA S3 C1, 2026-10-27): same reasoning-token
 * lesson as the judge cap — the 4000 cap survived a 2618-token
 * completion with thin margin. Pinned at >= 8000 by the unit tests. */
export const SYNTHESIS_MAX_TOKENS = 8000;

export type Emit = (event: string, data: unknown) => void;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / 86_400_000;
}

/** Deterministic health score from repo signals. The LLM never scores. */
export function healthScore(stats: RepoStats): { score: number; signals: string[] } {
  if (stats.archived) return { score: 10, signals: ["Repository is archived"] };
  const age = daysSince(stats.updatedAt);
  let score = age === null ? 40 : age <= 90 ? 100 : age <= 365 ? 60 : 30;
  const signals: string[] = [];
  if (age !== null) signals.push(age <= 90 ? "Active in the last 90 days" : `Last activity ${Math.round(age)} days ago`);
  if (stats.openIssues > 200) {
    score -= 20;
    signals.push(`${stats.openIssues} open issues`);
  }
  if (stats.latestRelease) signals.push(`Latest release ${stats.latestRelease.tag}`);
  return { score: Math.max(0, Math.min(100, Math.round(score))), signals };
}

/**
 * Grounding (M-2): GitHub stats + Meta Responses web_search citations.
 * There is NO fetch fallback: if grounding fails, the report keeps its
 * GitHub sources and notes the gap (FR-8 honest degradation). The
 * Slice 2 interim fetch adapter (README/homepage fetches) is deleted.
 */
async function groundEntity(
  entity: string,
  llm: LLMClient,
  emit: Emit,
  addSource: (s: Omit<Source, "id">) => Source | null,
): Promise<RepoStats | null> {
  const stats = await enrichFromGitHub(entity);
  if (!stats) {
    emit("progress", { stage: "research", detail: `No GitHub match for ${entity}; skipping repo sources.` });
    return null;
  }
  const repoExcerpt = [
    stats.description ?? "",
    `${stats.stars.toLocaleString()} stars`,
    stats.updatedAt ? `updated ${stats.updatedAt.slice(0, 10)}` : "",
    stats.archived ? "archived" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  addSource({ url: stats.htmlUrl, title: `${stats.fullName} (GitHub)`, kind: "Repo", excerpt: repoExcerpt || null });

  if (stats.latestRelease) {
    const body = stats.latestRelease.body ? stats.latestRelease.body.slice(0, 1000) : "";
    addSource({
      url: `${stats.htmlUrl}/releases/tag/${stats.latestRelease.tag}`,
      title: `${stats.fullName} ${stats.latestRelease.tag}`,
      kind: "Release",
      excerpt: body || `Release ${stats.latestRelease.tag}`,
    });
  }

  try {
    const grounded = await llm.ground(entity);
    emit("progress", { stage: "research", detail: `Grounded ${entity}: ${grounded.hits.length} web citations.` });
    for (const hit of grounded.hits) {
      addSource({ url: hit.url, title: hit.title, kind: "Page", excerpt: grounded.summary || hit.snippet, grounded: true });
    }
  } catch (err) {
    emit("progress", {
      stage: "research",
      detail: `Web grounding failed for ${entity} (${err instanceof Error ? err.message : "unknown"}); continuing with GitHub sources only.`,
    });
  }
  return stats;
}

export async function runResearch(query: string, llm: LLMClient, emit: Emit): Promise<Report> {
  const sources: Source[] = [];
  let counter = 0;
  const addSource = (s: Omit<Source, "id">): Source | null => {
    if (sources.length >= 20) return null;
    const src: Source = { ...s, id: `s${++counter}` };
    sources.push(src);
    emit("source", src);
    return src;
  };

  const plan = await planEntities(query, llm);
  emit("plan", plan);

  const entities: Entity[] = [];
  for (const name of plan.entities) {
    emit("progress", { stage: "research", detail: `Researching ${name}…` });
    const stats = await groundEntity(name, llm, emit, addSource);
    if (stats) {
      const health = healthScore(stats);
      entities.push({
        name,
        repo: stats.fullName,
        url: stats.htmlUrl,
        stars: stats.stars,
        lastRelease: stats.latestRelease?.tag ?? null,
        healthScore: health.score,
        healthSignals: health.signals,
      });
    } else {
      entities.push({ name, repo: null, url: null, stars: null, lastRelease: null, healthScore: 0, healthSignals: ["No GitHub data found"] });
    }
  }

  // Deterministic ranking: adoption (relative stars) 50% + health 50%.
  // The LLM writes wording only; it never reorders.
  const maxStars = Math.max(1, ...entities.map((e) => e.stars ?? 0));
  const ranked = entities
    .map((e) => ({
      e,
      adoption: e.stars === null ? 0 : (Math.log10(e.stars + 1) / Math.log10(maxStars + 1)) * 100,
    }))
    .map(({ e, adoption }) => ({ e, score: 0.5 * adoption + 0.5 * e.healthScore }))
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0]?.e.name ?? plan.entities[0] ?? query;
  const runnerUp = ranked[1]?.e.name ?? null;

  emit("progress", { stage: "synthesize", detail: "Writing the cited report…" });
  const sourceBlock = sources
    .map((s) => `[${s.id}] (${s.kind}) ${s.title} — ${s.url}\nExcerpt: ${(s.excerpt ?? "no excerpt fetched").slice(0, 1000)}${s.grounded ? " [grounded summary — Meta's summary of this page, not a page quote]" : ""}`)
    .join("\n\n");
  const entityBlock = entities
    .map(
      (e) =>
        `- ${e.name}: repo ${e.repo ?? "unknown"}, stars ${e.stars ?? "unknown"}, health ${e.healthScore}, last release ${e.lastRelease ?? "unknown"}`,
    )
    .join("\n");

  let claims: Claim[] = [];
  let verdictText = "";
  try {
    const out = await llm.completeJSON<{ claims?: Array<{ text?: string; sourceIds?: string[] }>; verdict?: string }>(
      `You write a cited comparison report as JSON. Rules: every claim MUST cite at least one source id from the provided list, using only facts present in the excerpts — never invent numbers, features, or quotes. Phrase each claim close to the source wording so it can be quote-checked. If the sources do not support a point, omit it. The ranked winner determined by the data is "${winner}"${runnerUp ? ` and the runner-up is "${runnerUp}"` : ""} — write the verdict paragraph explaining the winner's lead and the runner-up's case. Return ONLY JSON: {"claims": [{"text": "...", "sourceIds": ["s1"]}], "verdict": "..."}.`,
      `Query: ${query}\n\nEntities:\n${entityBlock}\n\nSources:\n${sourceBlock || "(no sources fetched)"}`,
      SYNTHESIS_MAX_TOKENS,
    );
    const validIds = new Set(sources.map((s) => s.id));
    claims = (out.claims ?? [])
      .filter((c) => c.text && Array.isArray(c.sourceIds) && c.sourceIds.length > 0)
      .map((c) => ({ text: String(c.text), sourceIds: (c.sourceIds as string[]).filter((id) => validIds.has(id)) }))
      .filter((c) => c.sourceIds.length > 0)
      .slice(0, 25);
    verdictText = typeof out.verdict === "string" ? out.verdict : "";
  } catch (err) {
    emit("progress", { stage: "synthesize", detail: `Synthesis call failed (${err instanceof Error ? err.message : "unknown"}); falling back to extractive claims.` });
  }

  if (claims.length === 0) {
    // Extractive fallback: repo descriptions only, each tied to its repo source.
    for (const e of entities) {
      const repoSrc = sources.find((s) => s.kind === "Repo" && s.title.startsWith(e.repo ?? "§"));
      if (e.repo && repoSrc) {
        claims.push({ text: `${e.name} (${e.repo}) has ${e.stars?.toLocaleString() ?? "?"} stars on GitHub.`, sourceIds: [repoSrc.id] });
      }
    }
    verdictText = verdictText || `${winner} leads on the combined adoption + maintenance-health ranking.`;
  }
  if (!verdictText) verdictText = `${winner} leads on the combined adoption + maintenance-health ranking.`;

  // Slice 3 (T-5): verify every claim — mechanical quote-match + Muse
  // Spark judge. Verification never fails the report: on judge failure
  // every claim lands on needs-review with a reason (FR-8).
  emit("progress", { stage: "verify", detail: `Verifying ${claims.length} claims…` });
  try {
    const factsText = entities
      .map((e) => `${e.name} ${e.repo ?? ""} stars ${e.stars ?? ""} last release ${e.lastRelease ?? ""}`)
      .join("\n");
    const verdicts = await verifyClaims(llm, claims, sources, factsText);
    claims = claims.map((c, i) => ({ ...c, ...verdicts[i] }));
    const verifiedCount = verdicts.filter((v) => v.verdict === "verified").length;
    emit("progress", { stage: "verify", detail: `${verifiedCount}/${claims.length} claims verified.` });
  } catch (err) {
    emit("progress", { stage: "verify", detail: `Verification unavailable (${err instanceof Error ? err.message : "unknown"}); claims marked needs-review.` });
    claims = claims.map((c) => ({ ...c, verdict: "needs-review" as const, reason: "Verification unavailable" }));
  }

  const report: Report = {
    id: randomUUID(),
    query,
    method: plan.method,
    createdAt: new Date().toISOString(),
    entities,
    sources,
    claims,
    verdict: { winner, text: verdictText },
    provider: { name: llm.provider, model: llm.model },
  };
  emit("report", report);
  return report;
}

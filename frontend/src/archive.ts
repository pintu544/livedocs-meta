/**
 * Slice 3 (T-6) — evidence archive (Markdown export) + report history.
 * Pure functions, no React: the Markdown builder is verified by a
 * throwaway driver during M-3, and history round-trips full report
 * JSON through localStorage so a reloaded report matches the original.
 */

export interface ArchiveSource {
  id: string;
  url: string;
  title: string;
  kind: string;
  excerpt: string | null;
  grounded?: boolean;
}

export interface ArchiveClaim {
  text: string;
  sourceIds: string[];
  verdict?: "verified" | "needs-review";
  excerpt?: string | null;
  reason?: string;
}

export interface ArchiveEntity {
  name: string;
  repo: string | null;
  url: string | null;
  stars: number | null;
  lastRelease: string | null;
  healthScore: number;
  healthSignals: string[];
}

export interface ArchiveReport {
  id: string;
  query: string;
  method: "split" | "discovery" | "single";
  createdAt?: string;
  entities: ArchiveEntity[];
  sources: ArchiveSource[];
  claims: ArchiveClaim[];
  verdict: { winner: string; text: string };
  provider: { name: string; model: string };
}

const HISTORY_KEY = "livedocs-meta:history";
const HISTORY_CAP = 20;

export function buildMarkdown(report: ArchiveReport): string {
  const lines: string[] = [];
  lines.push(`# LiveDocs evidence archive`);
  lines.push(``);
  lines.push(`- Query: ${report.query}`);
  lines.push(`- Report ID: ${report.id}`);
  if (report.createdAt) lines.push(`- Generated: ${report.createdAt}`);
  lines.push(`- Provider: ${report.provider.name} / ${report.provider.model}`);
  lines.push(`- Method: ${report.method}`);
  lines.push(``);
  lines.push(`## Entities`);
  for (const e of report.entities) {
    lines.push(
      `- ${e.name} — repo ${e.repo ?? "unknown"}, stars ${e.stars ?? "unknown"}, health ${e.healthScore}, last release ${e.lastRelease ?? "unknown"}`,
    );
  }
  lines.push(``);
  lines.push(`## Verdict: ${report.verdict.winner}`);
  lines.push(``);
  lines.push(report.verdict.text);
  lines.push(``);
  lines.push(`## Claims`);
  const byId = new Map(report.sources.map((s) => [s.id, s]));
  report.claims.forEach((c, i) => {
    const badge = c.verdict === "verified" ? "Verified" : c.verdict === "needs-review" ? "Needs review" : "Unverified";
    // Label the excerpt by the source it actually came from (see
    // App.tsx): a mixed-source claim must not be labeled a grounded
    // summary just because another cited source is grounded.
    const excerptSource = c.excerpt
      ? c.sourceIds.map((id) => byId.get(id)).find((s) => s?.excerpt === c.excerpt)
      : undefined;
    lines.push(`${i + 1}. [${badge}] ${c.text}`);
    if (c.reason) lines.push(`   Reason: ${c.reason}`);
    if (c.excerpt) lines.push(`   ${excerptSource?.grounded ? "Grounded summary (Meta's summary of the cited page, not a page quote)" : "Excerpt"}: ${c.excerpt.slice(0, 500)}`);
    for (const id of c.sourceIds) {
      const s = byId.get(id);
      if (s) lines.push(`   [${id}] ${s.title} — ${s.url}`);
    }
  });
  lines.push(``);
  lines.push(`## Sources`);
  for (const s of report.sources) {
    lines.push(`- [${s.id}] (${s.kind}) ${s.title} — ${s.url}${s.grounded ? " [web-grounded]" : ""}`);
    if (s.excerpt) lines.push(`  ${s.grounded ? "Grounded summary (Meta's summary of this page, not a page quote)" : "Excerpt"}: ${s.excerpt.slice(0, 1000)}`);
  }
  return lines.join("\n") + "\n";
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadHistory(store: Store): ArchiveReport[] {
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ArchiveReport[]) : [];
  } catch {
    return [];
  }
}

export function saveReport(store: Store, report: ArchiveReport): ArchiveReport[] {
  const next = [report, ...loadHistory(store).filter((r) => r.id !== report.id)].slice(0, HISTORY_CAP);
  try {
    store.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable — history is a convenience, never fatal.
  }
  return next;
}

export function clearHistory(store: Store): void {
  try {
    store.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

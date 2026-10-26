/** Free GitHub REST data (unauthenticated). Failures return null, never throw. */

export interface RepoStats {
  fullName: string;
  htmlUrl: string;
  homepage: string | null;
  stars: number;
  description: string | null;
  updatedAt: string | null;
  openIssues: number;
  archived: boolean;
  defaultBranch: string;
  latestRelease: { tag: string; publishedAt: string | null; body: string | null } | null;
}

const HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "livedocs-meta",
};

async function getJSON(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Top-starred repo matching the entity name, with release info.
 *
 * Matching is scored, NOT top-by-stars: a naive stars sort matched
 * "React Query" to ukrbublik/react-awesome-query-builder (name contains
 * both words) instead of TanStack/query. Scoring prefers description
 * phrase matches ("React Query" appears in TanStack Query's
 * description) plus name-token matches, with stars as a tiebreaker.
 */
export async function enrichFromGitHub(entity: string): Promise<RepoStats | null> {
  const search = (await getJSON(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(entity)}&sort=stars&order=desc&per_page=10`,
  )) as { items?: Array<Record<string, unknown>> } | null;
  const items = search?.items ?? [];
  if (items.length === 0) return null;

  const words = entity.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const slug = entity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const compact = entity.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const score = (item: Record<string, unknown>): number => {
    const name = String(item["name"] ?? "").toLowerCase();
    const nameTokens = name.split(/[^a-z0-9]+/).filter(Boolean);
    const desc = String(item["description"] ?? "").toLowerCase();
    // Owner is the missing link for TanStack/query: its name is just
    // "query" and its description never says "TanStack Query".
    const owner = String(item["full_name"] ?? "").split("/")[0].toLowerCase();
    const ownerExact = words.some((w) => w === owner) ? 25 : 0;
    // Exact repo-name match dominates: vercel/swr's description never
    // says "SWR", so without this a "SWR-inspired" Vue clone outscored it.
    const exactName = name === slug || name === compact ? 30 : 0;
    const nameMatches = words.filter((w) => nameTokens.includes(w)).length;
    const nameScore = words.length ? (nameMatches / words.length) * 20 : 0;
    const descPhrase = desc.includes(entity.toLowerCase()) ? 20 : 0;
    const descMatches = words.filter((w) => desc.includes(w)).length;
    const descScore = words.length ? (descMatches / words.length) * 5 : 0;
    const starScore = Math.log10(Number(item["stargazers_count"] ?? 0) + 1);
    return ownerExact + exactName + nameScore + descPhrase + descScore + starScore;
  };
  const ranked = items
    .map((it) => ({ it, s: score(it) }))
    .sort((a, b) => b.s - a.s || Number(b.it["stargazers_count"] ?? 0) - Number(a.it["stargazers_count"] ?? 0));
  // Prefer a live repo: an archived incubator (rtk-incubator/rtk-query)
  // must not represent a library when a live home exists. Archived
  // repos are only a fallback, never the first choice.
  const live = ranked.filter((r) => !r.it["archived"]);
  const best = (live[0] && live[0].s >= 15 ? live[0] : ranked[0]) ?? null;
  // No real match beats a wrong match: below threshold, report no repo.
  if (!best || best.s < 15) return null;
  const item = best.it;
  if (typeof item["full_name"] !== "string") return null;
  const fullName = item["full_name"] as string;
  const release = (await getJSON(`https://api.github.com/repos/${fullName}/releases/latest`)) as Record<
    string,
    unknown
  > | null;
  return {
    fullName,
    htmlUrl: String(item["html_url"] ?? `https://github.com/${fullName}`),
    homepage: typeof item["homepage"] === "string" && item["homepage"] ? item["homepage"] : null,
    stars: Number(item["stargazers_count"] ?? 0),
    description: typeof item["description"] === "string" ? item["description"] : null,
    updatedAt: typeof item["updated_at"] === "string" ? item["updated_at"] : null,
    openIssues: Number(item["open_issues_count"] ?? 0),
    archived: Boolean(item["archived"] ?? false),
    defaultBranch: typeof item["default_branch"] === "string" ? item["default_branch"] : "main",
    latestRelease:
      release && typeof release["tag_name"] === "string"
        ? {
            tag: release["tag_name"],
            publishedAt: typeof release["published_at"] === "string" ? release["published_at"] : null,
            body: typeof release["body"] === "string" ? release["body"] : null,
          }
        : null,
  };
}

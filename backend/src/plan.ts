import type { LLMClient } from "./llm.js";

/** Split a comparison query into entities. "A vs B", "A, B, C", "A or B". */
export function splitEntities(query: string): string[] {
  return query
    .split(/\s+vs\.?\s+|\s+or\s+|,/i)
    .map((s) => s.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Plan step. Deterministic split first; a single topic triggers LLM
 * discovery of contenders (the contenders are then researched and only
 * sourced claims render — the plan step never invents report facts).
 */
export async function planEntities(
  query: string,
  llm: LLMClient,
): Promise<{ entities: string[]; method: "split" | "discovery" | "single" }> {
  const split = splitEntities(query);
  if (split.length >= 2) return { entities: split, method: "split" };
  if (split.length === 0) return { entities: [query.trim()], method: "single" };
  const topic = split[0];
  try {
    const out = await llm.completeJSON<{ contenders?: string[] }>(
      "You list the top contenders for a developer-tool comparison topic. Return ONLY JSON: {\"contenders\": [\"name\", ...]} with 3 to 5 well-known names, no explanations.",
      `Topic: ${topic}`,
      500,
    );
    const contenders = (out.contenders ?? [])
      .filter((c) => typeof c === "string" && c.trim())
      // "TanStack Query (React Query)" must not pollute matching with
      // parenthetical words — it once resolved to a tutorial repo.
      .map((c) => c.replace(/\s*\([^)]*\)/g, "").trim())
      .filter(Boolean)
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .slice(0, 5);
    if (contenders.length >= 2) return { entities: contenders, method: "discovery" };
  } catch {
    // Discovery is a convenience; a single-entity report still works.
  }
  return { entities: [topic], method: "single" };
}

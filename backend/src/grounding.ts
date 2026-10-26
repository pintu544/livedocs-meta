/**
 * Meta Responses API + web_search grounding (M-2).
 *
 * Replaces the Slice 2 interim fetch-based grounding adapter (deleted).
 * There is NO fetch fallback: if this call fails, the report simply
 * has fewer sources (honest degradation, FR-8).
 *
 * Verified shape (T-1 probe 2026-10-27, logged in spec/research.md):
 * POST {base}/responses { model, input, tools: [{ type: "web_search" }] }
 * returns output[] items; the final message's output_text carries
 * url_citation annotations { type, url, start_index, end_index, title }.
 * Titles are unreliable (one was a raw JSON blob) — the URL is the
 * citation identity; title falls back to the URL's domain.
 * Reasoning items and intermediate chatter messages are ignored.
 */

import { LLMError } from "./llm.js";

export interface GroundingHit {
  url: string;
  title: string;
  snippet: string;
}

export interface GroundingResult {
  summary: string;
  hits: GroundingHit[];
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function cleanTitle(title: string | undefined, url: string): string {
  if (!title || title.trim().startsWith("{") || !/[a-z0-9]/i.test(title)) return domainOf(url);
  return title.trim().slice(0, 200);
}

/** Parse a Responses API payload into citations + summary. Pure, tested.
 * NOTE (QA S3 m5): the summary preserves ALL message texts in order,
 * not just the last one — multi-message Responses outputs used to
 * lose earlier text. */
export function parseGroundingResponse(data: unknown): GroundingResult {
  const output = (data as { output?: unknown })?.output;
  const items = Array.isArray(output) ? output : [];
  const summaryParts: string[] = [];
  const byUrl = new Map<string, GroundingHit>();
  for (const item of items) {
    const it = item as { type?: string; content?: unknown };
    if (it.type !== "message" || !Array.isArray(it.content)) continue;
    for (const part of it.content) {
      const c = part as { type?: string; text?: string; annotations?: unknown };
      if (c.type !== "output_text" || typeof c.text !== "string") continue;
      summaryParts.push(c.text);
      const summary = summaryParts.join("\n");
      if (!Array.isArray(c.annotations)) continue;
      for (const a of c.annotations) {
        const an = a as { type?: string; url?: string; title?: string };
        if (an.type !== "url_citation" || typeof an.url !== "string" || !an.url.startsWith("http")) continue;
        if (!byUrl.has(an.url)) {
          byUrl.set(an.url, { url: an.url, title: cleanTitle(an.title, an.url), snippet: summary });
        }
      }
    }
  }
  return { summary: summaryParts.join("\n"), hits: [...byUrl.values()].slice(0, 5) };
}

export async function groundWithMeta(
  baseUrl: string,
  apiKey: string,
  model: string,
  entity: string,
): Promise<GroundingResult> {
  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: `What is ${entity}? Give a one-sentence description and cite the official docs or homepage.`,
      tools: [{ type: "web_search" }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    // Generic message only — provider error bodies are never surfaced
    // (QA S5: a provider echoing a rejected key would leak it).
    throw new LLMError(`Grounding request failed: HTTP ${res.status}`, res.status);
  }
  const data = (await res.json()) as unknown;
  const usage = (data as { usage?: unknown })?.usage;
  console.log(JSON.stringify({ grounding: { model, usage: usage ?? null } }));
  return parseGroundingResponse(data);
}

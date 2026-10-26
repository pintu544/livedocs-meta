import { useEffect, useRef, useState } from "react";
import {
  buildMarkdown,
  clearHistory,
  loadHistory,
  saveReport,
  type ArchiveReport,
} from "./archive";

type Health = { ok: boolean; model: string | null; provider: string; llmConfigured: boolean; metaConfigured: boolean; envWarning: string | null };
type Source = { id: string; url: string; title: string; kind: string; excerpt: string | null; grounded?: boolean };
type Entity = { name: string; repo: string | null; url: string | null; stars: number | null; lastRelease: string | null; healthScore: number; healthSignals: string[] };
type Claim = { text: string; sourceIds: string[]; verdict?: "verified" | "needs-review"; excerpt?: string | null; reason?: string };
type Report = {
  id: string;
  query: string;
  method: "split" | "discovery" | "single";
  createdAt?: string;
  entities: Entity[];
  sources: Source[];
  claims: Claim[];
  verdict: { winner: string; text: string };
  provider: { name: string; model: string };
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [query, setQuery] = useState("React Query vs SWR");
  const [trace, setTrace] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<ArchiveReport[]>(() => {
    try {
      return loadHistory(localStorage);
    } catch {
      return [];
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => undefined);
  }, []);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setReport(null);
    setTrace([]);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Research failed (HTTP ${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const eventLine = part.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const event = eventLine?.slice("event: ".length) ?? "";
          const data = JSON.parse(dataLine.slice("data: ".length)) as Record<string, unknown>;
          if (event === "plan") {
            const entities = (data["entities"] as string[]).join(", ");
            setTrace((t) => [...t, `Plan (${data["method"]}): ${entities}`]);
          } else if (event === "progress") {
            setTrace((t) => [...t, `${data["stage"]}: ${data["detail"]}`]);
          } else if (event === "source") {
            setTrace((t) => [...t, `Source [${data["id"]}] ${data["title"]}`]);
          } else if (event === "report") {
            const rep = data as unknown as Report;
            setReport(rep);
            try {
              setHistory(saveReport(localStorage, rep as ArchiveReport));
            } catch {
              // history is a convenience, never fatal
            }
          } else if (event === "error") {
            throw new Error(String(data["message"] ?? "Research failed."));
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  const sourceById = new Map((report?.sources ?? []).map((s) => [s.id, s]));

  function exportEvidence() {
    if (!report) return;
    const blob = new Blob([buildMarkdown(report as ArchiveReport)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livedocs-evidence-${report.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>LiveDocs Meta</h1>
      <p>
        Citation-verified research reports. Every claim cites a source
        and carries a verification badge. Sources marked [web-grounded]
        carry Meta's grounded summary of the cited page, not a page
        quote — verification against those sources checks the summary,
        not the page text.
      </p>

      {health && !health.llmConfigured && (
        <p>Backend status: no LLM key configured — research is unavailable until a key is set.</p>
      )}
      {health && health.envWarning && (
        <p>
          <strong>Configuration warning:</strong> {health.envWarning}
        </p>
      )}
      {health && health.provider === "meta" && (
        <p>
          Powered by Meta Muse Spark ({health.model}) via the Meta Model API.
        </p>
      )}
      {health && health.provider === "fastrouter" && (
        <p>
          Provider: FastRouter ({health.model}) — local comparison only;
          the submission path runs on Meta Muse Spark.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "React Query vs SWR"'
          style={{ width: "70%", padding: "0.5rem" }}
        />{" "}
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Researching…" : "Research"}
        </button>
      </form>

      {error && <p>Error: {error}</p>}

      {history.length > 0 && (
        <section>
          <h2>History</h2>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => setReport(h as Report)}>
                  {h.query}
                </button>{" "}
                · {h.sources.length} sources · {h.claims.length} claims
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              clearHistory(localStorage);
              setHistory([]);
            }}
          >
            Clear history
          </button>
        </section>
      )}

      {trace.length > 0 && (
        <section>
          <h2>Live trace</h2>
          <ul>
            {trace.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {report && (
        <section>
          <h2>Report: {report.query}</h2>
          <p>
            Provider: {report.provider.name} / {report.provider.model} ·{" "}
            {report.sources.length} sources · {report.claims.length} claims
          </p>
          {report.method === "discovery" && (
            <p>
              <strong>Note:</strong> contenders were suggested by the
              model and repo matches are heuristic — check each repo
              card before citing. The vs query path resolves exactly;
              single-topic discovery can land on an adjacent repo.
            </p>
          )}

          <h3>Entities</h3>
          <ul>
            {report.entities.map((e) => (
              <li key={e.name}>
                <strong>{e.name}</strong>
                {e.url ? (
                  <>
                    {" "}
                    (<a href={e.url} target="_blank" rel="noreferrer">{e.repo}</a>)
                  </>
                ) : (
                  <> ({e.repo ?? "no repo found"})</>
                )}
                {e.stars !== null && <> · {e.stars.toLocaleString()} stars</>}
                {e.lastRelease && <> · latest {e.lastRelease}</>} · health {e.healthScore}
                {e.healthSignals.length > 0 && <> ({e.healthSignals.join("; ")})</>}
              </li>
            ))}
          </ul>

          <h3>Verdict: {report.verdict.winner}</h3>
          <p>{report.verdict.text}</p>
          <p>
            <button type="button" onClick={exportEvidence}>
              Export evidence (Markdown)
            </button>
          </p>

          <h3>Claims</h3>
          <ul>
            {report.claims.map((c, i) => {
              // QA S3 M2: a grounded claim's "excerpt" is Meta's
              // summary of the page, not a page quote — label it so.
              const claimGrounded = c.sourceIds.some((id) => sourceById.get(id)?.grounded);
              return (
              <li key={i}>
                <strong>
                  {c.verdict === "verified" ? "✓ Verified" : c.verdict === "needs-review" ? "Needs review" : "Unverified"}
                </strong>{" "}
                {c.text}{" "}
                {c.sourceIds.map((id) => {
                  const s = sourceById.get(id);
                  return s ? (
                    <a key={id} href={s.url} target="_blank" rel="noreferrer">
                      [{id}]
                    </a>
                  ) : (
                    <span key={id}>[{id}]</span>
                  );
                })}
                {c.reason && (
                  <p>
                    <em>{c.reason}</em>
                  </p>
                )}
                {c.excerpt && (
                  <details>
                    <summary>{claimGrounded ? "verifying excerpt (grounded summary — not a page quote)" : "verifying excerpt"}</summary>
                    <p>{c.excerpt.slice(0, 600)}</p>
                  </details>
                )}
              </li>
              );
            })}
          </ul>

          <h3>Sources</h3>
          <ul>
            {report.sources.map((s) => (
              <li key={s.id}>
                [{s.id}] ({s.kind}){" "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                {s.grounded && <> [web-grounded]</>}
                {s.excerpt && (
                  <details>
                    <summary>{s.grounded ? "grounded summary (Meta's summary of this page, not a page quote)" : "excerpt"}</summary>
                    <p>{s.excerpt.slice(0, 600)}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

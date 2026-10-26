import { useEffect, useRef, useState } from "react";

type Health = { ok: boolean; model: string; provider: string; llmConfigured: boolean; metaConfigured: boolean };
type Source = { id: string; url: string; title: string; kind: string; excerpt: string | null };
type Entity = { name: string; repo: string | null; url: string | null; stars: number | null; lastRelease: string | null; healthScore: number; healthSignals: string[] };
type Claim = { text: string; sourceIds: string[] };
type Report = {
  id: string;
  query: string;
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
            setReport(data as unknown as Report);
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

  return (
    <main>
      <h1>LiveDocs Meta</h1>
      <p>
        Citation-verified research reports. Every claim cites a fetched
        source — verification badges arrive in Slice 3.
      </p>

      {health && !health.llmConfigured && (
        <p>Backend status: no LLM key configured — research is unavailable until a key is set.</p>
      )}
      {health && health.provider === "fastrouter" && (
        <p>
          <strong>Interim provider:</strong> FastRouter ({health.model}) —
          migrating to Meta Muse Spark when billing clears.
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

          <h3>Claims</h3>
          <ul>
            {report.claims.map((c, i) => (
              <li key={i}>
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
              </li>
            ))}
          </ul>

          <h3>Sources</h3>
          <ul>
            {report.sources.map((s) => (
              <li key={s.id}>
                [{s.id}] ({s.kind}){" "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                {s.excerpt && (
                  <details>
                    <summary>excerpt</summary>
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

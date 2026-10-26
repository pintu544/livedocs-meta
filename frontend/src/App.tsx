import { useEffect, useState } from "react";

type Health = { ok: boolean; model: string; metaConfigured: boolean };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError("Backend not reachable on :4000."));
  }, []);

  return (
    <main>
      <h1>LiveDocs Meta</h1>
      <p>
        Citation-verified research reports, rebuilt on Meta Model API
        (Muse Spark). Every claim cites a fetched source — and every
        citation gets verified.
      </p>

      <section>
        <h2>Backend status</h2>
        {error && <p>{error}</p>}
        {health && (
          <p>
            ok: {String(health.ok)} · model: {health.model} · Meta API
            configured: {String(health.metaConfigured)}
          </p>
        )}
        {!health && !error && <p>Checking…</p>}
      </section>

      <section>
        <h2>Research</h2>
        <p>
          The research pipeline arrives in Slice 2 (see spec/TASKS.md).
          Until then this shell only proves the frontend and backend talk
          to each other.
        </p>
      </section>
    </main>
  );
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { llmClientFromEnv } from "./llm.js";
import { runResearch } from "./research.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);

app.get("/api/health", (_req, res) => {
  let llmConfigured = false;
  let provider = "none";
  // QA S3 m1: report a model only when a provider is actually
  // configured — otherwise the default id misleads (it used to
  // report muse-spark-1.3 alongside provider "none").
  let model: string | null = null;
  try {
    const llm = llmClientFromEnv();
    llmConfigured = true;
    provider = llm.provider;
    model = llm.model;
  } catch {
    // No LLM key configured — health still reports, honestly.
  }
  const metaKeySet = Boolean(process.env.MODEL_API_KEY);
  // QA S3 M1: MODEL_API_KEY alone does NOT activate Meta — the app
  // also needs LLM_BASE_URL + LLM_MODEL. Warn instead of silently
  // reporting provider "none", which a deployer could misread.
  const envWarning =
    metaKeySet && provider !== "meta"
      ? "MODEL_API_KEY is set but the active provider is not Meta — Meta requires LLM_BASE_URL=https://api.meta.ai/v1 and LLM_MODEL=muse-spark-1.3 in addition to the key."
      : null;
  res.json({
    ok: true,
    model,
    provider,
    llmConfigured,
    // Boolean only — never leaks key details beyond configured/not-configured.
    metaConfigured: metaKeySet,
    envWarning,
  });
});

app.post("/api/research", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query || query.length > 500) {
    res.status(400).json({ ok: false, error: "Query must be 1–500 characters." });
    return;
  }
  let llm;
  try {
    llm = llmClientFromEnv();
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "LLM is not configured." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    await runResearch(query, llm, send);
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : "Research failed." });
  } finally {
    res.end();
  }
});

// Slice 3 (T-5): single-claim verification, same two-stage check as
// the pipeline. Body: { claim, sourceUrl?, excerpt? }. The URL is a
// reference only — the check runs against the supplied excerpt text
// (no page fetch: the fetch adapter was deleted in M-2). Without an
// excerpt, mechanical match cannot run, so the verdict is
// needs-review with a reason. Provider error bodies are never echoed.
app.post("/api/verify", async (req, res) => {
  const claim = typeof req.body?.claim === "string" ? req.body.claim.trim() : "";
  const sourceUrl = typeof req.body?.sourceUrl === "string" ? req.body.sourceUrl : null;
  const excerpt = typeof req.body?.excerpt === "string" ? req.body.excerpt : null;
  if (!claim || claim.length > 2000) {
    res.status(400).json({ ok: false, error: "Claim must be 1–2000 characters." });
    return;
  }
  let llm;
  try {
    llm = llmClientFromEnv();
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "LLM is not configured." });
    return;
  }
  try {
    const { mechanicalCheck, judgeClaims, composeVerdict } = await import("./verify.js");
    const mechanical = excerpt ? mechanicalCheck(claim, [excerpt]) : { matched: false, excerpt: null, reason: "No source text supplied" };
    const judge = await judgeClaims(llm, [{ text: claim, sourceIds: ["s1"] }], [{ id: "s1", excerpt }]);
    const j = judge?.get(0) ?? null;
    const v = composeVerdict(mechanical, j ? j.supported : null, j?.reason);
    res.json({ ok: true, verdict: v.verdict, excerpt: v.excerpt ?? excerpt, reason: v.reason, sourceUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Verification failed." });
  }
});

// Production: serve the built frontend (same pattern as prior LiveDocs).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`livedocs-meta backend on http://localhost:${PORT}`);
});

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
const META_MODEL_ID = process.env.MODEL_ID ?? "muse-spark-1.3";

app.get("/api/health", (_req, res) => {
  let llmConfigured = false;
  let provider = "none";
  let model = META_MODEL_ID;
  try {
    const llm = llmClientFromEnv();
    llmConfigured = true;
    provider = llm.provider;
    model = llm.model;
  } catch {
    // No LLM key configured — health still reports, honestly.
  }
  res.json({
    ok: true,
    model,
    provider,
    llmConfigured,
    // Boolean only — never leaks key details beyond configured/not-configured.
    metaConfigured: Boolean(process.env.MODEL_API_KEY),
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

// Slice 3: citation verification + evidence archive.
app.post("/api/verify", (_req, res) => {
  res.status(501).json({
    ok: false,
    error: "Citation verification arrives in Slice 3 (see spec/TASKS.md).",
  });
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

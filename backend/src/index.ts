import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);
const MODEL_ID = process.env.MODEL_ID ?? "muse-spark-1.3";
// Boolean only — never leak key details beyond configured/not-configured.
const metaConfigured = Boolean(process.env.MODEL_API_KEY);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL_ID, metaConfigured });
});

// Slice 2+ fills these in: POST /api/research (SSE), POST /api/verify.
app.post("/api/research", (_req, res) => {
  res.status(501).json({
    ok: false,
    error: "Research pipeline arrives in Slice 2 (see spec/TASKS.md).",
  });
});

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
  console.log(`livedocs-meta backend on http://localhost:${PORT} (metaConfigured=${metaConfigured})`);
});

# LiveDocs Meta

**Meta Global AI Developer Hackathon 2026 · Indie track · Entry by Pintu Kumar**

An AI research assistant that compares libraries and tools using **live**
evidence — every claim backed by a fetched source, and every citation
verified. Rebuilt on Meta Model API (Muse Spark 1.3) with native web
search grounding.

Ask `"React Query vs SWR"` and get a comparison report where every claim
carries a clickable source link and a verification badge (Verified /
Needs review), plus a downloadable evidence archive.

Spec-driven build: requirements, design, and task list live in
`../meta-hackathon/spec/` (GRILL → SPEC → DESIGN → TASKS, approved
2026-10-26 before any code).

## How it works (target state)

1. **Plan** — the query is split into entities; a single topic triggers
   live discovery of the top contenders.
2. **Research** — Meta Responses API + web_search grounding per entity,
   plus free GitHub repo stats. Progress streams over SSE.
3. **Fetch + synthesize** — source pages are fetched; Muse Spark writes
   a structured cited report (entity cards, comparison table, verdict).
4. **Verify** — each claim gets a mechanical quote-match check plus a
   Muse Spark judge verdict. Verified only if both agree.
5. **Report + archive** — badges with quoted excerpts, Markdown
   evidence export, localStorage history.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env        # add your MODEL_API_KEY (dev.meta.ai)
npm install
npm run dev                 # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to the backend)
```

Production: `npm run build` in both folders — the backend serves
`frontend/dist` automatically.

### Environment variables (backend, server-side only)

| Variable | Required | Description |
|---|---|---|
| `MODEL_API_KEY` | ✅ | Meta Model API key (dev.meta.ai; never committed, never shipped to the browser) |
| `MODEL_ID` | – | Model id (default `muse-spark-1.3`; Contributor ids are never used) |
| `PORT` | – | Backend port (default `4000`) |

## Status

- Slice 1 (scaffold): done — shell + `/api/health`, no pipeline yet.
- Slice 2 (research pipeline): next. Slice 3 (verification + archive),
  Slice 4 (deploy + submit) follow. See `../meta-hackathon/spec/TASKS.md`.

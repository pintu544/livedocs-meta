# DESIGN — Meta LiveDocs rebuild

Architecture and contracts. Written after SPEC.md is stable.

## Architecture
One repo, two parts. Frontend: React + Vite SPA (query box, live trace
panel, report view with badges, history drawer, export button). Backend:
TypeScript Express server that (a) serves `frontend/dist` in production,
(b) runs the research pipeline, (c) proxies all Meta Model API calls so
the key never leaves the server. Pipeline stages, in order: plan
(entities) → ground (Meta Responses API + web_search, per entity) →
enrich (GitHub REST, free, no key) → fetch (source pages, extract text)
→ synthesize (Meta Chat Completions, structured JSON report) →
verify (mechanical quote-match, then Muse Spark judge) → render.
Progress streams over SSE; the final report is one JSON object the
frontend renders. Deterministic ranking (adoption + health) is computed
in code; the LLM only writes wording and verdicts.

## Data Model
- Report { id, query, createdAt, entities[], claims[], sources[],
  verdict, traceSummary }. IDs are client-generated UUIDs; history is
  keyed by id, refresh never duplicates.
- Entity { name, repo?, stars?, lastRelease?, healthScore (0–100),
  healthSignals[] }.
- Source { id, url, title, kind, fetchedAt, excerpt }.
- Claim { text, sourceIds[], excerpt, verdict: "verified" |
  "needs-review", reason }.
- No server-side tables. The evidence archive is the Report JSON
  rendered as Markdown on export (client-side).

## API Contracts
- GET /api/health → { ok, model, metaConfigured } (metaConfigured is
  boolean only — never leaks key presence details beyond that).
- POST /api/research { query } → SSE stream, events:
  { type: "plan", entities[] } → { type: "source", source } →
  { type: "progress", stage, detail } → { type: "report", report } |
  { type: "error", message, partial? }.
- POST /api/verify { claim, sourceUrl } → { verdict, excerpt, reason }
  (also used inside the pipeline; exposed so a judge can re-check a
  single claim).
- All Meta calls use base https://api.meta.ai/v1, Bearer MODEL_API_KEY,
  model muse-spark-1.3. Synthesis requests cap max_tokens; every call
  logs model + input/output token counts server-side (no content logged).

## Key Decisions
- Decision: Muse Spark 1.3 Standard via Meta Model API — Rationale: it
  is what the application promised and it maximizes the Meta-tooling
  score (rejected: Contributor ids — training clause; Wonder — less
  documented API posture; Llama — retired API).
- Decision: Responses API + web_search for grounding, Chat Completions
  for synthesis — Rationale: grounding returns citations natively;
  chat path is the simplest structured-JSON route with the OpenAI SDK
  (rejected: SerpApi — scope question + cost + weaker tooling score;
  rejected: Responses-only — synthesis JSON is cleaner over chat).
- Decision: Fresh repo, fresh code — Rationale: originality is a
  submission requirement and the team repo must not be touched
  (rejected: forking prior LiveDocs — team artifact + originality risk).
- Decision: Single Render service, no keepalive — Rationale: protects
  the 750h/month budget; wakes on visit (rejected: Vercel + Render
  split — more moving parts; Azure — trial LIMITED).
- Decision: Stateless server + localStorage — Rationale: no DB expiry
  risk (rejected: Postgres — CivicLens free DB expires Nov 24).
- Decision: Mechanical quote-match AND LLM judge for Verified —
  Rationale: either alone is weak; both agreeing is the honest bar
  (rejected: LLM-only verdicts — unverifiable; mechanical-only —
  misses paraphrase support, hence Needs review not Contradicted).

## Risks
1. Responses web_search citation shape differs from third-party docs —
   de-risked by Slice 1's throwaway probe (deleted after); fallback is
   chat synthesis + direct-fetch verification only, with grounding
   citations dropped but quote verification kept.
2. API key / credits / rules acceptance still pending on Pintu (T-0) —
   de-risked by making T-0 the first task (Oct 26–27) and by the
   pay-as-you-go fallback with a $5 budget log if credits don't land.
3. Oct 31 blackout compresses the schedule against a hard Nov 4
   deadline — de-risked by front-loading Slices 1–2 to Oct 26–30 and by
   a documented cut: if time runs short, Slice 3's LLM judge degrades
   to mechanical-only verification (badge wording changes, spec updated
   first).

## Interim provider (approved 2026-10-26 — Pintu's "different api key" go)
- Decision: Slice 2 is built NOW on FastRouter (OpenAI-compatible
  `/chat/completions`, base `https://api.fastrouter.ai/api/v1`, model
  `openai/gpt-5.2` — both verified live 2026-10-26 with a tiny call,
  ~$0.00008) because the Meta key is billing-blocked
  (`billing_not_configured`). The LLM client is provider-agnostic:
  base URL + model + key come from env, so Meta's Chat Completions
  endpoint (base `https://api.meta.ai/v1`, model `muse-spark-1.3`)
  plugs into the SAME client at migration.
- Decision: Interim grounding is fetch-based (GitHub API + direct
  docs/README/release fetches), NOT Meta Responses web_search and NOT
  SerpApi. The grounding step is a swappable adapter; migration swaps
  it for Meta Responses + web_search (M-2). Interim report quality is
  lower (fewer sources) but every claim is still source-linked (FR-3).
- RULE: The FINAL submission MUST run on Meta (Muse Spark 1.3 via Meta
  Model API) — the 25% Meta-tooling score depends on it. SPEC.md
  remains the target state; this section records a temporary
  deviation, not a spec change. No interim-provider code ships in the
  submission without migration + full re-verification (M-3).
- Interim key handling: FastRouter key 1 read from Doppler (muse/dev)
  at server start, transiently, never written to disk or printed.
  Note: this is a NEW use of that key (prior scopes: LiveDocs apps,
  TasteRoute, VulnIntel fallback, HackerRank check) — Pintu's
  "different api key" go authorizes it; he can veto the choice.

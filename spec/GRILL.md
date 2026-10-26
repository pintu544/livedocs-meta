# GRILL — Meta LiveDocs rebuild

Pre-build interrogation. Answers locked 2026-10-26. Nothing important stays
ambiguous when implementation starts.

## Q1 — Completion evidence
The ONE demo that proves it works: in a browser, Pintu (or a judge) types
"React Query vs SWR", watches a live reasoning trace, and gets a report
where EVERY claim carries a clickable source link AND a verification badge
(Verified / Needs review) with the quoted excerpt behind it — plus a
downloadable evidence archive (report + sources + verdicts as Markdown).
If any claim lacks a source, the build is not done.

**Answer:** Live cited report with per-claim verification badges +
Markdown evidence export, demoed in-browser and on a 2–3 min video.

## Q2 — Stack and layout
**Answer:** Fresh public repo `pintu544/livedocs-meta` (name tentative,
Pintu confirms at scaffold). TypeScript Express backend + React + Vite
frontend, one repo, backend serves `frontend/dist` (same proven pattern as
prior LiveDocs). Node 20+. No monorepo tooling, no database.

## Q3 — Data and migration
**Answer:** Stateless server, no database (no expiry risk — the CivicLens
free-DB expiry lesson). Reports live in the browser: localStorage history
+ Markdown/JSON export file as the evidence archive. No migration, no
seeded data beyond 3 fixture queries (see Q6). Refreshing never
duplicates records (history keyed by report id).

## Q4 — Ports and infra
**Answer:** Local: backend :4000, frontend :5173 (Vite proxy to /api).
Env (server-side only, never shipped to browser): `MODEL_API_KEY`
(Meta Model API), `MODEL_ID=muse-spark-1.3`, `PORT`. Deploy: ONE Render
web service on the new account, root `server/`-style layout (build
frontend, serve static + API). NO keepalive cron — service sleeps when
idle and wakes on visit, protecting the 750h/month budget.

## Q5 — The happy path
**Answer:** User enters a comparison query → backend plans entities and
streams the plan → Meta grounding research (Responses API + web_search)
plus free GitHub repo stats → source pages fetched → Muse Spark
synthesizes a structured cited report (Chat Completions) → each claim is
verified (mechanical quote-match + LLM judge) and badged → report renders
with entity cards, comparison table, verdict, source list, and an
Export-evidence button. Total < 120s on a warm instance.

## Q6 — Boundary cases
**Answer:** Must handle: single-topic queries ("best Node.js ORMs" →
discovery search for contenders); unknown/obscure entities (no GitHub
repo → grounding-only sources, no invented stats); unreachable source
pages (badge Needs review, source still listed, report still renders);
empty grounding results (honest "no sources found" state, never a
fabricated report); non-English query text (pass through, report in
query language); very long reports (cap claims at 25, sources at 20).

## Q7 — Failure modes
**Answer:** Meta API down/timeout → clear error banner, partial results
(if any) still shown, retry button; never a fabricated report. Key
missing/invalid → startup health check fails loudly with the exact fix
(create key at dev.meta.ai). Rate limit → exponential backoff, then an
honest "try again shortly" state. Render cold start → first load may
take up to ~60s; submission notes this; demo video is recorded against
a warm instance.

## Q8 — Out of scope
**Answer:** User accounts/auth; server-side persistence/DB; Muse Image,
SAM 3.1, voice; mobile app; multi-user/collaborative reports; payments;
non-English UI; SerpApi (deliberately not used); any code copied from
the All Day AI team repo.

## Q9 — Which Meta models, and why not the cheaper ones?
**Answer:** `muse-spark-1.3` Standard ONLY. Contributor ids rejected:
their discount trades away prompt privacy (Meta may train on the data),
which cannot be honestly disclosed away in a citation-integrity product.
Muse Wonder rejected: newer but its API posture (Standard vs Full split)
is less documented for this use, and Spark is what the application
promised. Llama open-weights rejected: retired API, weaker Meta-tooling
score.

## Q10 — What is Pintu-only, and what blocks the build?
**Answer:** Pintu-only: (1) accept Official Rules in the Cerebral Valley
portal, (2) create the Meta Model API key at dev.meta.ai and confirm
credits, (3) record the demo video, (4) file the submission. (1)+(2)
block Slice 1's live probe — they are T-0 and must land Oct 26–27.
Everything else is agent work.

# Research — Meta LiveDocs rebuild (Meta Global AI Developer Hackathon)

Researched 2026-10-26 (IST). Third-party summaries are marked as such; only
Meta's own pages and Pintu's own records count as verified.

## Event (verified from Pintu's own application record + third-party summaries)
- Meta Global AI Developer Hackathon, hosted by Meta + Cerebral Valley. $1M
  prize pool, 20,000-participant cap, free if selected, virtual, worldwide.
- Indie developer track (Pintu, solo). Themes: "Build for Your World" /
  "Push the Frontier" — Pintu's application declared Build for Your World.
- Build window Oct 26 – Nov 4, 2026. Submissions due **Nov 4, 21:00 ET
  (= Nov 5, 07:30 IST, verified by date conversion)**.
- Judging Nov 4–8, finals Nov 9 (third-party reports conflict on Nov 9 vs
  Nov 10 — UNVERIFIED, Official Rules govern).
- Scoring (third-party reporting of waiver/rules, confirm against Official
  Rules): Indie track judged on creativity, technical ambition, whether it
  works; "Use of Meta AI Tooling" ~25% of score; demo + demo video ~25%.
  Demo video length unstated in pre-rules reporting.
- Selected participants must accept the Official Rules in the portal
  (Pintu-only step, still to confirm done).
- Submission form fields were not public as of Oct 17 reporting — read the
  live form when it opens and adapt the submission checklist.

## Meta Model API (Meta's own docs + corroborating provider docs)
- Official product page: https://developer.meta.com/ai/products/meta-model-api/
  — public preview, "expanded global access", one-click API key, OpenAI-SDK
  compatible, web search grounding.
- Base URL: `https://api.meta.ai/v1`. Auth: Bearer `MODEL_API_KEY`
  (dashboard at dev.meta.ai; keys shown once, `LLM_` prefix).
- Surfaces: OpenAI-compatible Chat Completions (`/chat/completions`),
  Responses (`/responses`), Anthropic-compatible Messages (`/messages`).
  The Responses API exposes a `web_search` tool that returns cited answers.
- Models: `muse-spark-1.3` (latest, 1,048,576-token context, text/image/
  video/PDF input, tool calling, structured output, prompt caching).
  Standard pricing $1.25 / $4.25 per 1M input/output tokens; cached input
  $0.15. `muse-spark-1.3-contributor` is $0.10 / $0.20 but permits Meta
  to train on prompts/completions — REJECTED for this build.
  Rate limits reported 3,000 RPM / 4M TPM per team (standard) — third-party
  corroborated, treat as reported until the dashboard confirms.
- Also on the platform: Muse Image ($0.01/image), SAM 3.1, Muse Voice
  Transcribe — NOT needed for this build. Muse Code is a dev tool, not
  part of the product.
- $150 in Meta Model API credits for selected participants: CONFIRMED
  2026-10-26 from the Official Rules/waiver on the Cerebral Valley
  portal (browser read-only check): $150, valid for a 10-day
  development window, with Credit Terms to review before claiming.
  No claim link or API-key instructions appear on the CV event pages
  themselves — claiming happens via dev.meta.ai (sign-in there was
  blocked on a Google phone approval at check time).
- Judging (CONFIRMED from the waiver, no longer third-party-only):
  Impact 30%, Use of Meta AI Tooling 25%, Technical Depth & Execution
  20%, Demo 25% (including demo-video quality). Finals/closing
  ceremony Nov 9 per the portal's Key Dates; workshops + office hours
  Oct 27–Nov 4, with office hours on Discord (no invite link shown on
  the portal).
- DEAD END, do not use: the separate Llama API at api.llama.com was
  retired July 6, 2026. The old llama.developer.meta.com docs page
  returned 403 on text fetch Oct 26 — it is legacy Llama docs, not the
  Muse Model API docs. No Llama open-weights models in this build.

## Prior art (Pintu's own work — concept reference only, NOT copied)
- LiveDocs Research Agent (All Day AI BUILD track, team repo
  CommunityHackathons/adai26-team-002): Node backend + frontend, plan →
  research (SerpApi + GitHub) → reflect → synthesize → report, SSE
  reasoning trace, entity cards, comparison table, verdict, Markdown
  export, localStorage history. Local copies: ~/workspace/livedocs-research-agent
  (README/ARCHITECTURE read Oct 26).
- LiveDocs Evidence Vault (AWS Weekend Challenge, submitted): same concept
  + evidence archive + S3. Local copy: ~/workspace/livedocs-evidence-vault.
- RULE for this build: fresh repo, fresh code written in-window. The team
  repo is a team submission artifact and must not be modified or copied
  from. Submission will disclose lineage honestly ("evolved from the
  author's prior LiveDocs research agent").
- SerpApi key scope is "LiveDocs only" — this design avoids SerpApi
  entirely (Meta grounding + free GitHub API + direct page fetches), so
  no scope question arises.

## Deploy context (Pintu's standing facts)
- Render new account (pksharmagh4@gmail.com, Google sign-in) already hosts
  4 services; free tier = 750 instance-hours/month/account. Strategy:
  single service, NO keepalive cron (sleeps when idle, wakes on visit) —
  consistent with the retire-don't-repoint decision on the old crons.
- Azure student trial is LIMITED; do not deploy here.
- Oct 31 is a blackout day: Paytm offline hackathon (Mumbai, 8h) +
  TokenTrace submission deadline (17:00 IST). No Meta work scheduled Oct 31.

## Key check 2026-10-26 ~08:12 IST (probe attempt, billing-blocked)
- Pintu sent a Meta Model API key in chat; it was used transiently for
  this check only, unset immediately after, and NOT stored anywhere by
  Muse (no file, no memory value, no Doppler write).
- Result: the key AUTHENTICATES (not an invalid-key error) but every
  call fails with `billing_not_configured`: billing verification
  failed, the team must resolve a billing issue first, via the
  dev.meta.ai/billing page. The $150 credits are therefore NOT yet
  active on this key — claiming/activating them (or otherwise resolving
  billing) in Pintu's own browser is a precondition for T-1 and Slice 2.
- T-1 probe NOT run: blocked on billing, not on the key. Re-run after
  billing resolves. For Slice 2 the key still needs a home in Doppler
  (muse/dev, MODEL_API_KEY).
- How to activate the $150 (researched 2026-10-26): NO published claim
  flow found — the waiver promises the credits but gives no claim
  steps; Meta's own events page (dev.meta.ai/events/global-hackathon,
  read 08:17 IST) mentions no credits, billing, or claim method at
  all; third-party coverage likewise documents no claim button and
  does not state whether a payment card is required. The only
  system-generated instruction is the API error itself: resolve
  billing at dev.meta.ai/billing (team link from the error). So
  activation = completing billing verification on that page in
  Pintu's own browser; what it asks (card or not) is unverified
  until he opens it. Fallback if the page shows no credit path:
  organizers via the Oct 27–Nov 4 office hours.

## Billing page update 2026-10-26 ~08:26 IST (Pintu first-hand)
- The billing page ASKS FOR A PAYMENT METHOD. The card requirement is
  confirmed by the page itself — no doc stated it.
- Whether the $150 credits auto-apply after adding the card is
  UNVERIFIED. Card decision is Pintu's alone, in his own browser;
  Muse never touches card details.
- Exposure framing (SPEC NFR-4): build + demo + judging budgeted under
  $5 at Standard pricing, so worst case (credits never land) is a few
  dollars of API usage, not a $150 commitment.

## T-1 probe 2026-10-27 ~00:20 IST (billing resolved, real key, transient)
- Key: read in-process from the Meta goal hidden_files/.env (mode 600,
  outside any repo) as MODEL_API_KEY. Value never printed, stored, or
  committed. Probe file deleted after this run.
- Billing: RESOLVED. Both calls HTTP 200, model muse-spark-1.3.
  (Earlier 2026-10-26 probes failed billing_not_configured; the new
  key + claimed credits cleared it.)

### Responses API + web_search (grounding path, M-2 input)
- Request: POST https://api.meta.ai/v1/responses
  { model: "muse-spark-1.3",
    input: "<one-sentence question>",
    tools: [{ type: "web_search" }] }.
- Response: OpenAI-style object. Top-level keys include id, object
  ("response"), status, model, output[], usage, error.
- output[] items, in order: { type: "reasoning" } (summary empty),
  { type: "message", role: "assistant", content: [{ type:
  "output_text", text }] } (intermediate reasoning chatter — IGNORE),
  { type: "web_search_call", status, action } (one per search; the
  model ran 7 searches for a one-sentence question), then a final
  { type: "message" } whose output_text carries the answer.
- Citations: url_citation annotations on the FINAL message's
  output_text only: { type: "url_citation", url, start_index,
  end_index, title }. Title is unreliable (one citation's title was
  a raw npm-registry JSON blob) — use the URL as the citation
  identity, title falls back to the URL's domain.
- Verified example: "The latest stable release of TanStack Query is
  v5.105.0." cited to https://registry.npmjs.org/@tanstack%2Fquery-core/latest
  (real, current, grounded — not training data).
- M-2 parse contract: collect url_citation annotations from ALL
  message items' output_text (dedupe by URL), keep the final message
  text as the grounding summary. Ignore reasoning items and
  intermediate chatter.
- COST WARNING: one grounding call used 54,181 total tokens
  (input 52,187 incl. 24,364 cached; output 1,994 incl. 1,298
  reasoning). At Standard pricing (~$1.25 in / $4.25 out per 1M)
  that is ~$0.07–0.08 per entity grounding call. Two entities per
  report ≈ $0.16 + synthesis ≈ $0.01. Fine against the $5 budget
  for build + demo + judging, but do NOT ground more than one call
  per entity and keep prompts to one sentence.

### Chat Completions structured JSON (synthesis + judge path)
- Request: POST https://api.meta.ai/v1/chat/completions
  { model: "muse-spark-1.3", messages: [system, user],
    response_format: { type: "json_object" }, temperature: 0.3,
    max_tokens: 1500 }.
- Response: OpenAI-style { id, choices: [{ message: { content },
  finish_reason: "stop" }], model: "muse-spark-1.3", usage }.
  response_format json_object IS honored: content parsed as valid
  JSON with claims[] ({ text, sourceIds }) + verdict string.
- REASONING-TOKEN LESSON: usage showed completion 1,049 tokens of
  which 889 were reasoning_tokens — the model reasons before
  writing, and reasoning consumes max_tokens. The earlier 5-token
  probe returned content null for exactly this reason. Production
  max_tokens must stay generous: synthesis 4,000 (existing),
  judge batch 2,000 minimum. Never cap a Meta call below ~1,000.
- Node fetch through this VM's egress proxy requires
  NODE_USE_ENV_PROXY=1 (undici ignores proxy env otherwise).
  Production (Render) needs no proxy env.

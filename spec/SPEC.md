# SPEC — Meta LiveDocs rebuild

Requirements. Testable, implementation-free. (Meta Global AI Developer
Hackathon, Indie track, solo. Build window Oct 26 – Nov 4, 2026;
submissions due Nov 4, 21:00 ET / Nov 5, 07:30 IST.)

## Problem
Developers picking a library get AI answers they cannot trust: claims
with no source, stale training knowledge, and no way to check whether a
quote is real. LiveDocs fixes this by researching live, citing every
claim to a fetched source, and verifying each citation — rebuilt for this
hackathon on Meta's own models, so the verification itself runs on Meta
AI tooling.

## Users
- A developer comparing libraries/tools before adopting one.
- A hackathon judge checking the demo live in under 3 minutes.

## Functional Requirements
- FR-1: The system SHALL accept a free-text comparison query and stream
  a visible research plan (entities identified) before results appear.
- FR-2: The system SHALL research each entity using Meta Model API web
  search grounding plus free GitHub repository statistics; every source
  SHALL carry a clickable URL, title, and kind (Docs / Release / News /
  Repo / Page).
- FR-3: The system SHALL produce a structured report (entity cards,
  comparison table, verdict) in which every claim links to at least one
  source. A claim with no source SHALL NOT be rendered as a claim.
- FR-4: The system SHALL verify each cited claim and display a badge:
  Verified (quote found in fetched source text AND LLM judge agrees) or
  Needs review (anything else), with the quoted excerpt and reason shown.
- FR-5: The system SHALL let the user download an evidence archive
  (Markdown) containing the query, all claims, all sources with excerpts,
  and all verdicts.
- FR-6: The system SHALL keep past reports in browser localStorage and
  reload any of them on click.
- FR-7: The system SHALL stream a live reasoning trace (plan → sources →
  synthesis → verification) over SSE while research runs.
- FR-8: The system SHALL degrade honestly: on Meta API failure it shows
  an error and any partial sources, never a fabricated report.
- FR-9: The system SHALL cap LLM usage per request (max tokens + a
  server-side request budget log) and SHALL never call Contributor-tier
  models.
- FR-10: The system SHALL serve the full flow from one public URL that
  works cold (after Render wake-up) with no login.

## Non-Functional Requirements
- NFR-1: Performance — full report in < 120s p95 on a warm instance;
  first byte on a cold instance in < 60s.
- NFR-2: Security — the Meta API key lives server-side only and never
  reaches the browser bundle; no user data is stored server-side.
- NFR-3: Scale — single-user demo + judges; no auth, no DB, no
  multi-user state. Deterministic ranking: the LLM never reorders
  entities or claims; it only writes wording and verification verdicts.
- NFR-4: Cost — whole build + demo + judging usage targeted under $5
  at Standard pricing ($1.25 / $4.25 per 1M tokens); usage logged
  server-side per request.

## Out of Scope
User accounts/auth; server-side persistence or a database; Muse Image,
SAM 3.1, voice; mobile app; multi-user collaboration; payments;
non-English UI; SerpApi; any code copied from the All Day AI team repo;
any claim of Meta credits, Discord access, or submission-form fields
until verified in the portal.

## Judging Criteria (Indie track — confirmed from the Official Rules
waiver on the Cerebral Valley portal, 2026-10-26)
- Creativity → FR-3 + FR-4 (citation verification as the product, not a
  feature: no other entry shows quote-level proof per claim).
- Technical ambition → FR-2 + FR-7 (agentic pipeline: plan, ground,
  fetch, synthesize, verify, streamed live).
- Whether it works → FR-1 + FR-8 + FR-10 (live demo, honest failure
  modes, public URL).
- Use of Meta AI Tooling (~25%) → FR-2 + FR-4 (Muse Spark 1.3 via Meta
  Model API for research, synthesis, and verification; native web_search
  grounding as the evidence source).
- Demo + video (~25%) → FR-5 + FR-10 (evidence export a judge can keep;
  2–3 min video against a warm instance).

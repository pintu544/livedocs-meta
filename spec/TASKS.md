# TASKS — Meta LiveDocs rebuild

Ordered checklist. One task = one verifiable unit. Check off only when
acceptance criteria pass. Slices close only after an adversarial QA pass
(fresh subagent, criticals fixed) + Pintu's confirmation in the browser.
Oct 31 is a blackout day (Paytm offline + TokenTrace deadline) — no
Meta tasks scheduled that day. Submission target: Nov 3 EOD IST (early
against the Nov 4, 21:00 ET / Nov 5, 07:30 IST deadline).

## Slice 1 — Prove the Meta API works (Oct 26–27)
- [ ] T-0: Pintu-only portal steps: accept Official Rules, create Meta
      Model API key at dev.meta.ai, confirm credits/Discord state.
      Done means: Pintu confirms key created (value never shared in
      chat) + rules accepted. Unblocks: T-1.
- [ ] T-1: Throwaway probe (DELETED after): one Responses call with
      web_search + one Chat Completions structured-JSON call, log the
      exact citation/response shapes.
      Done means: probe output shows cited sources + valid JSON, shapes
      recorded in research.md; probe files deleted. Unblocks: T-3, T-4.
- [x] T-2: Repo scaffold: fresh public repo, TS Express backend +
      React/Vite frontend, /api/health, env contract, README, no
      secrets committed.
      Done means: `npm run dev` serves shell + health JSON locally.
      (Verified 2026-10-26: backend tsc clean, /api/health →
      {"ok":true,"model":"muse-spark-1.3","metaConfigured":false};
      frontend vite build clean + dev serves; commit dcacf4e pushed to
      github.com/pintu544/livedocs-meta, main.)
      Unblocks: T-3.

## Slice 2 — Research pipeline + cited report (Oct 28–30)
- [x] T-3: Plan + ground + enrich: query → entities → Meta grounding
      per entity → GitHub stats, streamed over SSE with live trace.
      Done means: "React Query vs SWR" streams plan + ≥4 real sources
      in the browser. Unblocks: T-4.
      DONE 2026-10-26 on the INTERIM provider (FastRouter + fetch-based
      grounding): live run streamed plan + 8 sources; entities
      TanStack/query (50482 stars) + vercel/swr (32494 stars).
- [x] T-4: Fetch + synthesize: source-page fetch + text extraction →
      Muse Spark structured report (cards, table, verdict).
      Done means: end-to-end report renders with every claim linked to
      a source; no unsourced claim renders. Unblocks: T-5.
      DONE 2026-10-26 on the INTERIM provider: 12 claims, 0 with
      missing/invalid sources; deterministic ranking (adoption 50% +
      health 50%), LLM wording only. Repo commit 4348b20.
- [ ] QA gate S2: adversarial QA subagent on Slice 2 + Pintu browser
      confirmation before Slice 3.

## Slice 3 — Verification + evidence archive (Nov 1–2)
- [ ] T-5: Verify: mechanical quote-match + Muse Spark judge → badges
      (Verified / Needs review) with excerpt + reason per claim.
      Done means: a deliberately stale claim shows Needs review with a
      reason; a true quote shows Verified. Unblocks: T-6.
- [ ] T-6: Archive + history: Markdown evidence export + localStorage
      history reload.
      Done means: exported file contains query, claims, sources with
      excerpts, verdicts; a reloaded report matches the original.
- [ ] QA gate S3: adversarial QA subagent on Slice 3 + Pintu browser
      confirmation before Slice 4.

## Slice 4 — Deploy + submit (Nov 3–4)
- [ ] T-7: Single-service Render deploy (new account), cold-start
      check, usage-log check.
      Done means: public URL serves the full flow cold in < 60s to
      first byte; no key in the browser bundle (bundle grep clean).
- [ ] T-8: Pintu-only: 2–3 min demo video (recorded warm), read live
      submission form, adapt checklist if fields differ from spec.
      Done means: video file ready + form fields confirmed.
- [ ] T-9: File submission on the Cerebral Valley portal before Nov 4,
      21:00 ET; verify SUBMITTED state on fresh reload.
      Done means: portal shows submitted; submission summary saved to
      spec/submission.md.
- [ ] QA gate S4: final adversarial QA pass + Pintu's pre-submission
      review (projected score vs bar + clarity check) before T-9 files.

## Migration — when the Meta key activates (any time after billing clears)
- [ ] M-1: Env swap: backend runs with Meta base
      (https://api.meta.ai/v1) + model muse-spark-1.3 + Meta key (from
      Doppler muse/dev, MODEL_API_KEY — never pasted in chat).
      Done means: /api/health shows provider meta + llmConfigured true.
- [ ] M-2: Grounding adapter swap: replace fetch-based grounding with
      Meta Responses API + web_search (the T-1 probe's verified shape).
      Done means: a report's sources include grounding citations, and
      the interim fetch adapter is deleted, not left as fallback.
- [ ] M-3: Full re-verification: re-run T-3/T-4/T-5/T-6 live against
      Meta + adversarial QA pass + Pintu browser confirmation.
      Done means: every slice acceptance passes on Meta, and the
      submission runs 100% on Meta tooling. Unblocks: T-7 deploy.

## Slice 2 note
- Slice 2 (T-3/T-4 below) is built on the INTERIM provider (FastRouter
  + fetch-based grounding) per the DESIGN.md interim decision. Its
  acceptance criteria are unchanged, except the report carries an
  honest "Interim provider" note in the UI until M-3 passes.


## Known limitation — discovery-path entity resolution (2026-10-26)
- The vs path resolves correctly and stably (React Query →
  TanStack/query, SWR → vercel/swr, verified across runs).
- The single-topic discovery path can resolve a contender to an
  adjacent repo (e.g. "TanStack Query" → a Firebase adapter whose
  description contains the phrase "TanStack Query", outscoring the
  canonical repo). The mismatch is VISIBLE (entity cards show the
  actual repo) and every claim is still sourced to the shown repo —
  nothing is fabricated — but the comparison is against the wrong
  project. Deliberately NOT fixed by further heuristic tuning
  (diminishing returns; each tweak risked the vs path).
- Principled fix is M-2: Meta Responses web_search grounding returns
  canonical project pages, and entity resolution can use grounded
  URLs instead of GitHub name guessing. Until M-2, the demo path is
  the vs query, and single-topic reports carry this caveat.

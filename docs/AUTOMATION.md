# How FerroScope keeps itself current

The site updates itself on three loops. Each one writes only what it can stand behind, and
each hands anything that needs judgement to a person instead of guessing.

| Loop | Runs | Writes | Human step |
|---|---|---|---|
| Data refresh | every 6 h (`refresh-intelligence.yml`) | `data/live.json`, `data/meta.json`, watch run-state in `data/monitoring-coverage.json` | none — a failed run opens an issue |
| Link health | Mondays 03:41 UTC (`check-lab-links.yml`) | `docs/link-health.json` | fix links it reports broken |
| Enrichment queue | Mondays 05:23 UTC (`build-enrichment-queue.yml`) | `docs/ENRICHMENT-QUEUE.md`, `docs/enrichment-queue.json` | none |
| Reading round | **manual today** — a weekly scheduled task exists but cannot complete it (below) | `data/ai-reading-drafts.json`, via a pull request | run the round; review the PR; promote drafts |

## What each loop now does on its own

- **Watch run-state.** When the laboratory-watch source succeeds, the refresh marks every
  executed watch `active`, and records `lastRunAt` and `matchesPastYear` (its one-year
  PubMed match count). A watch used to stay "first run pending" forever because nothing
  promoted it. Lab cards show the count ("author watch · 4 matches in 12 months"). Run-state
  lives only in these fields; the validator rejects prose like "has not yet been executed"
  in a note, because prose goes stale the moment the watch runs.
- **The queue** lists three things: records needing a first reading (with PubMed abstracts
  fetched in CI, where the network allows it), AI drafts awaiting review, and laboratory
  manual reviews due within 30 days.

## The reading round

GitHub Actions can fetch abstracts but cannot read them; a Claude session can read but its
sandbox cannot reach PubMed. The queue joins the two: CI attaches the abstracts, the session
reads them from the repository.

**This loop does not currently run by itself.** A person starts a session and gives it the
prompt below. Read "Why the schedule does not close this loop yet" after the prompt before
relying on it to happen on its own — the first version of this document claimed a weekly
scheduled session ran it, and that sentence let the round sit unrun from 2026-09-28 to
2026-11-02 with nobody noticing, because the queue kept refreshing and looked healthy.

The prompt:

```text
Repository: KKAIlab/ferroscope. Run the weekly FerroScope reading round.

1. Start a branch from the latest main named reading-round/<YYYY-MM-DD>.
2. Read docs/enrichment-queue.json. Take up to 8 entries from `candidates` that have a
   non-empty `abstract`, in queue order.
3. For each, read the abstract in the queue file and append one object to
   data/ai-reading-drafts.json:
     canonicalId, recordId, title        — copied from the queue entry
     takeaway   — 1–2 sentences: what the work adds, in plain English
     caveat     — 1 sentence: where its evidence stops, as far as the abstract shows
                  (model system, what was shown vs. proposed, what the abstract leaves out)
     basis: "abstract", status: "ai-draft",
     draftedBy: "Claude (weekly reading round, abstract only)", draftedAt: <today>
   Write only what the abstract supports. Keep every hedge the abstract uses. Never add
   evidenceGrade, evidence or documentType — the validator rejects them. If an abstract
   is too thin to say where the evidence stops, skip that entry.
4. Run `npm run check`. Fix anything it reports in your own entries; do not edit
   validators or tests to make it pass.
5. Commit, push the branch, and open a pull request titled
   "Reading round <date>: <n> AI drafts", listing each record and its caveat.
   Do not merge it.
```

A person merges the pull request after reading it. The drafts go live marked
"AI-read abstract · unreviewed"; the reviewer later sets `status: "reviewed"` with
`reviewedBy` and `reviewedAt` on each draft they have checked against the source.
Until that merge the drafts are not on the site, so an unmerged reading-round pull request
leaves this loop as stalled as never having run it.

### Why the schedule does not close this loop yet

A weekly scheduled task exists — "FerroScope weekly reading round", Sundays 22:31 UTC, a
fresh session per firing, push notification on. It fires, but as configured it cannot finish
the round, and two manual test firings on 2026-11-09 both produced nothing: no branch, no
pull request. The sessions it starts carry the tag `config:no-git-repo` and ended after 88
and 25 seconds.

Two things block it, neither fixable from the prompt:

- **No repository.** The cloud environment the task fires in has an empty `repositories`
  list, so each fired session starts with no checkout of this repository. Telling the
  session to attach one itself (`add_repo`) did not rescue it — that was what the second
  test firing changed, and it failed faster than the first.
- **No GitHub tools.** The task stores no MCP connectors, so fired sessions have no
  `mcp__github__*` tools and cannot open the pull request that step 5 asks for.

To make the schedule real, a person has to add `KKAIlab/ferroscope` to that environment's
**Repositories** list in its settings, and give the fired sessions GitHub access — then
re-test by firing the task once by hand and checking the branch list, not the session's own
report of what it did. Until both hold, treat the row in the table above as the truth: this
round is manual, and the schedule is a reminder that fires rather than a loop that closes.

## What stays manual, on purpose

- Grading evidence and classifying documents (curated audit overlays).
- Promoting a record into the paper layer (figure-level reading).
- Signing off AI drafts and glossary translations.
- Laboratory manual reviews — listed in the queue when due.

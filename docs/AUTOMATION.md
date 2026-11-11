# How FerroScope keeps itself current

The site updates itself on four loops — three that run on their own in GitHub Actions, and a
reading round that still needs a person to start it. Each one writes only what it can stand
behind, and each hands anything that needs judgement to a person instead of guessing.

| Loop | Runs | Writes | Human step |
|---|---|---|---|
| Data refresh | every 6 h (`refresh-intelligence.yml`) | `data/live.json`, `data/meta.json`, watch run-state in `data/monitoring-coverage.json` | none — a failed run opens an issue |
| Link health | Mondays 03:41 UTC (`check-lab-links.yml`) | `docs/link-health.json` | fix links it reports broken |
| Enrichment queue | Mondays 05:23 UTC (`build-enrichment-queue.yml`) | `docs/ENRICHMENT-QUEUE.md`, `docs/enrichment-queue.json` | none |
| Reading round | weekly scheduled task, but it wakes an existing session rather than standing on its own — **expect to run it by hand** (below) | `data/ai-reading-drafts.json`, via a pull request | run the round; review the PR; promote drafts |

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
prompt below. A weekly scheduled task does exist, but read "What the schedule actually is"
after the prompt before relying on it to happen on its own — the first version of this
document claimed a weekly scheduled session ran the round, and that sentence let it sit
unrun from 2026-09-28 to 2026-11-02 with nobody noticing, because the queue kept refreshing
and the loop looked healthy.

The prompt:

This is the same text the scheduled task stores. Keep the two in step: if you change one,
change the other, or the hand-run path quietly becomes the worse of the two.

```text
Repository: KKAIlab/ferroscope. Run the weekly FerroScope reading round.

1. `git fetch origin main`, then start a branch from the latest origin/main named
   reading-round/<today's date, YYYY-MM-DD>. Do not branch from a local main without
   fetching — a checkout that has sat for a week is many commits behind.
2. Read docs/enrichment-queue.json. From `candidates`, take up to 8 entries with a
   non-empty `abstract`, in queue order, preferring entries whose canonicalId is also in
   data/live.json — a draft for a record that has left the live window will not show on
   the site. Skip any canonicalId that already has a draft in
   data/ai-reading-drafts.json, including drafts sitting on an unmerged branch.
3. Read each abstract and append one object per entry to data/ai-reading-drafts.json:
     canonicalId, recordId, title        — copied from the queue entry
     takeaway   — 1–2 sentences: what the work adds, in plain English
     caveat     — 1 sentence: where its evidence stops, as far as the abstract shows
     basis: "abstract", status: "ai-draft",
     draftedBy: "Claude (weekly reading round, abstract only)", draftedAt: <today>
   Never add evidenceGrade, evidence or documentType — the validator rejects them, and
   grading or classifying a document needs the figures and a curated audit.
   The caveat is the field that gets overreached: three of the first eight drafts had to
   be corrected for it. Say what the abstract DOES say and where its scope stops, and
   keep its hedges ("may", "suggests", a proviso the authors state themselves). Do not
   assert an absence you cannot see from the abstract ("no data of its own", "names no
   model"), and do not invent a weaker study design to hedge against — for example
   recasting an authors' "X acts as a pathogenic factor" into "the link rests on X's
   presence". Understating a source fabricates as much as overstating it. A methods
   chapter, protocol or review rather than new findings → say so in the caveat. An
   abstract too thin to locate where the evidence stops → skip it; skipping is always
   acceptable.
4. Run `npm run check`. Fix only your own entries; never edit validators, tests or other
   data files to make it pass.
5. Commit, push the branch, and open a pull request against main titled
   "Reading round <date>: <n> AI drafts", listing each record with its takeaway and
   caveat so a reviewer can check them against the source. Do not merge it.
6. Report whether any earlier reading-round pull request is still open and unmerged, and
   whether docs/enrichment-queue.json is more than about two weeks old.
```

A person merges the pull request after reading it. The drafts go live marked
"AI-read abstract · unreviewed"; the reviewer later sets `status: "reviewed"` with
`reviewedBy` and `reviewedAt` on each draft they have checked against the source.
Until that merge the drafts are not on the site, so an unmerged reading-round pull request
leaves this loop as stalled as never having run it. That is the state as this is written:
the round was run by hand on 2026-11-02 and its pull request is still open, so the newest
drafts the site shows are still the eight from 2026-09-28. "Ran the round" and "the drafts
are live" are two different things, and only the second one counts.

### What the schedule actually is

A weekly scheduled task exists — "FerroScope weekly reading round", Sundays 22:31 UTC. It
does **not** start a fresh session. It wakes an existing Claude session that already has this
repository checked out, and that session runs the round. That is a workaround, not a loop
that stands on its own, and it is worth knowing why.

The obvious design — a fresh session per firing — was tried first and does not work here.
Two manual test firings on 2026-11-09 both produced nothing: no branch, no pull request.
Both sessions carried the tag `config:no-git-repo` and ended after 88 and 25 seconds.
Two things blocked them, neither fixable from the prompt:

- **No repository.** The cloud environment the task fires in has an empty `repositories`
  list, so each fired session starts with no checkout of this repository. Telling the
  session to attach one itself (`add_repo`) did not rescue it — that was what the second
  test firing changed, and it failed faster than the first.
- **No GitHub tools.** Such a task stores no MCP connectors, so fired sessions have no
  `mcp__github__*` tools and cannot open the pull request that step 5 asks for.

So the task was rebound to an existing session instead. What that costs:

- It lives only as long as the session it wakes. If that session is archived or retired, the
  task fires into nothing and the round stops — silently, exactly as it did for the five
  weeks after 2026-09-28. Nothing in this repository records which session it is bound to,
  and nothing can: the binding lives in the task. To check it, or to rebind it after the
  session goes, list the account's scheduled tasks, find "FerroScope weekly reading round",
  and recreate it from a session that has this repository checked out — creating it is what
  binds it, so it cannot be repointed in place.
- A session-bound task cannot carry a push notification (the API refuses one), so a firing
  that produces nothing does not announce itself. Nobody is told when this stops working.

Because a firing and a hand run can both happen in the same week, and both want the branch
name `reading-round/<today>`, check for an existing branch and an open reading-round pull
request before starting one. If a round for today already exists, there is nothing to do.

The durable fix is still the settings change: add `KKAIlab/ferroscope` to the **Repositories**
list of the cloud environment the sessions run in (`KKla b`, not `Default` — the account has
both), give its sessions GitHub access, then move the task back to a fresh session per firing
and re-test. Re-test by firing it by hand and checking the repository's branch list — not the
session's own account of what it did; both failed test firings described their own situation
accurately, but only the branch list proved nothing had been produced. Until then the table
above is the honest summary: a person should expect to run this round, and treat the schedule
as a prompt that may or may not land rather than a loop that closes itself.

## What stays manual, on purpose

- Grading evidence and classifying documents (curated audit overlays).
- Promoting a record into the paper layer (figure-level reading).
- Signing off AI drafts and glossary translations.
- Laboratory manual reviews — listed in the queue when due.

@AGENTS.md

# Keep docs in sync with every PR

Before finishing any PR, check whether the change affects something
`DESIGN.md` documents — architecture decisions, content-authoring rules and
conventions, coverage-depth behavior, a "Known gaps" item that just got
resolved, or the "Checklist: adding a new book" steps. If so, update
`DESIGN.md` in the same PR, not as a follow-up. Same for `README.md` when a
change affects how someone develops, authors content, tests, or deploys the
app.

This applies to every PR, not just ones explicitly about documentation — a
code or content change that makes `DESIGN.md` wrong is incomplete until
`DESIGN.md` is fixed too.

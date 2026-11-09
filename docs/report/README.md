# The report

Nine chapters plus an appendix, written in LaTeX. These files are the drafted
prose in Markdown; they are the source the LaTeX is assembled from, not the
submission itself. Citation keys match `references.bib` and are written as
`\cite{key}` so they survive the move.

## Building the PDF

```
cd docs/report/latex
python build.py --pdf-only
```

The whole report compiles: **67 pages**, nine chapters, five numbered figures,
13 bibliography entries, zero undefined references. `latex/README.md` covers
the build, what is generated, and the draft-note switch.

The chapter notes render as boxed **DRAFT NOTE** panels. One line in
`latex/main.tex` hides every one of them for the submission build:

```latex
\draftnotesfalse
```

Leave it `\draftnotestrue` until the blocked items below are resolved, so a
note cannot be submitted by accident. There are 13.

## Status

| file | chapter | state |
|---|---|---|
| `chapter1_introduction.md` | 1. Introduction | drafted — **§1.4 blocked** |
| `chapter2_literature_survey.md` | 2. Literature survey | drafted — **§2.7 blocked**, bibliography incomplete |
| `chapter3_analysis.md` | 3. System analysis and requirements | drafted |
| `chapter4_system_design.md` | 4. System design | drafted |
| `chapter5_implementation.md` | 5. Implementation | drafted |
| `chapter6_testing.md` | 6. Testing and verification | drafted |
| `chapter7_results.md` | 7. Results and discussion | drafted |
| `chapter8_conclusion.md` | 8. Conclusion and future work | drafted — **§8.6 blocked** |
| — | 9. References | generated from `references.bib` |
| `SRS.md` | Appendix A | drafted |
| `chapter2_plan.md` | — | the reading notes Chapter 2 was written from; not submitted |

## The one thing blocking three chapters

**Chapter 1 §1.4, Chapter 2 §2.7 and Chapter 8 §8.6 all state the project's
contribution, and all three are pending a conversation with the project guide,
Mr. Ashish Sharma.**

Chapter 7 reports that the behavioural layer does not detect partial
outsourcing on the one corpus built to test it. The project set out claiming
that capability, so the claimed novelty has to be reworded, and that is not a
unilateral edit.

Chapter 1 §1.4 states the defensible position so the conversation has a
starting point: the contribution is a working two-layer evidence system
together with a measured negative result and a diagnosed mechanism, not a
demonstrated capability to detect outsourced work.

**Settle all three in one conversation and edit them together**, or they will
drift apart.

## Also outstanding

**The bibliography.** `references.bib` holds 13 entries against a target of 15
to 25. Four have every field confirmed; nine are real publications with a
confirmed title and at least one field still carrying a TODO. Seven further
references are named as gaps in `chapter2_plan.md`'s table, each with a stated
purpose. **Baxter et al. must not be cited until it has been verified** — it
could not be confirmed on the original search.

This is a browser task of perhaps half an hour. It blocks printing the
bibliography, not writing the chapters.

**Figures.** Chapter 4 is built around the five diagrams in `docs/diagrams/`,
each with a Mermaid source beside its `.svg` and `.png`, so every figure in the
report can be regenerated. Captions are in that folder's README.

## Rules these drafts follow

Worth knowing before editing them, because they are the reason several
sections read the way they do.

1. **No figure or citation that cannot be traced to a source.** Every number
   in Chapter 7 comes from a committed script in
   `apps/detector/measurements/`. Where a figure could not be traced it was
   retracted rather than kept — the AUC pair in §7.4 is the worked example.
2. **Retractions are recorded, not quietly corrected.** Chapters 5 and 7 both
   carry withdrawn claims with the reason, because a reader who finds the
   earlier version elsewhere needs to know which supersedes.
3. **Limitations are stated before an examiner finds them.** Chapters 2 §2.8,
   3 §3.6, 6 §6.6 and 7 §7.8 each end on what the chapter does not establish.
4. **Layer 3 is a documented exclusion, never described as working.** The
   reasoning is in Chapter 5 §5.4 and it is a requirements argument, not a
   scheduling one.
5. **Constants are quoted from the file they live in**, and every draft carries
   a header asking for them to be re-checked before submission. A constant
   quoted wrongly is the easiest thing for an examiner to catch.

## Suggested assembly order

1. Settle the contribution wording with the guide, and apply it to 1, 2 and 8.
2. Verify the nine outstanding bibliography fields and close the seven gaps.
3. Re-check every quoted constant and test count against the code.
4. Convert to LaTeX, chapter by chapter, with the diagrams as `.svg`.
5. Appendices: the SRS, the test-case table, selected code. Not bulk listings.

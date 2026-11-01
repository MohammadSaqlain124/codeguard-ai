# Diagrams

Figures for the report and the viva, generated from the code rather than drawn
from the presentation. Each one has a Mermaid source beside it, so a figure
nobody can regenerate does not end up in the report — the same rule the
measurements folder works under.

```
theme.json                 palette and type, matching the web interface
01-architecture.mmd        the three tiers and the data stores
02-data-flow.mmd           one submission, upload to decision
03-data-model.mmd          the eight collections and their relationships
04-layer2-pipeline.mmd     how a baseline becomes a z-score
05-rps-composition.mmd     how the layers compose into the RPS
```

Each renders to `.svg` (vector, for LaTeX) and `.png` at 2x (for slides and
quick reading).

## Regenerating

Needs the Mermaid CLI, `npm install -g @mermaid-js/mermaid-cli`.

```
cd docs/diagrams
mmdc -i 01-architecture.mmd -o 01-architecture.svg -c theme.json -b transparent
mmdc -i 01-architecture.mmd -o 01-architecture.png -c theme.json -b white -s 2
```

Same two lines for each of the five.

## Captions

Written out here because a figure should be clean and the explanation belongs
underneath it. These are meant to be used as the report's caption text.

**Figure 1 — System architecture.** Three tiers and one detection service. The
web application never talks to the detector or to any data store; everything
goes through the API, which holds the only credentials. Redis is drawn inside
the application tier to keep the queue flow legible, but it is infrastructure
and runs as its own container. The worker is the same codebase as the API,
started with a different entry point, so a job and a request share one set of
services rather than two implementations that can drift.

**Figure 2 — One submission, end to end.** Ten steps across three phases. Step
4 is debounced by job id, so sixty uploads arriving at a deadline collapse into
a handful of detection runs rather than sixty. Step 7 stores the weights and
the review threshold *that produced the score* on the result itself, which is
what lets the evidence page stay readable after the configuration changes.
Step 10 is a design decision, not an omission: the student sees the recorded
decision and may answer it, and never sees a score, because a ranking a student
can read is a ranking they can tune against.

**Figure 3 — Data model.** Eight collections. `DetectionResult` carries both
layers' evidence rather than only their scores, which is what makes the
evidence page reproducible from stored data instead of recomputed on demand.
`isCurrent` and `revision` mean a re-run supersedes a result without destroying
it, because a decision may already have been recorded against the old one.
`AuditLog` is separate from the documents it describes so that a record of who
changed what cannot be edited by the same operation that changes it.

**Figure 4 — The Layer 2 pipeline.** The project's research contribution in one
figure, and the place to look first when defending it. Note what joins at the
z-score: the numerator comes from the student's own anchors, trust-weighted;
the denominator comes from the cohort, floored. A z here means *how far this
submission sits from this student's usual, measured in units of how much
students in this class differ from one another.* Both halves are load-bearing.
The floor exists because a cohort can produce zero spread on a coarse feature,
and dividing by zero gives infinity.

**Figure 5 — Composing the RPS.** With Layer 3 absent, the configured weights
0.4 / 0.3 / 0.3 are never the applied ones: the divisor is the sum of the
weights of the layers that actually ran, which is 0.7, so they act as
0.571 / 0.429. An absent layer contributes nothing rather than contributing
zero, because zero is a finding and an absent layer has made no finding.
`effectiveW2` is Layer 2's weight after attenuation by baseline confidence, so
a thin baseline reduces the layer's influence instead of being trusted at full
strength.

## What is deliberately not drawn

These show the system that exists, not the system the presentation describes.
Three things in the deck are absent here because they are absent in the code,
and the report should carry them as scope decisions rather than let an examiner
find the gap:

- **Layer 3, CodeBERT.** Dropped 06 October 2026. Figure 5 shows it greyed and
  excluded rather than omitting it, because its absence is what makes the
  renormalisation necessary.
- **The WebSocket push in slide 17, step 07.** Not built. The queue is polled
  by the reviewer rather than pushed to them.
- **The Monaco side-by-side AST diff in slide 19.** Not built. The evidence
  page shows matching line ranges and links to each file; rendering the two
  sources side by side needs both files fetched and a diff view.

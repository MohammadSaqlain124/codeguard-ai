# Chapter 8 — Conclusion and Future Work

> **Draft status, 04 November 2026.** §8.3 and §8.6 depend on how the project's
> claimed contribution is finally worded, which is pending a conversation with
> the project guide. See the flags in Chapter 2 §2.7 and Chapter 7 §7.9.

---

## 8.1 What was built

A working three-tier system that accepts programming assignment submissions,
ranks them for human review, and attaches to each ranking the evidence that
produced it.

- **35 HTTP endpoints** — 32 across four API routers, 3 on the detector.
- **Eight document collections**, including an audit log held separately from
  the records it describes.
- **Two detection layers in production**: structural similarity over normalised
  abstract syntax trees, and behavioural fingerprinting against a per-student
  baseline.
- **A renormalised composition** of those layers into one Review Priority Score
  that stores the weights and threshold that produced it.
- **A web interface** of ten pages, including a reviewer queue, an evidence view
  that guards its own arithmetic, and a student view that deliberately shows no
  score.
- **278 automated tests**, all of them in the continuous integration gate since
  01 November 2026.
- **A committed, re-runnable measurement programme** of seven scripts.

## 8.2 What the project established

**The architecture works and is defensible.** Credentials exist in exactly one
tier; an absent layer contributes nothing rather than zero; a result remains
interpretable after the configuration that produced it has changed; a re-run
supersedes without destroying. None of these is remarkable individually, and
together they are what makes the output auditable rather than merely computed.

**Layer 1 detects copying, measured.** In the positive control of the ablation
study, with a donor file inside the comparison pool, Layer 1's separation of
spliced from clean files rises monotonically with how much was copied — +0.0150,
+0.0335, +0.0706 — significant at all three fractions, with precision@10
reaching 1.000 where half the file was taken.

**The style features carry some author signal, within a project.** Across eleven
within-project tests, roughly 1.4× to 2.5× over chance where they work at all —
and they fail to beat chance in more than half the projects tested. That is the
honest figure and it survives checking.

**The two layers are independent.** Pearson −0.042 across 428 scored files, so
the premise on which the RPS weights them separately holds.

**The measurement programme is itself a result.** Every figure in Chapter 7 is
produced by a committed script that can be re-run, several of them reporting
ranges across 25 draws rather than point estimates — a practice adopted because
a single sample proved unreliable, not because it was planned.

## 8.3 What the project did not establish

**Layer 2 does not detect partial outsourcing, and that is the project's
headline negative result.** On the 214-pair style-shift corpus — 94 independent
source files — the behavioural layer did not separate spliced submissions from
clean ones at any splice fraction, and combining it with Layer 1 degraded
ranking precision.

The mechanism is understood and is structural rather than a matter of tuning,
and every link in the explanation is measured rather than argued:

1. The donors genuinely differ from the targets, by about 0.9 cohort standard
   deviations.
2. The **direction** of that difference is arbitrary: the donor sits above the
   target in 0.462 to 0.500 of pairs across the four features, none of them
   distinguishable from a coin flip.
3. The splice realises the predicted displacement almost exactly, 0.89 to 1.00.

A score that is a **magnitude** of deviation from a baseline therefore cannot
see it: a displacement of predicted size and arbitrary sign, applied to a point
already off centre, moves it closer about as often as further away. Separately,
`max_block_depth` is nearly inert for this task because a maximum is not a
mixable statistic.

**Layer 1's precision and recall on genuine plagiarism are unknown**, because no
labelled corpus of real student plagiarism exists. What was measured is the
distribution over honest work by different authors, which is a different claim.

## 8.4 Future work

Ordered by what unblocks the most, with preconditions stated rather than implied.

**1. Redesign Layer 2 around per-unit features and a signed comparison.** This
follows directly from §8.3 and is the single most valuable item. Two changes are
needed together: features computed per function or per window, so a spliced
region can be isolated instead of averaged into its host; and a signed or
population-referenced comparison, so that moving *toward* another author's
typical values is itself the signal rather than being invisible to a distance.
*Precondition: none. This is buildable now and the corpus to test it already
exists.*

**2. Implement Layer 3 for machine-generated code.** *Precondition: a labelled
corpus of student submissions from the course the system will police.* Without
it the layer can be built but never characterised, and an uncharacterisable
layer in an evidence system is worse than an absent one (Chapter 5 §5.4). The
precondition is the work, not the model.

**3. Reconsider the scored feature set.** The current four were selected from a
60-file sample and that selection is retracted: a 204-file measurement found
that nine of ten features clear F = 1 in Python, that the feature which drove
the original choice ranks ninth, and that using every applicable feature beats
the fixed four in both languages. A fixed four also cannot be right for both,
since two of them behave oppositely across the languages. *Precondition: none,
but it should follow item 1 rather than precede it, since the aggregation level
is the larger problem.*

**4. Build a labelled corpus of genuine plagiarism.** This is what would turn
Layer 1's distributional measurement into a precision and recall figure.
*Precondition: institutional access to adjudicated cases, with consent and
anonymisation — which is an ethics process, not an engineering task.*

**5. The deferred interface work.** WebSocket push for the review queue, the
side-by-side AST diff, and multi-file or archive submissions.

**6. Extend the ablation to Java.** The present study is Python only, and the
two most affected features behave oppositely across the two languages, so
nothing should be assumed to transfer.

## 8.5 On method

Three practices account for most of what this project got right, and all three
are transferable.

**Measure, then retract when the measurement disagrees.** Several published
claims in this project were withdrawn because a larger or better-controlled
measurement contradicted them: a similarity floor that did not hold, a feature
ranking that did not replicate, an AUC pair traceable to no run. Each retraction
is recorded with its reasoning rather than quietly corrected.

**Read code as well as run it.** Four defects in the ablation study were found
by reading, and not one would have been caught by running it, because each
produced output that looked like a result — a control that compared the wrong
file, a chance baseline that inflated every figure, a measurement of a strategy
the system does not deploy, and a significance verdict printed without its
direction.

**Render data and look at it.** Nine defects were found by displaying real data
on a screen and reading it, and two more by printing it to paper. A test asserts
a value; every one of these was something nobody had thought to assert.

## 8.6 Closing

The system set out to rank submissions for three kinds of misconduct:
collusion, outsourcing and machine generation. It ranks reliably for the first,
has a documented and justified absence for the third, and for the second it
produced a measured negative result with a diagnosed mechanism and a named fix.

> **To be finalised with the project guide.** How this chapter states the
> project's contribution depends on how the claimed novelty is reworded in light
> of §8.3. A negative result with a measured mechanism and a specific design
> remedy is a defensible final-year outcome; a claim contradicted by the
> project's own committed measurement script is not. Chapters 2 and 7 carry the
> same flag, and all three should be settled in one conversation.

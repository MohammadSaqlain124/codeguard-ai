# Chapter 1 — Introduction

> **Draft status, 04 November 2026.** §1.4 states the project's contribution and
> **must be settled with the project guide before submission** — Chapter 7 §7.9
> reports a result that narrows the claim the project set out with. Chapters 2
> §2.7 and 8 §8.6 carry the same flag and should be settled in one conversation.

---

## 1.1 The problem

Programming assignments are unusually easy to plagiarise and unusually hard to
check. Source code can be copied and then transformed — identifiers renamed,
statements reordered, whitespace and comments rewritten — until a text-based
comparison sees nothing, while the program remains the same program. A marker
reading fifty submissions cannot hold fifty files in mind well enough to notice
that two of them share a structure, and a marker reading five hundred cannot
begin.

There are three distinct problems hiding under the single word "plagiarism", and
they are not variations of one another:

**Collusion.** Two or more students submit substantially the same work. There
are at least two copies, and they are both in the cohort.

**Outsourcing.** A student submits work written by somebody else — a paid
third party, a senior, a friend outside the course. **There is exactly one copy,
and the author is not enrolled.**

**Machine generation.** A student submits work produced by a language model.
Again there is one copy, and again no second copy exists anywhere to compare
against.

Every widely deployed tool addresses only the first. MOSS and JPlag compare
submissions against one another, which is exactly the right design for
collusion and structurally incapable of seeing the other two. A tool that
compares submissions pairwise can detect only collusion, however good it is at
that.

## 1.2 Why a single similarity percentage is the wrong output

The conventional output of these tools is a similarity figure, and a
conventional institutional practice is to set a threshold on it.

This is wrong in a way that matters, and the clearest statement of why comes
from a systematic review rather than from this project: *tools do not find
plagiarism regardless of how good they are* \cite{novak2019}. Similarity is not
plagiarism. Two students taught the same algorithm in the same lecture, in a
language with strong idioms, writing a tightly specified exercise, will produce
similar code. A percentage above a threshold is a *judgement* the tool is not
entitled to make, presented in a format that invites it to be acted on
mechanically.

The consequences of acting on it mechanically fall on students, and they fall
hardest on the honest ones, because a flagged honest student has no second copy
to point at in their defence.

## 1.3 The approach: an evidence system, not a verdict machine

This project's governing principle is that the system produces **a ranking with
its evidence attached, and a human being decides.**

Concretely, that means:

- the output is an ordering of where a reviewer's attention is best spent, not a
  determination;
- every score carries the evidence that produced it, stored rather than
  recomputed, so it remains readable after the configuration changes;
- where the system cannot tell, it says so, instead of emitting a number that
  looks like an answer;
- a student may see the decision recorded about them and answer it, and may not
  see the score, because a ranking a student can read is a ranking a student can
  tune against.

The system asks two questions of a submission, in two layers. **Layer 1** asks
*does this resemble another submission?*, comparing normalised abstract syntax
trees so that renaming and reordering do not hide a copy. **Layer 2** asks a
different question, and it is the one the deployed tools cannot ask: *does this
resemble its own author's previous work?* That question needs no second copy,
which is why it is the only route to outsourced work.

A third layer, for machine-generated code, was specified and **deliberately not
built**; the reasoning is in Chapter 5 §5.4 and is a requirements argument
rather than a scheduling one.

The two layers are composed into a single **Review Priority Score**,
renormalised over the layers that actually ran, with the weights and threshold
that produced it stored on the result.

## 1.4 Objectives and contribution

The project's objectives were:

1. To build a working system that ingests programming submissions, scores them
   across multiple independent detection layers, and presents a ranked review
   queue with auditable evidence.
2. To design and implement behavioural fingerprinting — per-student stylistic
   baselining — as a route to detecting work with no second copy.
3. To protect honest students from the characteristic failure of such a system,
   a wrong baseline, through explicit integrity mitigations.
4. **To measure the result honestly enough to state where it fails.**

Objectives 1, 3 and 4 were met. Objective 2 was implemented and then measured,
and the measurement does not support it for partial outsourcing: Chapter 7
reports that the behavioural layer, as built, cannot detect a submission that is
partly somebody else's, together with a diagnosis of why and a specific design
remedy.

> **This section is not final.** How the contribution is stated depends on that
> result, and the wording is pending a conversation with the project guide. The
> defensible position is that the contribution is a working two-layer evidence
> system together with a measured negative result and a diagnosed mechanism —
> not a demonstrated capability to detect outsourced work. Chapters 2 §2.7 and
> 8 §8.6 must be settled consistently with whatever is decided here.

## 1.5 Scope

**In scope.** Single-file submissions in Python and Java; collusion detection by
structural similarity; behavioural baselining per student per language;
configuration per course with per-language overrides; a reviewer queue and
evidence view; a student view and right of reply; an audit log.

**Out of scope.** Detection of machine-generated code (Chapter 5 §5.4);
multi-file and archive submissions; languages other than Python and Java; any
automated action against a student. **No output of this system constitutes a
finding of academic misconduct.**

## 1.6 Structure of this report

| chapter | contents |
|---|---|
| 2 | Literature survey: where the layers come from, and where prior work stops |
| 3 | System analysis and requirements, summarising Appendix A |
| 4 | System design: architecture, data flow, data model, the Layer 2 pipeline, score composition |
| 5 | Implementation: how each layer works, and why Layer 3 does not exist |
| 6 | Testing and verification, including mutation testing |
| 7 | Results and discussion, including the negative result for Layer 2 |
| 8 | Conclusion and future work |
| 9 | References |
| A | Software Requirements Specification |

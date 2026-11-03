# Chapter 2 — Literature Survey

> **Draft status, 03 November 2026.** This prose was written from the argument
> and reading notes already recorded in `docs/report/chapter2_plan.md`, which
> states that every citation in `references.bib` was checked against a
> publisher record or an author's own copy. **No factual claim about any paper
> has been added here beyond what that plan records.** Two consequences follow,
> and both must be dealt with before submission:
>
> 1. Nine of the thirteen entries in `references.bib` still carry a TODO on at
>    least one field. Every one is a real publication with a confirmed title;
>    each needs a look at the publisher record. Chapter 2 can be written
>    around them, but the bibliography cannot be printed until they are filled.
> 2. The plan's target is 15 to 25 references and the bibliography holds 13.
>    The seven gaps are named in the plan's own table and restated in §2.8
>    below. Do not pad the count; close the named gaps.
>
> Sections are numbered for a nine-chapter LaTeX report. Citation keys match
> `references.bib`. Replace `\cite{}` with the house style if it differs.

---

## 2.1 What this chapter has to establish

A literature survey in a project report is often a sequence of summaries. That
is not what this chapter is for. Its job is to establish that the system
described in the chapters that follow needed building — that the gap it
occupies is a real gap in the published work, and not simply a gap in the
author's reading.

The argument runs in four steps, and the chapter is organised around those
steps rather than around chronology. Source-code similarity detection is a
mature field whose best work is explicit that it detects similarity and not
plagiarism. That maturity, however, is confined to one question: whether two
submissions resemble each other. Code authorship attribution asks a different
and more useful question, but asks it in a form that a university course cannot
supply the inputs for. Detection of machine-generated code exists but depends
on training data that a course cannot supply either. What is missing is not a
better algorithm in any one strand; it is a defensible way of combining them
and reporting the result so that a human being can act on it.

## 2.2 The anchoring result: tools do not find plagiarism

The most directly relevant published statement of this project's governing
principle is in Novak, Joy and Kermek's systematic review of source-code
similarity detection and the tools used in academia \cite{novak2019}. Their
review concludes that *tools do not find plagiarism regardless of how good they
are*, and that a human must judge what counts as plagiarism in a given academic
context. They identify JPlag, MOSS and Sherlock Warwick as the most promising
of the available tools, and they report two facts about the field that bear
directly on how this project should be evaluated: most academic tools are never
released, and most are never compared against one another.

This matters more than a design preference being validated. CodeGuard AI is
built as an evidence system rather than a verdict machine: it ranks submissions
for human review and attaches the evidence for its ranking, and it deliberately
does not decide whether plagiarism occurred. Stated by the author of a project,
that is a preference, and it invites the objection that ranking rather than
deciding is a way of avoiding the hard part of the problem. Stated in *ACM
Transactions on Computing Education* by the authors of a systematic review, it
is a position with support behind it.

It also supplies the justification for the specific output this system
produces. If a tool cannot determine plagiarism, then a single similarity
percentage compared against a threshold is the wrong interface, because it
presents a judgement the tool is not entitled to make. A ranked score with its
evidence attached presents what the tool actually has: an ordering of where a
reviewer's attention is best spent.

## 2.3 Token and fingerprint methods, and the question they cannot ask

The dominant family of deployed tools compares submissions as sequences of
tokens. Schleimer, Wilkerson and Aiken's winnowing algorithm
\cite{schleimer2003} is the fingerprinting scheme behind MOSS. Winnowing
selects the minimum hash from each window of consecutive k-gram hashes, which
yields a guarantee that any shared substring of length at least `w + k - 1`
produces at least one matching fingerprint. That guarantee is the reason MOSS
both works and scales: the index is a small fraction of the corpus, and the
matching property is provable rather than empirical.

JPlag \cite{prechelt2002} takes a different route to the same question. It
tokenises each submission using a language-aware front end, so that identifier
names and formatting are discarded before comparison, and then runs greedy
string tiling over the resulting token streams to find maximal matching
segments.

Both are strong, mature, and widely used. Both also share a structural
limitation, and it is this limitation that opens the space the present project
occupies: **they compare submissions against each other.** They are built to
answer the question *did two students hand in the same work?* Consequently
there are three forms of academic misconduct they cannot see at all:

- work outsourced to a paid third party, where no second copy exists anywhere
  in the cohort;
- work generated by a language model, for the same reason;
- work taken from a previous year's cohort, unless that corpus has been
  retained and is included in the comparison set.

A tool that compares submissions pairwise can detect collusion and nothing
else. Collusion is real and is the most common case, which is why these tools
remain valuable. But it is one of the three threats named in this project's
scope, and the other two require a different question to be asked of a
submission: not *does this resemble another submission?* but *does this
resemble its own author?*

## 2.4 Tree and AST methods: Layer 1's ancestry

Moving from token streams to syntax trees is what buys resistance to the
obfuscations a student actually applies. Renaming identifiers, reordering
independent statements and reformatting whitespace all change the token stream
while leaving the abstract syntax tree largely intact, because an AST discards
precisely the surface detail those transformations alter.

The algorithm this project's structural layer calls directly is APTED, from
Pawlik and Augsten \cite{pawlik2016}. Their earlier RTED paper
\cite{pawlik2015} establishes the dynamic decomposition strategy that the later
work builds on, and the authors ask that both be cited together; this report
does so. DECKARD \cite{jiang2007} takes the alternative path: rather than
computing an edit distance between trees, it characterises subtrees as
numerical count vectors and clusters them using locality-sensitive hashing,
trading exactness for scale. The distinction is worth stating explicitly in a
report whose own Layer 1 chooses exactness and then prefilters to recover
scale, which is a hybrid of the two positions.

Zakeri-Nasrabadi et al.'s systematic review \cite{zakeri2023} supplies the
taxonomy within which Layer 1 can be located: text, token, tree, graph, metric,
learning, image and test-based approaches, with hybrids the most common
category at approximately 28% of the studies surveyed. Two of their findings
should be carried into this report rather than discovered under questioning.

First, **Type IV (semantic) clones remain hard, and many techniques cannot
detect them at all.** Layer 1 shares that limitation. Two implementations of
the same algorithm with different structure will not be matched by tree edit
distance, and the report should say so in its limitations rather than imply a
generality the method does not have.

Second, their observation that close to half of surveyed tools support Java
while many languages have little or no support is the cleanest available
justification for this project measuring both Java and Python separately
instead of asserting language portability. The measurements in Chapter 7 report
the two languages apart from each other for exactly this reason.

## 2.5 Authorship attribution: Layer 2's ancestry, and its trap

Code stylometry asks who wrote a file from its style alone. Caliskan-Islam et
al. \cite{caliskan2015} is the canonical result, reporting roughly 94% accuracy
across 1,600 programmers and 98% across 250, using lexical, layout and
AST-derived features on Google Code Jam submissions. Frantzeskou et al.'s SCAP
method \cite{frantzeskou2006} reaches comparable accuracy from byte-level
n-gram author profiles without parsing the source at all. Abuhamad et al.
\cite{abuhamad2019} extend the task to large author populations using deep
feature learning.

This is Layer 2's intellectual ancestry, and it is also the single most
dangerous body of work for this project to be measured against. An examiner who
has read Caliskan-Islam will ask why this project reports a lift of roughly
**1.4x to 2.5x over chance** where the literature reports **94% accuracy**. The
question sounds damning. The answer is not, and it belongs here in Chapter 2
rather than being offered defensively in Chapter 7 after the numbers have
already been presented.

**The task is not the same one.** The attribution literature performs
closed-set identification: given a file and a known list of N candidate
authors, select the author. Layer 2 performs anomaly detection against a single
reference: given a file and this student's own earlier work, is it consistent
with that work? There is no candidate list, and there cannot be one, because
the ghostwriter is not enrolled in the course. The two tasks share features and
share nothing else.

**The feature budget is not the same.** Those systems use hundreds to thousands
of features, including deep AST-derived ones. The scoring in this project uses
four, for two reasons: four is what survived measurement on real code, and
every feature contributing to a flag must be explainable to a student who
contests it. A feature a reviewer cannot explain is not evidence, whatever it
contributes to an accuracy figure.

**The data is not the same.** Google Code Jam provides many authors solving
*identical* problems, which holds the task constant and allows style to
dominate the signal. Coursework has the same property, which makes it the fair
comparison. The figures this project reports, however, come from library code
across 26 open-source repositories, where the project's own conventions act as
a confound; the honest within-project figures are the lower ones, and Chapter 7
reports them as such.

**The success criterion is not the same.** Attribution is graded on selecting
the correct author. Layer 2 is graded on whether a human reviewer, shown the
evidence, reaches a defensible decision. A 2x lift that surfaces the right
twenty submissions out of five hundred is useful to a marker. A 94% attribution
accuracy over a candidate set that does not contain the actual author is not a
useful number at all.

Positioning the project against this literature before presenting results is
considerably stronger than defending the gap afterwards, and this chapter should
do so explicitly.

## 2.6 Detection of machine-generated code, and why Layer 3 was dropped

The fourth strand is the newest. Nguyen et al. \cite{nguyen2023}, with the
journal version appearing as GPTSniffer \cite{gptsniffer2024}, fine-tune
CodeBERT to distinguish human-written from ChatGPT-written code, and report
outperforming GPTZero and OpenAI's own text classifier on that task. Two of
their findings are directly relevant: performance improves when the training
data resembles the target code, and it improves when snippets are classified in
pairs rather than individually.

**The first of those findings is the argument for dropping this project's third
layer, and the report presents it as a decision rather than as an omission.** A
classifier whose accuracy depends on its training data resembling the target
requires a labelled corpus of student work drawn from the course it will
police. No such corpus exists for this project, and none can be manufactured
honestly: generating one would mean producing synthetic "AI-written" student
submissions and treating the result as ground truth.

Without that corpus the layer could still be implemented, but its performance
could never be reported. In a system whose entire premise is auditable
evidence, a layer that produces a number nobody can characterise is worse than
a layer that is absent, because a reviewer has no basis on which to weigh it.
The architecture therefore records the layer's absence explicitly rather than
silently omitting it — every detection result stores
`aiContent: { status: "skipped", reason: "Layer 3 is not implemented yet" }` —
and Chapter 8 lists the layer as future work with the labelled corpus named as
its precondition.

This has a consequence for the score composition that Chapter 4 describes in
detail and that is worth flagging here: because the third layer never runs, the
configured weights are renormalised over the layers that did run, and the
headline weights are therefore never the applied ones.

## 2.7 The gap this project occupies

Drawing the four strands together.

Similarity detection is mature, and the best of it is honest about what it
does: it finds similarity, not plagiarism, and a human decides \cite{novak2019}.
But similarity detection can only see collusion, because it compares
submissions against one another \cite{schleimer2003, prechelt2002}. Tree-based
methods make that comparison robust to the obfuscations students actually apply
\cite{pawlik2016, jiang2007}, which is a genuine improvement, but it does not
change the question being asked. Authorship attribution asks a question that
could in principle see outsourced work, and asks it well
\cite{caliskan2015, frantzeskou2006, abuhamad2019} — but it is posed as
closed-set identification against a candidate list, and a course does not have
one. Detection of machine-generated code exists, and its accuracy depends on
in-distribution training data that a course does not have either
\cite{gptsniffer2024}.

The contribution claimed by this project is therefore not a better algorithm in
any one of these strands. It is the combination of structural similarity with
per-student stylistic baselining, composed into a single ranked and auditable
figure with its evidence attached, measured honestly enough to state where it
fails.

That is a defensible contribution for a final-year project, and it is defensible
precisely because it does not claim to beat Caliskan-Islam et al. at their own
task.

> **Required revision before submission.** The claim in the paragraph above is
> stated as the project's contribution. The measurement reported in Chapter 7
> does not support the stylistic-baselining half of it on the one corpus built
> to test it: on 214 spliced pairs the behavioural layer did not detect partial
> outsourcing, and the mechanism for that failure is now understood. **The
> wording of this project's claimed novelty therefore has to be settled with
> the project guide before this section is finalised**, and Chapter 7 must be
> written first. Do not submit §2.7 in its present form.

## 2.8 Limitations of this survey

Stating these is better than leaving an examiner to find them.

**Coverage.** The bibliography holds 13 entries against a target of 15 to 25.
The gaps are specific rather than general, and each is wanted for a stated
purpose:

| missing | wanted for |
|---|---|
| Baxter et al., clone detection using ASTs, ICSM 1998 | the origin of AST-based clone detection; Layer 1's grandparent |
| Joy and Luck, plagiarism in programming assignments | the lexical/structural obfuscation taxonomy \cite{novak2019} draws on |
| CCFinder (Kamiya et al.) | the token-based industrial counterpoint to DECKARD |
| a study of student plagiarism behaviour | Chapter 1 needs evidence that the problem is real and common, not assumed |
| Sherlock (Warwick) | named in \cite{novak2019}'s top three; worth a paragraph |
| contract cheating / essay mills | the outsourcing threat model Layer 2 exists to address |
| a reference for one-way ANOVA and the F ratio | Chapter 7's method needs a citation, not only an explanation |

Baxter et al. could not be verified at the time of the original search and
**must not be cited until it has been**.

**Verification state.** Four entries have every field confirmed
(`novak2019`, `prechelt2002`, `caliskan2015`, `nguyen2023`). The remaining nine
are real publications with confirmed titles and at least one unconfirmed field.
During the first drafting of the bibliography three fields were written from
memory rather than read from a source — a DOI on `schleimer2003` and the author
lists on `frantzeskou2006` and `abuhamad2019` — and were removed on a second
pass. That is recorded because the bibliography's own header forbids exactly
that practice, and the rule only caught the error because the file was audited
after being written.

**Depth.** This survey positions the project against prior work; it does not
reproduce or re-implement any of it. No claim in this chapter rests on a
comparison this project ran. Where the report compares its own figures against
published ones, as in §2.5, the comparison is of *tasks* and not of results, and
is argued rather than measured.

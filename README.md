# CodeGuard AI

**An Authorship-Evidence System for Detecting Copied, Outsourced and AI-Generated Code**

Final-year B.Tech major project · Department of Computer Science & Engineering  
Invertis University, Bareilly · AY 2026–27

---

## The problem

Existing code-plagiarism tools (MOSS, JPlag) compare submissions against each other.
That catches one thing: two students who shared a file.

It misses the two forms of dishonesty that now matter more:

- **Outsourced code** — written by a paid third party. It matches nobody in the
  cohort, so a pairwise comparator sees nothing.
- **AI-generated code** — produced by an LLM. Every generation is textually
  distinct, so pairwise similarity is near zero by construction.

CodeGuard AI addresses all three cases.

## What this is — and what it is not

This is an **evidence system**, not a verdict machine.

It produces a **Review Priority Score (RPS)** whose only job is to rank the
faculty review queue, alongside inspectable evidence for every score. A human
makes every decision. Nothing is automated beyond the ranking.

The analogy we use: a metal detector at an airport. It beeps so a trained person
knows where to look. It does not arrest anyone.

## How it works — three detection layers

| Layer | Signal | Method | Needs student history? |
|-------|--------|--------|------------------------|
| 1 · Structural | Copied code | AST fingerprinting + tree edit distance | No |
| 2 · Behavioral | Outsourced code | Per-student stylometric baseline | Yes |
| 3 · AI-Content | LLM-generated code | Fine-tuned CodeBERT classifier | No |

```
RPS = w1·structural + w2·behavioral + w3·ai_content
```

A transparent weighted sum, with per-course weights configurable by faculty and
displayed openly in the evidence view. Deliberately not a learned model: there is
no labelled cheated/honest dataset to train one, and a black box is not defensible
in a disciplinary hearing.

## Baseline integrity

Layer 2 compares a submission against the student's own history, which assumes
that history is authentic. If a student used AI from their very first submission,
the baseline is poisoned — and the failure inverts. The poisoned baseline becomes
"their style," so their first honest submission deviates sharply and gets flagged.
The dishonest work looks clean; the honest work gets accused.

Five mitigations:

1. **Anchor samples** — baselines are built only from invigilated work (lab
   exercises, lab exams, viva code). Every submission carries a `provenance` field.
2. **Score but do not absorb** — an unverified submission is evaluated against the
   baseline but never added to it without faculty confirmation.
3. **Trust-weighted baseline** — invigilated 1.0, faculty-confirmed take-home 0.3,
   flagged or unreviewed 0.0. A baseline confidence value is displayed with every
   RPS, and `w2` is attenuated automatically when confidence is low.
4. **Low-variance detection** — human style wobbles across submissions; consistent
   AI output does not. Implausibly low intra-student variance relative to the
   cohort is flagged as a separate signal. This works even on a poisoned baseline,
   because it needs no clean reference.
5. **Graceful degradation** — Layers 1 and 3 need no history at all. At zero
   baseline confidence the system falls back to a two-layer detector that still
   beats MOSS and JPlag.

**Known limitation, stated openly:** with zero invigilated anchors and a student
who has used AI with perfect consistency since their first submission, Layer 2
will not catch them. Only Layer 3 stands in the way.

## Architecture

```
                    ┌──────────────┐   ┌──────────────┐
                    │  React web   │   │   Android    │
                    └──────┬───────┘   └──────┬───────┘
                           │                  │
                           └────────┬─────────┘
                                    │ REST + JWT
                           ┌────────▼─────────┐
                           │   Node API       │
                           │  auth · storage  │
                           │  orchestration   │
                           └──┬───┬───┬───┬───┘
                              │   │   │   │
              ┌───────────────┘   │   │   └──────────────┐
              │          ┌────────┘   └───────┐          │
        ┌─────▼─────┐ ┌──▼───┐          ┌─────▼────┐ ┌───▼────────┐
        │  MongoDB  │ │Redis │          │  MinIO   │ │  Python    │
        │           │ │queue │          │  files   │ │  detector  │
        └───────────┘ └──────┘          └──────────┘ └────────────┘
```

The Python detection service is a separate process because the required libraries
(tree-sitter, APTED, PyTorch, transformers) exist only in Python, and because
tree edit distance is CPU-bound work that would block Node's single-threaded
event loop. Heavy jobs are queued through Redis rather than called synchronously.

## Tech stack

| Layer | Technology |
|-------|------------|
| Web frontend | React 18 · TypeScript · Vite · Tailwind · Monaco Editor |
| Mobile | Kotlin · Jetpack Compose · Retrofit · FCM |
| API tier | Node.js · Express · TypeScript · Mongoose · Zod · JWT · BullMQ |
| Detection | Python 3.11 · FastAPI · tree-sitter · APTED |
| Data science | PyTorch · HuggingFace Transformers · scikit-learn · pandas · SHAP |
| Storage | MongoDB · Redis · MinIO |
| DevOps | Docker Compose · GitHub Actions · Nginx |

Deliberately not used: Kubernetes, gRPC, ClickHouse, FAISS, Vault, ELK.
Docker Compose runs the entire stack.

## Repository layout

```
apps/
  web/            React dashboard (teacher + student)
  api/            Node + Express REST tier
  detector/       Python + FastAPI detection service
  mobile/         Android companion app
packages/
  shared-types/   TypeScript types shared by web and api
harness/          Obfuscation benchmark — labelled plagiarism pair generator
ml/               Model training scripts, notebooks, model cards
infra/            docker-compose.yml, nginx.conf, .env.example
docs/             Project notes, SRS, ADRs, evaluation results
scripts/          Development helpers
```

## Getting started

**Prerequisites:** Docker Desktop, Git. Nothing else — Node and Python run
inside containers.

```bash
git clone https://github.com/MohammadSaqlain124/codeguard-ai.git
cd codeguard-ai
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml up --build
```

Once running:

| Service | URL |
|---------|-----|
| API health | http://localhost:4000/health |
| Detector health | http://localhost:8000/health |
| MinIO console | http://localhost:9001 |

Both health endpoints should return HTTP 200.

## Scope

**In scope:** single-file detection for Python and Java (C++ if time allows) ·
all three layers · baseline integrity subsystem · teacher and student dashboards ·
Android companion · REST API for LMS integration · quantitative evaluation.

**Out of scope:** multi-file / whole-repository analysis · keystroke monitoring ·
OCR of handwritten work · any automated disciplinary decision.

## Status

Tier 1 (must ship) · Phase 0 — scaffolding. In progress.

Detection logic is not yet implemented. See `docs/PROJECT_NOTES.md` for the
day-by-day build log.

## Team

| Name | Roll No. | Responsibility |
|------|----------|----------------|
| Mohd Saqlain Hussain | BCS2023126 | Lead · MERN platform + AST detection core |
| Vanshika Uppal | BCS2023143 | Behavioral fingerprinting + analytics |
| Trisha Bharadwaj | BCS2023148 | CodeBERT + ablation study |
| Shubham Raghav | BCS2023125 | Android mobile companion |

**Project Guide:** Mr. Ashish Sharma · Department of CSE, Invertis University

## License

Academic project. Not licensed for production use.
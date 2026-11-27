"""Builds the CodeGuard AI project report as a .docx in the department's format.

Every factual claim here is either measured and reproducible from the repo, or
marked as not measured. Section 11 replaces the synopsis's "Expected Outcomes"
with what was actually obtained.
"""

import os

from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DOC = Document()
HEADINGS = []
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "invertis_logo.png")
import json, os

# ---------------------------------------------------------------- styles --
st = DOC.styles["Normal"]
st.font.name = "Times New Roman"
st.font.size = Pt(12)
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
pf = st.paragraph_format
pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
pf.line_spacing = 1.5
pf.space_after = Pt(6)

for s in DOC.sections:
    s.top_margin = Inches(1.0)
    s.bottom_margin = Inches(1.0)
    s.left_margin = Inches(1.25)
    s.right_margin = Inches(1.0)


def page_border(section):
    """The cover page in the department format carries a box border."""
    pg = section._sectPr
    borders = OxmlElement("w:pgBorders")
    borders.set(qn("w:offsetFrom"), "page")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "18")
        el.set(qn("w:space"), "24")
        el.set(qn("w:color"), "000000")
        borders.append(el)
    pg.append(borders)


def para(text="", size=12, bold=False, italic=False, align="justify",
         space_after=6, space_before=0, line=1.5):
    p = DOC.add_paragraph()
    p.paragraph_format.alignment = {
        "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }[align]
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = line
    if text:
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.italic = italic
        r.font.name = "Times New Roman"
    return p


def h1(text):
    HEADINGS.append((1, text))
    # page_break_before on the heading itself, rather than add_page_break(),
    # which leaves an empty paragraph behind and with it a blank page
    p = DOC.add_heading(text, level=1)
    p.paragraph_format.page_break_before = True
    p.paragraph_format.space_after = Pt(10)
    for r in p.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(16)
        r.font.color.rgb = RGBColor(0, 0, 0)
        r.bold = True


def h2(text):
    HEADINGS.append((2, text))
    p = DOC.add_heading(text, level=2)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(10)
    for r in p.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(0, 0, 0)
        r.bold = True


def h3(text):
    para(text, size=12, bold=True, align="left",
         space_after=3, space_before=8, line=1.2)


def bullets(items, size=12):
    for it in items:
        p = DOC.add_paragraph(style="List Bullet")
        p.paragraph_format.line_spacing = 1.3
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r = p.add_run(it)
        r.font.size = Pt(size)
        r.font.name = "Times New Roman"


def table(headers, rows, widths=None):
    t = DOC.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    for i, htxt in enumerate(headers):
        c = t.rows[0].cells[i]
        c.text = ""
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(htxt)
        r.bold = True
        r.font.size = Pt(11)
        r.font.name = "Times New Roman"
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(str(val))
            r.font.size = Pt(11)
            r.font.name = "Times New Roman"
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Inches(w)
    para("", space_after=4)
    return t



def start_body_section():
    """Cover keeps the box border; the body does not. Separate sections are the
    only way OOXML expresses that, so the body gets its own sectPr with the
    inherited border stripped out."""
    s = DOC.add_section(WD_SECTION.NEW_PAGE)
    s.top_margin = Inches(1.0)
    s.bottom_margin = Inches(1.0)
    s.left_margin = Inches(1.25)
    s.right_margin = Inches(1.0)
    for b in s._sectPr.findall(qn("w:pgBorders")):
        s._sectPr.remove(b)
    return s


def footer_page_numbers(section):
    para_ = section.footer.paragraphs[0]
    para_.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = para_.add_run()
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    for instr, kind in (("begin", "w:fldChar"), ("PAGE", "w:instrText"), ("end", "w:fldChar")):
        el = OxmlElement(kind)
        if kind == "w:fldChar":
            el.set(qn("w:fldCharType"), instr)
        else:
            el.set(qn("xml:space"), "preserve")
            el.text = " PAGE "
        r._r.append(el)


PAGE_MAP = {}
if os.path.exists("toc_pages.json"):
    PAGE_MAP = json.load(open("toc_pages.json", encoding="utf-8"))


def toc_entry(level, text, page):
    """A real contents line with a dotted leader, so it renders everywhere
    rather than only after Word is asked to update its fields."""
    p_ = DOC.add_paragraph()
    pf_ = p_.paragraph_format
    pf_.line_spacing = 1.3
    pf_.space_after = Pt(2)
    pf_.left_indent = Inches(0.0 if level == 1 else 0.3)
    pf_.alignment = WD_ALIGN_PARAGRAPH.LEFT
    tabs = p_.paragraph_format.tab_stops
    tabs.add_tab_stop(Inches(6.0), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    r = p_.add_run(text + "\t" + str(page))
    r.font.size = Pt(12 if level == 1 else 11)
    r.font.name = "Times New Roman"
    r.bold = level == 1
    return p_._p


# ================================================================= COVER ==
page_border(DOC.sections[0])
para("", space_after=12)
_logo_p = DOC.add_paragraph()
_logo_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
_logo_p.paragraph_format.space_after = Pt(24)
_logo_p.add_run().add_picture(LOGO, width=Inches(3.44), height=Inches(1.11))
para("Invertis University, Bareilly [UP]", size=18, align="center", space_after=2, line=1.15)
para("(2026–27)", size=18, align="center", space_after=28, line=1.15)
para("FACULTY OF COMPUTER SCIENCE AND ENGINEERING", size=13, bold=True,
     align="center", space_after=40, line=1.15)
para("A Project Report on", size=12, italic=True, align="center", space_after=6, line=1.15)
para("CodeGuard AI", size=24, bold=True, align="center", space_after=6, line=1.15)
para("An Authorship-Evidence System for Code Integrity, Using Abstract Syntax "
     "Trees and Behavioural Fingerprinting", size=12, align="center",
     space_after=36, line=1.3)
para("Submitted By:", size=12, bold=True, align="right", space_after=4, line=1.2)
for n, roll in [("Mohd Saqlain Hussain", "BCS2023126"),
                ("Vanshika Uppal", "BCS2023143"),
                ("Trisha Bharadwaj", "BCS2023148"),
                ("Shubham Raghav", "BCS2023125")]:
    para(f"{n} — {roll}", size=12, align="right", space_after=2, line=1.2)
para("", space_after=24)
para("Under the guidance of:", size=12, italic=True, align="center", space_after=4, line=1.2)
para("Mr. Ashish Sharma", size=12, bold=True, align="center", line=1.2)

# ====================================================== ACKNOWLEDGEMENT ==
body_section = start_body_section()
footer_page_numbers(body_section)
para("ACKNOWLEDGEMENT", size=14, bold=True, align="center", space_after=16, line=1.2)
for t in [
    "The completion of this project would not have been possible without the "
    "support, guidance and encouragement of many people, and we take this "
    "opportunity to express our sincere gratitude to all of them.",

    "We extend our heartfelt thanks to our guide, Mr. Ashish Sharma, for his "
    "constant support, his willingness to question our assumptions, and his "
    "insistence that a claim is not a result until it has been measured. "
    "Several sections of this report exist in their present form because he "
    "asked what the evidence was.",

    "We are grateful to the Department of Computer Science and Engineering "
    "for providing the infrastructure and the academic environment in which a "
    "project of this scope could be attempted, and to all faculty members of "
    "the department whose teaching laid the foundation this work is built on.",

    "We acknowledge the open-source projects this system depends on directly: "
    "tree-sitter and its Python and Java grammars, the APTED tree edit "
    "distance implementation, FastAPI, Express, Mongoose, BullMQ and Vitest. "
    "We also acknowledge the authors of MOSS, JPlag and CodeBERT, whose "
    "published work defined the problem space we are working in and against "
    "which our approach is positioned.",

    "Finally, we thank our families and friends for their patience during the "
    "long hours of building, measuring, and on several occasions discarding "
    "results that did not survive checking.",
]:
    para(t)

# ============================================================== ABSTRACT ==
DOC.add_page_break()
para("ABSTRACT", size=14, bold=True, align="center", space_after=16, line=1.2)
for t in [
    "Academic dishonesty in programming coursework has changed shape with the "
    "widespread availability of large language models. Established similarity "
    "detectors such as MOSS and JPlag identify near-duplicate submissions "
    "reliably, but they operate on the assumption that the answer exists "
    "somewhere else to be compared against. Code that is outsourced to another "
    "person, or generated by a language model, matches nothing and is "
    "therefore invisible to that class of tool.",

    "This project presents CodeGuard AI, a multi-layer system that produces "
    "ranked, explainable evidence about which submissions merit human review. "
    "Three independent signals are computed. The structural layer parses "
    "source code into abstract syntax trees and compares their shape, so that "
    "renaming, reordering and reformatting do not defeat it. The behavioural "
    "layer builds a style profile for each student from invigilated work only, "
    "and scores later submissions against that profile and against the "
    "student's own cohort. The authorship layer trains a classifier over word "
    "and character n-gram features to separate human-written student code "
    "from AI-generated code.",

    "The system is deliberately constrained to produce evidence rather than "
    "verdicts. No output of the system constitutes an accusation, no penalty "
    "is applied automatically, and a faculty member must record an explicit "
    "decision on every reviewed case. This constraint follows from the "
    "asymmetry of the errors involved: a missed case costs a mark, while a "
    "false accusation can cost a student a year.",

    "The authorship layer achieved a ROC AUC of 0.9521 on a group-disjoint "
    "held-out set, correctly leaving 93.2 per cent of human files unflagged "
    "and identifying 88.0 per cent of unmodified AI-generated files. On files "
    "where AI-generated code was mixed into human work, which is the realistic "
    "case, detection fell to 37.5 per cent. Two candidate confounds were "
    "tested and rejected. The behavioural layer scored lower on files "
    "containing another author's code than on the clean originals, at every "
    "proportion tested, which is the opposite of the intended direction; this "
    "result is reported rather than omitted, and the layer is weighted "
    "accordingly.",

    "The system is implemented as a React front end, a native Android client, "
    "a Node and Express API with a background worker, and a stateless Python "
    "detection service, and is deployed and publicly reachable. The API is "
    "covered by 155 automated tests which run on every push.",
]:
    para(t)
para("", space_after=6)
p = DOC.add_paragraph()
p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
r = p.add_run("Keywords: ")
r.bold = True
r.font.size = Pt(12)
r.font.name = "Times New Roman"
r = p.add_run("Code Plagiarism Detection, Abstract Syntax Tree, Tree Edit "
              "Distance, Behavioural Fingerprinting, AI-Generated Code "
              "Detection, CodeBERT, Academic Integrity, Explainable Evidence")
r.font.size = Pt(12)
r.font.name = "Times New Roman"

# ============================================================== CONTENTS ==
DOC.add_page_break()
para("TABLE OF CONTENTS", size=14, bold=True, align="center", space_after=16, line=1.2)
TOC_ANCHOR = len(DOC.paragraphs)

# ========================================================= 1 INTRODUCTION =
h1("1. Introduction")

h2("1.1 Purpose")
para("CodeGuard AI is a code integrity system for academic environments. It "
     "examines programming submissions and produces, for each one, a ranked "
     "and explainable indication of how strongly it merits review by a "
     "faculty member. It is designed to address three distinct cases: code "
     "copied from another student, code obtained from a third party, and code "
     "generated by an AI assistant.")
para("The system is explicitly not a judgement system. It does not classify a "
     "submission as plagiarised, it does not apply any penalty, and it does "
     "not close a case on its own. Every output is evidence presented to a "
     "human being who then makes and records a decision.")

h2("1.2 Motivation")
para("Similarity-based plagiarism detection rests on an assumption that no "
     "longer holds universally. MOSS and JPlag compare a submission against a "
     "corpus of other submissions and report overlap. This works when the "
     "dishonest act is copying, because the source exists and can be found.")
para("When a student pays a third party to write an assignment, or asks a "
     "language model to produce it, the resulting code is original. It "
     "matches no other submission in the class and no public repository. "
     "Every similarity score is low, and the tool reports nothing. The "
     "detection failure is not a matter of tuning a threshold; it is "
     "structural.")
para("This creates a measurable gap in how programming coursework can be "
     "assessed fairly, and it is the gap this project addresses.")

h2("1.3 Problem Statement")
para("Existing systems used in programming education exhibit the following "
     "limitations:")
bullets([
    "They detect similarity between submissions, not authorship of a submission.",
    "They cannot identify AI-generated code, because such code is original by construction.",
    "They hold no model of an individual student, so a change in how a particular student writes is not observable.",
    "They report a score without the evidence behind it, which makes the score difficult for a faculty member to act on responsibly.",
])
para("CodeGuard AI addresses these by combining three independent detection "
     "signals and by presenting the evidence behind every number it produces.")

# =========================================================== 2 OBJECTIVES =
h1("2. Objectives")

h2("Primary Objectives")
table(["Objective", "Status"], [
    ["Develop a multi-layer detection system in which the layers fail independently", "Achieved"],
    ["Implement AST-based structural comparison robust to renaming and reformatting", "Achieved"],
    ["Build per-student behavioural fingerprinting with cohort calibration", "Implemented; not validated (see 11.3)"],
    ["Detect AI-generated code using a transformer-based classifier", "Measured offline; not wired into live scoring (see 11.2)"],
    ["Provide a faculty review interface showing the evidence behind each score", "Achieved"],
], widths=[4.4, 1.9])

h2("Secondary Objectives")
table(["Objective", "Status"], [
    ["Support more than one programming language", "Achieved for Python and Java"],
    ["Provide a documented REST API suitable for external integration", "Achieved; OpenAPI 3.0 specification published"],
    ["Allow the system to be self-hosted with no external dependency", "Achieved; full stack runs under Docker Compose"],
], widths=[4.4, 1.9])
para("The status column is stated at the level the evidence supports. Two "
     "objectives were not met in full, and the sections referenced explain "
     "precisely in what respect.", italic=True)

# ====================================================== 3 SYSTEM OVERVIEW =
h1("3. System Overview")
para("CodeGuard AI computes three independent signals for each submission. "
     "The design principle is that the layers should fail in different "
     "circumstances, so that a case invisible to one is visible to another.")

h3("Layer 1 — Structural Similarity")
bullets([
    "Source code is parsed into an abstract syntax tree using tree-sitter, discarding comments, identifier names and formatting.",
    "Trees are compared using the APTED tree edit distance algorithm.",
    "Renaming every identifier, reordering functions and reformatting a file leave the tree largely unchanged, so these common disguises do not defeat the layer.",
    "Known limitation: a shared template, a taught algorithm or a small problem space also produces high structural similarity. The layer therefore contributes to a ranking and never to a conclusion.",
])

h3("Layer 2 — Behavioural Fingerprinting")
bullets([
    "A style baseline is built for each student from invigilated submissions only, where authorship is not in question.",
    "Four style features are scored: blank line ratio, average line length, maximum block depth, and comment density.",
    "Each feature is converted to a z-score against the student's own history, and the four are combined as a root mean square so that one strongly deviant feature remains visible.",
    "The student's cohort on the same assignment is measured in parallel, so that an assignment which shifts the whole class does not flag an individual.",
    "A student is excluded from their own cohort statistics, so that an outlier cannot move the baseline toward itself.",
])

h3("Layer 3 — Authorship Classification")
bullets([
    "A logistic-regression classifier over word and character n-gram features is trained to separate human-written student code from AI-generated code.",
    "A transformer model, CodeBERT, is specified and unit tested but has never been trained, so no transformer result is reported anywhere in this document.",
    "It is evaluated offline and reported in Section 11. It is not connected to the live scoring path.",
    "The reason for that decision is given in Section 11.2 and follows from the measured failure mode rather than from implementation difficulty.",
])

h3("Final Output")
para("Signals are combined into a Review Priority Score:")
para("RPS = w₁·s + w₂·b + w₃·a", align="center", bold=True)
para("where s, b and a are the structural, behavioural and authorship scores "
     "and w₁, w₂, w₃ are per-course weights set by faculty. When a layer "
     "cannot produce a score, its weight is removed and the remaining weights "
     "are renormalised. A signal that did not run is never treated as a signal "
     "indicating innocence, and the interface states which layers contributed.")

# ============================================================== 4 SCOPE ===
h1("4. Scope of the Project")

h2("In Scope")
bullets([
    "Single-file source code submissions in Python and Java.",
    "Structural similarity detection within an assignment cohort.",
    "Per-student behavioural baselines built from invigilated work.",
    "Offline measurement of AI-generated code detection.",
    "Faculty review interface with per-layer evidence and a recorded decision.",
    "Role-based access for student, faculty and administrator.",
    "Audit logging of every review action.",
])

h2("Out of Scope")
bullets([
    "Multi-file or whole-project analysis. Submissions are single files, capped at 256 KB and 5000 lines.",
    "Real-time monitoring of a student while they write.",
    "Natural language plagiarism, which is addressed by other established tools.",
    "Automated disciplinary action of any kind.",
    "Languages other than Python and Java. The parser layer accepts additional tree-sitter grammars, but no other language has been tested or measured.",
])

# ================================================= 5 SYSTEM ARCHITECTURE ==
h1("5. System Architecture")
para("The system is a three-tier application with an asynchronous worker. The "
     "division is drawn along the line between request handling, which is "
     "latency-sensitive, and code analysis, which is computational and better "
     "expressed in Python.")

h3("1. Front End")
bullets([
    "React 19 with TypeScript, built with Vite.",
    "Separate interfaces for student, faculty and administrator roles.",
    "Evidence views including a hand-drawn SVG radar chart of behavioural deviation.",
])
h3("2. API Tier")
bullets([
    "Node.js with Express 5, written in TypeScript.",
    "32 REST routes covering authentication, courses, assignments and submissions.",
    "JSON Web Token authentication with separate access and refresh secrets.",
    "A single error response shape carrying a code, a message and a request identifier for tracing.",
])
h3("3. Detection Service")
bullets([
    "Python 3.11 with FastAPI, stateless, exposing /health, /analyze and /features.",
    "Authenticated by a shared secret sent as a request header and compared in constant time.",
    "Dependencies are pinned exactly, because the stored detector version is a promise that the same version computes the same score.",
])
h3("4. Mobile Client")
bullets([
    "A native Android application written in Kotlin, with Jetpack Compose and Material 3.",
    "Four screens: registration, sign-in, a student dashboard listing courses and assignments, and a faculty dashboard.",
    "It consumes the same REST API as the web front end over HTTPS, so a submission made from a phone enters the identical detection pipeline.",
    "The authentication token is held in the platform's encrypted preference store rather than in application memory or plain files.",
])
h3("5. Data Tier")
bullets([
    "MongoDB for application data and, since November 2026, for submitted source files.",
    "Redis as the job queue, through BullMQ.",
    "Object storage was removed from the architecture: submissions are capped at 256 KB and a MongoDB document holds 16 MB, so the dependency was not justified.",
])
para("The queue decouples upload from analysis. An upload returns immediately "
     "with a status of queued; the worker moves the submission through "
     "analyzing to analyzed, and the interface reflects each transition.")

# ========================================== 6 FUNCTIONAL REQUIREMENTS =====
h1("6. Functional Requirements")

h3("Student")
bullets([
    "Register and authenticate.",
    "Upload a submission against an open assignment, subject to attempt limits and deadlines.",
    "View submission history and the status of each submission.",
    "View their own result where the course configuration permits it.",
])
h3("Faculty")
bullets([
    "View a ranked review queue for an assignment.",
    "Open any submission and inspect all three layer scores and the weights applied.",
    "View the matched source regions behind a structural score.",
    "Record a review decision: dismissed, contested, escalated or confirmed clean.",
    "Adjust per-course detection weights and the review threshold.",
])
h3("Administrator")
bullets([
    "Manage users and role assignment.",
    "Create courses and assign faculty ownership.",
])
h3("System")
bullets([
    "Accept only the file extensions configured for an assignment, currently .py and .java.",
    "Reject uploads above the configured size limit of 256 KB, or longer than 5000 lines.",
    "Enforce per-user upload rate limits.",
    "Prevent concurrent uploads for the same assignment by the same student.",
    "Re-score earlier submissions once enough cohort peers exist.",
    "Write an audit record for every review action.",
])

# ====================================== 7 NON-FUNCTIONAL REQUIREMENTS =====
h1("7. Non-Functional Requirements")
table(["Requirement", "Target", "Status"], [
    ["Detection service timeout", "30 seconds per call, configurable", "Enforced in code (DETECTOR_TIMEOUT_MS)"],
    ["Upload responsiveness", "Upload returns without waiting for analysis", "Achieved via queue and worker"],
    ["Authentication", "Token-based, with separate access and refresh secrets", "Achieved"],
    ["Transport security", "HTTPS in deployment", "Achieved via the hosting platform"],
    ["Password storage", "Adaptive hashing", "bcrypt, cost factor 12"],
    ["Test coverage of the API", "Automated and run on every push", "155 tests across 10 files"],
    ["Reproducibility of a score", "An old score remains explainable", "Detector version stored with every result; dependencies pinned"],
    ["Scalability", "Stated in the synopsis as thousands of submissions", "Not measured. No load testing was performed."],
], widths=[2.0, 2.3, 2.0])
para("The final row is included deliberately. The synopsis asserted a "
     "scalability target; no load test was carried out, and the claim is "
     "therefore withdrawn rather than repeated.", italic=True)

# ========================================================= 8 CORE MODULES =
h1("8. Core Modules")
table(["Module", "Responsibility", "Principal files"], [
    ["Authentication", "Registration, login, token issue and refresh, role enforcement",
     "authController.ts, middleware/auth.ts, utils/jwt.ts, utils/password.ts"],
    ["Submission", "Upload validation, storage, queueing, attempt and deadline rules",
     "submissionController.ts, middleware/upload.ts, storage/fileStore.ts"],
    ["Structural analysis", "Parsing and tree comparison",
     "detector app/parsing.py, similarity.py, normalise.py, units.py"],
    ["Behavioural analysis", "Anchors, baselines, cohort calibration, saturation handling",
     "services/anchors.ts, baseline.ts, behavioural.ts, recalibrate.ts"],
    ["Authorship classification", "Corpus construction, training, evaluation",
     "measurements/ai_corpus.py, baseline_classifier.py, train_codebert.py"],
    ["Aggregation", "Weighting, renormalisation, threshold and eligibility",
     "services/detection.ts, detectionConfig.ts"],
    ["Review and audit", "Decisions, audit trail, review queue",
     "resultController.ts, services/audit.ts, models/AuditLog.ts"],
], widths=[1.4, 2.5, 2.4])

# =========================================================== 9 METHODOLOGY
h1("9. Methodology")

h2("Development Approach")
para("Development proceeded in short iterations with a working system "
     "maintained at all times. Each change to the API was accompanied by "
     "tests, and a pre-push hook runs type checking, linting and a production "
     "dependency audit on the directories a commit touches, so that a failure "
     "is found before it reaches the shared branch rather than afterwards.")

h2("Measurement Methodology")
para("The measurement work is the part of this project most open to "
     "challenge, and the following controls were applied deliberately.")
bullets([
    "Human code was drawn from 25 GitHub repositories of student coursework, with commits dated between February 2017 and November 2022. That window closes before current generative coding assistants were publicly available, so the human class cannot be contaminated by AI-written code.",
    "Disguised copies of human files were added to the human class as well as the AI class, so that the act of disguising cannot itself become the feature the classifier learns. This is referred to as matched preprocessing.",
    "Train and test splits are group-disjoint under a union-find over file origin and host, so that two files derived from the same source cannot appear on both sides of a split.",
    "Candidate confounds were identified in advance and tested, and the results of those tests are reported in Section 11 whether or not they were favourable.",
])

h2("Workflow")
bullets([
    "A student uploads a source file; it is validated and stored, and a job is queued.",
    "The worker requests structural and style features from the detection service.",
    "The behavioural layer scores the submission against the student's baseline and cohort.",
    "Available scores are weighted and renormalised into a Review Priority Score.",
    "The result is written with the detector version that produced it and appears in the faculty queue.",
    "A faculty member reviews the evidence and records a decision, which is written to the audit log.",
])

# ================================================ 10 TOOLS & TECHNOLOGIES =
h1("10. Tools & Technologies")
table(["Layer", "Technology"], [
    ["Front end", "React 19, TypeScript, Vite, hand-written CSS"],
    ["API", "Node.js 22+, Express 5, TypeScript, Mongoose, BullMQ, Helmet, Zod"],
    ["Detection service", "Python 3.11, FastAPI, tree-sitter, APTED, Pydantic"],
    ["Mobile client", "Kotlin, Jetpack Compose, Material 3, OkHttp"],
    ["Authorship measurement", "Python, scikit-learn, NumPy (offline only). PyTorch and Hugging Face Transformers are imported by the untrained CodeBERT script only."],
    ["Data", "MongoDB, Redis"],
    ["Testing", "Vitest and Supertest (API), pytest (detector)"],
    ["Tooling", "Docker and Docker Compose, GitHub Actions, ESLint, Ruff"],
    ["Deployment", "MongoDB Atlas, Render (web service, static site and managed Redis)"],
], widths=[1.9, 4.4])
para("Two entries from the synopsis are absent. Kubernetes was never used; "
     "orchestration is Docker Compose locally and a managed platform in "
     "deployment. ClickHouse was never used; no separate analytics store "
     "exists. Tailwind CSS was not adopted; the interface uses hand-written "
     "CSS.", italic=True)

# ========================================== 11 RESULTS AND EVALUATION =====
h1("11. Results and Evaluation")
para("This section replaces the synopsis heading Expected Outcomes. Every "
     "figure below is reproducible from the scripts in "
     "apps/detector/measurements/ against the stored corpus.")

h2("11.1 Evaluation Corpus")
table(["Property", "Value"], [
    ["Human files", "96, from 25 GitHub repositories"],
    ["Human commit date range", "28 February 2017 to 30 November 2022"],
    ["Median human file length", "98 lines"],
    ["AI-generated files", "60 (40 from one model family, 20 from others)"],
    ["Total items after edit grades", "351"],
    ["Distinct groups for splitting", "102"],
    ["Edit grades", "Grade 1 raw, Grade 2 disguised, Grade 3 AI mixed into a human file"],
], widths=[2.6, 3.7])

h2("11.2 Authorship Layer Results")
para("Every figure in this section comes from the logistic baseline described "
     "in Section 5. The transformer model has never been trained and "
     "contributes no number to this report.", italic=True)
table(["Metric", "Result"], [
    ["ROC AUC, held-out group-disjoint set", "0.9521"],
    ["Specificity (human files correctly unflagged)", "93.2 per cent (41 of 44)"],
    ["Grade 1 detection (raw AI code)", "88.0 per cent (22 of 25)"],
    ["Grade 2 detection (disguised AI code)", "80.0 per cent (20 of 25)"],
    ["Grade 3 detection (AI mixed into human work)", "37.5 per cent (9 of 24)"],
], widths=[3.5, 2.8])
para("The grade 3 figure is the important one. Partial outsourcing, in which "
     "a student writes part of a submission and obtains the remainder "
     "elsewhere, is the realistic case, and on that case the classifier "
     "detects fewer than two in five. The headline AUC of 0.9521 is dominated "
     "by whole-file cases which are easier and less common.")
para("This result is the reason the layer is not wired into live scoring. A "
     "classifier that performs well on the easy case and poorly on the "
     "realistic one would, if deployed, shift rankings on the strength of a "
     "signal that is weakest exactly where it would be relied upon.")

h2("11.3 Behavioural Layer Result")
para("On the splice corpus, the behavioural layer scored lower on files "
     "containing another author's code than on the clean originals: mean gaps "
     "of -0.0124, -0.0176 and -0.0090 at splice fractions of 0.10, 0.25 and "
     "0.50 respectively. Adding the layer to the structural layer reduced "
     "precision at ten at every fraction. There is no dose-response. On the "
     "data available, the layer did not separate outsourced work from honest "
     "work, and the sign of the effect is the wrong way round.")
para("The mechanism is diagnosed rather than merely observed. The score is a "
     "root-mean-square distance from the student's own mean, and a distance "
     "has no direction. The spliced code displaces the file by roughly 0.44 "
     "cohort standard deviations in a direction set by where the donor "
     "happens to sit relative to the student, and that direction was measured "
     "to be a coin flip: the donor lies above the student in between 0.462 "
     "and 0.500 of pairs across the four scored features. A file already some "
     "distance from its baseline, displaced in an arbitrary direction, moves "
     "closer about as often as further away. A whole-file magnitude cannot "
     "detect a partial, signed substitution, and no reweighting repairs that.")
para("The layer is retained in the system and in this report for three "
     "reasons. The mechanism is independently testable and its guarantees "
     "hold: there are tests demonstrating that a student cannot influence "
     "their own cohort statistics, and that the layer declines to score "
     "rather than guessing when fewer than three scored peers exist. The "
     "corpus was exonerated rather than blamed: the splice was measured to "
     "move the features by very close to the amount the mixing model "
     "predicts, so the data carried the signal and the score discarded it. "
     "And removing an unfavourable measurement from a report because it is "
     "unfavourable is not an acceptable practice.")
para("The fix is therefore a redesign and not a retuning. The features would "
     "have to be computed per function or per window, so that a substituted "
     "region can be isolated instead of averaged into its host, and the "
     "comparison would have to be signed or population-referenced, so that "
     "movement toward another author's typical values is itself the signal. "
     "That change is identified here and deliberately not attempted, because "
     "it is too large to begin without deciding it on its own terms.")
para("The layer is weighted accordingly and the weight is adjustable per "
     "course.")

h3("The denominator, measured")
para("One design decision inside this layer was tested separately and the "
     "result is reported here because it corrects an earlier claim. Layer 2 "
     "takes the mean of each feature from the student's own anchors but "
     "divides by the spread of the whole cohort. The stated justification "
     "had been that the cohort spread separates authors better. Measured "
     "over 204 files and 21 authors across 25 draws, with both denominators "
     "scored on identical files and splits, it does not: median area under "
     "the curve 0.6047 for the cohort spread against 0.5989 for the "
     "student's own, with the cohort ahead in only 10 of 25 draws and a "
     "median paired difference of -0.0029. The two are indistinguishable.")
para("The argument that survives is stability rather than separation. The "
     "student's own spread collapsed to the configured variance floor in "
     "3.6 per cent of feature scores against 0.0 per cent for the cohort "
     "spread, and 9.5 per cent of authors had at least one feature on which "
     "their own spread was exactly zero. A collapsed spread turns a z-score "
     "into a real difference divided by a constant, which is a worse failure "
     "than a slightly weaker ranking. The cohort denominator is therefore "
     "retained on the ground that it never degenerates, and the earlier "
     "claim that it ranks better is withdrawn.")

h2("11.4 Confounds Tested")
h3("Boilerplate")
para("A plausible objection is that the classifier learned a surface "
     "convention rather than authorship. The Python main-guard idiom appears "
     "in 82 per cent of AI files and 32 per cent of human files in the "
     "corpus, and reaches an AUC of 0.7499 on its own. The classifier was "
     "therefore retrained with the construct removed from every file. "
     "Performance was 0.9521 with it and 0.9616 without it, a difference well "
     "inside the standard error of approximately 0.025. The objection is not "
     "supported.")
h3("Language era")
para("A second objection is that AI-generated code might simply use more "
     "modern Python, making the classifier a date detector. Four modern "
     "constructs were counted across both classes, given as AI against human: "
     "f-strings 17 against 25 per cent, type hints 9 against 12 per cent, "
     "pathlib 2 against 2 per cent, and the walrus operator 0 against 0 per "
     "cent. The human files were not older in style, and on three of the four "
     "measures were more modern. The objection is not supported.")
h3("Preprocessing as a cue")
para("A control classifier trained to separate plain human files from "
     "disguised human files scored 0.8543, confirming that the disguising "
     "transformation is itself detectable. This is the reason disguised human "
     "copies are included in the human class under matched preprocessing. "
     "Under that design the control figure must not be subtracted from the "
     "grade 2 result, since the transformation is present on both sides of "
     "the comparison.")

h2("11.5 System Verification")
table(["Check", "Result"], [
    ["API test suite", "155 tests across 10 files, all passing"],
    ["API surface", "32 routes, documented in an OpenAPI 3.0 specification"],
    ["Specification accuracy", "Operation set diffed against the router definitions"],
    ["Type checking", "Enforced on every push by the pre-push hook and CI"],
    ["Production dependency audit", "Enforced on every push"],
    ["Deployment", "Front end, API, worker and detection service publicly reachable"],
], widths=[2.8, 3.5])

# ============================ 12 LIMITATIONS AND FUTURE ENHANCEMENTS ======
h1("12. Limitations and Future Enhancements")

h2("12.1 Known Limitations")
bullets([
    "Partial outsourcing is detected in 37.5 per cent of cases. This is the most significant limitation in the system and is a property of the measured classifier, not of its implementation.",
    "The behavioural layer is not validated. Its mechanism is tested; its discriminative value is not demonstrated.",
    "The evaluation corpus is small. 351 items in 102 groups supports the comparisons reported here and does not support fine threshold tuning.",
    "The AI class is dominated by one model family, with 40 of 60 files from a single provider. Generalisation across providers is not established.",
    "Only Python and Java are supported, and only Python was used for the authorship measurements.",
    "Structural similarity cannot distinguish a shared template from collusion, which is why it contributes to a ranking and not a conclusion.",
    "No load testing was performed, so no throughput claim is made.",
    "The transformer model specified for the authorship layer has never been trained, so no transformer result exists and none is quoted.",
    "Faculty cannot change their own password; accounts are provisioned by an administrator.",
])

h2("12.2 Future Enhancements")
bullets([
    "Segment-level authorship analysis, so that a mixed file can be assessed region by region rather than as a whole. This directly targets the grade 3 limitation.",
    "A labelled dataset of genuine partial outsourcing, collected under consent, to make validation of the behavioural layer possible.",
    "Broadening the AI class across model families and prompting styles.",
    "Additional languages through further tree-sitter grammars, with measurement before any claim of support.",
    "Multi-file project analysis.",
    "Self-service credential management and bulk enrolment import.",
])

# =========================================================== 13 CONCLUSION
h1("13. Conclusion")
para("CodeGuard AI addresses a detection gap that similarity-based tools "
     "cannot close by design. By combining structural comparison, behavioural "
     "baselines and authorship classification, and by presenting the evidence "
     "behind every score, it provides faculty with a defensible basis for "
     "deciding which submissions warrant attention.")
para("The strongest result obtained is the authorship classifier's ROC AUC of "
     "0.9521 on whole files, together with two pre-registered confound tests "
     "that failed to explain it away. The most important result is the 37.5 "
     "per cent detection rate on partially outsourced work, because it "
     "describes the system's behaviour in the case that actually occurs. Both "
     "are reported here with equal prominence.")
para("The project also produced a negative result. The behavioural layer did "
     "not outperform chance on the available data. That finding is recorded "
     "in this report rather than omitted from it, with the reasons the layer "
     "was nonetheless retained.")
para("The system is working, deployed, and covered by an automated test suite "
     "that runs on every change. What it does not do is stated as plainly in "
     "this report as what it does. For a system whose output could affect a "
     "student's academic record, that balance is not a presentational choice "
     "but a requirement.")

# ========================================================== REFERENCES ====
h1("References")
for i, ref in enumerate([
    "Schleimer, S., Wilkerson, D. S., and Aiken, A. Winnowing: Local Algorithms for Document Fingerprinting. Proceedings of the ACM SIGMOD International Conference on Management of Data, 2003.",
    "Prechelt, L., Malpohl, G., and Philippsen, M. Finding Plagiarisms among a Set of Programs with JPlag. Journal of Universal Computer Science, vol. 8, no. 11, 2002.",
    "Feng, Z., Guo, D., Tang, D., et al. CodeBERT: A Pre-Trained Model for Programming and Natural Languages. Findings of EMNLP, 2020.",
    "Pawlik, M., and Augsten, N. Tree Edit Distance: Robust and Memory-Efficient. Information Systems, vol. 56, 2016.",
    "Brunet, M., et al. tree-sitter: An Incremental Parsing System for Programming Tools. Project documentation, 2024.",
    "Fawcett, T. An Introduction to ROC Analysis. Pattern Recognition Letters, vol. 27, no. 8, 2006.",
], 1):
    p = DOC.add_paragraph()
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(f"[{i}]  {ref}")
    r.font.size = Pt(11)
    r.font.name = "Times New Roman"

# ============================================ APPENDIX A: CHANGED CLAIMS ==
h1("Appendix A: Claims Revised Since the Synopsis")
para("The project synopsis was written before implementation and measurement. "
     "The following claims have been revised in this report. They are listed "
     "so that any difference between the two documents is accounted for "
     "rather than discovered.")
table(["Claim in the synopsis", "Position in this report"], [
    ["Kubernetes used for orchestration", "Never used. Docker Compose locally, a managed platform in deployment."],
    ["ClickHouse used for analytics", "Never used. No separate analytics store exists."],
    ["Tailwind CSS in the front end", "Not adopted. The interface uses hand-written CSS."],
    ["AI detection layer outputs a probability in the system", "Measured offline only; not connected to live scoring. Section 11.2."],
    ["Handles thousands of submissions", "Withdrawn. No load testing was performed."],
    ["Reduced false positives", "Withdrawn as a comparative claim. Specificity is reported directly as 93.2 per cent."],
    ["Encrypted data", "Narrowed to what is implemented: HTTPS in transit and bcrypt password hashing."],
    ["IBM Project CodeNet acknowledged as a source", "Not used. The corpus was built from GitHub repositories and generated files."],
    ["Behavioural layer detects deviations", "Mechanism implemented and tested. It scored in the wrong direction on the splice corpus, and the cause is diagnosed. Section 11.3."],
    ["Authorship layer built on CodeBERT", "Every reported figure comes from a logistic baseline over n-gram features. The CodeBERT script is written and unit tested but has never been trained."],
    ["Mobile client listed as future work", "Delivered. A native Android client in Kotlin and Jetpack Compose, against the same API. Section 5."],
    ["Uploads capped at 1 MB", "The implemented cap is 256 KB and 5000 lines. The earlier figure was read from a configuration default rather than from the code."],
], widths=[2.8, 3.5])

json.dump(HEADINGS, open("headings.json", "w", encoding="utf-8"), ensure_ascii=False)

if PAGE_MAP:
    anchor = DOC.paragraphs[TOC_ANCHOR - 1]._p
    for level, text in HEADINGS:
        el = toc_entry(level, text, PAGE_MAP.get(text, ""))
        anchor.addnext(el)
        anchor = el

OUT = "/mnt/user-data/outputs/CodeGuard_AI_Project_Report.docx"
DOC.save(OUT)
print("saved:", OUT, "| contents entries:", len(HEADINGS) if PAGE_MAP else 0)

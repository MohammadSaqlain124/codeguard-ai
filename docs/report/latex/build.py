"""
Regenerate the LaTeX chapters from the Markdown drafts, then build the PDF.

The .tex files under chapters/ are GENERATED from ../chapter*.md and ../SRS.md.
They are committed so the report can be built with only a TeX distribution,
but if you edit them your edits are lost the next time this runs. Either edit
the Markdown and regenerate, or adopt the .tex as the source and stop running
this. Do not do both.

Needs pandoc for the regeneration step; the PDF build needs only pdflatex and
bibtex. Run with --pdf-only to skip pandoc.

    python build.py            regenerate from Markdown, then build
    python build.py --pdf-only build from the committed .tex
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
CHAPTERS = {
    "chapter1_introduction": "ch1", "chapter2_literature_survey": "ch2",
    "chapter3_analysis": "ch3", "chapter4_system_design": "ch4",
    "chapter5_implementation": "ch5", "chapter6_testing": "ch6",
    "chapter7_results": "ch7", "chapter8_conclusion": "ch8",
    "SRS": "appendix_srs",
}


def generate_bib():
    """Three transformations BibTeX needs and the source file should not carry."""
    text = open(os.path.join(SRC, "references.bib"), encoding="utf-8").read()
    text = re.sub(r"^[ \t]*%.*\n", "", text, flags=re.M)   # % inside an entry is a parse error
    text = text.replace("@software{", "@misc{")            # plainnat has no @software
    text = re.sub(r"(?<!\\)_", r"\\_", text)               # a bare _ starts math mode
    head = ("% GENERATED from docs/report/references.bib. Do not edit.\n"
            "% In-entry %% comments stripped, @software retyped to @misc, bare\n"
            "% underscores escaped. Edit docs/report/references.bib instead.\n")
    open(os.path.join(HERE, "references.bib"), "w", encoding="utf-8").write(head + text)


def regenerate():
    os.makedirs(os.path.join(HERE, "chapters"), exist_ok=True)
    tmp = os.path.join(HERE, ".prepped")
    os.makedirs(tmp, exist_ok=True)
    for src, out in CHAPTERS.items():
        md = os.path.join(SRC, src + ".md")
        if not os.path.exists(md):
            print(f"  missing {md}, skipped")
            continue
        mid = os.path.join(tmp, out + ".md")
        subprocess.run([sys.executable, os.path.join(HERE, "prep.py"), md, mid], check=True)
        tex = os.path.join(HERE, "chapters", out + ".tex")
        subprocess.run([
            "pandoc", mid, "-f", "markdown+fenced_divs", "-t", "latex", "--no-highlight",
            "--top-level-division=chapter",
            "--lua-filter=" + os.path.join(HERE, "draftnote.lua"), "-o", tex,
        ], check=True)
        subprocess.run([sys.executable, os.path.join(HERE, "post.py"), tex], check=True)
        print(f"  {src}.md -> chapters/{out}.tex")
    generate_bib()
    print("  references.bib regenerated")


def build():
    # bibtex exits 2 on warnings and this bibliography has real ones, so the
    # steps are run unconditionally rather than chained on success.
    for step in (["pdflatex", "-interaction=nonstopmode", "main.tex"],
                 ["bibtex", "main"],
                 ["pdflatex", "-interaction=nonstopmode", "main.tex"],
                 ["pdflatex", "-interaction=nonstopmode", "main.tex"]):
        r = subprocess.run(step, cwd=HERE, capture_output=True, text=True)
        print(f"  {step[0]:9} rc={r.returncode}")
    log = open(os.path.join(HERE, "main.log"), encoding="utf-8", errors="replace").read()
    undefined = len(re.findall(r"(Citation|Reference) `[^']+' on page \d+ undefined", log))
    print(f"\n  undefined citations/references: {undefined}")
    pdf = os.path.join(HERE, "main.pdf")
    print(f"  main.pdf: {'built, ' + str(os.path.getsize(pdf)) + ' bytes' if os.path.exists(pdf) else 'NOT BUILT'}")


if __name__ == "__main__":
    if "--pdf-only" not in sys.argv:
        print("REGENERATING from Markdown")
        regenerate()
    print("BUILDING")
    build()

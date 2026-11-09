import re, sys

FIGS = {
 "01-architecture": ("System architecture: three tiers and one detection service. The web "
   "application never talks to the detector or to any data store; everything goes through "
   "the API, which holds the only credentials."),
 "02-data-flow": ("One submission, end to end. Step 4 is debounced by job identity; step 7 "
   "stores the weights and threshold that produced the score; step 10 shows the student a "
   "decision and never a score."),
 "03-data-model": ("The eight collections. DetectionResult carries both layers' evidence "
   "rather than only their scores, and AuditLog is separate from the documents it describes."),
 "04-layer2-pipeline": ("The Layer 2 pipeline. The numerator comes from the student's own "
   "anchors, trust-weighted; the denominator comes from the cohort, floored."),
 "05-rps-composition": ("Composing the RPS. With Layer 3 absent the divisor is 0.7, so the "
   "configured 0.4/0.3/0.3 act as 0.571/0.429. An absent layer contributes nothing, not zero."),
}

UNI = [
 ("\u00d7 10\u207b\u00b3", r"$\times 10^{-3}$"), ("\u00d7 10\u207b\u00b2", r"$\times 10^{-2}$"),
 ("\u2014", "---"), ("\u2013", "--"), ("\u00a7", r"\S{}"), ("\u00d7", r"$\times$"),
 ("\u2212", "-"), ("\u00b7", r"$\cdot$"), ("\u00b1", r"$\pm$"),
 ("\u00b2", "$^{2}$"), ("\u00b3", "$^{3}$"), ("\u207b", "$^{-}$"),
]

def convert(text):
    # H1 "# Chapter 4 --- System Design" -> plain title; LaTeX numbers chapters itself
    text = re.sub(r"^# (?:Chapter \d+\s*[\u2014-]\s*)?(.+)$", r"# \1", text, count=1, flags=re.M)
    # Headings carry their own numbers ("## 2.6 Detection of..."), and LaTeX
    # numbers sections itself, so leaving them produces "2.6 2.6 Detection".
    # Sections are sequential from .1 in every chapter, so LaTeX reproduces
    # exactly the numbers the cross-references in the prose already use.
    text = re.sub(r"^(#{2,4}) \d+(?:\.\d+)*\.? +(.+)$", r"\1 \2", text, flags=re.M)

    # figure markers -> real figure environments
    def fig(m):
        key = m.group(1)
        cap = FIGS.get(key, key)
        return ("\n```{=latex}\n\\begin{figure}[htbp]\n\\centering\n"
                f"\\includegraphics[width=\\linewidth,height=0.78\\textheight,keepaspectratio]{{figures/{key}.png}}\n"
                f"\\caption{{{cap}}}\n\\label{{fig:{key}}}\n\\end{{figure}}\n```\n")
    text = re.sub(r"^\*\(Figure \d+ [\u2014-]+ `([0-9a-z\-]+)`\)\*\s*$", fig, text, flags=re.M)
    # blockquote runs -> fenced div the lua filter turns into draftnote
    out, i, lines = [], 0, text.split("\n")
    while i < len(lines):
        if lines[i].startswith(">"):
            block = []
            while i < len(lines) and (lines[i].startswith(">") or
                                      (lines[i].strip() == "" and i + 1 < len(lines)
                                       and lines[i + 1].startswith(">"))):
                block.append(re.sub(r"^> ?", "", lines[i])); i += 1
            out += ["::: {.draftnote}", *block, ":::", ""]
        else:
            out.append(lines[i]); i += 1
    text = "\n".join(out)
    return text

src, dst = sys.argv[1], sys.argv[2]
open(dst, "w", encoding="utf-8").write(convert(open(src, encoding="utf-8").read()))

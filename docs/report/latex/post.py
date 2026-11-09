import sys
# Text-mode only. No math, so nothing depends on $ surviving, and these are
# written into the .tex after pandoc so pandoc cannot escape the backslashes.
SUBS = [
 ("—", "---"), ("–", "--"),
 ("10⁻³", r"10\textsuperscript{-3}"), ("10⁻²", r"10\textsuperscript{-2}"),
 ("§", r"\S{}"), ("×", r"\texttimes{}"), ("−", "-"),
 ("·", r"\textperiodcentered{}"), ("±", r"\textpm{}"),
 ("²", r"\textsuperscript{2}"), ("³", r"\textsuperscript{3}"),
 ("⁻", r"\textsuperscript{-}"),
]
for path in sys.argv[1:]:
    t = open(path, encoding="utf-8").read()
    for a, b in SUBS:
        t = t.replace(a, b)
    open(path, "w", encoding="utf-8").write(t)

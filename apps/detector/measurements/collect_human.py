"""
Collect a human-written Python corpus from repositories that predate LLM code
generation, recording per-file provenance.

Why this exists: Layer 3's claim is that a classifier can tell human-written
student code from AI-written code. That claim is only as good as the human
class. The splice corpus is CPython standard library code, which is wrong for
this purpose - a classifier would separate mature library code from freshly
generated code and never learn anything about authorship.

The filter that matters is per FILE, not per repository. A repository last
pushed in 2019 can still contain a file edited in 2024, and one contaminated
file is one too many. For every candidate this asks git when that specific file
was last modified, and keeps it only if the answer predates the cutoff.

    python measurements/collect_human.py --repos repos.txt --out E:\\temp\\human

repos.txt holds one clone URL per line; blank lines and lines starting with #
are ignored.

The manifest it writes is the artifact to show anyone who asks how you know a
human wrote these: repository, commit, path and the file's own last-commit
date, for every file in the corpus.
"""

import argparse
import ast
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile

# Matches ai_corpus.py, so the two classes are filtered on the same terms.
MIN_LINES = 25
MAX_LINES = 600

# Default cutoff. ChatGPT opened to the public on 30 November 2022, so a file
# last touched before 2023 is very unlikely to contain generated code.
DEFAULT_CUTOFF = "2023-01-01"

# Directories that hold code the repository's author did not write.
SKIP_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env", "site-packages",
    "migrations", "vendor", "third_party", "thirdparty", "dist", "build",
    ".tox", ".eggs", "__pycache__", "lib", "libs",
}

# Files that are usually generated, trivial, or not the author's own prose.
SKIP_NAMES = {"__init__.py", "setup.py", "conftest.py", "manage.py", "wsgi.py", "asgi.py"}


def cleanup(workdir):
    """
    Delete the clones, clearing read-only bits on the way.

    Git marks its pack files read-only. On Windows that makes an ordinary
    delete fail, and a plain rmtree would leave every clone behind without
    saying so - gigabytes, for a list this long. The handler clears the bit
    and retries, and whatever survives that is reported rather than hidden.
    """
    def retry(func, path, _problem):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except OSError:
            pass

    # onerror was replaced by onexc in 3.12; the handler ignores the third
    # argument either way, so the same function serves both
    if sys.version_info >= (3, 12):
        shutil.rmtree(workdir, onexc=retry)
    else:
        shutil.rmtree(workdir, onerror=retry)

    if not os.path.exists(workdir):
        return
    left = 0
    for folder, _dirs, files in os.walk(workdir):
        for name in files:
            try:
                left += os.path.getsize(os.path.join(folder, name))
            except OSError:
                pass
    print(f"\nNOTE: the clones could not be fully deleted. {left / 1e6:.0f} MB remain in")
    print(f"  {workdir}")
    print("  Delete that folder by hand to get the space back.")


def run_git(args, cwd=None):
    """Run git and return stdout, or None if it failed."""
    try:
        done = subprocess.run(["git", *args], cwd=cwd, capture_output=True,
                              text=True, timeout=300)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if done.returncode != 0:
        return None
    return done.stdout.strip()


def clone(url, into):
    """Shallow-ish clone that still carries history, since we need file dates."""
    # blob:none keeps the clone small but keeps every commit, which is what the
    # per-file date lookup needs. A --depth clone would not have the history.
    out = run_git(["clone", "--quiet", "--filter=blob:none", url, into])
    if out is None:
        out = run_git(["clone", "--quiet", url, into])
    return out is not None


def last_commit_date(repo, relpath):
    """ISO date of the most recent commit touching this one file."""
    return run_git(["log", "-1", "--format=%cI", "--", relpath], cwd=repo)


def head_commit(repo):
    return run_git(["rev-parse", "HEAD"], cwd=repo)


def find_license(repo):
    for name in os.listdir(repo):
        if name.upper().startswith(("LICENSE", "COPYING")):
            return name
    return None


def candidates(repo):
    """Every .py file worth considering, as paths relative to the repo."""
    out = []
    for folder, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for name in sorted(files):
            if not name.endswith(".py") or name in SKIP_NAMES:
                continue
            full = os.path.join(folder, name)
            out.append(os.path.relpath(full, repo).replace("\\", "/"))
    return out


def usable(path):
    """Readable, the right size, and valid Python."""
    try:
        with open(path, "rb") as handle:
            source = handle.read().decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    count = source.count("\n") + 1
    if count < MIN_LINES or count > MAX_LINES:
        return None
    try:
        ast.parse(source)
    except (SyntaxError, ValueError, RecursionError):
        return None
    return source


def read_repo_list(path):
    urls = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    return urls


def harvest(url, workdir, cutoff, seen, out_dir, items, stats, per_repo_cap):
    name = url.rstrip("/").split("/")[-1].removesuffix(".git")
    repo = os.path.join(workdir, name)
    print(f"\n{url}")
    if not clone(url, repo):
        print("  clone failed, skipping")
        stats["clone_failed"] += 1
        return

    sha = head_commit(repo) or "unknown"
    licence = find_license(repo)
    kept_here = 0

    for relpath in candidates(repo):
        if kept_here >= per_repo_cap:
            break
        stats["seen"] += 1
        when = last_commit_date(repo, relpath)
        if not when:
            stats["no_date"] += 1
            continue
        if when[:10] >= cutoff:
            stats["too_recent"] += 1
            continue

        source = usable(os.path.join(repo, relpath))
        if source is None:
            stats["unusable"] += 1
            continue

        digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
        if digest in seen:
            stats["duplicate"] += 1
            continue
        seen.add(digest)

        index = len(items) + 1
        flat = f"{index:04d}-{name}-{os.path.basename(relpath)}"
        with open(os.path.join(out_dir, flat), "w", encoding="utf-8") as handle:
            handle.write(source)
        items.append({
            "file": flat, "repo": url, "commit": sha, "path": relpath,
            "last_commit": when, "lines": source.count("\n") + 1,
            "sha256": digest[:16], "license_file": licence,
        })
        kept_here += 1

    print(f"  kept {kept_here}")
    stats["repos"] += 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repos", required=True, help="text file of clone URLs, one per line")
    ap.add_argument("--out", required=True, help="where to write the human corpus")
    ap.add_argument("--cutoff", default=DEFAULT_CUTOFF,
                    help=f"keep files last committed before this date (default {DEFAULT_CUTOFF})")
    ap.add_argument("--per-repo", type=int, default=8,
                    help="cap per repository, so one large project cannot dominate")
    ap.add_argument("--keep-clones", action="store_true",
                    help="keep the cloned repositories instead of deleting them")
    args = ap.parse_args()

    if run_git(["--version"]) is None:
        raise SystemExit("git is not available on this machine")

    urls = read_repo_list(args.repos)
    if not urls:
        raise SystemExit("no repository URLs found")
    print(f"{len(urls)} repositories; keeping files last committed before {args.cutoff}")
    os.makedirs(args.out, exist_ok=True)

    workdir = tempfile.mkdtemp(prefix="codeguard-human-")
    items, seen = [], set()
    stats = {"repos": 0, "seen": 0, "too_recent": 0, "unusable": 0,
             "duplicate": 0, "no_date": 0, "clone_failed": 0}
    try:
        for url in urls:
            harvest(url, workdir, args.cutoff, seen, args.out, items, stats, args.per_repo)
    finally:
        if not args.keep_clones:
            cleanup(workdir)
        else:
            print(f"\nclones left in {workdir}")

    manifest = {
        "cutoff": args.cutoff,
        "generated_by": "collect_human.py",
        "note": ("Every file below was last modified, according to its repository's own "
                 "git history, before the cutoff date. That is the evidence that no "
                 "generated code is in this class."),
        "stats": stats,
        "items": items,
    }
    with open(os.path.join(args.out, "provenance.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"\n{'=' * 60}")
    print(f"kept {len(items)} files into {args.out}")
    print("=" * 60)
    for key in ("repos", "seen", "too_recent", "unusable", "duplicate",
                "no_date", "clone_failed"):
        print(f"  {key:14} {stats[key]}")

    if items:
        dates = sorted(row["last_commit"][:10] for row in items)
        lines = sorted(row["lines"] for row in items)
        print(f"\n  last-commit dates: {dates[0]} to {dates[-1]}")
        print(f"  lines: min {lines[0]}  median {lines[len(lines) // 2]}  max {lines[-1]}")
        repos = len({row['repo'] for row in items})
        print(f"  drawn from {repos} repositories")

    if len(items) < 30:
        print("\nWARNING: fewer than 30 files. Add more repositories before training;")
        print("a corpus this small gives a number that is noise.")
    sys.exit(0)


if __name__ == "__main__":
    main()

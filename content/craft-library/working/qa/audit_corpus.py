#!/usr/bin/env python3
"""Holistic, whole-corpus audit of the draft craft library.

Draft production tooling only — not part of the runtime app, not shipped,
not a dependency of anything under apps/. Run from the working/ directory:

    python3 qa/audit_corpus.py

`build_catalog.py` validates each record in isolation and rebuilds the
inventory. This script asks the questions that only make sense across the
whole corpus at once, which the batch-by-batch QA passes could not:

  1. near-duplicate detection — every record compared against every other
     record by body text and by title/summary/tag surface, not just against
     its batch neighbours;
  2. cross-link health — inbound/outbound `related` degree, orphan records
     nothing points at, one-way links, and links that cross families;
  3. structural conformance — the handoff's required body sections, allowed
     enum values, id/filename/family/directory agreement, and length bands;
  4. sourcing shape — records resting on a single source or on synthesis
     alone, and the source-reuse distribution.

Nothing here edits records. It reports; a human decides.
"""
import math
import re
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import yaml

WORKING = Path(__file__).resolve().parent.parent
FAMILY_DIRS = ["general", "tropes", "systems", "comparisons", "profiles"]
SYNTHESIS_ID = "src.synthesis.craft-library-editorial"

ALLOWED_DOCUMENT_TYPES = {
    "pattern", "trope", "system-mechanic", "comparison", "subgenre-profile",
}
ALLOWED_DETECTABILITY = {"deterministic", "model-assisted", "practice"}
ALLOWED_SCOPES = {
    "selection", "scene", "chapter", "manuscript", "series", "practice",
}
ALLOWED_SOURCE_CONFIDENCE = {"high", "mixed", "limited", "contested"}

# Records the handoff's length band is deliberately waived for, with the
# reason. The handoff calls 700–1,400 words "typical" rather than absolute,
# so an entry may exceed it when the extra length earns its place — but the
# waiver is recorded here so it stays a decision rather than a drift.
LENGTH_EXCEPTIONS = {
    "craft.trope.fatigue.overused-litrpg-trope-cluster":
        "consolidates five distinct conventions, each needing its own promise, "
        "fatigue mechanism, and freshening strategy; splitting it into five "
        "records would give each a thinner evidence base than the single "
        "source supports. Flagged for the author's editorial pass.",
}

# Directory a family's records are expected to live in.
FAMILY_TO_DIR = {
    "general": "general",
    "trope": "tropes",
    "system": "systems",
    "comparison": "comparisons",
    "profile": "profiles",
}

# The handoff's eleven required body sections, each with the heading
# variants the corpus actually uses for profile and process records.
REQUIRED_SECTIONS = [
    ("definition", ["what it is"]),
    ("reader value", ["why readers may care"]),
    ("forms and variants", [
        "common forms and variants",
        "characteristic forms and variants",
    ]),
    ("on the page", [
        "what it can look like on the page",
        "what it can look like in an author's process",
        "what it can look like in a revision process",
        "what it can look like in a manuscript or series",
    ]),
    ("failure modes", [
        "common failure modes",
        "characteristic failure mode",
        "characteristic failure modes",
    ]),
    ("author questions", ["questions for the author"]),
    ("experiments", [
        "revision or design experiments",
        "design experiments",
    ]),
    ("non-application", [
        "when this advice does not apply",
        "when this profile does not apply",
        "when straightforward execution is the right choice",
    ]),
    ("detection limits", ["evidence and detection limits"]),
    ("micro-examples", ["original micro-examples"]),
    ("sourcing", ["sources and confidence notes"]),
]

# Extra sections the handoff requires of system-mechanic and comparison
# records, matched loosely because the corpus consolidates them under a
# few combined headings.
SYSTEM_EXTRA_KEYWORDS = [
    ("progression/failure behaviour", ["progression", "failure behavior", "failure behaviour"]),
    ("visibility", ["visib", "visible"]),
    ("consequences", ["consequence", "social", "econom"]),
    ("exploits and interaction", ["exploit", "edge case", "interaction", "cross-mechanic"]),
]

STOPWORDS = set("""
a about above after again against all also am an and any are aren't as at be because been
before being below between both but by can cannot could couldn't did didn't do does doesn't
doing don't down during each few for from further had hadn't has hasn't have haven't having
he her here hers herself him himself his how i if in into is isn't it its itself just let's
me more most mustn't my myself no nor not of off on once only or other ought our ours
ourselves out over own same shan't she should shouldn't so some such than that the their
theirs them themselves then there these they this those through to too under until up very
was wasn't we were weren't what when where which while who whom why with won't would
wouldn't you your yours yourself yourselves it's isn't one two three may can't often
something someone anything nothing may might will shall must
""".split())

# Vocabulary shared by nearly every record because the handoff mandates it.
# Left in place for body comparison (it is the same for every pair, so it
# mostly cancels) but stripped from the surface comparison, where a handful
# of shared words would otherwise dominate a short field.
BOILERPLATE = set("""
reader readers record records library craft coach coaching author authors story stories
writing write written narrative chapter scene book novel work works experience
""".split())

TOKEN_RE = re.compile(r"[a-z][a-z'-]+")


def tokenize(text, drop_boilerplate=False):
    toks = [t.strip("'-") for t in TOKEN_RE.findall(text.lower())]
    out = []
    for t in toks:
        if len(t) < 3 or t in STOPWORDS:
            continue
        if drop_boilerplate and t in BOILERPLATE:
            continue
        out.append(t)
    return out


def tfidf_vectors(docs):
    """docs: {key: [token, ...]} -> {key: {token: weight}}, L2-normalized."""
    n = len(docs)
    df = Counter()
    for toks in docs.values():
        df.update(set(toks))
    vecs = {}
    for key, toks in docs.items():
        tf = Counter(toks)
        vec = {}
        for term, count in tf.items():
            idf = math.log((n + 1) / (df[term] + 1)) + 1.0
            vec[term] = (1.0 + math.log(count)) * idf
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        vecs[key] = {t: v / norm for t, v in vec.items()}
    return vecs


def cosine(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(w * b.get(t, 0.0) for t, w in a.items())


def top_terms(a, b, limit=6):
    shared = {t: w * b[t] for t, w in a.items() if t in b}
    return [t for t, _ in sorted(shared.items(), key=lambda kv: -kv[1])[:limit]]


def load_records():
    records = {}
    problems = []
    for family_dir in FAMILY_DIRS:
        d = WORKING / family_dir
        if not d.exists():
            continue
        for path in sorted(d.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            parts = text.split("---", 2)
            if not text.startswith("---") or len(parts) < 3:
                problems.append(f"{path.name}: malformed front matter")
                continue
            try:
                fm = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError as e:
                problems.append(f"{path.name}: YAML parse error: {e}")
                continue
            body = parts[2]
            rid = fm.get("id")
            if not rid:
                problems.append(f"{path.name}: no id")
                continue
            records[rid] = {
                "fm": fm,
                "body": body,
                "path": f"{family_dir}/{path.name}",
                "dir": family_dir,
                "filename": path.stem,
                "headings": [
                    h.strip().lower().rstrip(".")
                    for h in re.findall(r"^##\s+(.+)$", body, re.M)
                ],
                "words": len(body.split()),
            }
    return records, problems


def section_report(rec):
    """Return (missing_required, missing_system_extras)."""
    heads = rec["headings"]
    missing = []
    for label, variants in REQUIRED_SECTIONS:
        if not any(any(h.startswith(v) for v in variants) for h in heads):
            missing.append(label)
    extras = []
    if rec["fm"].get("document_type") in {"system-mechanic", "comparison"}:
        joined = " ".join(heads) + " " + rec["body"].lower()
        for label, keywords in SYSTEM_EXTRA_KEYWORDS:
            if not any(k in joined for k in keywords):
                extras.append(label)
    return missing, extras


def main():
    records, problems = load_records()
    ids = sorted(records)
    print(f"# Whole-corpus audit — {len(ids)} records\n")
    if problems:
        print("## Load problems\n")
        for p in problems:
            print(" -", p)
        print()

    # ---------------------------------------------------------------- 1
    body_docs = {rid: tokenize(r["body"]) for rid, r in records.items()}
    surface_docs = {}
    for rid, r in records.items():
        fm = r["fm"]
        surface = " ".join(filter(None, [
            str(fm.get("title", "")),
            str(fm.get("summary", "")),
            " ".join(fm.get("tags") or []),
            " ".join(fm.get("aliases") or []),
            rid.replace(".", " ").replace("-", " "),
        ]))
        surface_docs[rid] = tokenize(surface, drop_boilerplate=True)

    body_vecs = tfidf_vectors(body_docs)
    surface_vecs = tfidf_vectors(surface_docs)

    pairs = []
    for a, b in combinations(ids, 2):
        bs = cosine(body_vecs[a], body_vecs[b])
        ss = cosine(surface_vecs[a], surface_vecs[b])
        pairs.append((max(bs, ss * 0.9), bs, ss, a, b))
    pairs.sort(reverse=True)

    linked = set()
    for rid, r in records.items():
        for other in (r["fm"].get("related") or []):
            linked.add(frozenset((rid, other)))

    print("## 1. Near-duplicate candidates (top 30 of "
          f"{len(pairs)} pairs)\n")
    print("`body` = tf-idf cosine over the full body; `surf` = over "
          "title/summary/tags/aliases/id.")
    print("`link` = the two records already name each other in `related`.\n")
    print("| body | surf | link | record A | record B | shared terms |")
    print("|---|---|---|---|---|---|")
    for _, bs, ss, a, b in pairs[:30]:
        terms = ", ".join(top_terms(body_vecs[a], body_vecs[b]))
        mark = "yes" if frozenset((a, b)) in linked else "**no**"
        print(f"| {bs:.3f} | {ss:.3f} | {mark} | `{a}` | `{b}` | {terms} |")
    print()

    hi_unlinked = [p for p in pairs[:60] if frozenset((p[3], p[4])) not in linked]
    print(f"Of the 60 closest pairs, {len(hi_unlinked)} are not cross-linked.\n")

    # ---------------------------------------------------------------- 2
    print("## 2. Cross-link health\n")
    outbound = {rid: [r for r in (rec["fm"].get("related") or [])]
                for rid, rec in records.items()}
    inbound = defaultdict(list)
    broken = []
    for rid, outs in outbound.items():
        for o in outs:
            if o not in records:
                broken.append((rid, o))
            else:
                inbound[o].append(rid)

    print(f"- broken `related` targets: {len(broken)}")
    for rid, o in broken:
        print(f"  - `{rid}` → `{o}` (does not exist)")
    orphans = [rid for rid in ids if not inbound.get(rid)]
    print(f"- records nothing links to ({len(orphans)}):")
    for rid in orphans:
        print(f"  - `{rid}` ({records[rid]['fm'].get('family')})")
    no_out = [rid for rid in ids if not outbound[rid]]
    print(f"- records with no outbound links ({len(no_out)}):")
    for rid in no_out:
        print(f"  - `{rid}`")
    one_way = [(a, b) for a, outs in outbound.items() for b in outs
               if b in records and a not in outbound[b]]
    print(f"- one-way links (A names B, B does not name A): {len(one_way)}")
    deg = sorted(((len(inbound.get(r, [])) + len(outbound[r]), r) for r in ids),
                 reverse=True)
    print("- most-connected records: "
          + ", ".join(f"`{r}` ({d})" for d, r in deg[:5]))
    cross_family = Counter()
    for a, outs in outbound.items():
        fa = records[a]["fm"].get("family")
        for b in outs:
            if b in records:
                fb = records[b]["fm"].get("family")
                if fa != fb:
                    cross_family[(fa, fb)] += 1
    print(f"- cross-family links: {sum(cross_family.values())} "
          + ", ".join(f"{a}→{b}: {n}" for (a, b), n in cross_family.most_common(6)))
    print()

    # ---------------------------------------------------------------- 3
    print("## 3. Structural conformance\n")
    enum_issues, section_issues, naming_issues, length_issues = [], [], [], []
    length_exceptions = []
    for rid in ids:
        rec = records[rid]
        fm = rec["fm"]
        dt = fm.get("document_type")
        if dt not in ALLOWED_DOCUMENT_TYPES:
            enum_issues.append(f"`{rid}`: document_type `{dt}`")
        if fm.get("detectability") not in ALLOWED_DETECTABILITY:
            enum_issues.append(f"`{rid}`: detectability `{fm.get('detectability')}`")
        bad_scopes = set(fm.get("scopes") or []) - ALLOWED_SCOPES
        if bad_scopes:
            enum_issues.append(f"`{rid}`: scopes {sorted(bad_scopes)}")
        if fm.get("source_confidence") not in ALLOWED_SOURCE_CONFIDENCE:
            enum_issues.append(
                f"`{rid}`: source_confidence `{fm.get('source_confidence')}`")
        if rec["filename"] != rid:
            naming_issues.append(f"`{rid}`: filename `{rec['filename']}`")
        expected_dir = FAMILY_TO_DIR.get(fm.get("family"))
        if expected_dir and expected_dir != rec["dir"]:
            naming_issues.append(
                f"`{rid}`: family `{fm.get('family')}` in `{rec['dir']}/`")
        missing, extras = section_report(rec)
        if missing or extras:
            bits = []
            if missing:
                bits.append("missing " + ", ".join(missing))
            if extras:
                bits.append("system-record gaps: " + ", ".join(extras))
            section_issues.append(f"`{rid}` ({dt}): " + "; ".join(bits))
        ceiling = 1800 if dt == "comparison" else 1400
        if rec["words"] < 700 or rec["words"] > ceiling:
            note = LENGTH_EXCEPTIONS.get(rid)
            if note:
                length_exceptions.append(f"`{rid}`: {rec['words']} words — {note}")
            else:
                length_issues.append(
                    f"`{rid}`: {rec['words']} words (band 700–{ceiling})")

    for label, items in [
        ("enum violations", enum_issues),
        ("id / filename / directory mismatches", naming_issues),
        ("required-section gaps", section_issues),
        ("outside the handoff's length band", length_issues),
        ("length band waived, with reason", length_exceptions),
    ]:
        print(f"- **{label}: {len(items)}**")
        for i in items[:25]:
            print(f"  - {i}")
        if len(items) > 25:
            print(f"  - …and {len(items) - 25} more")
    words = [records[r]["words"] for r in ids]
    words.sort()
    print(f"- word counts: min {words[0]}, median {words[len(words)//2]}, "
          f"max {words[-1]}, mean {sum(words)//len(words)}")
    print()

    # ---------------------------------------------------------------- 4
    print("## 4. Sourcing shape\n")
    src_use = Counter()
    thin = []
    for rid in ids:
        sids = [s for s in (records[rid]["fm"].get("source_ids") or [])]
        src_use.update(sids)
        real = [s for s in sids if s != SYNTHESIS_ID]
        if len(real) <= 1:
            thin.append((rid, records[rid]["fm"].get("source_confidence"),
                         len(real)))
    print(f"- records citing 0–1 non-synthesis sources: {len(thin)}")
    by_conf = Counter(c for _, c, _ in thin)
    print("  - by declared source_confidence: " + str(dict(by_conf)))
    # A single-source record may legitimately declare `mixed` when a
    # well-supported principle has been extended by this pass's own
    # synthesis or adaptation — but the handoff requires the sourcing note
    # to say so. Flag only the ones that do not.
    explains = ("synthesis", "adaptation", "adapted", "drafting pass",
                "this pass", "extends", "extended", "transfer")
    for rid, conf, n in thin:
        if conf in {"limited", "contested"}:
            continue
        note = records[rid]["body"].lower()
        note = note[note.find("## sources and confidence notes"):]
        if any(w in note for w in explains):
            print(f"  - `{rid}`: {n} source(s), `{conf}` — mixture explained "
                  "in the sourcing note (allowed)")
        else:
            print(f"  - **`{rid}`: {n} source(s), source_confidence "
                  f"`{conf}`, and the sourcing note does not say what the "
                  "mixture is**")
    print(f"- distinct sources in use: {len(src_use)}")
    print("  - most-cited: "
          + ", ".join(f"`{s}` ({n})" for s, n in src_use.most_common(8)))
    once = [s for s, n in src_use.items() if n == 1]
    print(f"  - cited exactly once: {len(once)}")
    conf_counts = Counter(records[r]["fm"].get("source_confidence") for r in ids)
    print(f"- source_confidence across corpus: {dict(conf_counts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Propose and apply a repaired `related` link graph for the draft corpus.

Draft production tooling only — not part of the runtime app, not shipped,
not a dependency of anything under apps/. Run from the working/ directory:

    python3 qa/relink.py propose        # writes qa/relink-plan.yml, edits nothing
    python3 qa/relink.py review         # human-readable table of proposed edges
    python3 qa/relink.py apply          # rewrites `related:` blocks from the plan

Background: whole-corpus audit pass A found that `related` had been drafted
as a fixed two-link quota chosen from whatever already existed on disk, so
the graph pointed backward in batch order — 62 of 130 records had nothing
linking to them and only 27 pairs were mutual. This tool repairs that under
an explicit policy.

## Link policy

1. **Reciprocity.** Links are mutual. If A names B, B names A. A relation
   between two records is a property of the pair, not of whichever one was
   drafted second.
2. **Minimum five.** Every record carries at least five `related` links.
   There is no maximum: foundational records legitimately accumulate more,
   and capping them would break rule 1.
3. **At least one cross-family link.** A record that only points at its own
   family teaches an author nothing about how craft, trope, and system
   questions bear on each other.
4. **Profiles link to profiles.** Every `subgenre-profile` record carries at
   least two intra-family links, because choosing between adjacent subgenres
   is a decision authors actually make.
5. **Nothing is dropped.** Every hand-chosen link from the drafting batches
   survives; this tool only adds.

Proposed edges are scored by tf-idf similarity (body and metadata surface,
per qa/audit_corpus.py) with a bonus for records sharing an id prefix, and
every one is reviewed by hand before `apply` runs.
"""
import json
import re
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_corpus as A  # noqa: E402

WORKING = A.WORKING
PLAN_PATH = WORKING / "qa" / "relink-plan.yml"

MIN_DEGREE = 5
PROFILE_MIN_INTRA = 2

# Pairs identified by hand in whole-corpus audit pass A as close but not
# cross-linked (see qa/duplication-report.md). All were reviewed and judged
# "cross-link", not "merge".
AUDIT_PAIRS = [
    ("craft.profile.classic-litrpg", "craft.profile.gamelit"),
    ("craft.profile.classic-litrpg", "craft.profile.progression-fantasy"),
    ("craft.profile.classic-litrpg", "craft.profile.cultivation"),
    ("craft.profile.gamelit", "craft.profile.progression-fantasy"),
    ("craft.profile.classic-litrpg", "craft.profile.dark-horror-litrpg"),
    ("craft.profile.base-building", "craft.profile.dungeon-core"),
    ("craft.trope.convention.fantasy-genre-conventions",
     "craft.trope.convention.horror-genre-conventions"),
    ("craft.trope.role.companion", "craft.trope.role.ensemble-cast-dynamics"),
    ("craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics",
     "craft.system.character.attributes-and-soft-hard-caps"),
    ("craft.system.consequences.institutions-labor-and-governance",
     "craft.system.consequences.medicine-religion-and-crime"),
    ("craft.comparison.progression.hard-numbers-versus-named-tiers",
     "craft.profile.gamelit"),
    ("craft.comparison.resource.pools-vs-thresholds",
     "craft.system.resource.health-and-focus-as-core-resources"),
    ("craft.comparison.progression.hard-numbers-versus-named-tiers",
     "craft.profile.progression-fantasy"),
    ("craft.profile.isekai-portal-fantasy", "craft.profile.progression-fantasy"),
    ("craft.profile.cultivation", "craft.profile.progression-fantasy"),
    ("craft.general.plot.setup-and-payoff", "craft.trope.structure.mystery"),
    ("craft.profile.cultivation", "craft.profile.dark-horror-litrpg"),
    ("craft.profile.dungeon-core", "craft.profile.progression-fantasy"),
    ("craft.comparison.resource.pools-vs-thresholds",
     "craft.comparison.resource.renewable-vs-finite-resources"),
]

# Hand-authored edges added during review, where similarity scoring kept
# reaching for a weak partner and a person could name a better one. Mostly
# the `practice` and `voice` clusters, whose vocabulary overlaps little with
# the records they genuinely belong beside.
PREFERRED = [
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.general.revision.triage-and-beta-reader-signal"),
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.general.revision.protecting-reader-experience"),
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.trope.convention.serial-fiction-conventions"),
    ("craft.general.practice.buffer-discipline",
     "craft.general.revision.protecting-reader-experience"),
    ("craft.general.practice.no-gap-posting",
     "craft.trope.convention.serial-fiction-conventions"),
    ("craft.general.practice.no-gap-posting",
     "craft.trope.convention.progression-fiction-reader-expectations"),
    ("craft.general.voice.voice-as-craft-element",
     "craft.general.pov.psychic-distance-and-interiority"),
    ("craft.general.voice.voice-as-craft-element",
     "craft.general.voice.narrative-summary-vs-scene"),
    ("craft.general.voice.narrative-summary-vs-scene",
     "craft.general.pacing.pacing-across-scales"),
    ("craft.general.voice.narrative-summary-vs-scene",
     "craft.general.plot.exposition-and-info-delivery"),
    ("craft.general.scene.sequel-and-reflection",
     "craft.general.pacing.tension-and-release-cycles"),
    # Good pairs the greedy degree fill proposed and then displaced once the
    # two records' quotas were met elsewhere. Pinned so they survive.
    ("craft.general.scene.scene-turns",
     "craft.general.scene.sequel-and-reflection"),
    ("craft.general.voice.dialogue-and-subtext",
     "craft.general.voice.narrative-summary-vs-scene"),
    ("craft.general.plot.reader-expectation-and-genre-signaling",
     "craft.general.revision.protecting-reader-experience"),
    ("craft.general.plot.exposition-and-info-delivery",
     "craft.general.scene.entry-and-exit-points"),
    ("craft.general.plot.exposition-and-info-delivery",
     "craft.system.progression.visible-vs-hidden-systems"),
    # Scores 0.099, just under the cross-family floor, because a scheduling
    # practice and a genre-convention record share almost no vocabulary. The
    # relationship is obvious to a person: buffer discipline exists because
    # of serial publishing.
    ("craft.general.practice.buffer-discipline",
     "craft.trope.convention.serial-fiction-conventions"),
]

# Edges rejected during hand review of the proposal: pairs the similarity
# score liked but that carry no real coaching relationship. Recorded here so
# a re-run cannot silently reintroduce them.
REJECTED = {frozenset(p) for p in [
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.general.structure.chapter-architecture-and-transitions"),
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.system.progression.advancement-rate"),
    ("craft.general.practice.buffer-discipline",
     "craft.system.advancement.diminishing-returns-rarity-gates-and-catch-up-mechanics"),
    ("craft.general.practice.no-gap-posting",
     "craft.general.voice.voice-as-craft-element"),
    ("craft.general.voice.narrative-summary-vs-scene",
     "craft.trope.structure.sacrifice-and-return"),
    ("craft.general.scene.sequel-and-reflection", "craft.trope.role.mentor"),
    ("craft.general.voice.dialogue-and-subtext",
     "craft.trope.structure.sacrifice-and-return"),
    # arbitrary: shared craft vocabulary, unrelated subject
    ("craft.general.voice.voice-as-craft-element",
     "craft.general.character.power-as-sole-motivation"),
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.general.plot.negative-space-problems-power-cannot-solve"),
    ("craft.general.practice.author-burnout-as-craft-problem",
     "craft.system.progression.decorative-chapter-test"),
    ("craft.general.practice.buffer-discipline",
     "craft.general.structure.chapter-architecture-and-transitions"),
    ("craft.general.practice.no-gap-posting", "craft.profile.time-loop"),
    ("craft.general.revision.continuity-passes",
     "craft.trope.convention.fantasy-genre-conventions"),
    ("craft.general.scene.entry-and-exit-points",
     "craft.system.progression.advancement-rate"),
    ("craft.general.scene.sequel-and-reflection",
     "craft.trope.role.reluctant-hero"),
    ("craft.general.voice.narrative-summary-vs-scene",
     "craft.comparison.resource.renewable-vs-finite-resources"),
    ("craft.general.character.values-contradiction-and-meaningful-choice",
     "craft.system.character.perks-feats-and-talents"),
    ("craft.general.plot.complications",
     "craft.system.progression.vertical-vs-horizontal-progression"),
    # structurally unrelated trope pairs
    ("craft.trope.structure.the-prophecy", "craft.trope.structure.the-heist"),
    ("craft.trope.combination.inversions-and-combinations",
     "craft.trope.convention.mystery-genre-conventions"),
    ("craft.trope.fatigue.overused-litrpg-trope-cluster",
     "craft.trope.structure.revenge"),
    ("craft.trope.structure.survival",
     "craft.trope.convention.mystery-genre-conventions"),
    ("craft.system.character.specialization-and-respec",
     "craft.trope.identity.resurrection"),
]}

# A forced cross-family link is worth less than no link at all when the
# nearest out-of-family record is not actually relevant. Rule 3 is applied
# only above this similarity floor; exceptions are reported, not hidden.
CROSS_FAMILY_FLOOR = 0.10


def id_prefix(rid, depth=3):
    return ".".join(rid.split(".")[:depth])


def build_scores(recs):
    ids = sorted(recs)
    body = {r: A.tokenize(recs[r]["body"]) for r in ids}
    surf = {}
    for r in ids:
        fm = recs[r]["fm"]
        surf[r] = A.tokenize(" ".join([
            str(fm.get("title", "")), str(fm.get("summary", "")),
            " ".join(fm.get("tags") or []), " ".join(fm.get("aliases") or []),
            r.replace(".", " ").replace("-", " "),
        ]), drop_boilerplate=True)
    bv = A.tfidf_vectors(body)
    sv = A.tfidf_vectors(surf)
    scores = {}
    for a, b in combinations(ids, 2):
        s = max(A.cosine(bv[a], bv[b]), A.cosine(sv[a], sv[b]) * 0.9)
        if id_prefix(a) == id_prefix(b):
            s += 0.05          # same family + same section cluster
        scores[frozenset((a, b))] = s
    return scores


def propose():
    recs, problems = A.load_records()
    if problems:
        print("Refusing to plan; fix these first:")
        for p in problems:
            print(" -", p)
        return 1
    ids = sorted(recs)
    fam = {r: recs[r]["fm"].get("family") for r in ids}
    scores = build_scores(recs)

    original = {r: list(recs[r]["fm"].get("related") or []) for r in ids}
    edges = set()
    for r, outs in original.items():
        for o in outs:
            if o in recs:
                edges.add(frozenset((r, o)))
    n_original = len(edges)

    # Rule 5 + rule 1: everything hand-chosen survives, made mutual.
    reciprocity_added = 0
    for r, outs in original.items():
        for o in outs:
            if o in recs and r not in original[o]:
                reciprocity_added += 1

    # Audit-flagged and hand-authored pairs.
    audit_added = []
    for a, b in AUDIT_PAIRS + PREFERRED:
        if a not in recs or b not in recs:
            print(f"WARNING: audit pair references missing record: {a} / {b}")
            continue
        e = frozenset((a, b))
        if e not in edges:
            edges.add(e)
            audit_added.append((a, b))

    def degree(r):
        return sum(1 for e in edges if r in e)

    def neighbours(r):
        return {next(iter(e - {r})) for e in edges if r in e}

    def candidates(r, pool=None, exclude_same_family=False,
                   require_same_family=False):
        out = []
        have = neighbours(r) | {r}
        for o in (pool or ids):
            if o in have:
                continue
            if frozenset((r, o)) in REJECTED:
                continue
            if exclude_same_family and fam[o] == fam[r]:
                continue
            if require_same_family and fam[o] != fam[r]:
                continue
            out.append((scores[frozenset((r, o))], o))
        out.sort(reverse=True)
        return out

    # Rule 4: profiles link to profiles.
    profile_added = []
    profiles = [r for r in ids if fam[r] == "profile"]
    for r in profiles:
        while sum(1 for o in neighbours(r) if fam[o] == "profile") < PROFILE_MIN_INTRA:
            cands = candidates(r, pool=profiles, require_same_family=True)
            if not cands:
                break
            _, best = cands[0]
            edges.add(frozenset((r, best)))
            profile_added.append((r, best))

    # Rule 2: minimum degree, filled lowest-degree-first so the additions
    # land where they are needed instead of thickening existing hubs.
    degree_added = []
    guard = 0
    while guard < 5000:
        guard += 1
        deficient = [(degree(r), r) for r in ids if degree(r) < MIN_DEGREE]
        if not deficient:
            break
        deficient.sort()
        _, r = deficient[0]
        cands = candidates(r)
        if not cands:
            break
        # Prefer a partner that is also short on links.
        cands.sort(key=lambda c: (-(c[0] + (0.06 if degree(c[1]) < MIN_DEGREE else 0))))
        _, best = cands[0]
        edges.add(frozenset((r, best)))
        degree_added.append((r, best))

    # Rule 3: at least one cross-family link each, but only where a
    # genuinely related out-of-family record exists.
    crossfam_added = []
    crossfam_skipped = []
    for r in ids:
        if any(fam[o] != fam[r] for o in neighbours(r)):
            continue
        cands = candidates(r, exclude_same_family=True)
        if not cands:
            continue
        score, best = cands[0]
        if score < CROSS_FAMILY_FLOOR:
            crossfam_skipped.append((r, best, round(score, 3)))
            continue
        edges.add(frozenset((r, best)))
        crossfam_added.append((r, best))

    final = {r: sorted(neighbours(r)) for r in ids}
    plan = {
        "policy": {
            "min_degree": MIN_DEGREE,
            "reciprocal": True,
            "min_cross_family": 1,
            "profile_min_intra_family": PROFILE_MIN_INTRA,
        },
        "counts": {
            "records": len(ids),
            "edges_before": n_original,
            "edges_after": len(edges),
            "reciprocity_completions": reciprocity_added,
            "audit_pairs_added": len(audit_added),
            "profile_intra_added": len(profile_added),
            "degree_fill_added": len(degree_added),
            "cross_family_added": len(crossfam_added),
            "cross_family_skipped_below_floor": len(crossfam_skipped),
            "hand_rejected_pairs": len(REJECTED),
        },
        "cross_family_exceptions": [
            {"record": r, "nearest_out_of_family": o, "score": s}
            for r, o, s in crossfam_skipped
        ],
        "added": {
            "audit": [list(p) for p in audit_added],
            "profile_intra": [list(p) for p in profile_added],
            "degree_fill": [list(p) for p in degree_added],
            "cross_family": [list(p) for p in crossfam_added],
        },
        "related": final,
    }
    PLAN_PATH.write_text(
        "# Proposed `related` graph — generated by qa/relink.py propose\n"
        "# Reviewed by hand before `qa/relink.py apply` runs.\n\n"
        + yaml.safe_dump(plan, sort_keys=False, allow_unicode=True, width=100),
        encoding="utf-8",
    )
    print(json.dumps(plan["counts"], indent=2))
    degs = sorted(len(v) for v in final.values())
    print(f"degree: min {degs[0]}, median {degs[len(degs)//2]}, max {degs[-1]}")
    orphans = [r for r in ids if not final[r]]
    print(f"orphans after plan: {len(orphans)}")
    print(f"plan written to {PLAN_PATH.relative_to(WORKING)}")
    return 0


def review():
    plan = yaml.safe_load(PLAN_PATH.read_text(encoding="utf-8"))
    recs, _ = A.load_records()
    title = {r: recs[r]["fm"].get("title", r) for r in recs}
    fam = {r: recs[r]["fm"].get("family") for r in recs}
    for bucket, pairs in plan["added"].items():
        print(f"\n## {bucket} ({len(pairs)} edges)\n")
        for a, b in pairs:
            print(f"[{fam[a]:10s} → {fam[b]:10s}] {title.get(a)}  ↔  {title.get(b)}")
            print(f"    {a}\n    {b}")
    return 0


RELATED_BLOCK = re.compile(
    r"^related:\n(?:  - .*\n)*", re.M)


def apply_plan():
    plan = yaml.safe_load(PLAN_PATH.read_text(encoding="utf-8"))
    related = plan["related"]
    recs, _ = A.load_records()
    changed = 0
    for rid, rec in recs.items():
        path = WORKING / rec["path"]
        text = path.read_text(encoding="utf-8")
        head, fm_text, body = text.split("---", 2)
        links = related.get(rid, [])
        block = "related:\n" + "".join(f"  - {x}\n" for x in links)
        if not RELATED_BLOCK.search(fm_text):
            print(f"SKIP (no related block): {rid}")
            continue
        new_fm = RELATED_BLOCK.sub(lambda _: block, fm_text, count=1)
        if new_fm == fm_text:
            continue
        path.write_text(head + "---" + new_fm + "---" + body, encoding="utf-8")
        changed += 1
    print(f"rewrote `related` in {changed} records")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "propose"
    sys.exit({"propose": propose, "review": review, "apply": apply_plan}[cmd]())

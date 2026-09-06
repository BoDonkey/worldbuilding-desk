#!/usr/bin/env python3
"""Publish the explicitly author-vetted tranche into the runtime schema."""

import json
import re
from pathlib import Path

import yaml

WORKING = Path(__file__).resolve().parent.parent
PUBLISHED = WORKING.parent / "published" / "library.json"
TRANCHE_IDS = [
    "craft.system.progression.decorative-chapter-test",
    "craft.system.progression.advancement-rate",
    "craft.system.progression.stat-block-density",
    "craft.system.progression.fake-progression",
    "craft.general.practice.no-gap-posting",
    "craft.general.character.power-as-sole-motivation",
    "craft.general.plot.negative-space-problems-power-cannot-solve",
    "craft.general.promise.promise-consistency",
]


def load_record(path: Path):
    text = path.read_text(encoding="utf-8")
    _, front_matter, body = text.split("---", 2)
    return yaml.safe_load(front_matter), body.strip()


def section_id(title: str) -> str:
    lowered = title.lower()
    if lowered == "what it is":
        return "what-it-is"
    if lowered.startswith("what it can look like"):
        return "present"
    if lowered == "common failure modes":
        return "absence"
    if lowered == "revision or design experiments":
        return "actions"
    return re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")


def parse_sections(body: str):
    matches = list(re.finditer(r"^## (.+)$", body, flags=re.MULTILINE))
    sections = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        sections.append({
            "id": section_id(match.group(1).strip()),
            "title": match.group(1).strip(),
            "content": body[start:end].strip(),
        })
    return sections


def format_modifier(modifier) -> str:
    if isinstance(modifier, str):
        return modifier
    label = modifier.get("subgenre") or modifier.get("genre") or "Context"
    return f"{label}: {modifier.get('note', '').strip()}"


def main():
    sources_doc = yaml.safe_load((WORKING / "sources.yml").read_text(encoding="utf-8"))
    sources = {source["id"]: source for source in sources_doc["sources"]}
    paths = {
        metadata["id"]: path
        for directory in ("general", "systems", "tropes", "comparisons", "profiles")
        for path in (WORKING / directory).glob("*.md")
        for metadata, _ in [load_record(path)]
    }
    missing = [record_id for record_id in TRANCHE_IDS if record_id not in paths]
    if missing:
        raise ValueError(f"Missing tranche records: {', '.join(missing)}")

    records = []
    for record_id in TRANCHE_IDS:
        metadata, body = load_record(paths[record_id])
        if metadata.get("author_vetted") is not True:
            raise ValueError(f"{record_id} is not explicitly author-vetted")
        citations = []
        for source_id in metadata["source_ids"]:
            source = sources.get(source_id)
            if not source:
                raise ValueError(f"{record_id} references unknown source {source_id}")
            citation = {"id": source_id, "label": source["title"]}
            if source.get("url"):
                citation["url"] = source["url"]
            citations.append(citation)
        confidence = metadata["source_confidence"]
        if confidence == "mixed":
            confidence = "medium"
        records.append({
            "id": metadata["id"],
            "version": metadata["version"],
            "title": metadata["title"],
            "summary": metadata["summary"].strip(),
            "documentType": metadata["document_type"],
            "family": metadata["family"],
            "authorVetted": True,
            "detectability": metadata["detectability"],
            "scopes": metadata["scopes"],
            "applicability": metadata["applicability"],
            "modifiers": [format_modifier(value) for value in metadata.get("modifiers", [])],
            "aliases": metadata.get("aliases", []),
            "tags": metadata.get("tags", []),
            "sourceConfidence": confidence,
            "citations": citations,
            "sections": parse_sections(body),
        })

    current = json.loads(PUBLISHED.read_text(encoding="utf-8"))
    current["contentVersion"] = "1.0.0-tranche-1"
    current["records"] = records
    PUBLISHED.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Published {len(records)} author-vetted records to {PUBLISHED}")


if __name__ == "__main__":
    main()

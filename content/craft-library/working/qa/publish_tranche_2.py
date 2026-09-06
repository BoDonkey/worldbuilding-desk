#!/usr/bin/env python3
"""Publish the full author-vetted working corpus as tranche 2.

Tranche 1 (`publish_tranche.py`) hand-selected eight records to validate the
runtime schema and retrieval pipeline end to end. On 2026-09-06 the product
author reviewed and explicitly approved the entire 166-record working corpus
(every record in `general/`, `tropes/`, `systems/`, `comparisons/`, and
`profiles/` carries `author_vetted: true`). This script publishes all of them
as one manifest, superseding the tranche-1 subset rather than layering on top
of it — the tranche-1 records are included here too, unchanged, alongside the
rest.

Two mappings bridge the working-corpus vocabulary and the narrower runtime
contract from Slice 4.17:

- `document_type` in the working corpus is a content template (`pattern`,
  `trope`, `system-mechanic`, `comparison`, `subgenre-profile`); the runtime
  `documentType` is a narrower structural contract (`pattern`, `comparison`,
  `profile`). `trope` and `system-mechanic` records use the same four-section
  pattern shape as `pattern` records, so they map to `pattern`;
  `subgenre-profile` maps to `profile`.
- `source_confidence: contested` (one record — a scholarly dispute about a
  cited claim, not a source-count problem) is treated as `limited` so the
  shipped confidence label never overstates it. `mixed` continues to map to
  `medium`, matching tranche 1.

Section parsing also recognizes profile records' "Characteristic failure
mode" heading (singular, profile-specific wording) as the same required
`absence` section that other families title "Common failure modes".
"""

import json
import re
from pathlib import Path

import yaml

WORKING = Path(__file__).resolve().parent.parent
PUBLISHED = WORKING.parent / "published" / "library.json"
CONTENT_VERSION = "2.0.0-tranche-2"
RECORD_DIRECTORIES = ("general", "systems", "tropes", "comparisons", "profiles")

DOCUMENT_TYPE_MAP = {
    "pattern": "pattern",
    "trope": "pattern",
    "system-mechanic": "pattern",
    "comparison": "comparison",
    "subgenre-profile": "profile",
}

CONFIDENCE_MAP = {
    "mixed": "medium",
    "contested": "limited",
}


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
    if lowered in ("common failure modes", "characteristic failure mode"):
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
    record_paths = [
        path
        for directory in RECORD_DIRECTORIES
        for path in sorted((WORKING / directory).glob("*.md"))
    ]

    records = []
    seen_ids = set()
    for path in record_paths:
        metadata, body = load_record(path)
        record_id = metadata["id"]
        if record_id in seen_ids:
            raise ValueError(f"Duplicate record id across working directories: {record_id}")
        seen_ids.add(record_id)
        if metadata.get("author_vetted") is not True:
            raise ValueError(f"{record_id} is not explicitly author-vetted")

        document_type = metadata["document_type"]
        if document_type not in DOCUMENT_TYPE_MAP:
            raise ValueError(f"{record_id} has unmapped document_type {document_type!r}")

        citations = []
        for source_id in metadata["source_ids"]:
            source = sources.get(source_id)
            if not source:
                raise ValueError(f"{record_id} references unknown source {source_id}")
            citation = {"id": source_id, "label": source["title"]}
            if source.get("url"):
                citation["url"] = source["url"]
            citations.append(citation)

        confidence = CONFIDENCE_MAP.get(metadata["source_confidence"], metadata["source_confidence"])

        sections = parse_sections(body)
        section_ids = {section["id"] for section in sections}
        required_section_ids = {"what-it-is", "present", "absence", "actions"}
        missing_sections = required_section_ids - section_ids
        if missing_sections:
            raise ValueError(f"{record_id} is missing required sections: {sorted(missing_sections)}")

        records.append({
            "id": record_id,
            "version": metadata["version"],
            "title": metadata["title"],
            "summary": metadata["summary"].strip(),
            "documentType": DOCUMENT_TYPE_MAP[document_type],
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
            "sections": sections,
        })

    current = json.loads(PUBLISHED.read_text(encoding="utf-8"))
    current["contentVersion"] = CONTENT_VERSION
    current["records"] = records
    PUBLISHED.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Published {len(records)} author-vetted records to {PUBLISHED} as {CONTENT_VERSION}")


if __name__ == "__main__":
    main()

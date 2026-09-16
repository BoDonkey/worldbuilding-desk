# Portable Data Schema

**Schema identifier:** `worldbuilding-desk/portable/1`

Worldbuilding Desk's portable export is a human-readable ZIP intended for
moving material between writing tools and keeping an inspectable copy outside
the app. It is not a full-fidelity backup. Use **Export Backup (.zip)** on the
Projects screen when you need an exact, restorable project snapshot.

## ZIP layout

```text
README.md
world-bible/
  <category-slug>.csv
  <category-slug>/
    <record-slug>.md
source-notes/
  <note-slug>.md
```

All files are UTF-8. ZIP entries use forward-slash paths.

## World Bible Markdown

Each record has JSON-compatible YAML frontmatter followed by readable
Markdown:

```markdown
---
schema: "worldbuilding-desk/portable/1"
type: "world-bible-record"
title: "Ember Archive"
category: "Locations"
categorySlug: "locations"
aliases: ["The Archive"]
links: ["Glass Market"]
fields: {"description":"<p>A library beneath the city.</p>"}
---
# Ember Archive

## Description

A library beneath the city.
```

`fields` preserves category field keys and values. `aliases` and `links` use
names so the files remain understandable without application IDs. Accepted
facts are rendered in an `## Accepted facts` section, including manuscript
validity boundaries when present. On import they remain readable source text;
they are not written directly to accepted-fact storage.

## Category CSV

There is one CSV per category. The first columns are `name`, `aliases`, and
`links`; category field keys follow, then `accepted_facts`. CSV quoting follows
the conventional doubled-quote rule. Multiple values inside one cell use
` | `.

## Source Note Markdown

Source Notes use the same schema marker with `type: "source-note"`, their note
`kind`, and optional named context `links`. The body is the note content.
Source Notes are evidence and background material, never accepted canon by
themselves.

## Markdown-folder import

The importer accepts `.md` and `.markdown` files from a selected folder,
including an Obsidian vault. Every file is staged before saving. The author
chooses Source Note or World Bible draft, selects a category for a World Bible
draft, and may opt into each `[[wikilink]]` as an existing-record link or an
alias. Unmatched and unselected wikilinks remain ordinary text.

Imported Source Notes use the existing extraction and proposal review flow.
Imported World Bible records are marked incomplete and appear in the existing
World Bible Review queue. Import never writes accepted facts directly.


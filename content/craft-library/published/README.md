# Published craft library

This directory is the reviewed input to the bundled, read-only writing-coach
corpus. The larger corpus under `../working/` is draft material and must never
be imported here automatically.

`library.json` uses schema version 1. Every published record must include:

- a stable ID, record version, title, summary, document type, family, and
  `authorVetted: true`;
- detectability, supported scopes, applicability, modifiers, aliases, and tags;
- source confidence and at least one labeled citation;
- labeled `what-it-is`, `present`, `absence`, and `actions` sections (plus any
  additional sections the record needs).

Run `pnpm --filter web craft-library:build` after changing reviewed content.
The command validates the records, creates build-time embeddings, and replaces
the checked-in generated asset. Normal application builds use
`craft-library:check` to fail when the reviewed input and bundled asset differ.

The application exposes this asset only through the coach-scoped provider. It
is not project RAG data and is not included in project indexing, evidence,
health, backup, deletion, or canon workflows.

Author approval is recorded as `author_vetted: true` in the working Markdown
files. From
`content/craft-library/working`, run `python3 qa/build_catalog.py` and then
`python3 qa/publish_tranche.py` to validate the inventory and rebuild this
runtime JSON before rebuilding the generated asset. The publisher contains an
explicit ID allowlist so broad source approval cannot silently expand the
shipped tranche.

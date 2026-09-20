# World Canvas — planning prompt

> **Archived 2026-09-20.** Historical input prompt for World Canvas 4.30–4.33.
> Current product decisions and open slices live only in
> `docs/road-to-market.md`; do not execute this prompt.

Status: **input prompt, non-authoritative.** Received 2026-09-12 from an
external LLM. The resulting historical plan is
`docs/archive/world-canvas-plan.md`.

---

You are working in the worldbuilding-desk repository. Create a roadmap-ready work-slice plan for an optional “World Canvas” experience that helps fiction authors with initial and ongoing worldbuilding.

This is a planning task only. Do not implement code, claim roadmap slices, commit changes, or silently add the work to the active roadmap.

Inspect the current implementations of:

- World Bible
- Lore Documents / Source Notes
- Project Scratchpad
- World Bible authoring assistant
- Source Note capture and extraction
- Canon Decisions
- First-run onboarding and sample project
- Navigation and shared page chrome

Problem to solve
----------------

The application has strong infrastructure for storing and reviewing world information:

- Scratchpad holds loose ideas.
- Lore Documents hold exploratory longform source material.
- World Bible owns structured canon.
- Canon Decisions resolves extracted proposals and conflicts.
- AI can assist inside existing writing, note, and canon contexts.

However, these surfaces assume that the author already has material. The application does not provide a cohesive, optional experience for answering:

- What is distinctive about this world?
- What pressures and tensions generate stories here?
- Which parts of the world are worth developing next?
- Which ideas are exploratory, and which have become canon?

The desired concept is a “World Canvas”: the lore/worldbuilding counterpart to Corkboard.

Corkboard asks: “What happens, and in what order?”

World Canvas should ask: “What makes this world work, strain, and generate stories?”

Product direction
-----------------

Treat “World Canvas” as a working name. Evaluate author-facing alternatives if appropriate, but do not spend a slice on naming alone.

The preferred IA direction is an optional view or guided entry experience within World Bible, not a new top-level canon owner or a parallel lore database. Confirm this against the existing navigation and ownership rules before finalizing the plan.

The experience should support:

- A freeform world premise, promise, or creative north star.
- A small, optional set of worldbuilding lenses, such as:
  - people and cultures
  - places and environments
  - factions and institutions
  - history and inherited pressures
  - power, resources, or technology
  - customs, beliefs, and social expectations
  - constraints, costs, and consequences
- Tensions, implications, and unanswered questions.
- Lightweight links from canvas material to Source Notes and existing World Bible records.
- Author-invoked brainstorming that generates alternatives, tensions, implications, and questions rather than silently inventing canon.
- Explicit actions such as “Keep as Source Note” and “Propose as canon.”
- A useful empty-project experience and a useful return experience after the project contains substantial canon and manuscript text.

Important constraints
---------------------

- Preserve the writing-first direction. World Canvas must be optional, dismissible, and resumable; it must not become a mandatory project-creation wizard.
- Do not use completion percentages, “world completeness” scores, or exhaustive questionnaires. Worldbuilding is open-ended and genre-dependent.
- Do not create another source of canon truth.
- Prefer reuse of Source Notes, World Bible records, canon facts, links, proposal previews, and confirmation infrastructure.
- Clearly distinguish exploratory material, proposals, and accepted canon.
- Models propose; deterministic code validates; authors approve.
- Model output must never write directly to World Bible, canon facts, project state, or mechanics.
- AI actions must be explicit, reviewable, editable, and compatible with hosted-provider disclosure and project consultation budgets.
- General-fiction projects must not be treated as incomplete for lacking mechanics.
- Avoid forcing speculative ideas into rigid fields prematurely.
- Do not add a relationship graph merely because relationship data exists; include one only if it materially serves the initial-worldbuilding journey.
- Follow the existing design system and theme tokens. Do not invent isolated colors or styling systems.
- Domain logic belongs in services/hooks, not route components.
- Do not create a new parallel roadmap or edit archived planning documents.

Planning questions to resolve
-----------------------------

Investigate and make explicit recommendations about:

1. Whether World Canvas needs any new persisted project data, or whether its first useful version can be composed from existing Scratchpad, Source Notes, World Bible entities, and links.
2. If new persistence is justified, identify the smallest durable contract and its backup/migration implications.
3. Whether the world premise and unanswered questions should be specialized Source Notes, lightweight canvas records, or another reuse of an existing type.
4. How an author moves an idea through:
   exploratory thought → retained Source Note → editable canon proposal → confirmed World Bible/canonical fact.
5. How the experience behaves for:
   - a blank new project
   - a project with Source Notes but no canon
   - a project with established canon
   - a project with imported manuscript scenes
6. Which actions belong directly on the canvas and which should navigate to existing owners.
7. How the assistant receives context without treating exploratory ideas as accepted truth.
8. What belongs in the smallest valuable release and what should be deferred.

Required output
---------------

Produce a self-contained work-slice plan suitable for incorporation into docs/road-to-market.md and, if full prompts are too long for that document, a referenced planning document.

Include:

- A concise product finding and recommended IA.
- The primary author journeys.
- The proposed data ownership and trust flow.
- A slice index with IDs left as placeholders, titles, sizes, dependencies, and sequencing.
- PR-sized slices that each complete a testable author workflow.
- A full, self-contained implementation prompt for every slice.
- Acceptance criteria for every slice.
- Unit, integration, Cypress, accessibility, and manual-smoke expectations as appropriate.
- Storage-schema, snapshot, backup, import, migration, and rollback requirements wherever persistence changes.
- Documentation updates required when application truth changes.
- Explicit anti-goals and deferred ideas.
- A recommendation about v1, post-v1, or beta-driven scheduling, without changing the current roadmap status yourself.
- Risks, open product decisions, and any issue that requires author approval before implementation.

Each future implementation prompt must remind the executor to:

- Claim the approved slice on the authoritative status board.
- Follow the repository’s “Executing a Slice” procedure.
- Use existing services and theme tokens.
- Run the full verification battery.
- Run relevant manual smoke procedures.
- Update PROJECT_STATUS.md when application truth changes.
- Mark the slice done only with its commit hash and verified results.

Do not round uncertain product decisions into implementation details. Present a recommended default and identify genuine alternatives.

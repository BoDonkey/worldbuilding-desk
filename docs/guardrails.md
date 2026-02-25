Document 1: Technical Specification for Guardrails & Entity Detection
Title: Technical Specification: Entity Guardrails & State Enforcement
Version: 1.0
Context: For implementation in a Local-First Electron/Tauri LitRPG Authoring Tool.

1. Objective
To prevent the LLM from "hallucinating" game state or introducing undefined elements into the narrative. The system must intercept specific nouns/actions, validate them against a local JSON database, and force user intervention if validation fails.

2. Core Logic Flow: The "Stop-Gap" Protocol
The application must not allow the LLM to commit text to the main editor without passing the following checks:

Step A: Entity Extraction (Pre-Process)

Input: User's raw text or LLM's suggested text.

Action: Run a lightweight NLP pass (or fast LLM call) to identify:

Items (e.g., "Obsidian Cleaver")

Characters (e.g., "Kael")

Locations (e.g., "Ironhold")

Game Actions (e.g., "Casts Fireball", "Drinks Potion")

Step B: Database Lookup (The Guardrail)

Query: Check the WorldState.json (or SQLite db) for the existence of extracted entities.

Condition 1 (Success): Entity exists.

Action: Retrieve current state (e.g., Obsidian Cleaver: { durability: 40/100 }).

Validation: Does the action violate state? (e.g., Is durability > 0? Does the character own it?).

Condition 2 (Failure - The "Halt"): Entity does not exist.

Action: BLOCK the text generation/commit.

UI Feedback: Highlight the unknown term in Red.

Prompt: "Entity 'Obsidian Cleaver' not found. Create it?"

3. Implementation Requirements (The "Builder's List")

RAG Integration:

The RAG vector store is for Lore Context only (history, descriptions).

Strict Rule: Do not use RAG for Game State (HP, Inventory, Damage). Game State must be deterministic JSON.

The "Undefined Entity" Modal:

When an unknown entity is flagged, a modal must appear allowing the user to:

Define the entity manually.

"Auto-Draft" the entity stats using the LLM (User must approve/save).

State Updates:

If the text says "He drank the potion," the system must decrement Inventory.Potions by 1.

Constraint: The LLM cannot do the math. The LLM identifies the intent ("Intent: Consume Potion"), and the TypeScript backend executes the math (qty - 1).

4. Failure States

Ambiguity: If the system cannot determine if "The heavy blade" refers to the "Obsidian Cleaver," it must prompt the user for clarification before calculating stats.

Conflict: If the narrative contradicts the database (e.g., "He ran fast" but Leg_Status: Broken), the system must flag a "Consistency Error."
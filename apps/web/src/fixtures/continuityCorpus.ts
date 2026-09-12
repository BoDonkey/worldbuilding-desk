/**
 * Continuity review regression corpus (roadmap slice 4.23).
 *
 * Short, readable cases drawn from the Slice 1.1 trust-dogfood fixture
 * (`fixtures/trust-dogfood/`, answer-key IDs cited per case), the shipped
 * sample project, and the false-positive shapes fixed in 1.2d and the smoke
 * history. Each case supplies scene text plus the canon the review would
 * see (records, aliases, accepted facts) and states, explicitly, what the
 * deterministic engine must find and what it must not.
 *
 * The harness in `services/consistency/continuityCorpus.ts` runs the real
 * extraction, validation, and contradiction code over every case; the test
 * reports precision and recall so a matcher or detector change names what
 * it lost. Add a case for every new rule (4.24), state check (4.26), or
 * fixed false positive. `state` is reserved for 4.26 (ruleset, sheets,
 * ledger events) and is unused today.
 *
 * Keep excerpts short. Text is quoted from the fixture chapters; do not
 * "improve" it, because the matcher's behavior on real prose is the point.
 */

export type CorpusIssueCode = 'UNKNOWN_ENTITY' | 'AMBIGUOUS_REFERENCE' | 'UNEXPECTED_SCENE_PRESENCE' | 'STATE_CONFLICT';

export interface CorpusEntity {
  id: string;
  name: string;
  /** Character-kind records resolve through the character map like real World Bible characters. */
  kind: 'character' | 'entity';
  aliases?: string[];
}

export interface CorpusScene {
  id: string;
  title: string;
  /** Plain text, paragraphs separated by blank lines. */
  text: string;
}

export interface CorpusFact {
  targetId: string;
  factType: 'appearance' | 'occupation' | 'membership' | 'age' | 'heritage' | 'relationship' | 'trait';
  value: string;
  sourceTitle: string;
}

export interface CorpusExpectedFinding {
  code: CorpusIssueCode;
  sceneId: string;
  /** Case-insensitive; the finding's surface or focus text must contain it. */
  surfaceIncludes?: string;
  /** For conflicts: the related entity id. */
  entityId?: string;
  note: string;
}

export interface CorpusExpectedAbsence {
  sceneId: string;
  /** No UNKNOWN_ENTITY / AMBIGUOUS_REFERENCE finding may have a surface equal to this (case-insensitive, article-insensitive). */
  surface: string;
  reason: string;
  /**
   * Set when current behavior violates this absence and the violation is a
   * recorded, accepted gap. The test then requires the violation to be
   * present so that fixing it forces the corpus to be updated too.
   */
  knownGap?: string;
}

export interface CorpusExpectedResolution {
  sceneId: string;
  /** A mention whose surface contains this text... */
  surfaceIncludes: string;
  /** ...must NOT resolve to this entity id. */
  mustNotResolveTo: string;
  reason: string;
}

export interface ContinuityCorpusCase {
  id: string;
  title: string;
  source: string;
  scenes: CorpusScene[];
  entities: CorpusEntity[];
  facts?: CorpusFact[];
  expected: CorpusExpectedFinding[];
  expectedAbsent: CorpusExpectedAbsence[];
  expectedNotResolved?: CorpusExpectedResolution[];
  /** No STATE_CONFLICT may name these entity ids (a `knownGap` records an accepted current violation). */
  expectedNoConflictFor?: Array<{entityId: string; knownGap?: string}>;
  /** Reserved for slice 4.26 (state-backed checks). */
  state?: never;
}

const sera: CorpusEntity = {id: 'sera', name: 'Sera Kestrel', kind: 'character', aliases: ['Sera', 'the Ledgerbound']};
const brannic: CorpusEntity = {id: 'brannic', name: 'Brannic Halloway', kind: 'character', aliases: ['Bran', 'Warden Halloway']};
const odessa: CorpusEntity = {id: 'odessa', name: 'Odessa Vane-Kir', kind: 'character', aliases: ['Dess', 'Vane-Kir']};
const tam: CorpusEntity = {id: 'tam', name: 'Tam', kind: 'character'};
const grayharbor: CorpusEntity = {id: 'grayharbor', name: 'Grayharbor', kind: 'entity'};
const saltDoor: CorpusEntity = {id: 'salt-door', name: 'Salt Door', kind: 'entity'};
const undervault: CorpusEntity = {id: 'undervault', name: 'the Undervault', kind: 'entity', aliases: ['the Vault']};
const compact: CorpusEntity = {id: 'compact', name: 'Cinder Compact', kind: 'entity', aliases: ['the Compact']};
const weighingHouse: CorpusEntity = {id: 'weighing-house', name: 'Grand Weighing House', kind: 'entity', aliases: ['Weighing House']};

const CH1_OPENING = `The tide went out at four bells, and Sera Kestrel went down with it.

The stair cut into the cliff face below Grayharbor had no rail, no lamps, and no forgiveness. Forty feet below, the sea pulled back from the cliff like a curtain drawn on a stage, and the Salt Door stood exposed in the wet dark — a slab of pale stone twice her height, crusted to the waist in barnacle and brine, carved with a single line of script no one living could read.

"Don't rush the last ten steps," Brannic Halloway called down from above her, his cane ringing on the stone. "Some of them are more idea than stair."

"You say that every time, Bran."

The Salt Door had been open for eleven days, ever since the quake in the spring tides had cracked its seal and half of Grayharbor had felt something exhale beneath the harbor. The Cinder Compact had claimed delving rights within the week, posted wardens on the cliff stair, and started sending small teams down at every low tide. Sera's team was the smallest: one senior warden with a ruined knee, and one junior delver with steady pen-work and a Ledger-mark she had never asked for.`;

const CH1_LEDGER = `The line hung in the corner of her vision, pale letters on nothing, the way the Ledger always wrote itself. Two years since the marks had crawled up her wrist and she still flinched at it. Look at any delver's eyes when a line appears and you could see the same flinch, hidden fast.

[Health: 62/100.]`;

const CH2_CORVO = `"Sera Kestrel," he said, pleasantly, as though they were resuming a conversation. "The Ledgerbound herself. Grayharbor is very proud."

"Corvo Lash." He smiled the way a ledger smiles — thin, exact, all accounting. "A broker of sorts. I represent parties with a standing interest in what comes up the cliff stair."

"The Compact holds a paper," said Corvo Lash, "and papers burn. Keep well, Ledgerbound. We will speak again when you've had time to be sensible."

Corvo Lash was gone before she reached the top of the stair.`;

const CH2_MA = `Sera stood at the stairhead until her heart slowed, one hand pressed flat over the pocket where the Emberglass Key rode warm against her hip. Then she went down into the fish market and found Tam closing the lamp on the corner of Netmaker's Row, and let him talk about his day, his supervisor, the price of wick-cord — anything at all that was small and ordinary and above the tide line.

"You look like Ma tonight," Tam said, out of nowhere, halfway home. "It's the eyes. Her same green, and the same trick of going somewhere else with them."

"Flatterer." She knocked her shoulder against his. "Ma could also fillet a man at forty paces with those eyes."

"Well," her brother said reasonably, "so can you. That's my whole point."`;

const CH2_REACH = `Reach for it, something in her said, and for once she listened. The Vault's aether was everywhere down here, thick as fog.`;

const CH3_DESS = `"Get your coat. We're going to see Dess."

The Grand Weighing House stood on the third terrace, a barn of black stone where every catch, cargo, and salvage in Grayharbor was weighed.

"Warden Halloway." Odessa did not get up from behind her scale-crowded desk.

"It's her arm, Dess," Brannic said. "Vaultburn, four days in."

"It stays with the Compact," Brannic said.

Odessa Vane-Kir made it disappear into the black iron cabinet behind her desk, spun the seal-wheel, and hung the little brass weight-tag on the hook.`;

const CH4_DEEP_VAULT = `The Salt Door. The antechamber. The dark gate — signed out of Odessa's deep vault that morning, the Key had turned the lock like it had been waiting.

"Climb," said Warden Halloway, and climbed.

[Health: 71/100.]`;

export const CONTINUITY_CORPUS: ContinuityCorpusCase[] = [
  {
    id: 'a1-corvo-lash-repeated-unknown',
    title: 'A1 — a never-seen character repeated three times surfaces as an unknown',
    source: 'trust-dogfood answer-key A1; chapter 2',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_CORVO}],
    entities: [sera, brannic, grayharbor, compact],
    expected: [
      {code: 'UNKNOWN_ENTITY', sceneId: 'ch2', surfaceIncludes: 'Corvo Lash', note: 'repeated-mention unknown character'}
    ],
    expectedAbsent: [
      {sceneId: 'ch2', surface: 'Keep', reason: 'sentence-start imperative is not a name'},
      {sceneId: 'ch2', surface: 'Grayharbor', reason: 'known record'},
      {sceneId: 'ch2', surface: 'Ledgerbound', reason: 'alias of Sera Kestrel resolves as known lore'},
      {sceneId: 'ch2', surface: 'the Compact', reason: 'alias of Cinder Compact resolves as known lore'}
    ]
  },
  {
    id: 'a2-salt-door-before-lore',
    title: 'A2 (first half) — a place from unaccepted lore is an unknown after chapter 1',
    source: 'trust-dogfood answer-key A2; chapter 1',
    scenes: [{id: 'ch1', title: 'The Salt Door', text: CH1_OPENING}],
    entities: [sera, brannic, grayharbor],
    expected: [
      {code: 'UNKNOWN_ENTITY', sceneId: 'ch1', surfaceIncludes: 'Salt Door', note: 'unknown place before place-notes are accepted'}
    ],
    expectedAbsent: [
      {sceneId: 'ch1', surface: "Don't", reason: 'sentence-start contraction'},
      {sceneId: 'ch1', surface: 'Some', reason: 'sentence-start quantifier'},
      {sceneId: 'ch1', surface: 'Bran', reason: 'alias of Brannic Halloway'},
      {sceneId: 'ch1', surface: 'Forty', reason: 'cardinal number word'}
    ]
  },
  {
    id: 'a2-salt-door-after-lore-article-equivalent',
    title: 'A2 (second half) + 1.2d — "the Salt Door" resolves to the record named "Salt Door"',
    source: 'trust-dogfood answer-key A2; 1.2d article-equivalent identity; dogfood note 8',
    scenes: [{id: 'ch1', title: 'The Salt Door', text: CH1_OPENING}],
    entities: [sera, brannic, grayharbor, saltDoor],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch1', surface: 'Salt Door', reason: 'record exists; article variant must share identity'},
      {sceneId: 'ch1', surface: 'the Salt Door', reason: 'record exists; article variant must share identity'}
    ]
  },
  {
    id: 'a4-ma-does-not-fragment',
    title: 'A4 — "Ma" and "your mother" never become review noise',
    source: 'trust-dogfood answer-key A4; chapter 2',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_MA}],
    entities: [sera, tam],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch2', surface: 'Ma', reason: 'kinship word, not a name candidate'},
      {sceneId: 'ch2', surface: 'Flatterer', reason: 'sentence-start noun in dialogue'},
      {sceneId: 'ch2', surface: 'Well', reason: 'sentence-start interjection'}
    ]
  },
  {
    id: 'hazards-sentence-starts-and-system-lines',
    title: 'Natural-prose hazards — sentence starts and bracketed system lines are not candidates',
    source: 'trust-dogfood answer-key § A hazards; chapters 1, 2, 4; smoke history (Look/Some/Don\'t)',
    scenes: [
      {id: 'ch1', title: 'The Salt Door', text: CH1_LEDGER},
      {id: 'ch2', title: 'The Ledgerbound', text: CH2_REACH},
      {id: 'ch4', title: 'Sorrowsteel', text: CH4_DEEP_VAULT}
    ],
    entities: [sera, brannic, odessa, saltDoor, undervault],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch1', surface: 'Look', reason: 'sentence-start verb'},
      {sceneId: 'ch1', surface: 'Health', reason: 'bracketed system line'},
      {sceneId: 'ch1', surface: 'Two', reason: 'cardinal number word'},
      {sceneId: 'ch2', surface: 'Reach', reason: 'sentence-start verb'},
      {sceneId: 'ch4', surface: 'Health', reason: 'bracketed system line'},
      {sceneId: 'ch4', surface: 'Climb', reason: 'one-word imperative in dialogue'}
    ]
  },
  {
    id: 'b1-sera-alias-chain',
    title: 'B1 — Ledgerbound resolves as Sera; no re-flag',
    source: 'trust-dogfood answer-key B1',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_CORVO}],
    entities: [sera, brannic, grayharbor, compact, {id: 'corvo', name: 'Corvo Lash', kind: 'character'}],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch2', surface: 'Ledgerbound', reason: 'alias'},
      {sceneId: 'ch2', surface: 'the Ledgerbound', reason: 'alias with article'},
      {sceneId: 'ch2', surface: 'Corvo Lash', reason: 'now a record'}
    ]
  },
  {
    id: 'b2-b3-b5-dess-vane-kir-warden-compact',
    title: 'B2/B3/B5 — hyphenated surname, titled mention, and short faction form resolve',
    source: 'trust-dogfood answer-key B2, B3, B5; chapter 3',
    scenes: [{id: 'ch3', title: 'The Weighing House', text: CH3_DESS}],
    entities: [sera, brannic, odessa, grayharbor, compact, weighingHouse],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch3', surface: 'Dess', reason: 'alias of Odessa'},
      {sceneId: 'ch3', surface: 'Vane-Kir', reason: 'hyphenated surname alias'},
      {sceneId: 'ch3', surface: 'Warden', reason: 'title must not split off as a candidate'},
      {sceneId: 'ch3', surface: 'Warden Halloway', reason: 'titled alias'},
      {sceneId: 'ch3', surface: 'the Compact', reason: 'short faction form'}
    ]
  },
  {
    id: 'b4-deep-vault-is-not-the-undervault',
    title: 'B4 — bare "vault" inside "deep vault" must not link to the Undervault',
    source: 'trust-dogfood answer-key B4; chapter 4',
    scenes: [{id: 'ch4', title: 'Sorrowsteel', text: CH4_DEEP_VAULT}],
    entities: [sera, brannic, odessa, saltDoor, undervault],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch4', surface: 'deep vault', reason: 'different referent, and a lowercase phrase'}
    ],
    expectedNotResolved: [
      {sceneId: 'ch4', surfaceIncludes: 'vault', mustNotResolveTo: 'undervault', reason: 'the alias is "the Vault"; "deep vault" is Odessa\'s cabinet'}
    ]
  },
  {
    id: 'bran-inside-brannic-boundary',
    title: '1.2d boundary — "Bran" does not fire inside "Brannic Halloway"',
    source: 'dogfood note 2; 1.2d shared boundary arbitration',
    scenes: [{id: 'ch1', title: 'The Salt Door', text: CH1_OPENING}],
    entities: [sera, brannic, grayharbor, saltDoor],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch1', surface: 'Bran', reason: 'alias resolves only as a standalone word'},
      {sceneId: 'ch1', surface: 'Brannic', reason: 'partial of a known full name'}
    ]
  },
  {
    id: 'c1-eye-color-conflict',
    title: 'C1 — accepted gray eyes vs. "Her same green" in chapter 2',
    source: 'trust-dogfood answer-key C1',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_MA}],
    entities: [sera, tam],
    facts: [{targetId: 'sera', factType: 'appearance', value: 'gray eyes', sourceTitle: 'Sera Kestrel dossier'}],
    expected: [
      {code: 'STATE_CONFLICT', sceneId: 'ch2', entityId: 'sera', surfaceIncludes: 'green', note: 'scene eye color contradicts accepted appearance fact'}
    ],
    expectedAbsent: []
  },
  {
    id: 'c1-eye-color-agrees',
    title: 'C1 non-hit — an accepted green-eyes fact produces no conflict',
    source: 'trust-dogfood answer-key C1 (agreeing case)',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_MA}],
    entities: [sera, tam],
    facts: [{targetId: 'sera', factType: 'appearance', value: 'green eyes', sourceTitle: 'Sera Kestrel dossier'}],
    expected: [],
    expectedAbsent: [
      {sceneId: 'ch2', surface: 'Ma', reason: 'kinship word'}
    ],
    expectedNoConflictFor: [{entityId: 'sera'}]
  },
  {
    id: 'c1-eye-color-wrong-entity',
    title: 'C1 non-hit — a gray-eyes fact about Tam is not attributed to Sera\'s scene claim',
    source: 'contradictionReview.test wrong-entity case',
    scenes: [{id: 'ch2', title: 'The Ledgerbound', text: CH2_MA}],
    entities: [sera, tam],
    facts: [{targetId: 'tam', factType: 'appearance', value: 'gray eyes', sourceTitle: 'Tam dossier'}],
    expected: [],
    expectedAbsent: [],
    expectedNoConflictFor: [
      {entityId: 'sera'},
      {
        entityId: 'tam',
        knownGap:
          'Speaker attribution: "Her same green" is spoken by Tam about Sera, but when only Tam has an accepted eye-color fact the claim is attributed to Tam. Target for slice 4.24 (rule registry with addressee/possessive resolution).'
      }
    ]
  },
  {
    id: 'sample-project-opening-no-canon',
    title: 'Sample project — opening paragraphs with no canon surface the four names the guide expects',
    source: 'shipped sample project (5.4); chapter 1 opening',
    scenes: [{id: 'sample-ch1', title: 'Chapter One — The Salt Door', text: CH1_OPENING}],
    entities: [],
    expected: [
      {code: 'UNKNOWN_ENTITY', sceneId: 'sample-ch1', surfaceIncludes: 'Sera Kestrel', note: 'first canon candidate'},
      {code: 'UNKNOWN_ENTITY', sceneId: 'sample-ch1', surfaceIncludes: 'Brannic Halloway', note: 'second character'},
      {code: 'UNKNOWN_ENTITY', sceneId: 'sample-ch1', surfaceIncludes: 'Grayharbor', note: 'place'},
      {code: 'UNKNOWN_ENTITY', sceneId: 'sample-ch1', surfaceIncludes: 'Salt Door', note: 'place'}
    ],
    expectedAbsent: [
      {sceneId: 'sample-ch1', surface: "Don't", reason: 'sentence start'},
      {sceneId: 'sample-ch1', surface: 'Some', reason: 'sentence start'},
      {sceneId: 'sample-ch1', surface: 'Forty', reason: 'number word'}
    ]
  }
];

import type {ExtractProposalInput, KnownEntityRef} from '../consistency';
import {ObservationProposalSchema} from './types';
import type {ObservationProposal} from './types';

const LOCATION_PATTERNS: Array<{
  operation: 'location_set';
  pattern: string;
  confidence: number;
}> = [
  {
    operation: 'location_set',
    pattern:
      String.raw`(?:entered|enters|arrived at|arrives at|returned to|returns to|went to|goes to|moved to|moves to|traveled to|travels to)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.74
  }
];

const INVENTORY_PATTERNS: Array<{
  operation:
    | 'inventory_add'
    | 'inventory_remove'
    | 'inventory_consume'
    | 'inventory_equip'
    | 'inventory_unequip';
  pattern: string;
  confidence: number;
}> = [
  {
    operation: 'inventory_add',
    pattern:
      String.raw`(?:picked up|picks up|found|finds|grabbed|grabs|received|receives|gained|gains|took|takes)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.72
  },
  {
    operation: 'inventory_remove',
    pattern:
      String.raw`(?:dropped|drops|lost|loses|discarded|discards|left behind)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.72
  },
  {
    operation: 'inventory_consume',
    pattern:
      String.raw`(?:drank|drinks|used|uses|consumed|consumes|spent)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.74
  },
  {
    operation: 'inventory_equip',
    pattern:
      String.raw`(?:equipped|equips|wielded|wields|drew|draws)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.78
  },
  {
    operation: 'inventory_unequip',
    pattern:
      String.raw`(?:unequipped|unequips|sheathed|sheathes|stowed|stows)\s+(?<target>[^.!?,;\n]+)`,
    confidence: 0.72
  }
];

// "gained 250 XP", "earns 1,200 experience points".
const XP_PATTERN = {
  operation: 'xp_gain' as const,
  pattern: String.raw`(?:gained|gains|earned|earns|received|receives|was awarded|is awarded)\s+(?<amount>\d[\d,]*)\s*(?:xp|exp|experience(?:\s+points)?)\b`,
  confidence: 0.8
};

/** An inventory target that starts with an XP amount ("250 XP for the kill") is not an item. */
const XP_TARGET = /^\s*(?:[\d,]+\s*)?(?:xp|exp|experience)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSurface(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^(?:a|an|the|some)\s+/i, '').trim();
}

function trimTrailingNoise(value: string): string {
  return value
    .replace(
      /\s+in\s+(?:a|an|one|two|three|four|\d+)\s+(?:bite|bites|gulp|gulps|sip|sips|swallow|swallows)\b.*$/i,
      ''
    )
    .replace(/\s+(?:from|into|toward|towards|with|and)\s+.*$/i, '')
    .replace(/[.!,;:\s]+$/g, '')
    .trim();
}

function normalizeTarget(value: string): {target: string; amount?: number} | null {
  const compact = normalizeSurface(trimTrailingNoise(value));
  if (!compact) {
    return null;
  }

  const amountMatch = compact.match(/^(?<amount>\d+)\s+(?<rest>.+)$/);
  if (amountMatch?.groups?.rest) {
    const amount = Number.parseInt(amountMatch.groups.amount, 10);
    const target = stripLeadingArticle(amountMatch.groups.rest);
    return target ? {target, amount} : null;
  }

  const target = stripLeadingArticle(compact);
  return target ? {target} : null;
}

function makeStateObservationId(
  projectId: string,
  operation: Exclude<ObservationProposal, {type: 'entity_candidate'}>['operation'],
  start: number,
  end: number,
  index: number
): string {
  return `${projectId}:state-delta:${operation}:${start}:${end}:${index}`;
}

function getCharacterRefs(knownEntities: KnownEntityRef[]): KnownEntityRef[] {
  const seen = new Set<string>();
  return knownEntities.filter((entry) => {
    if (entry.type !== 'character') {
      return false;
    }
    const key = entry.id.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function extractStateDeltaObservations(
  input: ExtractProposalInput
): ObservationProposal[] {
  const characterRefs = getCharacterRefs(input.knownEntities)
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  if (characterRefs.length === 0) {
    return [];
  }

  const observations: ObservationProposal[] = [];

  characterRefs.forEach((character, characterIndex) => {
    const escapedName = escapeRegex(character.name);
    [...LOCATION_PATTERNS, ...INVENTORY_PATTERNS].forEach((definition, definitionIndex) => {
      const regex = new RegExp(
        String.raw`\b${escapedName}\b\s+${definition.pattern}`,
        'gi'
      );
      let match: RegExpExecArray | null;
      while ((match = regex.exec(input.text)) !== null) {
        const fullMatch = match[0];
        const targetSurface = match.groups?.target;
        if (!targetSurface) {
          continue;
        }
        if (XP_TARGET.test(targetSurface)) {
          continue;
        }
        const normalizedTarget = normalizeTarget(targetSurface);
        if (!normalizedTarget?.target) {
          continue;
        }
        const start = match.index;
        const end = start + fullMatch.length;
        observations.push(
          ObservationProposalSchema.parse({
            id: makeStateObservationId(
              input.projectId,
              definition.operation,
              start,
              end,
              characterIndex * 100 + definitionIndex
            ),
            projectId: input.projectId,
            type: 'state_delta_candidate',
            operation: definition.operation,
            actor: character.id,
            target: normalizedTarget.target,
            amount: normalizedTarget.amount,
            confidence: definition.confidence,
            evidence: {
              start,
              end,
              text: input.text.slice(start, end)
            },
            createdAt: Date.now()
          })
        );
      }
    });
  });

  characterRefs.forEach((character, characterIndex) => {
    const regex = new RegExp(
      String.raw`\b${escapeRegex(character.name)}\b\s+${XP_PATTERN.pattern}`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input.text)) !== null) {
      const amount = Number.parseInt((match.groups?.amount ?? '').replace(/,/g, ''), 10);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const start = match.index;
      const end = start + match[0].length;
      observations.push(
        ObservationProposalSchema.parse({
          id: makeStateObservationId(input.projectId, XP_PATTERN.operation, start, end, characterIndex * 100 + 99),
          projectId: input.projectId,
          type: 'state_delta_candidate',
          operation: XP_PATTERN.operation,
          actor: character.id,
          amount,
          confidence: XP_PATTERN.confidence,
          evidence: {start, end, text: input.text.slice(start, end)},
          createdAt: Date.now()
        })
      );
    }
  });

  return observations.sort((a, b) => a.evidence.start - b.evidence.start);
}

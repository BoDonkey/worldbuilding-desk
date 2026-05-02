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

  return observations.sort((a, b) => a.evidence.start - b.evidence.start);
}

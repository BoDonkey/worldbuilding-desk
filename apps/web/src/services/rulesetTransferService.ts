import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {
  downloadJsonFile,
  readJsonFile,
  sanitizeFileNamePart
} from './jsonTransfer';

interface RulesetTransferPayload {
  schemaVersion: 1;
  kind: 'ruleset';
  exportedAt: number;
  sourceProjectName: string;
  data: {
    ruleset: WorldRuleset;
  };
}

function isRulesetTransferPayload(value: unknown): value is RulesetTransferPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const payload = value as Partial<RulesetTransferPayload>;
  return payload.schemaVersion === 1 && payload.kind === 'ruleset' && Boolean(payload.data?.ruleset);
}

export async function exportRulesetJson(params: {
  projectName: string;
  ruleset: WorldRuleset;
}): Promise<void> {
  const payload: RulesetTransferPayload = {
    schemaVersion: 1,
    kind: 'ruleset',
    exportedAt: Date.now(),
    sourceProjectName: params.projectName,
    data: {
      ruleset: params.ruleset
    }
  };

  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(
    params.projectName
  )}-ruleset-${stamp}.json`;
  downloadJsonFile(fileName, payload);
}

export async function importRulesetJson(file: File): Promise<WorldRuleset> {
  const json = await readJsonFile(file);
  if (!isRulesetTransferPayload(json)) {
    throw new Error('Invalid ruleset export file.');
  }
  return json.data.ruleset;
}

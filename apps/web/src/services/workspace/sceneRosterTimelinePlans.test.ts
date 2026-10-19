import {describe, expect, it} from 'vitest';
import {buildRosterTimeline, planRosterConsumption, planRosterExpiration, planRosterTimelineEdit} from './sceneRosterTimelinePlans';
import {anchor, character, definition, event, scene, sheet, snapshot, timelineContext} from './sceneRosterPlanFixtures.testSupport';

const item = {name: definition.name, quantity: 1, equipped: false, consumable: {definitionId: definition.id}};

describe('scene roster timeline plans', () => {
  it('prepares consumption for explicit review with the canonical actor and effect metadata', () => {
    const input = {...timelineContext, character, item};
    const original = structuredClone(input);
    expect(planRosterConsumption(input)?.value).toEqual({
      character, initialLabel: 'Consumes Pale Draught', initialCommands: [
        {type: 'inventory_consume', actorId: 'sera', itemName: definition.name, quantity: 1},
        {type: 'stat_change', actorId: 'sera', statDefinitionId: 'strength', delta: 3},
        {type: 'status_apply', actorId: 'sera', statusName: 'Fortified'}
      ], consumableEffect: {definitionId: definition.id, itemName: definition.name, durationLabel: 'one scene', phase: 'consume'}
    });
    expect(input).toEqual(original);
    expect(planRosterConsumption({...input, content: 'unsaved'})?.error).toContain('Save this scene');
    expect(planRosterConsumption({...input, sceneCursorAnchor: {before: '', after: ''}})?.error).toContain('Place the cursor');
    expect(planRosterConsumption({...input, compendiumEntries: []})).toBeNull();
    expect(planRosterConsumption({...input, characterSheets: [{...sheet, characterEntityId: undefined}]})?.error).toContain('legacy sheet');
  });

  it('prepares inverse effects and retains the exact source event for expiration', () => {
    const input = {...timelineContext, eventId: event.id};
    const result = planRosterExpiration(input)?.value;
    expect(result).toMatchObject({character, initialLabel: 'Pale Draught expires',
      initialCommands: [
        {type: 'stat_change', actorId: sheet.id, statDefinitionId: 'strength', delta: -3},
        {type: 'status_remove', actorId: sheet.id, statusName: 'Fortified'}
      ], consumableEffect: {sourceEventId: event.id, phase: 'expire', durationLabel: 'one scene'}
    });
    expect(planRosterExpiration({...input, characters: []})?.error).toContain('affected character');
    expect(planRosterExpiration({...input, content: 'unsaved'})?.error).toContain('Save this scene');
    expect(planRosterExpiration({...input, sceneCursorAnchor: {before: '', after: ''}})?.error).toContain('where the effect expires');
    expect(planRosterExpiration({...input, eventId: 'missing'})).toBeNull();
  });

  it('edits at a resolved anchor and falls back to the saved position for unresolved legacy text', () => {
    const input = {...timelineContext, eventId: event.id, stateMutationAnchorResolutionById: new Map([[event.id, {status: 'moved' as const, position: 12, textOffset: 11}]]), sceneCursorSnapshot: snapshot};
    expect(planRosterTimelineEdit(input)?.value).toMatchObject({cursorPosition: 12, pending: {character, event: {...event, scenePosition: 12}}});
    expect(planRosterTimelineEdit({...input, stateMutationAnchorResolutionById: new Map([[event.id, {status: 'unresolved'}]])})?.value?.cursorPosition).toBe(event.scenePosition);
    expect(planRosterTimelineEdit({...input, characters: []})?.error).toContain('before editing');
    expect(planRosterTimelineEdit({...input, stateMutationEvents: [{...event, scenePosition: undefined}]})).toBeNull();
    expect(event.scenePosition).toBe(20);
  });

  it('preserves existing sheet/legacy-ID lookup behavior for timeline edit and expiration', () => {
    const canonicalEvent = {...event, commands: event.commands.map((command) => ({...command, actorId: 'sera'}))};
    // This refactor must not silently widen the old timeline lookup to canonical IDs.
    const input = {...timelineContext, stateMutationEvents: [canonicalEvent], eventId: event.id};
    expect(planRosterExpiration(input)?.error).toContain('affected character');
    expect(planRosterTimelineEdit({...input, stateMutationAnchorResolutionById: new Map(), sceneCursorSnapshot: snapshot})?.error).toContain('before editing');
    const legacy = {...sheet, characterId: 'old-sera'};
    const legacyEvent = {...event, commands: event.commands.map((command) => ({...command, actorId: 'old-sera'}))};
    expect(planRosterExpiration({...input, characterSheets: [legacy], stateMutationEvents: [legacyEvent]})?.value?.initialCommands?.[0].actorId).toBe('old-sera');
  });

  it('derives a sorted timeline, excludes proposals, and suppresses already-expired effects across scenes', () => {
    const expiration = {...event, id: 'expire', sceneId: 'later', consumableEffect: {...event.consumableEffect!, phase: 'expire' as const, sourceEventId: event.id}};
    const events = [expiration, {...event, id: 'later-change', sceneSequence: 6, label: ' Later '}, {...event, id: 'proposal', status: 'proposed' as const}, event];
    const original = structuredClone(events);
    const result = buildRosterTimeline({selectedDocument: scene, characterSheets: [sheet], stateMutationEvents: events, stateMutationAnchorResolutionById: new Map([[event.id, {status: 'moved', position: 22, textOffset: 21}]]), resourceDefinitionNameById: new Map(), statDefinitionNameById: new Map()});
    expect(result.map((entry) => entry.id)).toEqual([event.id, 'later-change']);
    expect(result[0]).toMatchObject({actorLabel: sheet.name, anchorStatus: 'moved', position: 22, canEdit: true, canExpire: false});
    expect(result[1]).toMatchObject({label: 'Later', anchorStatus: 'legacy'});
    expect(events).toEqual(original);
    expect(anchor.before).not.toBe('');
  });
});

import {describe, expect, it} from 'vitest';
import {buildPositionedChangeBefore, planPositionedChange, planRosterInvalidation, planRosterReanchor} from './sceneRosterPositionPlans';
import {resolveRosterAnchors} from './sceneRosterAnchors';
import {anchor, character, event, scene, sheet, snapshot} from './sceneRosterPlanFixtures.testSupport';
import {textSnapshotFromPlainText} from '../state/stateMutationAnchor';
import {hashSceneContent} from './sceneRosterMutationTypes';

const context = {
  input: {label: 'Drinks Pale Draught', commands: event.commands}, projectId: 'corpus',
  selectedDocument: scene, documents: [scene], pendingPositionedSheet: sheet,
  pendingPositionedChange: {character}, stateMutationEvents: [event], sceneCursorPosition: 30,
  sceneCursorAnchor: anchor, eventId: 'new', now: 100
};

describe('positioned scene changes', () => {
  it('creates a canonically bound event with scene-local sequence and supplied clock/id', () => {
    const input = {...context, stateMutationEvents: [event, {...event, sceneId: 'other', sceneSequence: 99}]};
    const original = structuredClone(input);
    expect(planPositionedChange(input)?.value).toMatchObject({id: 'new', createdAt: 100, sceneSequence: 5,
      scenePosition: 30, sceneAnchor: anchor, sourceHash: hashSceneContent(scene.content), sourceRevision: 2,
      commands: [{...event.commands[0], actorId: 'sera'}], status: 'accepted', sourceType: 'manual'});
    expect(input).toEqual(original);
    expect(planPositionedChange({...context, documents: []})).toBeNull();
    expect(planPositionedChange({...context, pendingPositionedSheet: {...sheet, characterEntityId: undefined}})?.error).toContain('legacy sheet');
  });

  it('retains edited identity, timestamp, zero position/sequence and consumable metadata', () => {
    const existing = {...event, scenePosition: 0, sceneSequence: 0};
    const result = planPositionedChange({...context, input: {...context.input, label: ''}, pendingPositionedChange: {character, event: existing}})?.value;
    expect(result).toMatchObject({id: event.id, scenePosition: 0, sceneSequence: 0, createdAt: event.createdAt,
      consumableEffect: event.consumableEffect, label: undefined});
    const effect = {...event.consumableEffect!, phase: 'expire' as const};
    expect(planPositionedChange({...context, pendingPositionedChange: {character, event, consumableEffect: effect}})?.value?.consumableEffect).toEqual(effect);
  });

  it('reanchors with updated evidence while retaining the existing status and commands', () => {
    const invalidated = {...event, status: 'invalidated' as const, invalidatedAt: 3, invalidationReason: 'old'};
    const input = {event: invalidated, selectedDocument: scene, content: scene.content, sceneCursorPosition: 30, sceneCursorAnchor: anchor};
    expect(planRosterReanchor(input).value).toEqual({...invalidated, scenePosition: 30, sceneAnchor: anchor, sourceRevision: 2, sourceHash: hashSceneContent(scene.content), invalidatedAt: undefined, invalidationReason: undefined});
    expect(planRosterReanchor({...input, content: 'unsaved'}).error).toContain('Save the scene');
    expect(planRosterReanchor({...input, sceneCursorAnchor: {before: '', after: ''}}).error).toContain('intended scene text');
    expect(planRosterInvalidation(event.id)).toEqual({eventId: event.id, reason: 'Invalidated from the scene roster timeline.'});
    expect(invalidated.invalidatedAt).toBe(3);
  });

  it('previews only earlier same-position events, excluding the edited change and later siblings', () => {
    const add = {...event, id: 'earlier', sceneSequence: 1, commands: [{type: 'inventory_add' as const, actorId: 'sera', itemName: 'Pale Draught', quantity: 2}]};
    const later = {...event, id: 'later', sceneSequence: 8, commands: [{type: 'inventory_add' as const, actorId: 'sera', itemName: 'Pale Draught', quantity: 10}]};
    const before = buildPositionedChangeBefore({...context, ruleset: null, actorResolutions: [], resolvedStateMutationEvents: [add, event, later], pendingPositionedChange: {character, event}});
    expect(before?.inventory.items.find((item) => item.name === 'Pale Draught')?.quantity).toBe(3);
    expect(buildPositionedChangeBefore({...context, ruleset: null, actorResolutions: [], resolvedStateMutationEvents: [], pendingPositionedSheet: null})).toBeNull();
  });

  it('distinguishes missing, legacy, exact and moved anchors using live text for the active scene', () => {
    const legacy = {...event, id: 'legacy', sceneAnchor: undefined};
    const missing = {...event, id: 'missing', sceneId: 'deleted'};
    const input = {stateMutationEvents: [event, legacy, missing], documents: [scene], selectedDocument: scene, sceneCursorSnapshot: snapshot};
    const result = resolveRosterAnchors(input);
    expect(result.get(event.id)).toMatchObject({status: 'exact', position: 20});
    expect(result.get('legacy')).toBeNull();
    expect(result.get('missing')).toEqual({status: 'unresolved'});
    const prefix = 'At dawn, ';
    const moved = textSnapshotFromPlainText(prefix + snapshot.text);
    expect(resolveRosterAnchors({...input, sceneCursorSnapshot: moved}).get(event.id)).toMatchObject({status: 'moved', position: 29});
    expect(resolveRosterAnchors({...input, selectedDocument: null}).get(event.id)).toMatchObject({status: 'exact', position: 20});
  });
});

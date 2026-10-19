import {describe, expect, it} from 'vitest';
import {planSelectionConsumptionCapture, planSelectionInventoryCapture} from './sceneRosterItemPlans';
import {captureContext, pickupInput, sheet, definition, event, capture, scene} from './sceneRosterPlanFixtures.testSupport';
import {replayCharacterState} from '../state/stateReplay';
import {validateItemStateAuthoringPlan} from '../state/itemStateAuthoringService';

const consumeContext = {...captureContext, pendingInventoryCapture: {...capture, action: 'consume' as const}};
const consumeInput = {...pickupInput, commands: event.commands};

describe('scene roster item write plans', () => {
  it('plans state-only pickup with canonical identity and scene-local ordering, without mutating inputs', () => {
    const input = {...captureContext, input: pickupInput};
    const original = structuredClone(input);
    const result = planSelectionInventoryCapture(input)!.value!;
    expect(result.plan.event).toMatchObject({
      id: 'new-event', projectId: 'corpus', sceneId: scene.id, sceneOrder: 1, sceneSequence: 5,
      scenePosition: capture.position, sceneAnchor: capture.anchor, sourceRevision: scene.updatedAt,
      status: 'accepted', sourceType: 'manual', createdAt: 100,
      commands: [{type: 'inventory_add', actorId: 'sera', itemName: 'Pale Draught', quantity: 2}]
    });
    expect(result.plan.entityToSave).toBeUndefined();
    expect(result.plan.compendiumEntryToSave).toBeUndefined();
    expect(input).toEqual(original);
    expect(planSelectionInventoryCapture(input)).toEqual({value: result});
  });

  it('creates reusable canon only on request and links an unlinked exact definition', () => {
    const result = planSelectionInventoryCapture({...captureContext, compendiumEntries: [definition], input: {...pickupInput, saveReusable: true, canonicalName: 'Pale Draught (healing)'}})!.value!.plan;
    expect(result.entityToSave).toMatchObject({id: 'new-world-item', name: 'Pale Draught (healing)', categoryId: 'items', needsCompletion: true, createdAt: 100});
    expect(result.compendiumEntryToSave).toEqual({...definition, sourceEntityId: 'new-world-item', updatedAt: 100});
    expect(result.event.commands[0]).toMatchObject({definitionId: definition.id, sourceEntityId: 'new-world-item'});
  });

  it('uses an explicitly chosen existing item and leaves ambiguous automatic matches unlinked', () => {
    const entity = {id: 'chosen', projectId: 'corpus', categoryId: 'items', name: 'Pale Draught', fields: {}, links: [], createdAt: 1, updatedAt: 1};
    const result = planSelectionInventoryCapture({...captureContext, entities: [entity], input: {...pickupInput, reusableEntityId: 'chosen', saveReusable: true}})!.value!.plan;
    expect(result.entityToSave).toBeUndefined();
    expect(result.event.commands[0]).toMatchObject({sourceEntityId: 'chosen'});
    const ambiguous = planSelectionInventoryCapture({...captureContext, entities: [entity, {...entity, id: 'duplicate'}], input: pickupInput})!.value!.plan;
    expect(ambiguous.event.commands[0]).toMatchObject({sourceEntityId: undefined, definitionId: undefined});
  });

  it.each([planSelectionInventoryCapture, planSelectionConsumptionCapture])('rejects stale prose, wrong scenes, unresolved actors and missing reusable categories', (build) => {
    const base = {...consumeContext, input: {...consumeInput, quantity: 1}};
    const context = build === planSelectionInventoryCapture ? {...base, pendingInventoryCapture: capture} : base;
    expect(build({...context, content: scene.content + ' changed'})?.error).toContain('source prose changed');
    expect(build({...context, pendingInventoryCapture: {...context.pendingInventoryCapture, sceneId: 'other'}})?.error).toContain('source prose changed');
    expect(build({...context, characterSheets: [{...sheet, characterEntityId: undefined}]})?.error).toContain('before recording state');
    expect(build({...context, categories: [], input: {...context.input, saveReusable: true}})?.error).toContain('Items category');
    expect(build({...context, documents: []})).toBeNull();
  });

  it('pins distinct acquire/consume no-op and wrong-action guards', () => {
    expect(planSelectionInventoryCapture({...consumeContext, input: pickupInput})?.error).toContain('consumption proposal');
    expect(planSelectionConsumptionCapture({...captureContext, input: consumeInput})).toBeNull();
    expect(planSelectionInventoryCapture({...captureContext, characterSheets: [], input: pickupInput})).toBeNull();
    expect(planSelectionConsumptionCapture({...consumeContext, characterSheets: [], input: consumeInput})?.error).toContain('World Bible canon');
  });

  it('consumes the corpus baseline once and supersedes only the reviewed proposal', () => {
    const result = planSelectionConsumptionCapture({...consumeContext,
      pendingInventoryCapture: {...consumeContext.pendingInventoryCapture, proposalEventId: 'review'},
      stateMutationEvents: [{...event, id: 'review', status: 'proposed', sourceType: 'deterministic-review'}], input: consumeInput
    })!.value!.plan;
    expect(result.event.commands).toEqual([{...event.commands[0], actorId: 'sera', sourceEntityId: undefined, definitionId: undefined}]);
    expect(result.eventToInvalidate).toMatchObject({id: 'review', status: 'invalidated', invalidatedAt: 100});
    validateItemStateAuthoringPlan({plan: result, ruleset: null});
    const replay = replayCharacterState({sheet, ruleset: null, events: [result.event], target: {actorId: 'sera', sheetId: sheet.id}});
    expect(replay.inventory.items.some((item) => item.name === 'Pale Draught')).toBe(false);
    expect(replay.inventory.items.some((item) => item.name === 'Emberglass Key')).toBe(true);
  });

  it('remembers consumption effects only when requested and rewrites all actors but only inventory links', () => {
    const commands = [...event.commands, {type: 'stat_change' as const, actorId: 'legacy', statDefinitionId: 'strength', delta: 3}];
    const result = planSelectionConsumptionCapture({...consumeContext, input: {...consumeInput, commands, saveReusable: true, rememberedConsumable: definition.consumable}})!.value!.plan;
    expect(result.compendiumEntryToSave).toMatchObject({id: 'new-definition', sourceEntityId: 'new-world-item', consumable: definition.consumable});
    expect(result.event.consumableEffect).toEqual({definitionId: 'new-definition', itemName: definition.name, phase: 'consume'});
    expect(result.event.commands).toEqual([
      {...event.commands[0], actorId: 'sera', sourceEntityId: 'new-world-item', definitionId: 'new-definition'},
      {type: 'stat_change', actorId: 'sera', statDefinitionId: 'strength', delta: 3}
    ]);
  });

  it('retains existing definition metadata and ID when remembering an effect', () => {
    const result = planSelectionConsumptionCapture({...consumeContext, compendiumEntries: [definition], input: {...consumeInput, rememberedConsumable: {effects: []}}})!.value!.plan;
    expect(result.compendiumEntryToSave).toMatchObject({id: definition.id, tags: definition.tags, createdAt: 1, updatedAt: 100, consumable: {effects: []}});
    expect(result.event.consumableEffect?.definitionId).toBe(definition.id);
  });
});

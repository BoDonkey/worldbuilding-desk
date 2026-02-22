import type {
  CharacterState,
  ActiveStatus,
  Modifier
} from '../types/CharacterState';
import type {
  WorldRuleset,
  StatDefinition,
  ResourceDefinition
} from '../types/WorldRuleset';
import {
  createEmptyCharacterState,
  calculateEffectiveStat
} from '../types/CharacterState';
import {updateState} from '../utils/immutable';
import {RulesEngine} from '../engine/RulesEngine';

/**
 * Manages character state and applies time-based effects
 */

export type TimeProgressionMode = 'seconds' | 'ticks';

export interface TimeAdvanceOptions {
  mode?: TimeProgressionMode;
  tickSeconds?: number;
}

export interface ExposureAilmentDefinition {
  id: string;
  exposureKey: string;
  statusName: string;
  triggerAtSeconds: number;
  durationSeconds: number;
  sourceRuleId?: string;
  cooldownSeconds?: number;
  data?: Record<string, unknown>;
}

export interface ItemDurabilityOptions {
  durabilityCost?: number;
  allowBreak?: boolean;
  scrapOnBreak?: number;
  insightOnBreak?: number;
  legacyUsageThreshold?: number;
  legacyYieldIncrement?: number;
  legacyNamePrefix?: string;
}

export interface ItemDurabilityResult {
  state: CharacterState;
  broken: boolean;
  removed: boolean;
  gainedScrap: number;
  gainedInsight: number;
  legacyTierIncreased: boolean;
  newLegacyTier?: number;
  itemName?: string;
}

export class StateManager {
  private states: Map<string, CharacterState>;
  private engine: RulesEngine;
  private ruleset: WorldRuleset;

  constructor(ruleset: WorldRuleset, engine?: RulesEngine) {
    this.states = new Map();
    this.ruleset = ruleset;
    this.engine = engine || new RulesEngine(ruleset);
  }

  /**
   * Create a new character from ruleset definitions
   */
  createCharacter(
    name: string,
    customStats?: Record<string, any>
  ): CharacterState {
    // Build initial stats from ruleset
    const stats: Record<string, any> = {};
    for (const statDef of this.ruleset.statDefinitions) {
      stats[statDef.id] = customStats?.[statDef.id] ?? statDef.defaultValue;
    }

    // Build initial resources
    const resources = {
      current: {} as Record<string, number>,
      max: {} as Record<string, number>
    };

    for (const resDef of this.ruleset.resourceDefinitions) {
      const value =
        typeof resDef.defaultValue === 'number' ? resDef.defaultValue : 100;
      resources.current[resDef.id] = value;
      resources.max[resDef.id] = resDef.max ?? value;
    }

    const character = createEmptyCharacterState(
      name,
      this.ruleset.id,
      stats,
      resources
    );

    this.states.set(character.id, character);

    // Apply any passive rules
    const passiveRules = this.ruleset.rules.filter(
      (rule) => rule.enabled && rule.trigger?.type === 'passive'
    );

    if (passiveRules.length > 0) {
      const {finalState} = this.engine.executeRules(
        passiveRules.map((r) => r.id),
        character
      );
      this.states.set(character.id, finalState);
      return finalState;
    }

    return character;
  }

  /**
   * Get character state by ID
   */
  getCharacter(characterId: string): CharacterState | undefined {
    return this.states.get(characterId);
  }

  /**
   * Update character state
   */
  updateCharacter(
    characterId: string,
    updates: Partial<CharacterState>
  ): CharacterState {
    const current = this.states.get(characterId);
    if (!current) {
      throw new Error(`Character ${characterId} not found`);
    }

    const updated = updateState(current, (draft) => {
      Object.assign(draft, updates);
      draft.updatedAt = Date.now();
    });

    this.states.set(characterId, updated);
    return updated;
  }

  /**
   * Apply a rule to a character
   */
  applyRule(
    characterId: string,
    ruleId: string
  ): {
    state: CharacterState;
    success: boolean;
    error?: string;
  } {
    const state = this.states.get(characterId);
    if (!state) {
      return {
        state: state!,
        success: false,
        error: `Character ${characterId} not found`
      };
    }

    const result = this.engine.executeRules([ruleId], state);

    if (result.results[0]?.success) {
      this.states.set(characterId, result.finalState);
      return {state: result.finalState, success: true};
    }

    return {
      state,
      success: false,
      error: result.results[0]?.error || 'Rule failed to execute'
    };
  }

  /**
   * Process time elapsed for a character (handles regeneration, status expiry, etc)
   */
  advanceTime(
    characterId: string,
    amount: number,
    options?: TimeAdvanceOptions
  ): CharacterState {
    const seconds = this.toSeconds(amount, options);
    return this.processTimeElapsed(characterId, seconds);
  }

  processTimeElapsed(characterId: string, seconds: number): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    let newState = updateState(state, (draft) => {
      draft.timers.lastUpdate = Date.now();
    });

    // 1. Update active effect timers
    newState = this.updateEffectTimers(newState, seconds);

    // 2. Remove expired statuses
    newState = this.removeExpiredStatuses(newState);

    // 3. Apply resource regeneration
    newState = this.applyRegeneration(newState, seconds);

    // 4. Trigger time-based rules
    newState = this.triggerTimeBasedRules(newState, seconds);

    // 5. Trigger status-active rules
    newState = this.triggerStatusActiveRules(newState, seconds);

    this.states.set(characterId, newState);
    return newState;
  }

  private toSeconds(amount: number, options?: TimeAdvanceOptions): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Time amount must be a positive number');
    }
    const mode = options?.mode ?? 'seconds';
    if (mode === 'ticks') {
      const tickSeconds = options?.tickSeconds ?? 60;
      return amount * tickSeconds;
    }
    return amount;
  }

  /**
   * Update effect timers
   */
  private updateEffectTimers(
    state: CharacterState,
    seconds: number
  ): CharacterState {
    return updateState(state, (draft) => {
      for (const [ruleId, timer] of Object.entries(
        draft.timers.activeEffects
      )) {
        if (!timer.isPaused) {
          timer.remainingTime -= seconds;

          // Remove timer if expired
          if (timer.remainingTime <= 0) {
            delete draft.timers.activeEffects[ruleId];
          }
        }
      }
    });
  }

  /**
   * Remove expired statuses
   */
  private removeExpiredStatuses(state: CharacterState): CharacterState {
    const now = Date.now();

    return updateState(state, (draft) => {
      draft.statuses = draft.statuses.filter((status) => {
        if (status.expiresAt && status.expiresAt <= now) {
          return false; // Remove expired
        }
        return true; // Keep active
      });
    });
  }

  /**
   * Apply resource regeneration based on ruleset definitions
   */
  private applyRegeneration(
    state: CharacterState,
    seconds: number
  ): CharacterState {
    let newState = state;

    for (const resDef of this.ruleset.resourceDefinitions) {
      if (resDef.regeneration?.enabled) {
        const {rate, interval} = resDef.regeneration;
        const regenAmount = (seconds / interval) * rate;

        newState = updateState(newState, (draft) => {
          const current = draft.resources.current[resDef.id] || 0;
          const max = draft.resources.max[resDef.id] || 100;
          draft.resources.current[resDef.id] = Math.min(
            current + regenAmount,
            max
          );
        });
      }
    }

    return newState;
  }

  /**
   * Trigger time-based rules
   */
  private triggerTimeBasedRules(
    state: CharacterState,
    seconds: number
  ): CharacterState {
    // Find rules with time_elapsed trigger
    const timeRules = this.ruleset.rules.filter(
      (rule) => rule.enabled && rule.trigger?.type === 'time_elapsed'
    );

    let newState = state;

    for (const rule of timeRules) {
      const interval = rule.trigger?.interval || 60;

      // Check if enough time has passed
      if (seconds >= interval) {
        const result = this.engine.evaluateRule(rule, newState);
        if (result.success && result.newState) {
          newState = result.newState;
        }
      }
    }

    return newState;
  }

  /**
   * Trigger rules that should run while a status is active
   */
  private triggerStatusActiveRules(
    state: CharacterState,
    seconds: number
  ): CharacterState {
    const statusRuleCandidates = this.ruleset.rules.filter(
      (rule) => rule.enabled && rule.trigger?.type === 'status_active'
    );
    if (statusRuleCandidates.length === 0 || state.statuses.length === 0) {
      return state;
    }

    let newState = state;
    for (const status of state.statuses) {
      const matchingRules = statusRuleCandidates.filter((rule) => {
        const configuredStatus = rule.trigger?.statusName;
        if (!configuredStatus) return true;
        return configuredStatus === status.name;
      });

      for (const rule of matchingRules) {
        const interval = rule.trigger?.interval || 1;
        if (seconds < interval) continue;
        const result = this.engine.evaluateRule(rule, newState);
        if (result.success && result.newState) {
          newState = result.newState;
        }
      }
    }

    return newState;
  }

  /**
   * Add a status to a character
   */
  recordExposure(
    characterId: string,
    exposureKey: string,
    amount: number,
    options?: TimeAdvanceOptions
  ): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }
    const seconds = this.toSeconds(amount, options);
    const now = Date.now();
    const newState = updateState(state, (draft) => {
      const current = draft.environment.exposures[exposureKey];
      draft.environment.exposures[exposureKey] = {
        seconds: (current?.seconds ?? 0) + seconds,
        lastUpdated: now,
        lastAppliedAt: current?.lastAppliedAt
      };
      draft.updatedAt = now;
    });
    this.states.set(characterId, newState);
    return newState;
  }

  clearExposure(characterId: string, exposureKey: string): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }
    const newState = updateState(state, (draft) => {
      delete draft.environment.exposures[exposureKey];
      draft.updatedAt = Date.now();
    });
    this.states.set(characterId, newState);
    return newState;
  }

  applyExposureAilments(
    characterId: string,
    ailments: ExposureAilmentDefinition[]
  ): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const now = Date.now();
    const nextState = updateState(state, (draft) => {
      for (const ailment of ailments) {
        const tracker = draft.environment.exposures[ailment.exposureKey];
        if (!tracker || tracker.seconds < ailment.triggerAtSeconds) {
          continue;
        }

        const activeStatus = draft.statuses.find(
          (status) =>
            status.name === ailment.statusName &&
            (!status.expiresAt || status.expiresAt > now)
        );
        if (activeStatus) {
          continue;
        }

        const cooldownSeconds = ailment.cooldownSeconds ?? 0;
        if (
          tracker.lastAppliedAt &&
          now - tracker.lastAppliedAt < cooldownSeconds * 1000
        ) {
          continue;
        }

        draft.statuses.push({
          id: crypto.randomUUID(),
          name: ailment.statusName,
          sourceRuleId: ailment.sourceRuleId ?? ailment.id,
          appliedAt: now,
          expiresAt: now + ailment.durationSeconds * 1000,
          data: ailment.data
        });
        tracker.lastAppliedAt = now;
      }

      draft.updatedAt = now;
    });

    this.states.set(characterId, nextState);
    return nextState;
  }

  recordExposureAndApplyAilments(
    characterId: string,
    exposureKey: string,
    amount: number,
    ailments: ExposureAilmentDefinition[],
    options?: TimeAdvanceOptions
  ): CharacterState {
    this.recordExposure(characterId, exposureKey, amount, options);
    return this.applyExposureAilments(characterId, ailments);
  }

  /**
   * Add a status to a character
   */
  addStatus(
    characterId: string,
    statusName: string,
    sourceRuleId: string,
    duration?: number,
    data?: Record<string, any>
  ): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const status: ActiveStatus = {
      id: crypto.randomUUID(),
      name: statusName,
      sourceRuleId,
      appliedAt: Date.now(),
      expiresAt: duration ? Date.now() + duration * 1000 : undefined,
      data
    };

    const newState = updateState(state, (draft) => {
      draft.statuses.push(status);
    });

    this.states.set(characterId, newState);
    return newState;
  }

  /**
   * Remove a status from a character
   */
  removeStatus(characterId: string, statusId: string): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const newState = updateState(state, (draft) => {
      draft.statuses = draft.statuses.filter((s) => s.id !== statusId);
    });

    this.states.set(characterId, newState);
    return newState;
  }

  /**
   * Add a modifier to a character
   */
  applyItemDurability(
    characterId: string,
    itemInstanceId: string,
    options: ItemDurabilityOptions = {}
  ): ItemDurabilityResult {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const durabilityCost = Math.max(0, options.durabilityCost ?? 1);
    const allowBreak = options.allowBreak ?? true;
    const scrapOnBreak = Math.max(0, options.scrapOnBreak ?? 1);
    const insightOnBreak = Math.max(0, options.insightOnBreak ?? 1);
    const legacyUsageThreshold = Math.max(1, options.legacyUsageThreshold ?? 100);
    const legacyYieldIncrement = options.legacyYieldIncrement ?? 0.02;
    const legacyNamePrefix = options.legacyNamePrefix ?? 'Legacy';

    let broken = false;
    let removed = false;
    let gainedScrap = 0;
    let gainedInsight = 0;
    let legacyTierIncreased = false;
    let newLegacyTier: number | undefined;
    let itemName: string | undefined;
    let found = false;

    const nextState = updateState(state, (draft) => {
      const crafting = (draft.custom ?? {}) as Record<string, unknown>;
      const progression = ((crafting.progression ?? {}) as Record<string, unknown>);

      const processItem = (item: {
        name: string;
        durability?: number;
        usageCount?: number;
        breakCount?: number;
        legacyTier?: number;
        legacyName?: string;
        yieldBonusPercent?: number;
      }) => {
        item.usageCount = (item.usageCount ?? 0) + 1;

        const currentTier = item.legacyTier ?? 0;
        const nextTierTarget = legacyUsageThreshold * (currentTier + 1);
        if (item.usageCount >= nextTierTarget) {
          item.legacyTier = currentTier + 1;
          item.yieldBonusPercent = (item.yieldBonusPercent ?? 0) + legacyYieldIncrement;
          item.legacyName = `${legacyNamePrefix} ${item.name}`;
          itemName = item.legacyName;
          legacyTierIncreased = true;
          newLegacyTier = item.legacyTier;
        } else {
          itemName = item.legacyName ?? item.name;
        }

        if (item.durability === undefined || durabilityCost === 0) {
          return false;
        }

        item.durability = item.durability - durabilityCost;
        if (item.durability > 0) {
          return false;
        }

        broken = true;
        item.breakCount = (item.breakCount ?? 0) + 1;
        gainedScrap = scrapOnBreak + (item.legacyTier ?? 0);
        gainedInsight = insightOnBreak;
        progression.craftingScrap = Number(progression.craftingScrap ?? 0) + gainedScrap;
        progression.craftingInsight = Number(progression.craftingInsight ?? 0) + gainedInsight;
        return allowBreak;
      };

      // Inventory items
      for (let index = 0; index < draft.inventory.items.length; index++) {
        const item = draft.inventory.items[index];
        if (item.id !== itemInstanceId) continue;
        found = true;
        const shouldRemove = processItem(item);
        if (shouldRemove) {
          draft.inventory.items.splice(index, 1);
          removed = true;
        } else if (broken) {
          item.durability = 0;
        }
        break;
      }

      // Equipment slots
      if (!found) {
        for (const [slot, item] of Object.entries(draft.equipment)) {
          if (!item || item.id !== itemInstanceId) continue;
          found = true;
          const shouldRemove = processItem(item);
          if (shouldRemove) {
            draft.equipment[slot] = null;
            removed = true;
          } else if (broken) {
            item.durability = 0;
          }
          break;
        }
      }

      if (!found) {
        throw new Error(`Item ${itemInstanceId} not found`);
      }

      draft.custom = {
        ...crafting,
        progression
      };
      draft.updatedAt = Date.now();
    });

    this.states.set(characterId, nextState);
    return {
      state: nextState,
      broken,
      removed,
      gainedScrap,
      gainedInsight,
      legacyTierIncreased,
      newLegacyTier,
      itemName
    };
  }

  getCraftingProgress(characterId: string): {
    scrap: number;
    insight: number;
  } {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const custom = (state.custom ?? {}) as Record<string, unknown>;
    const progression = ((custom.progression ?? {}) as Record<string, unknown>);
    return {
      scrap: Number(progression.craftingScrap ?? 0),
      insight: Number(progression.craftingInsight ?? 0)
    };
  }

  /**
   * Add a modifier to a character
   */
  addModifier(
    characterId: string,
    stat: string,
    operation: 'add' | 'multiply' | 'set',
    value: number,
    sourceRuleId: string,
    priority: number = 100
  ): CharacterState {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    const modifier: Modifier = {
      id: crypto.randomUUID(),
      stat,
      operation,
      value,
      sourceRuleId,
      priority
    };

    const newState = updateState(state, (draft) => {
      draft.modifiers.push(modifier);
    });

    this.states.set(characterId, newState);
    return newState;
  }

  /**
   * Get effective stat value (base + all modifiers)
   */
  getEffectiveStat(characterId: string, statName: string): number {
    const state = this.states.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found`);
    }

    return calculateEffectiveStat(state, statName);
  }

  /**
   * Delete a character
   */
  deleteCharacter(characterId: string): void {
    this.states.delete(characterId);
  }

  /**
   * Get all characters
   */
  getAllCharacters(): CharacterState[] {
    return Array.from(this.states.values());
  }

  /**
   * Clear all characters
   */
  clearAll(): void {
    this.states.clear();
  }
}

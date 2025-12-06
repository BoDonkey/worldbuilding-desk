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

    this.states.set(characterId, newState);
    return newState;
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

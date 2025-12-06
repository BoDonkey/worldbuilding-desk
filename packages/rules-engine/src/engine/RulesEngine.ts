import type {GameRule} from '../types/GameRule';
import type {CharacterState} from '../types/CharacterState';
import type {WorldRuleset} from '../types/WorldRuleset';
import {ConditionEvaluator} from './ConditionEvaluator';
import {EffectApplicator} from './EffectApplicator';
import {FormulaParser} from './FormulaParser';

/**
 * Result of rule evaluation
 */
export interface RuleResult {
  ruleId: string;
  ruleName: string;
  success: boolean;
  conditionsMet: boolean;
  newState?: CharacterState;
  error?: string;
  triggeredRules?: string[]; // IDs of rules that were triggered by this rule
}

/**
 * Context for rule evaluation
 */
export interface RuleContext {
  trigger?: string;
  triggerData?: Record<string, any>;
  timestamp?: number;
}

/**
 * Configuration for the rules engine
 */
export interface RulesEngineConfig {
  maxExecutionTime?: number; // Milliseconds
  enableLogging?: boolean;
  strictMode?: boolean; // Throw errors vs log warnings
}

/**
 * Main rules engine - evaluates rules against character state
 */
export class RulesEngine {
  private ruleset: WorldRuleset;
  private config: RulesEngineConfig;
  private conditionEvaluator: ConditionEvaluator;
  private effectApplicator: EffectApplicator;
  private formulaParser: FormulaParser;

  constructor(ruleset: WorldRuleset, config: RulesEngineConfig = {}) {
    this.ruleset = ruleset;
    this.config = {
      maxExecutionTime: 5000,
      enableLogging: false,
      strictMode: false,
      ...config
    };

    this.conditionEvaluator = new ConditionEvaluator();
    this.effectApplicator = new EffectApplicator();
    this.formulaParser = new FormulaParser();
  }

  /**
   * Evaluate a single rule against character state
   */
  evaluateRule(
    rule: GameRule,
    state: CharacterState,
    context?: RuleContext
  ): RuleResult {
    const result: RuleResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      success: false,
      conditionsMet: false
    };

    try {
      // Check if rule is enabled
      if (!rule.enabled) {
        if (this.config.enableLogging) {
          console.log(`Rule "${rule.name}" is disabled, skipping`);
        }
        return result;
      }

      // Evaluate conditions
      const conditionsMet = this.conditionEvaluator.evaluate(
        rule.conditions,
        state
      );
      result.conditionsMet = conditionsMet;

      if (!conditionsMet) {
        if (this.config.enableLogging) {
          console.log(`Rule "${rule.name}" conditions not met`);
        }
        return result;
      }

      // Apply effects
      let newState = state;

      if (rule.effects && rule.effects.length > 0) {
        newState = this.effectApplicator.applyEffects(rule.effects, state);
      }

      // Handle formula-based rules
      if (rule.formula) {
        const formulaResult = this.formulaParser.evaluate(rule.formula, state);
        if (this.config.enableLogging) {
          console.log(`Rule "${rule.name}" formula result:`, formulaResult);
        }
        // Store formula result in custom data for reference
        newState = {
          ...newState,
          custom: {
            ...newState.custom,
            [`formula_${rule.id}`]: formulaResult
          }
        };
      }

      result.success = true;
      result.newState = newState;

      // Check for triggered rules
      const triggeredRules: string[] = [];
      for (const effect of rule.effects || []) {
        if (effect.triggersRule) {
          triggeredRules.push(effect.triggersRule);
        }
      }

      if (triggeredRules.length > 0) {
        result.triggeredRules = triggeredRules;
      }

      if (this.config.enableLogging) {
        console.log(`Rule "${rule.name}" applied successfully`);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';

      if (this.config.strictMode) {
        throw error;
      } else {
        console.error(`Error evaluating rule "${rule.name}":`, error);
      }
    }

    return result;
  }

  /**
   * Execute multiple rules in priority order
   */
  executeRules(
    ruleIds: string[],
    state: CharacterState,
    context?: RuleContext
  ): {finalState: CharacterState; results: RuleResult[]} {
    const rules = ruleIds
      .map((id) => this.ruleset.rules.find((r) => r.id === id))
      .filter((r): r is GameRule => r !== undefined)
      .sort((a, b) => (b.priority || 100) - (a.priority || 100)); // Higher priority first

    let currentState = state;
    const results: RuleResult[] = [];
    const triggeredRuleIds = new Set<string>();

    for (const rule of rules) {
      const result = this.evaluateRule(rule, currentState, context);
      results.push(result);

      if (result.success && result.newState) {
        currentState = result.newState;
      }

      // Collect triggered rules
      if (result.triggeredRules) {
        result.triggeredRules.forEach((id) => triggeredRuleIds.add(id));
      }
    }

    // Execute triggered rules (one level deep to prevent infinite loops)
    if (triggeredRuleIds.size > 0) {
      const triggeredResults = this.executeRules(
        Array.from(triggeredRuleIds),
        currentState,
        context
      );

      currentState = triggeredResults.finalState;
      results.push(...triggeredResults.results);
    }

    return {
      finalState: currentState,
      results
    };
  }

  /**
   * Find rules matching a trigger type
   */
  findRulesByTrigger(triggerType: string): GameRule[] {
    return this.ruleset.rules.filter(
      (rule) => rule.enabled && rule.trigger?.type === triggerType
    );
  }

  /**
   * Execute all rules matching a trigger
   */
  executeTrigger(
    triggerType: string,
    state: CharacterState,
    triggerData?: Record<string, any>
  ): {finalState: CharacterState; results: RuleResult[]} {
    const matchingRules = this.findRulesByTrigger(triggerType);
    const ruleIds = matchingRules.map((r) => r.id);

    return this.executeRules(ruleIds, state, {
      trigger: triggerType,
      triggerData,
      timestamp: Date.now()
    });
  }

  /**
   * Get the current ruleset
   */
  getRuleset(): WorldRuleset {
    return this.ruleset;
  }

  /**
   * Update the ruleset
   */
  updateRuleset(ruleset: WorldRuleset): void {
    this.ruleset = ruleset;
  }

  /**
   * Validate a rule without executing it
   */
  validateRule(rule: GameRule): {valid: boolean; errors: string[]} {
    const errors: string[] = [];

    // Validate formula if present
    if (rule.formula) {
      const formulaValidation = this.formulaParser.validate(rule.formula);
      if (!formulaValidation.valid) {
        errors.push(`Invalid formula: ${formulaValidation.error}`);
      }
    }

    // Validate effect formulas
    for (const effect of rule.effects || []) {
      if (typeof effect.value === 'string' && /[+\-*/()]/.test(effect.value)) {
        const formulaValidation = this.formulaParser.validate(effect.value);
        if (!formulaValidation.valid) {
          errors.push(`Invalid effect formula: ${formulaValidation.error}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

import {evaluate, create, all} from 'mathjs';
import type {CharacterState} from '../types/CharacterState';
import {DiceRoller} from '../utils/DiceRoller';

/**
 * Safely evaluates mathematical formulas with character state context
 */

// Create a restricted math instance
const math = create(all);

export class FormulaParser {
  private diceRoller: DiceRoller;

  constructor() {
    this.diceRoller = new DiceRoller();
  } // <-- This was missing!

  /**
   * Create scope object from character state for formula evaluation
   */
  private createScope(state: CharacterState): Record<string, any> {
    const scope: Record<string, any> = {
      // Direct stat access
      ...state.stats,

      // Resource access
      health: state.resources.current.health || 0,
      maxHealth: state.resources.max.health || 0,
      mana: state.resources.current.mana || 0,
      maxMana: state.resources.max.mana || 0,

      // Full character object access
      character: state,
      stats: state.stats,
      resources: state.resources
    };

    return scope;
  }

  /**
   * Evaluate a formula string safely
   */
  evaluate(formula: string, state: CharacterState): number {
    try {
      const formulaWithRolls = this.replaceDiceNotation(formula);
      const scope = this.createScope(state);
      const result = evaluate(formulaWithRolls, scope);

      // Ensure we return a number
      if (typeof result === 'number') {
        return result;
      }

      // Try to coerce to number
      const num = Number(result);
      if (!isNaN(num)) {
        return num;
      }

      console.warn(`Formula "${formula}" did not return a number:`, result);
      return 0;
    } catch (error) {
      console.error(`Error evaluating formula "${formula}":`, error);
      return 0;
    }
  }

  /**
   * Validate formula syntax without evaluating
   */
  validate(formula: string): {valid: boolean; error?: string} {
    try {
      // Try to parse the formula
      math.parse(formula);
      return {valid: true};
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid formula'
      };
    }
  }

  /**
   * Extract variables used in a formula
   */
  extractVariables(formula: string): string[] {
    try {
      const parsed = math.parse(formula);
      const variables = new Set<string>();

      parsed.traverse((node: any) => {
        if (node.type === 'SymbolNode') {
          variables.add(node.name);
        }
      });

      return Array.from(variables);
    } catch (error) {
      console.error('Error extracting variables:', error);
      return [];
    }
  }

  /**
   * Replace dice notation in formula with rolled values
   * Example: "2d6 + STR" => "7 + STR" (if 2d6 rolled 7)
   */
  private replaceDiceNotation(formula: string): string {
    // Match dice notation: XdY (with optional +/- prefix)
    const diceRegex = /([+-]?\s*\d*d\d+)/g;

    return formula.replace(diceRegex, (match) => {
      const cleanMatch = match.replace(/\s+/g, '');
      try {
        const result = this.diceRoller.roll(cleanMatch);
        // Preserve the sign if it was negative
        return cleanMatch.startsWith('-') ? `(${result})` : result.toString();
      } catch (error) {
        console.error(`Error rolling dice "${cleanMatch}":`, error);
        return match; // Return original if it fails
      }
    });
  }
}

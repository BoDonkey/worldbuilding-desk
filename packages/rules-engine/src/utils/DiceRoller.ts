/**
 * Dice roller with support for any die size and standard notation
 * 
 * Supported notation:
 * - "2d6" => Roll 2 six-sided dice
 * - "1d20+5" => Roll 1 twenty-sided dice, add 5
 * - "3d8-2" => Roll 3 eight-sided dice, subtract 2
 * - "d100" => Roll 1 hundred-sided die (d prefix implies 1)
 * - "2d17+3d13-4" => Mix multiple dice types with modifiers
 * 
 * TODO: Advanced features for later implementation
 * - Exploding dice: "2d6!" (reroll on max, add to total)
 * - Keep highest: "2d20kh1" (advantage)
 * - Keep lowest: "4d6kl1" (drop lowest)
 * - Drop highest: "3d6dh1"
 * - Drop lowest: "4d6dl1"
 * - Custom/weighted dice: "d[1,2,2,3,5,8]" (Fibonacci example)
 * - Percentile: "d%" (alias for d100)
 */

export interface DiceRollResult {
  total: number;
  rolls: number[];
  notation: string;
  breakdown: string;
}

export class DiceRoller {
  /**
   * Roll dice using standard notation
   * Examples: "2d6", "1d20+5", "3d8-2", "2d6+1d4+3"
   */
  roll(notation: string): number {
    const result = this.rollWithDetails(notation);
    return result.total;
  }
  
  /**
   * Roll dice and return detailed breakdown
   */
  rollWithDetails(notation: string): DiceRollResult {
    const cleanNotation = notation.replace(/\s+/g, ''); // Remove whitespace
    
    let total = 0;
    const allRolls: number[] = [];
    const breakdownParts: string[] = [];
    
    // Parse the notation into parts (dice expressions and modifiers)
    // Matches: XdY, +X, -X
    const regex = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/g;
    let match;
    
    while ((match = regex.exec(cleanNotation)) !== null) {
      if (match[2] !== undefined && match[3] !== undefined) {
        // Dice expression: XdY
        const sign = match[1] === '-' ? -1 : 1;
        const count = match[2] ? parseInt(match[2], 10) : 1;
        const sides = parseInt(match[3], 10);
        
        if (sides < 1) {
          throw new Error(`Invalid die size: d${sides}. Must be at least 1.`);
        }
        
        if (count < 1) {
          throw new Error(`Invalid die count: ${count}d${sides}. Must be at least 1.`);
        }
        
        // Roll the dice
        const rolls: number[] = [];
        for (let i = 0; i < count; i++) {
          rolls.push(this.rollSingleDie(sides));
        }
        
        const sum = rolls.reduce((a, b) => a + b, 0) * sign;
        total += sum;
        allRolls.push(...rolls);
        
        breakdownParts.push(
          `${sign === -1 ? '-' : ''}${count}d${sides}[${rolls.join(',')}]=${sum}`
        );
        
      } else if (match[4] !== undefined) {
        // Flat modifier: +X or -X
        const modifier = parseInt(match[4], 10);
        total += modifier;
        breakdownParts.push(`${modifier >= 0 ? '+' : ''}${modifier}`);
      }
    }
    
    if (breakdownParts.length === 0) {
      throw new Error(`Invalid dice notation: "${notation}"`);
    }
    
    return {
      total,
      rolls: allRolls,
      notation: cleanNotation,
      breakdown: breakdownParts.join(' '),
    };
  }
  
  /**
   * Roll a single die with N sides
   */
  private rollSingleDie(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }
  
  /**
   * Validate dice notation without rolling
   */
  validate(notation: string): { valid: boolean; error?: string } {
    try {
      const cleanNotation = notation.replace(/\s+/g, '');
      
      // Check for basic validity
      if (!/^[+-]?(\d*)d\d+([+-]\d+)?([+-](\d*)d\d+)*([+-]\d+)?$/.test(cleanNotation)) {
        return {
          valid: false,
          error: 'Invalid dice notation format',
        };
      }
      
      // Try to parse it
      this.rollWithDetails(notation);
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Parse notation to extract dice information without rolling
   */
  parse(notation: string): {
    diceGroups: Array<{ count: number; sides: number; sign: number }>;
    modifiers: number[];
  } {
    const cleanNotation = notation.replace(/\s+/g, '');
    const diceGroups: Array<{ count: number; sides: number; sign: number }> = [];
    const modifiers: number[] = [];
    
    const regex = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/g;
    let match;
    
    while ((match = regex.exec(cleanNotation)) !== null) {
      if (match[2] !== undefined && match[3] !== undefined) {
        diceGroups.push({
          count: match[2] ? parseInt(match[2], 10) : 1,
          sides: parseInt(match[3], 10),
          sign: match[1] === '-' ? -1 : 1,
        });
      } else if (match[4] !== undefined) {
        modifiers.push(parseInt(match[4], 10));
      }
    }
    
    return { diceGroups, modifiers };
  }
  
  /**
   * Calculate average result for a dice notation (useful for balancing)
   */
  average(notation: string): number {
    const { diceGroups, modifiers } = this.parse(notation);
    
    let total = 0;
    
    for (const group of diceGroups) {
      // Average of a die is (sides + 1) / 2
      const avgPerDie = (group.sides + 1) / 2;
      total += group.count * avgPerDie * group.sign;
    }
    
    total += modifiers.reduce((a, b) => a + b, 0);
    
    return total;
  }
  
  /**
   * Calculate min/max possible results
   */
  range(notation: string): { min: number; max: number } {
    const { diceGroups, modifiers } = this.parse(notation);
    
    let min = 0;
    let max = 0;
    
    for (const group of diceGroups) {
      if (group.sign > 0) {
        min += group.count * 1; // Minimum roll is 1
        max += group.count * group.sides;
      } else {
        min -= group.count * group.sides; // Negative dice
        max -= group.count * 1;
      }
    }
    
    const modifierSum = modifiers.reduce((a, b) => a + b, 0);
    min += modifierSum;
    max += modifierSum;
    
    return { min, max };
  }
}

// Singleton instance for convenience
export const diceRoller = new DiceRoller();

// Convenience function for quick rolls
export function roll(notation: string): number {
  return diceRoller.roll(notation);
}

export function rollWithDetails(notation: string): DiceRollResult {
  return diceRoller.rollWithDetails(notation);
}
import type {Dispatch, SetStateAction} from 'react';
import type {
  CompendiumMilestone,
  CompendiumProgress,
  UnlockableRecipe
} from '../../entityTypes';
import {
  canCraftRecipe,
  type deriveCraftingRuntimeModifiers
} from '../../services/compendium';

const RECIPE_CATEGORY_OPTIONS: UnlockableRecipe['category'][] = [
  'food',
  'crafting',
  'alchemy',
  'custom'
];

interface ProgressionTabProps {
  craftingRuntimeModifiers: ReturnType<typeof deriveCraftingRuntimeModifiers>;
  handleCreateMilestone: () => Promise<void>;
  handleCreateRecipe: () => Promise<void>;
  milestoneDescription: string;
  milestoneName: string;
  milestonePoints: number;
  milestoneRecipeIds: string;
  milestones: CompendiumMilestone[];
  parsedPreviewMaterials: Record<string, number>;
  previewLevel: number;
  previewMaterialsText: string;
  progress: CompendiumProgress | null;
  recipeCategory: UnlockableRecipe['category'];
  recipeMinLevel: number;
  recipeName: string;
  recipeRequiredMilestones: string;
  recipes: UnlockableRecipe[];
  setMilestoneDescription: Dispatch<SetStateAction<string>>;
  setMilestoneName: Dispatch<SetStateAction<string>>;
  setMilestonePoints: Dispatch<SetStateAction<number>>;
  setMilestoneRecipeIds: Dispatch<SetStateAction<string>>;
  setPreviewLevel: Dispatch<SetStateAction<number>>;
  setPreviewMaterialsText: Dispatch<SetStateAction<string>>;
  setRecipeCategory: Dispatch<SetStateAction<UnlockableRecipe['category']>>;
  setRecipeMinLevel: Dispatch<SetStateAction<number>>;
  setRecipeName: Dispatch<SetStateAction<string>>;
  setRecipeRequiredMilestones: Dispatch<SetStateAction<string>>;
  unlockedMilestoneSet: Set<string>;
  unlockedRecipeSet: Set<string>;
}

export function ProgressionTab({
  craftingRuntimeModifiers,
  handleCreateMilestone,
  handleCreateRecipe,
  milestoneDescription,
  milestoneName,
  milestonePoints,
  milestoneRecipeIds,
  milestones,
  parsedPreviewMaterials,
  previewLevel,
  previewMaterialsText,
  progress,
  recipeCategory,
  recipeMinLevel,
  recipeName,
  recipeRequiredMilestones,
  recipes,
  setMilestoneDescription,
  setMilestoneName,
  setMilestonePoints,
  setMilestoneRecipeIds,
  setPreviewLevel,
  setPreviewMaterialsText,
  setRecipeCategory,
  setRecipeMinLevel,
  setRecipeName,
  setRecipeRequiredMilestones,
  unlockedMilestoneSet,
  unlockedRecipeSet
}: ProgressionTabProps) {
  return (
    <>
      <p style={{marginTop: 0, marginBottom: '0.9rem', color: 'var(--color-text-secondary)'}}>
        Define unlock rules first, then validate craftability using current
        progression and runtime modifiers.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
      <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Recipes</h2>
        <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
          Recipes define what can be unlocked and what requirements must be met.
        </p>
        <label style={{display: 'block', marginBottom: '0.5rem'}}>
          Name
          <input
            type='text'
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            style={{width: '100%'}}
          />
        </label>
        <label style={{display: 'block', marginBottom: '0.75rem'}}>
          Category
          <select
            value={recipeCategory}
            onChange={(e) =>
              setRecipeCategory(e.target.value as UnlockableRecipe['category'])
            }
            style={{width: '100%'}}
          >
            {RECIPE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label style={{display: 'block', marginBottom: '0.5rem'}}>
          Min Character Level
          <input
            type='number'
            min={1}
            value={recipeMinLevel}
            onChange={(e) => setRecipeMinLevel(Number(e.target.value))}
            style={{width: '100%'}}
          />
        </label>
        <label style={{display: 'block', marginBottom: '0.75rem'}}>
          Required Milestone IDs (comma-separated)
          <input
            type='text'
            value={recipeRequiredMilestones}
            onChange={(e) => setRecipeRequiredMilestones(e.target.value)}
            style={{width: '100%'}}
          />
        </label>
        <button type='button' onClick={() => void handleCreateRecipe()}>
          Add Recipe
        </button>
        {recipes.length === 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-secondary)'
            }}
          >
            <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
              No recipes yet. Create one to test unlock and craftability flow.
            </p>
            <button
              type='button'
              onClick={() => {
                if (!recipeName.trim()) setRecipeName('First Recipe');
              }}
            >
              Create a starter recipe
            </button>
          </div>
        )}
        <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
          {recipes.map((recipe) => (
            <li key={recipe.id} style={{marginBottom: '0.35rem'}}>
              {unlockedRecipeSet.has(recipe.id) ? 'Unlocked' : 'Locked'}: {recipe.name}
              {recipe.requirements?.minCharacterLevel ? (
                <> (lvl {recipe.requirements.minCharacterLevel}+)</>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div style={{display: 'grid', gap: '1rem'}}>
        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Milestones</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Milestones convert point totals into explicit progression beats.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Name
            <input
              type='text'
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Points Required
            <input
              type='number'
              min={0}
              value={milestonePoints}
              onChange={(e) => setMilestonePoints(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Description
            <input
              type='text'
              value={milestoneDescription}
              onChange={(e) => setMilestoneDescription(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Unlock Recipe IDs (comma-separated)
            <input
              type='text'
              value={milestoneRecipeIds}
              onChange={(e) => setMilestoneRecipeIds(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <button type='button' onClick={() => void handleCreateMilestone()}>
            Add Milestone
          </button>
          {milestones.length === 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.65rem',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary)'
              }}
            >
              <p style={{marginTop: 0, marginBottom: '0.5rem'}}>
                No milestones yet. Add a threshold to make progression visible.
              </p>
              <button
                type='button'
                onClick={() => {
                  if (!milestoneName.trim()) setMilestoneName('First Milestone');
                }}
              >
                Create a milestone threshold
              </button>
            </div>
          )}
          <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
            {milestones.map((milestone) => (
              <li key={milestone.id} style={{marginBottom: '0.35rem'}}>
                {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                {milestone.name} ({milestone.pointsRequired} pts)
              </li>
            ))}
          </ul>
        </section>

        <section style={{padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Craftability Preview</h2>
          <p style={{marginTop: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>
            Check if recipes are craftable for a sample character and material loadout.
          </p>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Character Level
            <input
              type='number'
              min={1}
              value={previewLevel}
              onChange={(e) => setPreviewLevel(Number(e.target.value))}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Materials (one per line: <code>itemId:quantity</code>)
            <textarea
              rows={5}
              value={previewMaterialsText}
              onChange={(e) => setPreviewMaterialsText(e.target.value)}
              placeholder={'wolf_pelt:4\niron_ore:12'}
              style={{width: '100%'}}
            />
          </label>
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              marginBottom: '0.65rem',
              padding: '0.5rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px'
            }}
          >
            Runtime modifiers: +{craftingRuntimeModifiers.levelBonus} effective level,
            material cost x{craftingRuntimeModifiers.materialCostMultiplier.toFixed(2)}
            {craftingRuntimeModifiers.notes.length > 0 && (
              <div style={{marginTop: '0.3rem'}}>
                {craftingRuntimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {recipes.map((recipe) => {
              const check = canCraftRecipe(recipe, {
                progress,
                characterLevel: Math.max(1, Math.floor(previewLevel || 1)),
                availableMaterials: parsedPreviewMaterials,
                runtime: craftingRuntimeModifiers
              });
              return (
                <li
                  key={`preview-${recipe.id}`}
                  style={{
                    marginBottom: '0.5rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--color-border)'
                  }}
                >
                  <strong>{recipe.name}</strong>{' '}
                  <span
                    style={{
                      color: check.craftable ? 'var(--color-success)' : 'var(--color-error)'
                    }}
                  >
                    {check.craftable ? 'craftable' : 'not craftable'}
                  </span>
                  <div style={{fontSize: '0.78rem', color: 'var(--color-text-secondary)'}}>
                    Effective level: {check.effectiveCharacterLevel}
                    {' · '}Material multiplier: x{check.materialCostMultiplier.toFixed(2)}
                  </div>
                  {!check.craftable && check.reasons.length > 0 && (
                    <div style={{fontSize: '0.82rem', color: 'var(--color-text-secondary)'}}>
                      {check.reasons.join(' ')}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      </div>
    </>
  );
}

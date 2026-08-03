import styles from '../../assets/components/CompendiumRoute.module.css';
import {useMemo, useState, type Dispatch, type SetStateAction} from 'react';
import type {
  CompendiumMilestone,
  CompendiumProgress,
  UnlockableRecipe
} from '../../entityTypes';
import {
  canCraftRecipe,
  type deriveCraftingRuntimeModifiers
} from '../../services/compendium';
import {filterNamedItems} from './constants';

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
  const [recipeFilter, setRecipeFilter] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState('');
  const filteredRecipes = useMemo(
    () => filterNamedItems(recipes, recipeFilter),
    [recipeFilter, recipes]
  );
  const filteredMilestones = useMemo(
    () => filterNamedItems(milestones, milestoneFilter),
    [milestoneFilter, milestones]
  );

  return (
    <>
      <p className={`${styles.marginTop0} ${styles.marginBottom09rem} ${styles.colorVarColorTextSecondary}`}>
        Define unlock rules first, then validate craftability using current
        progression and runtime modifiers.
      </p>
      <div
        className={`${styles.displayGrid} ${styles.gridTemplateColumns2fr1fr} ${styles.gap1rem} ${styles.alignItemsStart}`}
      >
      <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
        <h2 className={styles.marginTop0}>Recipes</h2>
        <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
          Recipes define what can be unlocked and what requirements must be met.
        </p>
        <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
          Name
          <input
            type='text'
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className={styles.width100}
          />
        </label>
        <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
          Category
          <select
            value={recipeCategory}
            onChange={(e) =>
              setRecipeCategory(e.target.value as UnlockableRecipe['category'])
            }
            className={styles.width100}
          >
            {RECIPE_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
          Min Character Level
          <input
            type='number'
            min={1}
            value={recipeMinLevel}
            onChange={(e) => setRecipeMinLevel(Number(e.target.value))}
            className={styles.width100}
          />
        </label>
        <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
          Required Milestone IDs (comma-separated)
          <input
            type='text'
            value={recipeRequiredMilestones}
            onChange={(e) => setRecipeRequiredMilestones(e.target.value)}
            className={styles.width100}
          />
        </label>
        <button type='button' onClick={() => void handleCreateRecipe()}>
          Add Recipe
        </button>
        <label className={styles.listFilter}>
          <span>Filter recipes</span>
          <input
            type='search'
            value={recipeFilter}
            onChange={(event) => setRecipeFilter(event.target.value)}
            placeholder='Search by recipe name'
            className={styles.listFilterInput}
          />
        </label>
        {recipes.length === 0 && (
          <div
            className={`${styles.marginTop075rem} ${styles.padding065rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius6px} ${styles.backgroundColorVarColorBgSecondary}`}
          >
            <p className={`${styles.marginTop0} ${styles.marginBottom05rem}`}>
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
        {recipes.length > 0 && filteredRecipes.length === 0 && (
          <p className={styles.filterEmpty}>No recipes match this filter.</p>
        )}
        <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop075rem}`}>
          {filteredRecipes.map((recipe) => (
            <li key={recipe.id} className={styles.marginBottom035rem}>
              {unlockedRecipeSet.has(recipe.id) ? 'Unlocked' : 'Locked'}: {recipe.name}
              {recipe.requirements?.minCharacterLevel ? (
                <> (lvl {recipe.requirements.minCharacterLevel}+)</>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div className={`${styles.displayGrid} ${styles.gap1rem}`}>
        <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Milestones</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Milestones convert point totals into explicit progression beats.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Name
            <input
              type='text'
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Points Required
            <input
              type='number'
              min={0}
              value={milestonePoints}
              onChange={(e) => setMilestonePoints(Number(e.target.value))}
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Description
            <input
              type='text'
              value={milestoneDescription}
              onChange={(e) => setMilestoneDescription(e.target.value)}
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Unlock Recipe IDs (comma-separated)
            <input
              type='text'
              value={milestoneRecipeIds}
              onChange={(e) => setMilestoneRecipeIds(e.target.value)}
              className={styles.width100}
            />
          </label>
          <button type='button' onClick={() => void handleCreateMilestone()}>
            Add Milestone
          </button>
          <label className={styles.listFilter}>
            <span>Filter milestones</span>
            <input
              type='search'
              value={milestoneFilter}
              onChange={(event) => setMilestoneFilter(event.target.value)}
              placeholder='Search by milestone name'
              className={styles.listFilterInput}
            />
          </label>
          {milestones.length === 0 && (
            <div
              className={`${styles.marginTop075rem} ${styles.padding065rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius6px} ${styles.backgroundColorVarColorBgSecondary}`}
            >
              <p className={`${styles.marginTop0} ${styles.marginBottom05rem}`}>
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
          {milestones.length > 0 && filteredMilestones.length === 0 && (
            <p className={styles.filterEmpty}>
              No milestones match this filter.
            </p>
          )}
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.marginTop075rem}`}>
            {filteredMilestones.map((milestone) => (
              <li key={milestone.id} className={styles.marginBottom035rem}>
                {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                {milestone.name} ({milestone.pointsRequired} pts)
              </li>
            ))}
          </ul>
        </section>

        <section className={`${styles.padding1rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius8px}`}>
          <h2 className={styles.marginTop0}>Craftability Preview</h2>
          <p className={`${styles.marginTop0} ${styles.fontSize085rem} ${styles.colorVarColorTextSecondary}`}>
            Check if recipes are craftable for a sample character and material loadout.
          </p>
          <label className={`${styles.displayBlock} ${styles.marginBottom05rem}`}>
            Character Level
            <input
              type='number'
              min={1}
              value={previewLevel}
              onChange={(e) => setPreviewLevel(Number(e.target.value))}
              className={styles.width100}
            />
          </label>
          <label className={`${styles.displayBlock} ${styles.marginBottom075rem}`}>
            Materials (one per line: <code>itemId:quantity</code>)
            <textarea
              rows={5}
              value={previewMaterialsText}
              onChange={(e) => setPreviewMaterialsText(e.target.value)}
              placeholder={'wolf_pelt:4\niron_ore:12'}
              className={styles.width100}
            />
          </label>
          <div
            className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary} ${styles.marginBottom065rem} ${styles.padding05rem} ${styles.border1pxSolidVarColorBorder} ${styles.borderRadius6px}`}
          >
            Runtime modifiers: +{craftingRuntimeModifiers.levelBonus} effective level,
            material cost x{craftingRuntimeModifiers.materialCostMultiplier.toFixed(2)}
            {craftingRuntimeModifiers.notes.length > 0 && (
              <div className={styles.marginTop03rem}>
                {craftingRuntimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>
          <ul className={`${styles.listStyleNone} ${styles.padding0} ${styles.margin0}`}>
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
                  className={`${styles.marginBottom05rem} ${styles.paddingBottom05rem} ${styles.borderBottom1pxSolidVarColorBorder}`}
                >
                  <strong>{recipe.name}</strong>{' '}
                  <span
                    className={
                      check.craftable ? styles.craftable : styles.notCraftable
                    }
                  >
                    {check.craftable ? 'craftable' : 'not craftable'}
                  </span>
                  <div className={`${styles.fontSize078rem} ${styles.colorVarColorTextSecondary}`}>
                    Effective level: {check.effectiveCharacterLevel}
                    {' · '}Material multiplier: x{check.materialCostMultiplier.toFixed(2)}
                  </div>
                  {!check.craftable && check.reasons.length > 0 && (
                    <div className={`${styles.fontSize082rem} ${styles.colorVarColorTextSecondary}`}>
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

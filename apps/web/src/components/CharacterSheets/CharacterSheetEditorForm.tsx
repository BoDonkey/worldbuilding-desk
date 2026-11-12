import {useMemo} from 'react';
import type {CompendiumEntry, StoredRuleset} from '../../entityTypes';
import {
  getEffectiveResourceValues,
  getEffectiveStatValue,
  type CharacterRuntimeModifiers
} from '../../services/compendium';
import type {CharacterSheetEditor} from '../../hooks/useCharacterSheetEditor';
import {TrackedEntryEditor} from './TrackedEntryEditor';
import styles from '../../styles/CharacterSheetsRoute.module.css';

interface CharacterSheetEditorFormProps {
  editor: CharacterSheetEditor;
  ruleset: StoredRuleset;
  runtimeModifiers: CharacterRuntimeModifiers;
  compendiumEntries: CompendiumEntry[];
  hidden: boolean;
}

/** "Build character sheet": baseline level, attributes, resources, starting items, notes. */
export function CharacterSheetEditorForm({
  editor,
  ruleset,
  runtimeModifiers,
  compendiumEntries,
  hidden
}: CharacterSheetEditorFormProps) {
  const {
    editingId, selectedCharacterId, availableCharacters, name, setName, level, setLevel,
    experience, setExperience, stats, resources, notes, setNotes, isSubmitting
  } = editor;
  const effectiveLevel = Math.max(1, level + runtimeModifiers.levelBonus);
  const statusCatalogOptions = useMemo(
    () =>
      compendiumEntries.filter((entry) => {
        const tags = (entry.tags ?? []).map((tag) => tag.toLowerCase());
        return entry.domain === 'custom' || tags.includes('status');
      }),
    [compendiumEntries]
  );
  const getStatDefinition = (definitionId: string) =>
    ruleset.statDefinitions.find((def) => def.id === definitionId);
  const getResourceDefinition = (definitionId: string) =>
    ruleset.resourceDefinitions.find((def) => def.id === definitionId);

  return (
    <form
      onSubmit={editor.handleSubmit}
      className={`${styles.sheetForm} ${hidden ? styles.hidden : ''}`}
    >
      <h2>{editingId ? 'Edit Character Sheet' : 'New Character Sheet'}</h2>
      <div
        className={`${styles.inlineMarginBottom085rem} ${styles.inlinePadding075rem} ${styles.inlineBorder1pxSolidVarColorAccentSoftBg} ${styles.inlineBorderRadius8px} ${styles.inlineBackgroundColorVarColorBgSecondary} ${styles.inlineFontSize086rem} ${styles.inlineColorVarColorTextPrimary}`}
      >
        This is the main place to track level, stats, resources like mana,
        inventory, equipment, and statuses for a character.
      </div>

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Canonical name *
          <br />
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={Boolean(selectedCharacterId)}
            required
            className={styles.inlineWidth100}
          />
          {selectedCharacterId && (
            <span className={styles.sectionHint}>
              Rename this character in the World Bible.
            </span>
          )}
        </label>
      </div>

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Link to Character
          <br />
          <select
            value={selectedCharacterId}
            onChange={(e) => editor.handleCharacterSelect(e.target.value)}
            className={styles.inlineWidth100}
          >
            <option value='' disabled={!editingId}>
              {editingId ? '-- Legacy unlinked sheet --' : '-- Choose World Bible character --'}
            </option>
            {availableCharacters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </label>
        <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary} ${styles.inlineMarginTop025rem}`}>
          Choose a character with a canonical World Bible identity, then
          adjust the sheet-specific stats and resources here.
        </div>
      </div>

      <div
        className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumns1fr1fr} ${styles.inlineGap075rem} ${styles.inlineMarginBottom075rem}`}
      >
        <label>
          Starting level *
          <br />
          <input
            type='number'
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            min={1}
            required
            className={styles.inlineWidth100}
          />
        </label>

        <label>
          Starting XP *
          <br />
          <input
            type='number'
            value={experience}
            onChange={(e) => setExperience(Number(e.target.value))}
            min={0}
            required
            className={styles.inlineWidth100}
          />
        </label>
      </div>

      <div
        className={`${styles.inlineMarginBottom09rem} ${styles.inlinePadding06rem075rem} ${styles.inlineBorder1pxSolidVarColorAccentSoftBg} ${styles.inlineBorderRadius6px} ${styles.inlineBackgroundColorVarColorBgSecondary} ${styles.inlineFontSize085rem}`}
      >
        <strong>Runtime Effects (Preview)</strong>
        <div className={styles.inlineMarginTop025rem}>
          Effective level: {effectiveLevel}
          {runtimeModifiers.levelBonus > 0
            ? ` (base ${level} + ${runtimeModifiers.levelBonus})`
            : ` (base ${level})`}
        </div>
        {runtimeModifiers.notes.length > 0 && (
          <div className={`${styles.inlineMarginTop025rem} ${styles.inlineColorVarColorTextSecondary}`}>
            {runtimeModifiers.notes.join(' ')}
          </div>
        )}
      </div>

      {stats.length > 0 ? (
        <div className={styles.inlineMarginBottom1rem}>
          <h3>Attributes</h3>
          <p className={styles.sectionHint}>
            Starting values from {ruleset.name || 'the active ruleset'}. Adjust them
            for this character before saving.
          </p>
          <div className={styles.statEditorGrid}>
          {stats.map((stat) => {
            const def = getStatDefinition(stat.definitionId);
            if (!def) return null;
            const effectiveValue = getEffectiveStatValue({
              definitionId: stat.definitionId,
              baseValue: stat.value,
              runtime: runtimeModifiers
            });
            return (
              <div key={stat.definitionId} className={styles.statEditorCard}>
                <label>
                  {def.name}
                  {def.description && (
                    <span
                      className={`${styles.inlineFontSize085em} ${styles.inlineColorVarColorTextTertiary} ${styles.inlineMarginLeft05rem}`}
                    >
                      ({def.description})
                    </span>
                  )}
                  <br />
                  <input
                    type='number'
                    value={stat.value}
                    onChange={(e) =>
                      editor.updateStatValue(stat.definitionId, Number(e.target.value))
                    }
                    min={def.min}
                    max={def.max}
                    className={styles.inlineWidth100}
                  />
                </label>
                <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary}`}>
                  Effective: {effectiveValue}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <div className={`${styles.inlineMarginBottom1rem} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
          No stat definitions are available in this ruleset yet.
        </div>
      )}

      {resources.length > 0 ? (
        <div className={styles.inlineMarginBottom1rem}>
          <h3>Resources</h3>
          <p className={styles.sectionHint}>
            Set the character’s starting and maximum values.
          </p>
          {resources.map((resource) => {
            const def = getResourceDefinition(resource.definitionId);
            if (!def) return null;
            const effective = getEffectiveResourceValues({
              definitionId: resource.definitionId,
              current: resource.current,
              max: resource.max,
              runtime: runtimeModifiers
            });
            return (
              <div
                key={resource.definitionId}
                className={styles.inlineMarginBottom075rem}
              >
                <label>
                  {def.name}
                  {def.description && (
                    <span
                      className={`${styles.inlineFontSize085em} ${styles.inlineColorVarColorTextTertiary} ${styles.inlineMarginLeft05rem}`}
                    >
                      ({def.description})
                    </span>
                  )}
                </label>
                <div
                  className={`${styles.inlineDisplayGrid} ${styles.inlineGridTemplateColumns1fr1fr} ${styles.inlineGap05rem}`}
                >
                  <label>
                    Current
                    <br />
                    <input
                      type='number'
                      value={resource.current}
                      onChange={(e) =>
                        editor.updateResourceCurrent(resource.definitionId, Number(e.target.value))
                      }
                      min={0}
                      className={styles.inlineWidth100}
                    />
                  </label>
                  <label>
                    Max
                    <br />
                    <input
                      type='number'
                      value={resource.max}
                      onChange={(e) =>
                        editor.updateResourceMax(resource.definitionId, Number(e.target.value))
                      }
                      min={0}
                      className={styles.inlineWidth100}
                    />
                  </label>
                </div>
                <div className={`${styles.inlineFontSize08rem} ${styles.inlineColorVarColorTextSecondary}`}>
                  Effective: {effective.current}/{effective.max}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.inlineMarginBottom1rem} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
          No resource definitions are available yet. Add things like Mana,
          Stamina, or Health in the ruleset to track them here.
        </div>
      )}

      <details className={styles.optionalState}>
        <summary>Inventory, equipment & statuses</summary>
        <p className={`${styles.inlineMarginTop0} ${styles.inlineFontSize085rem} ${styles.inlineColorVarColorTextSecondary}`}>
          Optional starting state. Type a simple entry, or choose a catalog record
          when it should stay linked to Mechanics.
        </p>
        {([
          ['inventory', editor.inventoryEntries, compendiumEntries, styles.inlineMarginBottom08rem],
          ['equipment', editor.equipmentEntries, compendiumEntries, styles.inlineMarginBottom08rem],
          ['status', editor.statusEntries, statusCatalogOptions, undefined]
        ] as const).map(([target, entries, catalogOptions, className]) => (
          <TrackedEntryEditor
            key={`${target}-${editor.entryInputsVersion}`}
            target={target}
            entries={entries}
            catalogOptions={catalogOptions}
            onAddQuick={(entryName, quantity) => editor.addQuickEntry(target, entryName, quantity)}
            onAddCatalog={(entryId) => editor.addCatalogEntry(target, entryId)}
            onRemove={(entryId) => editor.removeTrackedEntry(target, entryId)}
            className={className}
          />
        ))}
      </details>

      <div className={styles.inlineMarginBottom075rem}>
        <label>
          Notes
          <br />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={styles.inlineWidth100}
          />
        </label>
      </div>

      <div className={`${styles.inlineDisplayFlex} ${styles.inlineGap05rem}`}>
        <button type='submit' disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : editingId
              ? 'Save Changes'
              : 'Create Character Sheet'}
        </button>
        {editingId && (
          <button type='button' onClick={editor.resetForm} disabled={isSubmitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

import type {Dispatch, RefObject, SetStateAction} from 'react';
import type {
  CharacterSheet, StatBlockGroup, StatBlockInsertMode, StatBlockScopePreset,
  StatBlockSourceType, StatBlockStyle, WorldEntity
} from '../../entityTypes';
import type {useWorkspaceStatBlocks} from '../../hooks/useWorkspaceStatBlocks';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceStatBlockModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  statBlocks: ReturnType<typeof useWorkspaceStatBlocks>;
  pendingRebindToken: string | null;
  sourceType: StatBlockSourceType;
  setSourceType: Dispatch<SetStateAction<StatBlockSourceType>>;
  characterSheets: CharacterSheet[];
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  scopePreset: StatBlockScopePreset;
  setScopePreset: Dispatch<SetStateAction<StatBlockScopePreset>>;
  setSelectedGroupId: Dispatch<SetStateAction<string>>;
  groups: StatBlockGroup[];
  newGroupName: string;
  setNewGroupName: Dispatch<SetStateAction<string>>;
  entities: WorldEntity[];
  selectedEntityId: string;
  setSelectedEntityId: Dispatch<SetStateAction<string>>;
  style: StatBlockStyle;
  setStyle: Dispatch<SetStateAction<StatBlockStyle>>;
  insertMode: StatBlockInsertMode;
  setInsertMode: Dispatch<SetStateAction<StatBlockInsertMode>>;
  navigate: (path: string) => void;
}

export const WorkspaceStatBlockModal = (props: WorkspaceStatBlockModalProps) => {
  const {
    isOpen: isStatBlockModalOpen, dialogRef: statBlockDialogRef, statBlocks,
    pendingRebindToken: pendingStatBlockRebindToken,
    sourceType: statBlockSourceType, setSourceType: setStatBlockSourceType,
    characterSheets, selectedCharacterId: selectedStatCharacterId,
    setSelectedCharacterId: setSelectedStatCharacterId,
    scopePreset: statBlockScopePreset, setScopePreset: setStatBlockScopePreset,
    setSelectedGroupId: setSelectedStatGroupId, groups: statBlockGroups,
    newGroupName: newStatGroupName, setNewGroupName: setNewStatGroupName,
    entities, selectedEntityId: selectedStatEntityId,
    setSelectedEntityId: setSelectedStatEntityId,
    style: statBlockStyle, setStyle: setStatBlockStyle,
    insertMode: statBlockInsertMode, setInsertMode: setStatBlockInsertMode, navigate
  } = props;
  const {
    statDefinitionNameById, resourceDefinitionNameById, selectedSheet,
    activeProjectMode, canInsertStatBlock, selectedStatGroup,
    activeSelectedStatSet, activeSelectedResourceSet, statBlockScopeValue,
    handleInsertStatBlock, handleToggleStatSelection, handleToggleResourceSelection,
    handleSaveStatGroup, handleDeleteStatGroup, closeStatBlockModal
  } = statBlocks;
  return (
    <>
      {isStatBlockModalOpen && (
        <div
          ref={statBlockDialogRef}
          role='dialog'
          aria-modal='true'
          aria-label='Status Block Builder'
          onClick={closeStatBlockModal}
          className={styles.modalOverlay}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`${styles.modalCard} ${styles.statModalCard}`}
          >
            <h3 className={styles.modalTitle}>
              {pendingStatBlockRebindToken ? 'Rebind Status Block' : 'Insert Status Block'}
            </h3>
            <p className={styles.modalDescription}>
              {pendingStatBlockRebindToken ? (
                <>
                  Choose the correct source and save it back into this placeholder token.
                </>
              ) : (
                <>
                  Choose what to insert. Use <strong>Reusable placeholder</strong> if you
                  want to refresh it later.
                </>
              )}
            </p>
            {pendingStatBlockRebindToken && (
              <div className={styles.statRebindNotice}>
                Rebinding keeps this token as a reusable placeholder and updates only the
                selected chip in the scene.
              </div>
            )}

            <div className={styles.statFormGrid}>
              <label>
                Source type
                <br />
                <select
                  id='stat-block-source-type'
                  value={statBlockSourceType}
                  onChange={(event) =>
                    setStatBlockSourceType(event.target.value as StatBlockSourceType)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='character'>Character</option>
                  <option value='item'>Item/Entity</option>
                </select>
              </label>

              {statBlockSourceType === 'character' ? (
                <>
                  <label>
                    Character
                    <br />
                    <select
                      id='stat-block-character'
                      value={selectedStatCharacterId}
                      onChange={(event) => setSelectedStatCharacterId(event.target.value)}
                      disabled={characterSheets.length === 0}
                      className={styles.fullWidthField}
                    >
                      {characterSheets.length === 0 ? (
                        <option value=''>No character sheets</option>
                      ) : (
                        characterSheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label>
                    Block contents
                    <br />
                    <select
                      id='stat-block-contents'
                      value={statBlockScopeValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value.startsWith('group:')) {
                          setSelectedStatGroupId(value.slice('group:'.length));
                          setStatBlockScopePreset('custom');
                          return;
                        }
                        setSelectedStatGroupId('');
                        setStatBlockScopePreset(value as StatBlockScopePreset);
                      }}
                      className={styles.fullWidthField}
                    >
                      <option value='all'>All stats + resources</option>
                      <option value='stats'>Stats only</option>
                      <option value='resources'>Resources only</option>
                      <option value='custom'>Custom selection</option>
                      {statBlockGroups.map((group) => (
                        <option key={group.id} value={`group:${group.id}`}>
                          Group: {group.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {statBlockScopePreset === 'custom' && !selectedStatGroup && (
                    <div className={styles.statCustomCard}>
                      <strong className={styles.statCustomTitle}>Custom pick</strong>
                      <div className={styles.statCustomGrid}>
                        <div>
                          <div className={styles.statSectionLabel}>Stats</div>
                          {selectedSheet?.stats.length ? (
                            selectedSheet.stats.map((stat) => {
                              const label =
                                statDefinitionNameById.get(stat.definitionId) ??
                                stat.definitionId;
                              return (
                                <label key={stat.definitionId} className={styles.statOptionLabel}>
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedStatSet.has(stat.definitionId)}
                                    onChange={() =>
                                      handleToggleStatSelection(stat.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No stats on this character.
                            </span>
                          )}
                        </div>
                        <div>
                          <div className={styles.statSectionLabel}>Resources</div>
                          {selectedSheet?.resources.length ? (
                            selectedSheet.resources.map((resource) => {
                              const label =
                                resourceDefinitionNameById.get(resource.definitionId) ??
                                resource.definitionId;
                              return (
                                <label
                                  key={resource.definitionId}
                                  className={styles.statOptionLabel}
                                >
                                  <input
                                    type='checkbox'
                                    checked={activeSelectedResourceSet.has(
                                      resource.definitionId
                                    )}
                                    onChange={() =>
                                      handleToggleResourceSelection(resource.definitionId)
                                    }
                                  />{' '}
                                  {label}
                                </label>
                              );
                            })
                          ) : (
                            <span className={styles.statMutedText}>
                              No resources on this character.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedStatGroup && (
                    <div className={styles.statGroupSummary}>
                      <span>
                        Group <strong>{selectedStatGroup.name}</strong> includes{' '}
                        {activeSelectedStatSet.size} stat(s) and{' '}
                        {activeSelectedResourceSet.size} resource(s).
                      </span>
                      <button
                        type='button'
                        onClick={() => handleDeleteStatGroup(selectedStatGroup.id)}
                        className={styles.statGroupDeleteButton}
                      >
                        Delete group
                      </button>
                    </div>
                  )}

                  <div className={styles.statCustomCard}>
                    <strong className={styles.statSaveGroupTitle}>Save current selection</strong>
                    <div className={styles.statSaveGroupRow}>
                      <input
                        type='text'
                        placeholder='Group name (e.g. Qi only)'
                        value={newStatGroupName}
                        onChange={(event) => setNewStatGroupName(event.target.value)}
                        className={styles.statSaveGroupInput}
                      />
                      <button type='button' onClick={handleSaveStatGroup}>
                        Save group
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <label>
                  Item/Entity
                  <br />
                  <select
                    id='stat-block-entity'
                    value={selectedStatEntityId}
                    onChange={(event) => setSelectedStatEntityId(event.target.value)}
                    disabled={entities.length === 0}
                    className={styles.fullWidthField}
                  >
                    {entities.length === 0 ? (
                      <option value=''>No entities</option>
                    ) : (
                      entities.map((entity) => (
                        <option key={entity.id} value={entity.id}>
                          {entity.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              )}

              <label>
                Detail level
                <br />
                <select
                  id='stat-block-detail'
                  value={statBlockStyle}
                  onChange={(event) =>
                    setStatBlockStyle(event.target.value as StatBlockStyle)
                  }
                  className={styles.fullWidthField}
                >
                  <option value='full'>All stats</option>
                  <option value='buffs'>Current buffs only</option>
                  <option value='compact'>Compact</option>
                </select>
              </label>

              <label>
                Insert as
                <br />
                <select
                  id='stat-block-insert-as'
                  value={statBlockInsertMode}
                  onChange={(event) =>
                    setStatBlockInsertMode(event.target.value as StatBlockInsertMode)
                  }
                  disabled={activeProjectMode === 'litrpg'}
                  className={styles.fullWidthField}
                >
                  <option value='block'>Live block now</option>
                  <option value='template'>Reusable placeholder</option>
                </select>
                {activeProjectMode === 'litrpg' && (
                  <span className={styles.modeHint}>
                    LitRPG mode always inserts live text for readability.
                  </span>
                )}
              </label>
            </div>
            {!canInsertStatBlock && (
              <div className={styles.statInsertHintCard}>
                <p className={styles.statInsertHintText}>
                  Add at least one {statBlockSourceType === 'character' ? 'character sheet' : 'entity'} before inserting a status block.
                </p>
                <div className={styles.statInsertHintActions}>
                  <button
                    type='button'
                    onClick={() => {
                      closeStatBlockModal();
                      navigate(
                        statBlockSourceType === 'character'
                          ? '/characters?view=sheets'
                          : '/world-bible'
                      );
                    }}
                    className={styles.statInsertHintButton}
                  >
                    {statBlockSourceType === 'character'
                      ? 'Go to Character Sheets'
                      : 'Go to World Bible'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type='button'
                onClick={closeStatBlockModal}
                className={styles.modalSecondaryAction}
              >
                Cancel
              </button>
              <button type='button' onClick={handleInsertStatBlock} disabled={!canInsertStatBlock}>
                {pendingStatBlockRebindToken ? 'Rebind token' : 'Insert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

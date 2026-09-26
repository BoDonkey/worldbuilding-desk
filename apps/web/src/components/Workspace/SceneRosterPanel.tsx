import {useMemo, useState} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';
import type {
  CharacterSnapshotInventoryLine,
  CharacterSnapshotResourceLine,
  CharacterSnapshotStatLine
} from '../../services/state/characterSnapshot';
import {
  CharacterResourceMeters,
  CharacterStateDetails,
  CharacterStatusChips
} from '../CharacterSheets/CharacterStatCard';

export type SceneRosterStatLine = CharacterSnapshotStatLine;
export type SceneRosterResourceLine = CharacterSnapshotResourceLine;
export type SceneRosterInventoryLine = CharacterSnapshotInventoryLine;

export interface SceneRosterCharacterCard {
  key: string;
  id: string;
  sheetId?: string;
  name: string;
  role: string;
  level?: number;
  source: 'scene' | 'pinned';
  matchedSurface?: string;
  stats: SceneRosterStatLine[];
  resources: SceneRosterResourceLine[];
  inventory: SceneRosterInventoryLine[];
  statuses: string[];
  location?: string;
  hasSheet: boolean;
}

export interface SceneRosterItemCard {
  key: string;
  id: string;
  name: string;
  categoryLabel: string;
  icon?: string;
  source: 'scene' | 'pinned';
  matchedSurface?: string;
  fields: SceneRosterStatLine[];
}

export interface SceneRosterAddOption {
  key: string;
  name: string;
  group: 'Characters' | 'Items & entities';
}

export interface SceneRosterTimelineEvent {
  id: string;
  label: string;
  actorLabel: string;
  position?: number;
  anchorStatus: 'exact' | 'moved' | 'unresolved' | 'legacy';
  status: 'accepted' | 'invalidated';
  summaries: string[];
  canEdit: boolean;
  canExpire: boolean;
  durationLabel?: string;
}

interface SceneRosterPanelProps {
  sceneTitle: string | null;
  characters: SceneRosterCharacterCard[];
  items: SceneRosterItemCard[];
  addOptions: SceneRosterAddOption[];
  ambiguousSurfaces: string[];
  onAdd: (candidateKey: string) => void;
  onHide: (candidateKey: string) => void;
  onOpenRecord: (target: {id: string; type: 'character' | 'entity'}) => void;
  stateMoment: 'opening' | 'cursor' | 'ending';
  cursorPosition: number;
  onStateMomentChange: (moment: 'opening' | 'cursor' | 'ending') => void;
  onRecordChangeHere: (character: SceneRosterCharacterCard) => void;
  onConsumeHere: (character: SceneRosterCharacterCard, item: SceneRosterInventoryLine) => void;
  timeline: SceneRosterTimelineEvent[];
  onEditTimelineEvent: (eventId: string) => void;
  onInvalidateTimelineEvent: (eventId: string) => void;
  onReanchorTimelineEvent: (eventId: string) => void;
  onExpireTimelineEvent: (eventId: string) => void;
}

const initialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('');

const sourceLabel = (source: 'scene' | 'pinned', matchedSurface?: string): string =>
  source === 'pinned'
    ? 'Pinned to scene'
    : matchedSurface
      ? `Mentioned as “${matchedSurface}”`
      : 'Mentioned in scene';

export function SceneRosterPanel({
  sceneTitle,
  characters,
  items,
  addOptions,
  ambiguousSurfaces,
  onAdd,
  onHide,
  onOpenRecord,
  stateMoment,
  cursorPosition,
  onStateMomentChange,
  onRecordChangeHere,
  onConsumeHere,
  timeline,
  onEditTimelineEvent,
  onInvalidateTimelineEvent,
  onReanchorTimelineEvent,
  onExpireTimelineEvent
}: SceneRosterPanelProps) {
  const [selectedCandidateKey, setSelectedCandidateKey] = useState('');
  const groupedOptions = useMemo(
    () => ({
      Characters: addOptions.filter((option) => option.group === 'Characters'),
      'Items & entities': addOptions.filter(
        (option) => option.group === 'Items & entities'
      )
    }),
    [addOptions]
  );

  if (!sceneTitle) {
    return (
      <div className={styles.sceneRosterEmpty}>
        <strong>Select a scene</strong>
        <p>The scene roster will show exact character and item state here.</p>
      </div>
    );
  }

  const isEmpty = characters.length === 0 && items.length === 0;

  return (
    <div className={styles.sceneRosterPanel}>
      <header className={styles.sceneRosterHeader}>
        <div>
          <div className={styles.sceneRosterEyebrow}>Current scene</div>
          <h3>{sceneTitle}</h3>
        </div>
        <span className={styles.sceneRosterCount}>
          {characters.length + items.length}
        </span>
      </header>
      <p className={styles.sceneRosterIntro}>
        {stateMoment === 'opening'
          ? 'Exact canonical values at scene opening.'
          : stateMoment === 'cursor'
            ? `Exact state through cursor position ${cursorPosition}.`
            : 'Exact state after every accepted change in this scene.'}
      </p>
      <div className={styles.sceneRosterMomentSwitch} aria-label='Scene state moment'>
        {(['opening', 'cursor', 'ending'] as const).map((moment) => (
          <button
            key={moment}
            type='button'
            className={stateMoment === moment ? styles.sceneRosterMomentActive : ''}
            onClick={() => onStateMomentChange(moment)}
          >
            {moment === 'opening' ? 'Opening' : moment === 'cursor' ? 'At cursor' : 'Ending'}
          </button>
        ))}
      </div>

      <div className={styles.sceneRosterAddRow}>
        <select
          value={selectedCandidateKey}
          onChange={(event) => setSelectedCandidateKey(event.target.value)}
          aria-label='Add a character or item to this scene'
        >
          <option value=''>Add to this scene…</option>
          {Object.entries(groupedOptions).map(([label, options]) =>
            options.length > 0 ? (
              <optgroup key={label} label={label}>
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.name}
                  </option>
                ))}
              </optgroup>
            ) : null
          )}
        </select>
        <button
          type='button'
          disabled={!selectedCandidateKey}
          onClick={() => {
            if (!selectedCandidateKey) return;
            onAdd(selectedCandidateKey);
            setSelectedCandidateKey('');
          }}
        >
          Add
        </button>
      </div>

      {ambiguousSurfaces.length > 0 && (
        <div className={styles.sceneRosterNotice}>
          <strong>Needs a choice</strong>
          <span>
            {ambiguousSurfaces.join(', ')} matched more than one record and was not added
            automatically.
          </span>
        </div>
      )}

      {timeline.length > 0 && (
        <details className={styles.sceneRosterTimeline}>
          <summary>Scene changes ({timeline.length})</summary>
          <ol>
            {timeline.map((event) => (
              <li key={event.id} className={event.status === 'invalidated' ? styles.sceneRosterTimelineInvalid : ''}>
                <div className={styles.sceneRosterTimelineHeader}>
                  <div>
                    <strong>{event.label}</strong>
                    <span>
                      {event.actorLabel} · {event.position === undefined ? 'Scene ending' : `Position ${event.position}`}
                    </span>
                    {event.anchorStatus !== 'legacy' && (
                      <span className={`${styles.sceneRosterAnchorStatus} ${
                        event.anchorStatus === 'unresolved'
                          ? styles.sceneRosterAnchorStatusWarning
                          : ''
                      }`}>
                        {event.anchorStatus === 'exact'
                          ? 'Anchor exact'
                          : event.anchorStatus === 'moved'
                            ? 'Anchor moved with text'
                            : 'Anchor needs review'}
                      </span>
                    )}
                  </div>
                  <div>
                    {event.canEdit && event.status === 'accepted' && event.anchorStatus !== 'unresolved' && (
                      <button type='button' onClick={() => onEditTimelineEvent(event.id)}>
                        Edit
                      </button>
                    )}
                    {event.canExpire && event.status === 'accepted' && (
                      <button type='button' onClick={() => onExpireTimelineEvent(event.id)} title={event.durationLabel ? `Place expiration after ${event.durationLabel} of story time` : 'Place expiration at the current cursor'}>
                        Expire here
                      </button>
                    )}
                    {event.canEdit && event.status === 'accepted' && event.anchorStatus === 'unresolved' && (
                      <button type='button' onClick={() => onReanchorTimelineEvent(event.id)}>
                        Re-anchor here
                      </button>
                    )}
                    {event.status === 'accepted' && (
                      <button type='button' onClick={() => onInvalidateTimelineEvent(event.id)}>
                        Invalidate
                      </button>
                    )}
                  </div>
                </div>
                <ul>
                  {event.summaries.map((summary, index) => (
                    <li key={`${event.id}-${index}`}>{summary}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      )}

      {isEmpty && (
        <div className={styles.sceneRosterEmpty}>
          <strong>No roster matches yet</strong>
          <p>
            Mention a canonical name or alias in the scene, or add a record manually above.
          </p>
        </div>
      )}

      {characters.length > 0 && (
        <section className={styles.sceneRosterSection}>
          <div className={styles.sceneRosterSectionHeading}>Characters</div>
          <div className={styles.sceneRosterCardList}>
            {characters.map((character) => (
              <article key={character.key} className={styles.sceneRosterCard}>
                <div className={styles.sceneRosterCardHeader}>
                  <div className={styles.sceneRosterAvatar} aria-hidden='true'>
                    {initialsFor(character.name)}
                  </div>
                  <div className={styles.sceneRosterIdentity}>
                    <button
                      type='button'
                      className={styles.sceneRosterNameButton}
                      onClick={() => onOpenRecord({id: character.id, type: 'character'})}
                    >
                      {character.name}
                    </button>
                    <span>
                      {character.role}
                      {typeof character.level === 'number' ? ` · Level ${character.level}` : ''}
                    </span>
                  </div>
                  <button
                    type='button'
                    className={styles.sceneRosterRemoveButton}
                    onClick={() => onHide(character.key)}
                    aria-label={`Hide ${character.name} from this scene roster`}
                    title='Hide from this scene'
                  >
                    ×
                  </button>
                </div>
                <div className={styles.sceneRosterSource}>
                  {sourceLabel(character.source, character.matchedSurface)}
                </div>

                <CharacterResourceMeters resources={character.resources} />
                <CharacterStatusChips statuses={character.statuses} />

                {character.hasSheet ? (
                  <>
                  <button
                    type='button'
                    className={styles.sceneRosterRecordButton}
                    onClick={() => onRecordChangeHere(character)}
                  >
                    Record change here
                  </button>
                  <CharacterStateDetails
                    summary='Full state at this moment'
                    location={character.location}
                    stats={character.stats}
                    inventory={character.inventory}
                    renderItemAction={(item) =>
                      item.consumable && (
                        <button type='button' onClick={() => onConsumeHere(character, item)}>
                          Consume here
                        </button>
                      )
                    }
                  />
                  </>
                ) : (
                  <div className={styles.sceneRosterMissing}>
                    No mechanics sheet is linked to this character.
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className={styles.sceneRosterSection}>
          <div className={styles.sceneRosterSectionHeading}>Items & entities</div>
          <div className={styles.sceneRosterCardList}>
            {items.map((item) => (
              <article key={item.key} className={styles.sceneRosterCard}>
                <div className={styles.sceneRosterCardHeader}>
                  <div className={styles.sceneRosterAvatar} aria-hidden='true'>
                    {item.icon?.trim() || initialsFor(item.name)}
                  </div>
                  <div className={styles.sceneRosterIdentity}>
                    <button
                      type='button'
                      className={styles.sceneRosterNameButton}
                      onClick={() => onOpenRecord({id: item.id, type: 'entity'})}
                    >
                      {item.name}
                    </button>
                    <span>{item.categoryLabel}</span>
                  </div>
                  <button
                    type='button'
                    className={styles.sceneRosterRemoveButton}
                    onClick={() => onHide(item.key)}
                    aria-label={`Hide ${item.name} from this scene roster`}
                    title='Hide from this scene'
                  >
                    ×
                  </button>
                </div>
                <div className={styles.sceneRosterSource}>
                  {sourceLabel(item.source, item.matchedSurface)}
                </div>
                {item.fields.length > 0 ? (
                  <div className={styles.sceneRosterFieldList}>
                    {item.fields.map((field) => (
                      <div key={field.id}>
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.sceneRosterMissing}>
                    No canonical fields have values yet.
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

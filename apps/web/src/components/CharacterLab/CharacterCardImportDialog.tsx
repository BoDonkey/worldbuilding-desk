import {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {
  readCharacterCardFile,
  type CharacterCard
} from '../../services/characterCards/characterCardParse';
import {
  buildCharacterCardImportRecords,
  lorebookEntryTitle,
  resolveCardMacros,
  type CharacterCardImportTarget
} from '../../services/characterCards/characterCardImport';
import {describeError} from '../../services/errors';
import styles from '../../styles/CharacterLab.module.css';

interface CharacterCardImportDialogProps {
  projectId: string;
  /** The character category a new draft is created in. */
  category: {id: string; slug: string};
  onOpenCharacter: (entityId: string) => void;
  onClose: () => void;
}

interface LoadedCard {
  card: CharacterCard;
  fileName: string;
  mimeType: string;
  isPng: boolean;
}

interface ImportResult {
  entityId: string;
  name: string;
  noteId: string;
  lorebookCount: number;
  createdNew: boolean;
}

const SEPARATE = 'separate';
const EXCERPT_CHARS = 180;

const excerpt = (value: string) =>
  value.length > EXCERPT_CHARS ? `${value.slice(0, EXCERPT_CHARS).trimEnd()}…` : value;

/** Which card parts become Notes sections, by the labels the import writes. */
function notesParts(card: CharacterCard): string[] {
  return [
    card.personality && 'Personality',
    card.scenario && 'Scenario',
    card.firstMessage && 'First message',
    card.exampleDialogue && 'Example dialogue',
    card.alternateGreetings.length > 0 &&
      `${card.alternateGreetings.length} alternate ${card.alternateGreetings.length === 1 ? 'greeting' : 'greetings'}`,
    card.creatorNotes && 'Creator notes'
  ].filter((part): part is string => Boolean(part));
}

/**
 * Imports a Tavern character card (Slice 4.69): read, preview where each part
 * goes, then write a draft character and Source Notes only on confirm.
 */
export function CharacterCardImportDialog({projectId, category, onOpenCharacter, onClose}: CharacterCardImportDialogProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lab = useCharacterLabData(projectId, true);
  const [loaded, setLoaded] = useState<LoadedCard | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [name, setName] = useState('');
  const [keptEntries, setKeptEntries] = useState<boolean[]>([]);
  const [collisionChoice, setCollisionChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  useFocusTrap(containerRef, true);

  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, [loaded, result]);

  const {findNameCollisions} = lab;
  const collisions = useMemo(() => findNameCollisions(name), [findNameCollisions, name]);
  useEffect(() => {
    setCollisionChoice(null);
  }, [name]);

  const readFile = async (file: File) => {
    setIsReading(true);
    setError(null);
    setLoaded(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const card = await readCharacterCardFile(bytes);
      setLoaded({card, fileName: file.name, mimeType: file.type, isPng: bytes[0] === 0x89});
      setName(card.name);
      setKeptEntries((card.lorebook?.entries ?? []).map((entry) => entry.enabled));
    } catch (readError) {
      setError(describeError(readError, 'This file could not be read as a character card.'));
    } finally {
      setIsReading(false);
    }
  };

  const target: CharacterCardImportTarget | null = (() => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (collisions.length === 0 || collisionChoice === SEPARATE) {
      return {kind: 'new', categoryId: category.id, name: trimmed};
    }
    const existing = collisions.find((collision) => collision.entityId === collisionChoice);
    return existing ? {kind: 'existing', entityId: existing.entityId, name: existing.name} : null;
  })();

  const confirm = async () => {
    if (!loaded || !target) return;
    setIsSaving(true);
    setError(null);
    try {
      const records = buildCharacterCardImportRecords({
        projectId,
        card: loaded.card,
        fileName: loaded.fileName,
        mimeType: loaded.mimeType || undefined,
        target,
        keptLorebookEntries: keptEntries.flatMap((kept, index) => (kept ? [index] : []))
      });
      await lab.saveCardImport(records, category.slug);
      setResult({
        entityId: records.links[0]?.targetId ?? '',
        name: target.name,
        noteId: records.cardNote.id,
        lorebookCount: records.lorebookNotes.length,
        createdNew: target.kind === 'new'
      });
    } catch (saveError) {
      setError(describeError(saveError, 'Unable to import this character card.'));
    } finally {
      setIsSaving(false);
    }
  };

  const card = loaded?.card;
  const entries = card?.lorebook?.entries ?? [];
  const parts = card ? notesParts(card) : [];
  const usesUserMacro = card ? /\{\{\s*user\s*\}\}|<USER>/i.test(JSON.stringify(card)) : false;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={`${styles.dialog} ${styles.narrowDialog}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='character-card-import-title'
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Nothing is written until you confirm, and nothing becomes canon</span>
            <h2 id='character-card-import-title'>Import a character card</h2>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </header>

        <div className={styles.conversation}>
          {result ? (
            <>
              <p className={styles.hint} role='status'>
                {result.createdNew
                  ? `Created a draft character, ${result.name}. It is marked Needs completion.`
                  : `Added the card to ${result.name} as a Source Note; the character itself is unchanged.`}{' '}
                {result.lorebookCount === 0
                  ? 'The card is saved as a Source Note.'
                  : `The card and ${result.lorebookCount} lorebook ${result.lorebookCount === 1 ? 'entry are' : 'entries are'} saved as Source Notes.`}{' '}
                None of it is canon until you review it.
              </p>
              <div className={styles.actions}>
                <button
                  type='button'
                  className={styles.primary}
                  onClick={() => {
                    onClose();
                    onOpenCharacter(result.entityId);
                  }}
                >
                  Open {result.name}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    onClose();
                    navigate('/lore', {state: {focusLoreDocumentId: result.noteId}});
                  }}
                >
                  Open the card note
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>Character card file (PNG or JSON)</span>
                <input
                  type='file'
                  accept='.png,.json,image/png,application/json'
                  disabled={isReading || isSaving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </label>
              {!card && (
                <p className={styles.hint}>
                  Reads Tavern character cards (V1, V2, and V3), the format SillyTavern and most card libraries use.
                </p>
              )}
              {isReading && <p className={styles.hint} role='status'>Reading the card…</p>}

              {card && (
                <>
                  <label className={styles.field}>
                    <span>Name</span>
                    <input className={styles.textInput} value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  {!name.trim() && <p className={styles.hint}>Add a name to continue.</p>}
                  {collisions.length > 0 && (
                    <fieldset className={styles.castPicker}>
                      <legend>
                        {collisions.length === 1 ? 'A character' : 'Characters'} already{' '}
                        {collisions.length === 1 ? 'uses' : 'use'} this name
                      </legend>
                      {collisions.map((collision) => (
                        <label key={collision.entityId}>
                          <input
                            type='radio'
                            name='card-collision-choice'
                            checked={collisionChoice === collision.entityId}
                            onChange={() => setCollisionChoice(collision.entityId)}
                          />
                          Add the card to {collision.name}
                          {collision.via === 'alias' ? ` (alias “${collision.matchedText}”)` : ''}
                        </label>
                      ))}
                      <label>
                        <input
                          type='radio'
                          name='card-collision-choice'
                          checked={collisionChoice === SEPARATE}
                          onChange={() => setCollisionChoice(SEPARATE)}
                        />
                        Create a separate character with this name
                      </label>
                    </fieldset>
                  )}

                  <section aria-label='Where each part goes'>
                    <h3 className={styles.sectionTitle}>Where each part goes</h3>
                    <ul className={styles.choiceList}>
                      {target?.kind !== 'existing' && (
                        <>
                          <li>
                            <strong>Description field:</strong>{' '}
                            {card.description
                              ? excerpt(resolveCardMacros(card.description, name.trim() || card.name))
                              : 'empty (the card has no description)'}
                          </li>
                          <li>
                            <strong>Notes field:</strong> {parts.length > 0 ? parts.join(', ') : 'nothing'}
                          </li>
                        </>
                      )}
                      <li>
                        <strong>Source Note “Character card: {name.trim() || card.name}”:</strong> every field above, plus
                        nickname and tags
                      </li>
                      {(card.systemPrompt || card.postHistoryInstructions) && (
                        <li>
                          Not imported: the card’s chat instructions (system prompt, post-history instructions), which are
                          written for a chat model, not for your book.
                        </li>
                      )}
                      {loaded?.isPng && <li>The portrait image itself is not imported.</li>}
                    </ul>
                    <p className={styles.hint}>
                      {card.spec.toUpperCase()} card{card.creator ? ` by ${card.creator}` : ''}. {'{{char}}'} becomes the
                      character’s name.
                      {usesUserMacro ? ' The card also uses {{user}}, the chat partner in SillyTavern; it is kept as written for you to rewrite.' : ''}
                    </p>
                  </section>

                  {entries.length > 0 && (
                    <section aria-label='Lorebook entries'>
                      <h3 className={styles.sectionTitle}>Lorebook entries, each kept as its own Source Note</h3>
                      <ul className={styles.choiceList}>
                        {entries.map((entry, index) => (
                          <li key={index}>
                            <label>
                              <input
                                type='checkbox'
                                checked={keptEntries[index] ?? false}
                                onChange={() =>
                                  setKeptEntries((current) =>
                                    current.map((kept, position) => (position === index ? !kept : kept))
                                  )
                                }
                              />
                              <span>
                                <strong>{lorebookEntryTitle(entry, index)}</strong>
                                {!entry.enabled && <span className={styles.hint}> (switched off in the card)</span>}
                                <span className={styles.quote}>
                                  {excerpt(resolveCardMacros(entry.content, name.trim() || card.name))}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <p className={styles.hint}>
                    {target?.kind === 'existing'
                      ? `Saves the card${entries.length > 0 ? ' and the kept lorebook entries' : ''} as Source Notes on ${target.name}. Nothing is merged into the character.`
                      : 'Creates a draft character marked Needs completion, plus Source Notes you can review for facts. Nothing becomes canon.'}
                  </p>
                </>
              )}

              {error && <p className={styles.error} role='alert'>{error}</p>}
              {card && (
                <div className={styles.actions}>
                  <button
                    type='button'
                    className={styles.primary}
                    onClick={() => void confirm()}
                    disabled={!target || isSaving || !lab.isLoaded}
                  >
                    {isSaving
                      ? 'Importing…'
                      : target?.kind === 'existing'
                        ? `Add to ${target.name}`
                        : 'Create draft character'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

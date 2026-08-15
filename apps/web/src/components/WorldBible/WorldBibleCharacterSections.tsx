import type {ReactNode} from 'react';
import type {Character, CharacterSheet} from '../../entityTypes';
import styles from '../../assets/components/WorldBibleRoute.module.css';

export type CharacterDetailSection =
  | 'canon'
  | 'notes'
  | 'continuity'
  | 'mechanics'
  | 'writing-aids';

interface WorldBibleCharacterSectionsProps {
  activeSection: CharacterDetailSection;
  onSectionChange: (section: CharacterDetailSection) => void;
  isSaved: boolean;
  characterName: string;
  canUseMechanics: boolean;
  characterExtension: Character | null;
  characterSheet: CharacterSheet | null;
  linkedNoteCount: number;
  sceneMentionCount: number;
  stateEventCount: number;
  isExporting: boolean;
  onExport: () => void;
  dialogueStyleContent: ReactNode;
  canonContent: ReactNode;
  notesContent: ReactNode;
  continuityContent: ReactNode;
  mechanicsContent: ReactNode;
}

interface SectionDefinition {
  id: CharacterDetailSection;
  label: string;
  description: string;
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    id: 'canon',
    label: 'Canon',
    description: 'Identity, aliases, description, and story-facing facts.'
  },
  {
    id: 'notes',
    label: 'Notes',
    description: 'Structured notes, custom sections, and longform source material.'
  },
  {
    id: 'continuity',
    label: 'Continuity',
    description: 'Accepted facts, scene mentions, memory, and manuscript-time state.'
  },
  {
    id: 'mechanics',
    label: 'Mechanics',
    description: 'Optional sheet and state tracking for system-focused projects.'
  },
  {
    id: 'writing-aids',
    label: 'Writing aids',
    description: 'Dialogue presentation and portable character packages.'
  }
];

const getAvailableCharacterDetailSections = (params: {
  isSaved: boolean;
  canUseMechanics: boolean;
}): SectionDefinition[] => {
  if (!params.isSaved) return SECTION_DEFINITIONS.slice(0, 1);
  return SECTION_DEFINITIONS.filter(
    (section) => section.id !== 'mechanics' || params.canUseMechanics
  );
};

export const WorldBibleCharacterSections = (
  props: WorldBibleCharacterSectionsProps
) => {
  const sections = getAvailableCharacterDetailSections({
    isSaved: props.isSaved,
    canUseMechanics: props.canUseMechanics
  });
  const activeSection = sections.some((section) => section.id === props.activeSection)
    ? props.activeSection
    : 'canon';
  const activeDefinition = sections.find((section) => section.id === activeSection) ??
    sections[0];
  const panelId = `character-detail-panel-${activeSection}`;

  return (
    <div className={styles.characterDetailExperience}>
      <div className={styles.characterDetailIntro}>
        <span>One character, one home</span>
        <strong>{props.characterName || 'New character'}</strong>
        <p>
          Canon stays here. Notes, continuity, mechanics, and writing aids attach
          to this same character when they become useful.
        </p>
      </div>

      <div
        className={styles.characterDetailTabs}
        role='tablist'
        aria-label='Character detail sections'
      >
        {sections.map((section) => (
          <button
            key={section.id}
            id={`character-detail-tab-${section.id}`}
            type='button'
            role='tab'
            aria-selected={activeSection === section.id}
            aria-controls={`character-detail-panel-${section.id}`}
            className={activeSection === section.id ? styles.characterDetailTabActive : ''}
            onClick={() => props.onSectionChange(section.id)}
          >
            <span>{section.label}</span>
            {section.id === 'notes' && props.linkedNoteCount > 0 && (
              <small>{props.linkedNoteCount}</small>
            )}
            {section.id === 'continuity' &&
              props.sceneMentionCount + props.stateEventCount > 0 && (
                <small>{props.sceneMentionCount + props.stateEventCount}</small>
              )}
            {section.id === 'mechanics' && props.characterSheet && <small>Ready</small>}
          </button>
        ))}
      </div>

      {!props.isSaved && (
        <p className={styles.characterDetailUnlockHint}>
          Save the canonical character first. Notes, continuity, and optional
          capabilities will then attach here without another name entry.
        </p>
      )}

      <section
        id={panelId}
        role='tabpanel'
        aria-labelledby={`character-detail-tab-${activeSection}`}
        className={styles.characterDetailPanel}
      >
        <header className={styles.characterDetailPanelHeader}>
          <div>
            <span>{activeDefinition.label}</span>
            <p>{activeDefinition.description}</p>
          </div>
        </header>

        {activeSection === 'canon' && props.canonContent}
        {activeSection === 'notes' && props.notesContent}
        {activeSection === 'continuity' && props.continuityContent}

        {activeSection === 'mechanics' && (
          props.mechanicsContent
        )}

        {activeSection === 'writing-aids' && (
          <div className={styles.characterCapabilityPanel}>
            <div className={styles.characterCapabilitySummary}>
              <div>
                <span>Dialogue style</span>
                <strong>
                  {props.characterExtension?.characterStyleId ? 'Assigned' : 'Default'}
                </strong>
              </div>
              <div>
                <span>Character package</span>
                <strong>Canon-linked</strong>
              </div>
            </div>
            {props.dialogueStyleContent}
            <div className={styles.reviewToolbarActions}>
              <button type='button' onClick={props.onExport} disabled={props.isExporting}>
                {props.isExporting ? 'Exporting...' : 'Export character'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

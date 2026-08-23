import type {CharacterSheet, StoredRuleset, WritingDocument} from '../../entityTypes';
import type {MutationFormType} from './MutationForm';
import styles from '../../styles/CharacterSheetsRoute.module.css';

interface BasicCharacterStatePanelProps {
  sheets: CharacterSheet[];
  ruleset: StoredRuleset;
  documents: WritingDocument[];
  sheetId: string;
  sceneId: string;
  mutationType: MutationFormType;
  statDefinitionId: string;
  resourceDefinitionId: string;
  numberValue: string;
  previewSummary: string | null;
  previewIssues: string[];
  feedback: {tone: 'success' | 'error'; message: string} | null;
  isSaving: boolean;
  onSheetChange: (id: string) => void;
  onSceneChange: (id: string) => void;
  onTrackedValueChange: (value: string) => void;
  onOperationChange: (operation: 'change' | 'set') => void;
  onNumberValueChange: (value: string) => void;
  onConfirm: () => void;
  onOpenAdvancedSetup: () => void;
  onOpenDetailedChanges: () => void;
  onOpenWorldBible: () => void;
}

export function BasicCharacterStatePanel(props: BasicCharacterStatePanelProps) {
  const selectedValue = props.statDefinitionId
    ? `stat:${props.statDefinitionId}`
    : props.resourceDefinitionId
      ? `resource:${props.resourceDefinitionId}`
      : '';
  const operation = props.mutationType.endsWith('_set') ? 'set' : 'change';
  return (
    <section className={styles.basicStatePanel}>
      <header>
        <div><span>Character continuity</span><h1>Record a scene change</h1></div>
        <button type='button' onClick={props.onOpenAdvancedSetup}>Advanced sheet setup</button>
      </header>
      <p>
        Choose what changed in the manuscript. The app previews the result and
        records nothing until you confirm.
      </p>
      {props.feedback && (
        <p role='status' className={`${styles.feedback} ${props.feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}>
          {props.feedback.message}
        </p>
      )}
      {props.sheets.length === 0 ? (
        <div className={styles.basicStateEmpty}>
          <strong>No character is tracking mechanics yet.</strong>
          <p>Open a saved World Bible character and choose Add mechanics.</p>
          <button type='button' onClick={props.onOpenWorldBible}>Open World Bible</button>
        </div>
      ) : (
        <div className={styles.basicStateFields}>
          <label>Character<select value={props.sheetId} onChange={(event) => props.onSheetChange(event.target.value)}>
            <option value=''>Choose a character…</option>
            {props.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
          </select></label>
          <label>Scene<select value={props.sceneId} onChange={(event) => props.onSceneChange(event.target.value)}>
            <option value=''>Choose a scene…</option>
            {props.documents.map((scene) => <option key={scene.id} value={scene.id}>{scene.title || 'Untitled scene'}</option>)}
          </select></label>
          <label>Tracked value<select value={selectedValue} onChange={(event) => props.onTrackedValueChange(event.target.value)}>
            <option value=''>Choose a value…</option>
            {props.ruleset.statDefinitions.filter((definition) => definition.type === 'number').map((definition) => <option key={definition.id} value={`stat:${definition.id}`}>{definition.name}</option>)}
            {props.ruleset.resourceDefinitions.map((definition) => <option key={definition.id} value={`resource:${definition.id}`}>{definition.name}</option>)}
          </select></label>
          <label>How should it change?<select value={operation} onChange={(event) => props.onOperationChange(event.target.value as 'change' | 'set')}>
            <option value='change'>Change by</option><option value='set'>Set to</option>
          </select></label>
          <label>{operation === 'change' ? 'Amount' : 'New value'}<input type='number' value={props.numberValue} onChange={(event) => props.onNumberValueChange(event.target.value)} /></label>
          <div className={styles.basicStatePreview} aria-live='polite'>
            <strong>Before → after</strong>
            <p>{props.previewSummary ?? 'Complete the choices above to preview the result.'}</p>
            {props.previewIssues.length > 0 && <p role='alert'>{props.previewIssues.join(' ')}</p>}
          </div>
          <div className={styles.basicStateActions}>
            <button type='button' onClick={props.onOpenDetailedChanges}>
              Inventory, equipment, status, or location
            </button>
            <button type='button' onClick={props.onConfirm} disabled={props.isSaving || !props.sheetId || !props.sceneId || !selectedValue || props.previewIssues.length > 0}>
              {props.isSaving ? 'Recording…' : 'Confirm scene change'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

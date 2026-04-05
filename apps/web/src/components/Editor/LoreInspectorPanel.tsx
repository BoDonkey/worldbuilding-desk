import {useMemo} from 'react';
import styles from '../../assets/components/AISettings.module.css';

interface LoreRelatedRecord {
  id: string;
  label: string;
  detail: string;
  targetType: 'character' | 'entity' | 'compendium';
}

export interface LoreInspectorRecord {
  type: 'character' | 'entity';
  id: string;
  name: string;
  completionStatus?: 'draft' | 'complete';
  vitalSigns: string[];
  alternativeNames?: string[];
  relatedRecords?: LoreRelatedRecord[];
  compendium?: {
    entryId?: string;
    name: string;
    domain?: string;
    linked: boolean;
  };
  synopsis: {
    goal: string;
    recentEvent: string;
    motivation: string;
  };
}

interface LoreInspectorPanelProps {
  record: LoreInspectorRecord | null;
  aiEnabled: boolean;
  aiBudgetUsed: number;
  aiBudgetMax: number;
  onConsult: (mode: 'consistency' | 'reaction' | 'outcome') => void;
  onOpenPrimaryRecord?: (target: {id: string; type: 'character' | 'entity'}) => void;
  onOpenCompendium?: (record: LoreInspectorRecord) => void;
  onSeedCompendiumEntry?: (record: LoreInspectorRecord) => void;
  seedingCompendiumRecordId?: string | null;
}

export const LoreInspectorPanel = ({
  record,
  aiEnabled,
  aiBudgetUsed,
  aiBudgetMax,
  onConsult,
  onOpenPrimaryRecord,
  onOpenCompendium,
  onSeedCompendiumEntry,
  seedingCompendiumRecordId
}: LoreInspectorPanelProps) => {
  const remaining = useMemo(
    () => Math.max(0, aiBudgetMax - aiBudgetUsed),
    [aiBudgetMax, aiBudgetUsed]
  );

  if (!record) {
    return (
      <div className={styles.lorePanel}>
        <p className={styles.systemEmpty}>
          Select a character or item in the scene, then open Lore Inspector.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.lorePanel}>
      <div className={styles.loreHeaderCard}>
        <h3 className={styles.systemPanelTitle}>{record.name}</h3>
        {record.type === 'entity' && record.completionStatus === 'draft' ? (
          <div className={styles.loreDraftWarning}>
            This World Bible record still needs completion.
          </div>
        ) : null}
        <div className={styles.loreVitalList}>
          {record.vitalSigns.map((item) => (
            <span key={item} className={styles.loreVitalChip}>
              {item}
            </span>
          ))}
        </div>
        {record.compendium ? (
          <div className={styles.loreCompendiumStatus}>
            {record.compendium.linked
              ? `Compendium linked${record.compendium.domain ? ` · ${record.compendium.domain}` : ''}`
              : `Compendium not seeded${record.compendium.domain ? ` · suggested ${record.compendium.domain}` : ''}`}
          </div>
        ) : null}
      </div>

      {record.alternativeNames?.length ? (
        <section className={styles.loreSection}>
          <h4 className={styles.loreSectionTitle}>Alternative Names</h4>
          <div className={styles.loreVitalList}>
            {record.alternativeNames.map((item) => (
              <span key={item} className={styles.loreVitalChip}>
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {record.relatedRecords?.length ? (
        <section className={styles.loreSection}>
          <h4 className={styles.loreSectionTitle}>Connected Records</h4>
          <div className={styles.lorePeekSummary}>
            {record.relatedRecords.map((item) => (
              <div key={`${item.targetType}:${item.id}`} className={styles.lorePeekRow}>
                <div className={styles.lorePeekLabel}>{item.label}</div>
                <div className={styles.lorePeekValue}>{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.loreSection}>
        <h4 className={styles.loreSectionTitle}>Contextual Synopsis</h4>
        <ul className={styles.loreSynopsisList}>
          <li>
            <strong>Goal:</strong> {record.synopsis.goal}
          </li>
          <li>
            <strong>Recent Event:</strong> {record.synopsis.recentEvent}
          </li>
          <li>
            <strong>Secret/Motivation:</strong> {record.synopsis.motivation}
          </li>
        </ul>
      </section>

      <section className={styles.loreSection}>
        <h4 className={styles.loreSectionTitle}>Record Actions</h4>
        <div className={styles.systemActions}>
          {onOpenPrimaryRecord ? (
            <button
              type='button'
              onClick={() => onOpenPrimaryRecord({id: record.id, type: record.type})}
            >
              {record.type === 'entity' ? 'Open in World Bible' : 'Open in Characters'}
            </button>
          ) : null}
          {record.type === 'entity' && record.compendium?.linked && onOpenCompendium ? (
            <button type='button' onClick={() => onOpenCompendium(record)}>
              Open Compendium
            </button>
          ) : null}
          {record.type === 'entity' &&
          !record.compendium?.linked &&
          onSeedCompendiumEntry ? (
            <button
              type='button'
              onClick={() => onSeedCompendiumEntry(record)}
              disabled={seedingCompendiumRecordId === record.id}
            >
              {seedingCompendiumRecordId === record.id
                ? 'Seeding...'
                : 'Seed Compendium Entry'}
            </button>
          ) : null}
        </div>
      </section>

      <section className={styles.loreSection}>
        <h4 className={styles.loreSectionTitle}>AI Consultation</h4>
        <p className={styles.loreBudgetText}>
          Daily consultations used: {aiBudgetUsed}/{aiBudgetMax}
          {' · '}Remaining: {remaining}
        </p>
        <div className={styles.systemActions}>
          <button type='button' onClick={() => onConsult('consistency')} disabled={!aiEnabled || remaining === 0}>
            Check Consistency
          </button>
          <button type='button' onClick={() => onConsult('reaction')} disabled={!aiEnabled || remaining === 0}>
            Suggest Reaction
          </button>
          <button type='button' onClick={() => onConsult('outcome')} disabled={!aiEnabled || remaining === 0}>
            Calculate Outcome
          </button>
        </div>
      </section>
    </div>
  );
};

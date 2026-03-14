import {useMemo} from 'react';
import styles from '../../assets/components/AISettings.module.css';

export interface LoreInspectorRecord {
  type: 'character' | 'entity';
  id: string;
  name: string;
  vitalSigns: string[];
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
}

export const LoreInspectorPanel = ({
  record,
  aiEnabled,
  aiBudgetUsed,
  aiBudgetMax,
  onConsult
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
        <div className={styles.loreVitalList}>
          {record.vitalSigns.map((item) => (
            <span key={item} className={styles.loreVitalChip}>
              {item}
            </span>
          ))}
        </div>
      </div>

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

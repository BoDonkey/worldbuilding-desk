import styles from '../../assets/components/AISettings.module.css';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import type {UseConsultationBudget} from '../../hooks/useConsultationBudget';

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
  onEditRecord: (record: LoreInspectorRecord) => void;
  aiEnabled: boolean;
  /** Shared project consultation budget — the same status every spending surface shows. */
  budget: UseConsultationBudget;
  onConsult: (
    mode:
      | 'consistency'
      | 'reaction'
      | 'outcome'
      | 'worldbuilding'
      | 'plotting'
  ) => void;
}

export const LoreInspectorPanel = ({
  record,
  onEditRecord,
  aiEnabled,
  budget,
  onConsult
}: LoreInspectorPanelProps) => {

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
        <div className={styles.systemActions}>
          <button type='button' onClick={() => onEditRecord(record)}>
            {record.type === 'entity' ? 'Edit in World Bible' : 'Resolve in World Bible'}
          </button>
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
        <ConsultationBudgetNotice
          status={budget.status}
          isLocal={budget.isLocal}
          onGrantMore={budget.grantMore}
          hidden={!aiEnabled}
          className={styles.loreBudgetText}
        />
        <div className={styles.systemActions}>
          <button type='button' onClick={() => onConsult('consistency')} disabled={!aiEnabled || budget.blocked}>
            Check Consistency
          </button>
          <button type='button' onClick={() => onConsult('reaction')} disabled={!aiEnabled || budget.blocked}>
            Suggest Reaction
          </button>
          <button type='button' onClick={() => onConsult('outcome')} disabled={!aiEnabled || budget.blocked}>
            Calculate Outcome
          </button>
          <button type='button' onClick={() => onConsult('worldbuilding')} disabled={!aiEnabled || budget.blocked}>
            Expand World Detail
          </button>
          <button type='button' onClick={() => onConsult('plotting')} disabled={!aiEnabled || budget.blocked}>
            Generate Plot Hooks
          </button>
        </div>
      </section>
    </div>
  );
};

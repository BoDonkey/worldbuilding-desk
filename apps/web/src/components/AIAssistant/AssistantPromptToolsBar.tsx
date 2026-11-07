import type {Dispatch, SetStateAction} from 'react';
import type {PromptTool} from '../../entityTypes';
import styles from '../../assets/components/AIAssistant.module.css';

/** The assistant's Prompt Tools bar: the author ticks the standing instructions for this chat. */
export function AssistantPromptToolsBar({
  tools,
  selectedToolIds,
  setSelectedToolIds
}: {
  tools: PromptTool[];
  selectedToolIds: string[];
  setSelectedToolIds: Dispatch<SetStateAction<string[]>>;
}) {
  const enabled = tools.filter((tool) => tool.enabled);
  if (enabled.length === 0) return null;
  return (
    <div className={styles.toolsBar}>
      <div className={styles.toolsHeading}>Prompt Tools</div>
      <div className={styles.toolsList}>
        {enabled.map((tool) => (
          <label key={tool.id} className={styles.toolChip}>
            <input
              type='checkbox'
              checked={selectedToolIds.includes(tool.id)}
              onChange={(e) =>
                setSelectedToolIds((prev) =>
                  e.target.checked
                    ? [...new Set([...prev, tool.id])]
                    : prev.filter((id) => id !== tool.id)
                )
              }
            />
            <span>{tool.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

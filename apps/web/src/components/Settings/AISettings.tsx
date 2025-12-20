import React, { useState} from 'react';
import styles from '../../assets/components/AISettings.module.css';

export const AISettings: React.FC = () => {
  const [anthropicKey, setAnthropicKey] = useState(() => 
    localStorage.getItem('anthropic_api_key') || ''
  );
  const [openaiKey, setOpenaiKey] = useState(() => 
    localStorage.getItem('openai_api_key') || ''
  );

  const handleSave = () => {
    if (anthropicKey) {
      localStorage.setItem('anthropic_api_key', anthropicKey);
    } else {
      localStorage.removeItem('anthropic_api_key');
    }

    if (openaiKey) {
      localStorage.setItem('openai_api_key', openaiKey);
    } else {
      localStorage.removeItem('openai_api_key');
    }

    alert('API keys saved');
  };

  return (
    <div className={styles.container}>
      <h2>AI Settings</h2>
      
      <div className={styles.section}>
        <label>
          Anthropic API Key (for Claude)
          <input
            type="password"
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </label>
        <p className={styles.help}>
          Get your key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>
        </p>
      </div>

      <div className={styles.section}>
        <label>
          OpenAI API Key (for embeddings)
          <input
            type="password"
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
          />
        </label>
        <p className={styles.help}>
          Get your key from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">platform.openai.com</a>
        </p>
      </div>

      <button onClick={handleSave}>Save API Keys</button>
    </div>
  );
};
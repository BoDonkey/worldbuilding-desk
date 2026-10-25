import type {ProjectAISettings} from '../../entityTypes';
import styles from '../../assets/components/Settings/AISettingsForm.module.css';
import {
  MAX_LOCAL_REPLY_TOKENS,
  MIN_LOCAL_REPLY_TOKENS,
  PROVIDER_DEFAULT_BASE_URLS
} from '../../services/llm/providerConfig';

interface LocalServerFieldProps {
  aiSettings: ProjectAISettings;
  onSettingsChange: (aiSettings: ProjectAISettings) => void;
}

function updateLocalServer(
  {aiSettings, onSettingsChange}: LocalServerFieldProps,
  patch: Partial<NonNullable<ProjectAISettings['configs']['local-openai']>>
) {
  onSettingsChange({
    ...aiSettings,
    configs: {...aiSettings.configs, 'local-openai': {...aiSettings.configs['local-openai'], ...patch}}
  });
}

/** The local model server's address (Slice 4.67). */
export function LocalServerAddressField(props: LocalServerFieldProps & {value?: string}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor='local-server-base-url'>Server address</label>
      <input
        id='local-server-base-url'
        type='text'
        className={styles.input}
        value={props.value ?? ''}
        onChange={(e) => updateLocalServer(props, {baseUrl: e.target.value})}
        placeholder={PROVIDER_DEFAULT_BASE_URLS['local-openai']}
      />
      <p className={styles.help}>
        KoboldCPP: http://localhost:5001/v1 · LM Studio: http://localhost:1234/v1 · llama.cpp server:
        http://localhost:8080/v1. Only addresses on this computer are allowed; no API key is needed.
      </p>
    </div>
  );
}

/**
 * The reply cap for a server that does not report its context size (Slice 4.75).
 * KoboldCPP and llama.cpp report it, and replies then get the room the prompt leaves.
 */
export function LocalServerReplyLengthField(props: LocalServerFieldProps) {
  const value = props.aiSettings.configs['local-openai']?.maxReplyTokens;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor='local-server-max-reply-tokens'>Maximum reply length (tokens)</label>
      <input
        id='local-server-max-reply-tokens'
        type='number'
        className={styles.input}
        min={MIN_LOCAL_REPLY_TOKENS}
        max={MAX_LOCAL_REPLY_TOKENS}
        step={1}
        value={value ?? ''}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          updateLocalServer(props, {maxReplyTokens: Number.isNaN(parsed) ? undefined : parsed});
        }}
        placeholder='Server default'
      />
      <p className={styles.help}>
        KoboldCPP and the llama.cpp server report their context size, and replies get whatever room the
        prompt leaves, so this is not used for them. For a server that does not report it, this caps each
        reply ({MIN_LOCAL_REPLY_TOKENS}–{MAX_LOCAL_REPLY_TOKENS.toLocaleString('en-US')}); leave it blank to
        use the server&apos;s own limit.
      </p>
    </div>
  );
}

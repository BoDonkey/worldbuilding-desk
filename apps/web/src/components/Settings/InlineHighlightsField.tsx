import type {InlineHighlightsMode} from '../../entityTypes';
import styles from '../../styles/SettingsRoute.module.css';

/** One hint per Highlight visibility mode (4.98). */
const HINTS: Record<InlineHighlightsMode, string> = {
  visible: 'Lore and review highlights show in full while you write.',
  subtle:
    'Highlights show as lighter, thinner underlines with no background. They can still be clicked.',
  'hidden-while-typing':
    'Highlights hide while you type and come back after about three seconds of pause, so review stays available without crowding the draft.'
};

/** Settings → Reading & Editor: how inline lore and review highlights show. */
export function InlineHighlightsField({
  value,
  onChange
}: {
  value: InlineHighlightsMode;
  onChange: (mode: InlineHighlightsMode) => void;
}) {
  return (
    <>
      <label className={styles.fieldLabel}>
        Highlight visibility
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as InlineHighlightsMode)}
          className={styles.styleInput}
        >
          <option value='visible'>Visible</option>
          <option value='subtle'>Subtle</option>
          <option value='hidden-while-typing'>Hidden while typing</option>
        </select>
      </label>
      <p className={styles.helperText}>{HINTS[value]}</p>
    </>
  );
}

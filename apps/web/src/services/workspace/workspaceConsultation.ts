import type {LoreInspectorRecord} from '../../components/Editor/LoreInspectorPanel';

export type WorkspaceLoreConsultationMode =
  | 'consistency'
  | 'reaction'
  | 'outcome'
  | 'worldbuilding'
  | 'plotting';

export const summarizeWorkspaceContent = (html: string, limit = 500): string => {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, limit);
};

export const buildWorkspaceLoreConsultation = (params: {
  mode: WorkspaceLoreConsultationMode;
  record: LoreInspectorRecord;
  content: string;
  maxContextChars: number;
}) => {
  const {mode, record, content, maxContextChars} = params;
  const compactContext = summarizeWorkspaceContent(content).slice(0, maxContextChars);
  const header =
    mode === 'consistency'
      ? 'Check consistency for this subject against the current scene context.'
      : mode === 'reaction'
        ? 'Suggest an in-character reaction aligned with this subject profile.'
        : mode === 'outcome'
          ? 'Calculate a plausible outcome grounded in current stats/resources.'
          : mode === 'worldbuilding'
            ? 'Expand the surrounding worldbuilding around this subject without inventing canon-breaking facts.'
            : 'Generate plot hooks and scene pressure that naturally involve this subject.';
  const outputGuide =
    mode === 'worldbuilding'
      ? 'Return 3 grounded expansions with headings: Social/Cultural, Environmental/Material, and Tension/Complication. Keep each brief and explicitly tie it to existing context.'
      : mode === 'plotting'
        ? 'Return 4 plot hooks. For each hook include: Hook, Why it matters now, Risk/complication, and Best-fit scene type. Do not write the scene itself.'
        : mode === 'consistency'
          ? 'Return a concise review with confirmed facts, possible conflicts, and one safe next-step suggestion.'
          : mode === 'reaction'
            ? 'Return 3 plausible reactions ranked from most likely to least likely, with a short reason for each.'
            : 'Return one likely outcome, 2 alternate outcomes, and the key stat/resource pressures driving them.';
  const prompt =
    `${header}\n\n` +
    `Subject: ${record.name} (${record.type})\n` +
    `Vital Signs: ${record.vitalSigns.join(' | ')}\n` +
    `Goal: ${record.synopsis.goal}\n` +
    `Recent Event: ${record.synopsis.recentEvent}\n` +
    `Motivation: ${record.synopsis.motivation}\n` +
    `Scene Context: ${compactContext}\n\n` +
    `Constraints:\n` +
    `- Treat established details as canon unless explicitly marked uncertain.\n` +
    `- Prefer extensions, implications, and tensions over replacement.\n` +
    `- Do not write finished prose for the novel unless the request explicitly asks for insertable text.\n` +
    `- Flag any assumption that is not directly grounded in the provided context.\n\n` +
    `Output format:\n${outputGuide}`;

  return {compactContext, prompt};
};

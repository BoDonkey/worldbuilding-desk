import {useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import type {Character, Project, ProjectSettings} from '../entityTypes';
import {getCharactersByProject, saveCharacter, deleteCharacter} from '../characterStorage';
import {getOrCreateSettings, saveProjectSettings} from '../settingsStorage';
import {CharacterStyleList} from '../components/CharacterStyleList';
import type {CharacterStyle} from '../entityTypes';
import {useNavigate} from 'react-router-dom';
import {LLMService} from '../services/llm/LLMService';
import {
  parseCharacterImportText,
  readCharacterImportFile,
  type CharacterImportDraft,
  type CharacterImportSectionAction
} from '../services/characterImportService';
import {generateCharacterCreationDraft} from '../services/characterCreationService';
import {parseAiJson} from '../utils/parseAiJson';
import styles from '../styles/CharactersRoute.module.css';

interface CharactersRouteProps {
  activeProject: Project | null;
  projectSettings?: ProjectSettings | null;
  embedded?: boolean;
  focusCharacterId?: string | null;
  onFocusCharacterConsumed?: () => void;
  onOpenSheets?: (characterId?: string) => void;
  canOpenSheets?: boolean;
}

interface ImportedCharacterSection {
  id?: string;
  title: string;
  content: string;
  action: CharacterImportSectionAction;
}

interface ImportSectionState {
  id: string;
  title: string;
  content: string;
  action: CharacterImportSectionAction;
}

type SectionAssistIntent = 'expand' | 'sharpen' | 'tension';

interface SectionAssistState {
  isLoading: boolean;
  suggestion: string;
  note: string;
  intent: SectionAssistIntent | null;
}

interface CharacterCoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ImportReviewSuggestionResponse {
  name?: string;
  age?: string;
  role?: string;
  description?: string;
  ignoredSections?: string[];
  note?: string;
}

interface SectionAssistResponse {
  content?: string;
  note?: string;
}

type CharacterCoachMode = 'gaps' | 'tension' | 'texture' | 'custom';
type CharacterCreationMode = 'idle' | 'manual' | 'import' | 'ai';

const ensureUniqueImportSectionStates = (
  sections: ImportSectionState[]
): ImportSectionState[] => {
  const seen = new Map<string, number>();
  return sections.map((section, index) => {
    const baseId = section.id?.trim() || section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'section';
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    return {
      ...section,
      id: count === 0 ? baseId : `${baseId}-${index}`
    };
  });
};

function CharactersRoute({
  activeProject,
  projectSettings = null,
  embedded = false,
  focusCharacterId = null,
  onFocusCharacterConsumed,
  onOpenSheets,
  canOpenSheets = false
}: CharactersRouteProps) {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [editingImportedSections, setEditingImportedSections] = useState<ImportedCharacterSection[]>([]);
  const [editingSourceResidue, setEditingSourceResidue] = useState('');
  const [editingSectionAssistStates, setEditingSectionAssistStates] = useState<Record<string, SectionAssistState>>({});
  const [characterStyleId, setCharacterStyleId] = useState<string>('');
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isImportingCharacterDoc, setImportingCharacterDoc] = useState(false);
  const [importDraft, setImportDraft] = useState<CharacterImportDraft | null>(null);
  const [importName, setImportName] = useState('');
  const [importAge, setImportAge] = useState('');
  const [importRole, setImportRole] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importUnmatchedText, setImportUnmatchedText] = useState('');
  const [importSectionStates, setImportSectionStates] = useState<ImportSectionState[]>([]);
  const [sectionAssistStates, setSectionAssistStates] = useState<Record<string, SectionAssistState>>({});
  const [isAskingImportAI, setIsAskingImportAI] = useState(false);
  const [importAiNote, setImportAiNote] = useState<string | null>(null);
  const [pastedImportText, setPastedImportText] = useState('');
  const [characterCreationPrompt, setCharacterCreationPrompt] = useState('');
  const [isGeneratingCharacterDraft, setIsGeneratingCharacterDraft] = useState(false);
  const [characterCoachMessages, setCharacterCoachMessages] = useState<CharacterCoachMessage[]>([]);
  const [characterCoachInput, setCharacterCoachInput] = useState('');
  const [isAskingCharacterCoach, setIsAskingCharacterCoach] = useState(false);
  const [creationMode, setCreationMode] = useState<CharacterCreationMode>('idle');

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const [chars, projectSettingsFromStore] = await Promise.all([
        getCharactersByProject(activeProject.id),
        getOrCreateSettings(activeProject.id)
      ]);

      if (!cancelled) {
        setCharacters(chars);
        setSettings(projectSettingsFromStore);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!focusCharacterId || characters.length === 0) return;
    const character = characters.find((entry) => entry.id === focusCharacterId);
    if (!character) return;
    setEditingId(character.id);
    setCreationMode('manual');
    setName(character.name);
    setDescription(character.description ?? '');
    setAge(character.fields.age ?? '');
    setRole(character.fields.role ?? '');
    setNotes(character.fields.notes ?? '');
    setEditingImportedSections(importedSectionsForCharacter(character));
    setEditingSourceResidue(character.fields.notes ?? '');
    setEditingSectionAssistStates({});
    setCharacterStyleId(character.characterStyleId ?? '');
    setCharacterCoachMessages([]);
    setCharacterCoachInput('');
    onFocusCharacterConsumed?.();
  }, [characters, focusCharacterId, onFocusCharacterConsumed]);

  const effectiveProjectSettings = projectSettings ?? settings;

  const resetForm = () => {
    setEditingId(null);
    setCreationMode('idle');
    setName('');
    setDescription('');
    setAge('');
    setRole('');
    setNotes('');
    setEditingImportedSections([]);
    setEditingSourceResidue('');
    setEditingSectionAssistStates({});
    setCharacterStyleId('');
    setCharacterCoachMessages([]);
    setCharacterCoachInput('');
  };

  const handleAddManualSection = () => {
    setEditingImportedSections((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'New Section',
        content: '',
        action: 'notes'
      }
    ]);
  };

  const handleAddReviewSection = () => {
    setImportSectionStates((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'New Section',
        content: '',
        action: 'notes'
      }
    ]);
  };

  const resetImportState = () => {
    setImportDraft(null);
    setCreationMode('idle');
    setImportName('');
    setImportAge('');
    setImportRole('');
    setImportDescription('');
    setImportUnmatchedText('');
    setImportSectionStates([]);
    setSectionAssistStates({});
    setImportAiNote(null);
    setPastedImportText('');
  };

  const reviewSourceLabel = importDraft?.sourceKind === 'ai' ? 'AI Character Draft Review' : 'Character Import Review';
  const reviewSourceLead =
    importDraft?.sourceKind === 'ai'
      ? 'Review the generated draft, tighten the details, and save only what feels usable for this project.'
      : 'Review extracted fields, decide what belongs in notes or description, and save only when it looks right.';
  const sourceResidueLabel =
    importDraft?.sourceKind === 'ai' ? 'Open Questions / Draft Residue' : 'Raw Source Residue';
  const saveReviewLabel =
    importDraft?.sourceKind === 'ai' ? 'Save AI Draft As Character' : 'Save Imported Character';
  const isFocusedCharacterTask = Boolean(importDraft || editingId || creationMode !== 'idle');
  const isShowingManualEditor = Boolean(editingId || creationMode === 'manual');
  const isShowingImportWorkspace = Boolean(importDraft || creationMode === 'import');
  const isShowingAiWorkspace = Boolean(creationMode === 'ai' && !importDraft);

  const initializeImportDraft = (draft: CharacterImportDraft) => {
    setImportDraft(draft);
    setImportName(draft.detectedName);
    setImportAge(draft.detectedAge);
    setImportRole(draft.detectedRole);
    setImportDescription(draft.detectedDescription);
    setImportUnmatchedText(draft.unmatchedText);
    setImportSectionStates(
      ensureUniqueImportSectionStates(draft.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content,
        action: section.action
      })))
    );
    setSectionAssistStates({});
    setImportAiNote(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject) {
      alert('Select or create a project first.');
      return;
    }

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = characters.find((c) => c.id === id);

    const character: Character = {
      id,
      projectId: activeProject.id,
      name: name.trim(),
      description: description.trim() || undefined,
      characterStyleId: characterStyleId || undefined,
      fields: {
        age: age.trim() || undefined,
        role: role.trim() || undefined,
        notes: editingId ? editingSourceResidue.trim() || undefined : notes.trim() || undefined,
        importedSections:
          editingImportedSections.length > 0
            ? editingImportedSections
                .filter((section) => section.content.trim())
                .map((section) => ({
                  id: section.id?.trim() || crypto.randomUUID(),
                  title: section.title.trim() || 'Imported Section',
                  content: section.content.trim(),
                  action: section.action
                }))
            : undefined
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await saveCharacter(character);

    setCharacters((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === id);
      if (existingIndex === -1) {
        return [...prev, character];
      }
      const copy = [...prev];
      copy[existingIndex] = character;
      return copy;
    });

    resetForm();
    setFeedback({
      tone: 'success',
      message: editingId ? 'Character updated.' : 'Character created.'
    });
  };

  const handleCreateSheet = (character: Character) => {
    if (!canOpenSheets) {
      setFeedback({
        tone: 'error',
        message: 'Character sheets need a ruleset before they can be opened.'
      });
      return;
    }
    if (onOpenSheets) {
      onOpenSheets(character.id);
      return;
    }
    navigate('/characters?view=sheets');
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setCreationMode('manual');
    setName(character.name);
    setDescription(character.description ?? '');
    setAge(character.fields.age ?? '');
    setRole(character.fields.role ?? '');
    setNotes(character.fields.notes ?? '');
    setEditingImportedSections(importedSectionsForCharacter(character));
    setEditingSourceResidue(character.fields.notes ?? '');
    setEditingSectionAssistStates({});
    setCharacterStyleId(character.characterStyleId ?? '');
    setCharacterCoachMessages([]);
    setCharacterCoachInput('');
  };

  const buildCharacterCoachContext = () => {
    const lines: string[] = [
      `Name: ${name.trim() || '(missing)'}`,
      `Role: ${role.trim() || '(missing)'}`,
      `Age: ${age.trim() || '(missing)'}`,
      `Short Description: ${description.trim() || '(missing)'}`,
      `Dialogue Style: ${getStyleName(characterStyleId || undefined)}`
    ];

    if (editingImportedSections.length > 0) {
      lines.push(
        `Imported Sections: ${JSON.stringify(
          editingImportedSections.map((section) => ({
            title: section.title,
            content: section.content,
            action: section.action
          }))
        )}`
      );
    }

    const residue = editingId ? editingSourceResidue.trim() : notes.trim();
    if (residue) {
      lines.push(`Notes / Source Residue: ${residue}`);
    }

    return lines.join('\n');
  };

  const getCharacterCoachSystemPrompt = (mode: CharacterCoachMode) => {
    const shared =
      'You are a fiction character coach. Stay anchored to the character sheet the author provided. Focus on character construction, not broad plot engineering. Do not drift into story-outline advice, twists, scene pitches, or external plot beats unless the author explicitly asks for that. Do not rewrite the whole sheet unless asked. Mark speculation clearly.';

    switch (mode) {
      case 'gaps':
        return `${shared} Identify what is missing, vague, underdeveloped, or overly generic in the character itself: psychology, desire, fear, contradiction, habits, worldview, relationships, wounds, coping patterns, values, and voice. Prefer missing character dimensions over plot tasks.`;
      case 'tension':
        return `${shared} Look for internal contradiction, competing desires, blind spots, self-deception, emotional pressure points, vulnerabilities, and unstable relationships already implied by the sheet. Ground every suggestion in the existing character details.`;
      case 'texture':
        return `${shared} Suggest concrete, character-specific texture: habits, sensory tells, speech tendencies, routines, private rituals, petty preferences, social tells, embodied reactions, and other lived-in details. Avoid generic advice that could apply to anyone.`;
      case 'custom':
      default:
        return `${shared} Give concrete, targeted feedback that helps the author improve the current character sheet.`;
    }
  };

  const handleAskCharacterCoach = async (
    promptOverride?: string,
    options?: {
      mode?: CharacterCoachMode;
      replaceHistory?: boolean;
    }
  ) => {
    const promptText = (promptOverride ?? characterCoachInput).trim();
    const mode = options?.mode ?? (promptOverride ? 'custom' : 'custom');
    const replaceHistory = options?.replaceHistory ?? false;
    if (!promptText) {
      setFeedback({tone: 'error', message: 'Ask a question about the character first.'});
      return;
    }
    if (!effectiveProjectSettings?.aiSettings) {
      setFeedback({
        tone: 'error',
        message: 'AI provider is not configured. Add an API key in Settings first.'
      });
      return;
    }

    const history = characterCoachMessages.map((message) => ({
      role: message.role,
      content: message.content
    })) as Array<{role: 'user' | 'assistant'; content: string}>;
    const activeHistory = replaceHistory ? [] : history;

    const userMessage: CharacterCoachMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: promptText
    };

    setCharacterCoachMessages((prev) => (replaceHistory ? [userMessage] : [...prev, userMessage]));
    setCharacterCoachInput('');
    setIsAskingCharacterCoach(true);

    try {
      const llmService = new LLMService(effectiveProjectSettings.aiSettings);
      const response = await llmService.complete({
        messages: [
          ...activeHistory,
          {
            role: 'user',
            content: [
              'Character draft context:',
              buildCharacterCoachContext(),
              '',
              'Respond with concrete observations tied to the current sheet.',
              'Prefer bullets or short sections over long essays.',
              '',
              `Question: ${promptText}`
            ].join('\n')
          }
        ],
        systemPrompt: getCharacterCoachSystemPrompt(mode),
        maxTokens: effectiveProjectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      const assistantMessage: CharacterCoachMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content.trim() || 'No response returned.'
      };

      setCharacterCoachMessages((prev) =>
        replaceHistory ? [userMessage, assistantMessage] : [...prev, assistantMessage]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to get character coaching right now.';
      if (replaceHistory) {
        setCharacterCoachMessages([]);
      }
      setFeedback({tone: 'error', message});
    } finally {
      setIsAskingCharacterCoach(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCharacter(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  const handleUpdateStyle = async (
    styleId: string,
    updates: Partial<CharacterStyle['styles']>
  ) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.map((s) =>
        s.id === styleId ? {...s, styles: {...s.styles, ...updates}} : s
      ),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
  };

  const handleDeleteStyle = async (styleId: string) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.filter((s) => s.id !== styleId),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
  };

  const handleImportCharacterFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportingCharacterDoc(true);
    setCreationMode('import');
    setFeedback(null);
    try {
      const text = await readCharacterImportFile(file);
      const draft = parseCharacterImportText(text, file.name);
      initializeImportDraft(draft);
      setFeedback({
        tone: 'success',
        message: `Prepared import review for "${file.name}".`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import this character document.';
      setFeedback({tone: 'error', message});
    } finally {
      setImportingCharacterDoc(false);
    }
  };

  const handleStartPasteImport = () => {
    if (!pastedImportText.trim()) {
      setFeedback({tone: 'error', message: 'Paste some character text first.'});
      return;
    }
    setCreationMode('import');
    initializeImportDraft(parseCharacterImportText(pastedImportText));
    setFeedback({tone: 'success', message: 'Prepared import review from pasted text.'});
  };

  const handleGenerateCharacterDraft = async () => {
    if (!activeProject) {
      setFeedback({tone: 'error', message: 'Select or create a project first.'});
      return;
    }
    if (!characterCreationPrompt.trim()) {
      setFeedback({
        tone: 'error',
        message: 'Describe the kind of character you want before asking AI for a draft.'
      });
      return;
    }
    if (!effectiveProjectSettings?.aiSettings) {
      setFeedback({
        tone: 'error',
        message: 'AI provider is not configured. Add an API key in Settings first.'
      });
      return;
    }

    setIsGeneratingCharacterDraft(true);
    setCreationMode('ai');
    setFeedback(null);
    try {
      const {draft, note} = await generateCharacterCreationDraft({
        aiSettings: effectiveProjectSettings.aiSettings,
        prompt: characterCreationPrompt,
        projectName: activeProject.name,
        projectDescription: activeProject.description,
        existingCharacters: characters,
        maxTokens: effectiveProjectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      initializeImportDraft(draft);
      setImportAiNote(note ?? 'AI generated a draft. Review the fields before saving.');
      setFeedback({tone: 'success', message: 'AI draft prepared for review.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate an AI character draft.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsGeneratingCharacterDraft(false);
    }
  };

  const handleAskImportAI = async () => {
    if (!effectiveProjectSettings?.aiSettings || !importDraft) {
      setFeedback({
        tone: 'error',
        message: 'AI provider is not configured. Add an API key in Settings first.'
      });
      return;
    }

    setIsAskingImportAI(true);
    setImportAiNote(null);
    try {
      const llmService = new LLMService(effectiveProjectSettings.aiSettings);
      const response = await llmService.complete({
        messages: [
          {
            role: 'user',
            content: [
              'Review this character import draft and suggest a tighter role, a concise description, and any sections that look like reference material or should probably be ignored.',
              'If the source supports it, also repair missing or weak name and age extraction.',
              'Return strict JSON with keys: name, age, role, description, ignoredSections, note.',
              'Only set name or age when the source text reasonably supports them.',
              'ignoredSections must be an array of exact section titles to ignore.',
              'Do not invent facts.',
              '',
              `Detected name: ${importName || '(missing)'}`,
              `Detected age: ${importAge || '(missing)'}`,
              `Detected role: ${importRole || '(missing)'}`,
              `Detected description: ${importDescription || '(missing)'}`,
              `Sections: ${JSON.stringify(importSectionStates.map((section) => ({
                title: section.title,
                content: section.content
              })))}`,
              `Unmatched text: ${importUnmatchedText || '(none)'}`,
              `Source text: ${importDraft.sourceText}`
            ].join('\n')
          }
        ],
        systemPrompt:
          'You are assisting with character import review for a fiction-writing app. Stay conservative, preserve trust, and clearly separate extraction from inference.',
        maxTokens: effectiveProjectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      const parsed = parseAiJson<ImportReviewSuggestionResponse>(response.content);
      const changes: string[] = [];
      if (parsed.name?.trim()) {
        const nextName = parsed.name.trim();
        if (nextName !== importName.trim()) {
          changes.push(`Name updated to "${nextName}".`);
        }
        setImportName(nextName);
      }
      if (parsed.age?.trim()) {
        const nextAge = parsed.age.trim();
        if (nextAge !== importAge.trim()) {
          changes.push(`Age updated to "${nextAge}".`);
        }
        setImportAge(nextAge);
      }
      if (parsed.role?.trim()) {
        const nextRole = parsed.role.trim();
        if (nextRole !== importRole.trim()) {
          changes.push(`Role updated to "${nextRole}".`);
        }
        setImportRole(nextRole);
      }
      if (parsed.description?.trim()) {
        const nextDescription = parsed.description.trim();
        if (nextDescription !== importDescription.trim()) {
          changes.push('Short description updated.');
        }
        setImportDescription(nextDescription);
      }
      if (Array.isArray(parsed.ignoredSections) && parsed.ignoredSections.length > 0) {
        const ignoredTitles = new Set(parsed.ignoredSections);
        let ignoredCount = 0;
        setImportSectionStates((prev) =>
          ensureUniqueImportSectionStates(
            prev.map((section) => {
              if (!ignoredTitles.has(section.title) || section.action === 'ignore') {
                return section;
              }
              ignoredCount += 1;
              return {...section, action: 'ignore'};
            })
          )
        );
        if (ignoredCount > 0) {
          changes.push(`${ignoredCount} imported section${ignoredCount === 1 ? '' : 's'} marked ignore.`);
        }
      }
      if (parsed.note?.trim()) {
        setImportAiNote(
          changes.length > 0
            ? `${changes.join(' ')} ${parsed.note.trim()}`
            : parsed.note.trim()
        );
      } else if (changes.length > 0) {
        setImportAiNote(changes.join(' '));
      } else {
        setImportAiNote('AI suggestions applied, but no visible fields changed.');
      }
      setFeedback({tone: 'success', message: 'AI suggestions applied to the import review.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate AI import suggestions.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsAskingImportAI(false);
    }
  };

  const getSectionAssistLabel = (intent: SectionAssistIntent) => {
    switch (intent) {
      case 'expand':
        return 'Expand';
      case 'sharpen':
        return 'Sharpen';
      case 'tension':
        return 'Find tension';
    }
  };

  const handleAssistSection = async (sectionId: string, intent: SectionAssistIntent) => {
    const section = importSectionStates.find((entry) => entry.id === sectionId);
    if (!section) return;
    if (!effectiveProjectSettings?.aiSettings) {
      setFeedback({
        tone: 'error',
        message: 'AI provider is not configured. Add an API key in Settings first.'
      });
      return;
    }

    setSectionAssistStates((prev) => ({
      ...prev,
      [sectionId]: {
        isLoading: true,
        suggestion: prev[sectionId]?.suggestion ?? '',
        note: '',
        intent
      }
    }));

    const intentInstruction =
      intent === 'expand'
        ? 'Add concrete, useful detail to this section without bloating it or changing the character premise.'
        : intent === 'sharpen'
          ? 'Make this section more specific, less generic, and more scene-usable without changing its basic meaning.'
          : 'Surface contradiction, vulnerability, blind spots, or conflict pressure that would make this section more interesting.';

    try {
      const llmService = new LLMService(effectiveProjectSettings.aiSettings);
      const response = await llmService.complete({
        messages: [
          {
            role: 'user',
            content: [
              'Improve this one character section.',
              'Return strict JSON with keys: content, note.',
              'content must be the revised section text only.',
              'note should briefly explain what changed or what was emphasized.',
              'Do not use markdown fences.',
              '',
              `Character name: ${importName || '(missing)'}`,
              `Character age: ${importAge || '(missing)'}`,
              `Character role: ${importRole || '(missing)'}`,
              `Short description: ${importDescription || '(missing)'}`,
              `Section title: ${section.title}`,
              `Section action: ${section.action}`,
              `Current section content: ${section.content}`,
              `Other sections: ${JSON.stringify(
                importSectionStates
                  .filter((entry) => entry.id !== sectionId)
                  .map((entry) => ({title: entry.title, content: entry.content}))
              )}`,
              `Open notes or residue: ${importUnmatchedText || '(none)'}`,
              '',
              `Task: ${intentInstruction}`
            ].join('\n')
          }
        ],
        systemPrompt:
          'You are helping an author improve one section of a character draft. Stay specific, avoid filler, and keep continuity with the rest of the draft. Do not rewrite the whole character.',
        maxTokens: effectiveProjectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      const parsed = parseAiJson<SectionAssistResponse>(response.content);
      const suggestion = parsed.content?.trim();
      if (!suggestion) {
        throw new Error('AI did not return section content.');
      }

      setSectionAssistStates((prev) => ({
        ...prev,
        [sectionId]: {
          isLoading: false,
          suggestion,
          note: parsed.note?.trim() ?? '',
          intent
        }
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to improve this section right now.';
      setSectionAssistStates((prev) => ({
        ...prev,
        [sectionId]: {
          isLoading: false,
          suggestion: prev[sectionId]?.suggestion ?? '',
          note: '',
          intent
        }
      }));
      setFeedback({tone: 'error', message});
    }
  };

  const handleAssistEditingSection = async (sectionIndex: number, intent: SectionAssistIntent) => {
    const section = editingImportedSections[sectionIndex];
    if (!section) return;
    if (!effectiveProjectSettings?.aiSettings) {
      setFeedback({
        tone: 'error',
        message: 'AI provider is not configured. Add an API key in Settings first.'
      });
      return;
    }

    const sectionKey = `${editingId ?? 'draft'}:${sectionIndex}`;
    setEditingSectionAssistStates((prev) => ({
      ...prev,
      [sectionKey]: {
        isLoading: true,
        suggestion: prev[sectionKey]?.suggestion ?? '',
        note: '',
        intent
      }
    }));

    const intentInstruction =
      intent === 'expand'
        ? 'Add concrete, useful detail to this section without bloating it or changing the character premise.'
        : intent === 'sharpen'
          ? 'Make this section more specific, less generic, and more scene-usable without changing its basic meaning.'
          : 'Surface contradiction, vulnerability, blind spots, or conflict pressure that would make this section more interesting.';

    try {
      const llmService = new LLMService(effectiveProjectSettings.aiSettings);
      const response = await llmService.complete({
        messages: [
          {
            role: 'user',
            content: [
              'Improve this one saved character section.',
              'Return strict JSON with keys: content, note.',
              'content must be the revised section text only.',
              'note should briefly explain what changed or what was emphasized.',
              'Do not use markdown fences.',
              '',
              `Character name: ${name || '(missing)'}`,
              `Character age: ${age || '(missing)'}`,
              `Character role: ${role || '(missing)'}`,
              `Short description: ${description || '(missing)'}`,
              `Section title: ${section.title}`,
              `Section action: ${section.action}`,
              `Current section content: ${section.content}`,
              `Other sections: ${JSON.stringify(
                editingImportedSections
                  .filter((_, index) => index !== sectionIndex)
                  .map((entry) => ({title: entry.title, content: entry.content}))
              )}`,
              `Source residue: ${editingSourceResidue || '(none)'}`,
              '',
              `Task: ${intentInstruction}`
            ].join('\n')
          }
        ],
        systemPrompt:
          'You are helping an author improve one section of a saved character record. Stay specific, avoid filler, and keep continuity with the rest of the character. Do not rewrite the whole sheet.',
        maxTokens: effectiveProjectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      const parsed = parseAiJson<SectionAssistResponse>(response.content);
      const suggestion = parsed.content?.trim();
      if (!suggestion) {
        throw new Error('AI did not return section content.');
      }

      setEditingSectionAssistStates((prev) => ({
        ...prev,
        [sectionKey]: {
          isLoading: false,
          suggestion,
          note: parsed.note?.trim() ?? '',
          intent
        }
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to improve this section right now.';
      setEditingSectionAssistStates((prev) => ({
        ...prev,
        [sectionKey]: {
          isLoading: false,
          suggestion: prev[sectionKey]?.suggestion ?? '',
          note: '',
          intent
        }
      }));
      setFeedback({tone: 'error', message});
    }
  };

  const compiledImportNotes = useMemo(() => {
    const blocks: string[] = [];
    importSectionStates.forEach((section) => {
      if (section.action === 'notes') {
        blocks.push(`${section.title}\n${section.content}`);
      }
      if (section.action === 'later') {
        blocks.push(`Flag For Later: ${section.title}\n${section.content}`);
      }
    });
    if (importUnmatchedText.trim()) {
      blocks.push(`Imported Source Notes\n${importUnmatchedText.trim()}`);
    }
    return blocks.filter(Boolean).join('\n\n');
  }, [importSectionStates, importUnmatchedText]);

  const importedSectionsForCharacter = (character: Character): ImportedCharacterSection[] => {
    const raw = character.fields.importedSections;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (entry): entry is ImportedCharacterSection =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        (typeof (entry as ImportedCharacterSection).id === 'string' ||
          typeof (entry as ImportedCharacterSection).id === 'undefined') &&
        typeof (entry as ImportedCharacterSection).title === 'string' &&
        typeof (entry as ImportedCharacterSection).content === 'string' &&
        typeof (entry as ImportedCharacterSection).action === 'string'
    );
  };

  const handleSaveImportedCharacter = async () => {
    if (!activeProject || !importName.trim()) {
      setFeedback({tone: 'error', message: 'Character name is required before saving.'});
      return;
    }

    const descriptionBlocks = importSectionStates
      .filter((section) => section.action === 'description')
      .map((section) => section.content.trim())
      .filter(Boolean);
    const nextDescription = [importDescription.trim(), ...descriptionBlocks]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const now = Date.now();
    const character: Character = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: importName.trim(),
      description: nextDescription || undefined,
      fields: {
        age: importAge.trim() || undefined,
        role: importRole.trim() || undefined,
        notes: importUnmatchedText.trim() || undefined,
        importedSections: importSectionStates
          .filter((section) => section.action !== 'ignore')
          .map((section) => ({
            title: section.title,
            content: section.content.trim(),
            action: section.action
          }))
      },
      createdAt: now,
      updatedAt: now
    };

    await saveCharacter(character);
    setCharacters((prev) => [...prev, character]);
    resetImportState();
    setFeedback({
      tone: 'success',
      message:
        importDraft?.sourceKind === 'ai'
          ? `Created character "${character.name}" from the AI draft.`
          : `Imported character "${character.name}".`
    });
  };

  if (!activeProject) {
    return <p>No active project selected.</p>;
  }

  const getStyleName = (styleId: string | undefined) => {
    if (!styleId || !settings) return 'None';
    const style = settings.characterStyles.find((s) => s.id === styleId);
    return style?.name ?? 'None';
  };

  const content = (
    <>
      {!embedded && <h1>Characters</h1>}
      {feedback && (
        <p
          className={`${styles.feedback} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
      )}

      {!isFocusedCharacterTask && (
        <div
          style={{
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem'
          }}
        >
          <section className={styles.panel}>
            <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
              Manual Character
            </h2>
            <p className={styles.lead}>
              Start from scratch and build the profile yourself.
            </p>
            <div style={{marginTop: '0.75rem'}}>
              <button type='button' onClick={() => setCreationMode('manual')}>
                Create Manually
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
              Import Character
            </h2>
            <p className={styles.lead}>
              Bring in a long-form sheet, pasted notes, or a draft document and review it before save.
            </p>
            <div style={{marginTop: '0.75rem'}}>
              <button type='button' onClick={() => setCreationMode('import')}>
                Import Or Paste
              </button>
            </div>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
              AI-Assisted Draft
            </h2>
            <p className={styles.lead}>
              Describe the kind of character you want, then review the AI draft before it becomes canon.
            </p>
            <div style={{marginTop: '0.75rem'}}>
              <button type='button' onClick={() => setCreationMode('ai')}>
                Start With AI
              </button>
            </div>
          </section>
        </div>
      )}

      {isShowingImportWorkspace && !importDraft && (
        <section className={styles.panel} style={{marginBottom: '1.25rem'}}>
          <div style={{display: 'grid', gap: '0.75rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'}}>
              <div>
                <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
                  Import Character
                </h2>
                <p className={styles.lead}>
                  Import accepts long-form `.docx`, `.rtf`, or pasted text. The app extracts what it can,
                  then you review the result before saving.
                </p>
              </div>
              <button type='button' onClick={resetImportState} disabled={isImportingCharacterDoc}>
                Cancel
              </button>
            </div>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button
                type='button'
                onClick={() => importInputRef.current?.click()}
                disabled={isImportingCharacterDoc}
              >
                {isImportingCharacterDoc ? 'Importing...' : 'Import Character Doc'}
              </button>
              <input
                ref={importInputRef}
                type='file'
                accept='.docx,.rtf,.txt,.md,.markdown,.html,.htm,text/plain,text/rtf,application/rtf,application/x-rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                onChange={(event) => void handleImportCharacterFile(event)}
                style={{display: 'none'}}
              />
            </div>
            <textarea
              className={styles.softTextarea}
              value={pastedImportText}
              onChange={(event) => setPastedImportText(event.target.value)}
              rows={8}
              placeholder='Paste a character sheet or profile here to review it before import.'
              style={{width: '100%'}}
            />
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button type='button' onClick={handleStartPasteImport}>
                Review Pasted Text
              </button>
            </div>
          </div>
        </section>
      )}

      {isShowingAiWorkspace && (
        <section className={styles.panel} style={{marginBottom: '1.25rem'}}>
          <div style={{display: 'grid', gap: '0.75rem'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'}}>
              <div>
                <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
                  AI-Assisted Character Draft
                </h2>
                <p className={styles.lead}>
                  Start with your own premise, let AI draft the profile, then review and edit everything before saving.
                </p>
              </div>
              <button type='button' onClick={() => setCreationMode('idle')} disabled={isGeneratingCharacterDraft}>
                Cancel
              </button>
            </div>
            <textarea
              className={styles.softTextarea}
              value={characterCreationPrompt}
              onChange={(event) => setCharacterCreationPrompt(event.target.value)}
              rows={8}
              placeholder='Example: A disgraced court botanist in a storm-soaked fantasy city who secretly breeds poisons, wants redemption, and speaks with surgical precision.'
              style={{width: '100%'}}
            />
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button
                type='button'
                onClick={() => void handleGenerateCharacterDraft()}
                disabled={isGeneratingCharacterDraft}
              >
                {isGeneratingCharacterDraft ? 'Generating...' : 'Generate AI Draft'}
              </button>
              {characterCreationPrompt && (
                <button
                  type='button'
                  onClick={() => setCharacterCreationPrompt('')}
                  disabled={isGeneratingCharacterDraft}
                >
                  Clear Prompt
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {importDraft && (
        <section className={styles.panel} style={{marginBottom: '1.25rem'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'}}>
            <div>
              <h2 className={styles.panelTitle} style={{marginBottom: '0.35rem'}}>
                {reviewSourceLabel}
              </h2>
              <p className={styles.lead}>
                {reviewSourceLead}
              </p>
            </div>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              {importDraft.sourceKind !== 'ai' && (
                <button
                  type='button'
                  onClick={() => void handleAskImportAI()}
                  disabled={isAskingImportAI}
                >
                  {isAskingImportAI ? 'Thinking...' : 'Use AI To Suggest Mappings'}
                </button>
              )}
              <button type='button' onClick={resetImportState}>
                Cancel Review
              </button>
              <button type='button' onClick={() => void handleSaveImportedCharacter()}>
                {saveReviewLabel}
              </button>
            </div>
          </div>

          {importDraft.warnings.length > 0 && (
            <div className={styles.notice} style={{marginTop: '1rem'}}>
              {importDraft.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}
          {importAiNote && (
            <div className={styles.notice} style={{marginTop: '1rem'}}>
              {importAiNote}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.75rem',
              marginTop: '1rem'
            }}
          >
            <label className={styles.fieldLabel}>
              Name
              <input
                className={styles.softInput}
                type='text'
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Age
              <input
                className={styles.softInput}
                type='text'
                value={importAge}
                onChange={(event) => setImportAge(event.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Role
              <input
                className={styles.softInput}
                type='text'
                value={importRole}
                onChange={(event) => setImportRole(event.target.value)}
              />
            </label>
          </div>

          <div style={{marginTop: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Short Description
              <textarea
                className={styles.softTextarea}
                value={importDescription}
                onChange={(event) => setImportDescription(event.target.value)}
                rows={4}
              />
            </label>
          </div>

          <div style={{marginTop: '1rem', display: 'grid', gap: '0.85rem'}}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <strong>Detail Sections</strong>
              <button type='button' onClick={handleAddReviewSection}>
                Add Section
              </button>
            </div>
            {importSectionStates.map((section, index) => {
              const assistState = sectionAssistStates[section.id];
              return (
              <div
                key={`${section.id}-${index}`}
                style={{
                  padding: '0.9rem',
                  border: '1px solid var(--surface-border-soft)',
                  borderRadius: '14px',
                  background: 'var(--surface-panel-elevated)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '0.6rem'
                  }}
                >
                  <input
                    className={styles.softInput}
                    type='text'
                    value={section.title}
                    onChange={(event) =>
                      setImportSectionStates((prev) =>
                        prev.map((entry) =>
                          entry.id === section.id
                            ? {...entry, title: event.target.value}
                            : entry
                        )
                      )
                    }
                    style={{flex: 1, minWidth: '180px'}}
                  />
                  <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center'}}>
                    <button
                      type='button'
                      onClick={() => void handleAssistSection(section.id, 'expand')}
                      disabled={assistState?.isLoading}
                    >
                      {assistState?.isLoading && assistState.intent === 'expand' ? 'Working...' : 'Expand'}
                    </button>
                    <button
                      type='button'
                      onClick={() => void handleAssistSection(section.id, 'sharpen')}
                      disabled={assistState?.isLoading}
                    >
                      {assistState?.isLoading && assistState.intent === 'sharpen' ? 'Working...' : 'Sharpen'}
                    </button>
                    <button
                      type='button'
                      onClick={() => void handleAssistSection(section.id, 'tension')}
                      disabled={assistState?.isLoading}
                    >
                      {assistState?.isLoading && assistState.intent === 'tension' ? 'Working...' : 'Find tension'}
                    </button>
                    <select
                      className={styles.softSelect}
                      value={section.action}
                      onChange={(event) =>
                        setImportSectionStates((prev) =>
                          prev.map((entry) =>
                            entry.id === section.id
                              ? {
                                  ...entry,
                                  action: event.target.value as CharacterImportSectionAction
                                }
                              : entry
                          )
                        )
                      }
                    >
                      <option value='notes'>Keep in details</option>
                      <option value='description'>Add to short description</option>
                      <option value='later'>Review later</option>
                      <option value='ignore'>Ignore for now</option>
                    </select>
                  </div>
                </div>
                <textarea
                  className={styles.softTextarea}
                  value={section.content}
                  onChange={(event) =>
                    setImportSectionStates((prev) =>
                      prev.map((entry) =>
                        entry.id === section.id
                          ? {...entry, content: event.target.value}
                          : entry
                      )
                    )
                  }
                  rows={6}
                  style={{width: '100%'}}
                />
                {assistState?.suggestion && !assistState.isLoading && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.8rem',
                      border: '1px solid var(--surface-border-soft)',
                      borderRadius: '12px',
                      background: 'var(--surface-panel)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}
                    >
                      <strong>{getSectionAssistLabel(assistState.intent ?? 'sharpen')} suggestion</strong>
                      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                        <button
                          type='button'
                          onClick={() => {
                            setImportSectionStates((prev) =>
                              prev.map((entry) =>
                                entry.id === section.id
                                  ? {...entry, content: assistState.suggestion}
                                  : entry
                              )
                            );
                            setSectionAssistStates((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...prev[section.id],
                                suggestion: '',
                                note: ''
                              }
                            }));
                          }}
                        >
                          Replace section
                        </button>
                        <button
                          type='button'
                          onClick={() => {
                            setImportSectionStates((prev) =>
                              prev.map((entry) =>
                                entry.id === section.id
                                  ? {
                                      ...entry,
                                      content: entry.content.trim()
                                        ? `${entry.content.trim()}\n\n${assistState.suggestion}`
                                        : assistState.suggestion
                                    }
                                  : entry
                              )
                            );
                            setSectionAssistStates((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...prev[section.id],
                                suggestion: '',
                                note: ''
                              }
                            }));
                          }}
                        >
                          Append
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            setSectionAssistStates((prev) => ({
                              ...prev,
                              [section.id]: {
                                ...prev[section.id],
                                suggestion: '',
                                note: ''
                              }
                            }))
                          }
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    {assistState.note && (
                      <div
                        style={{
                          marginTop: '0.45rem',
                          fontSize: '0.9em',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
                        {assistState.note}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: '0.6rem',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--color-text-primary)'
                      }}
                    >
                      {assistState.suggestion}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div style={{marginTop: '1rem'}}>
            <label className={styles.fieldLabel}>
              {sourceResidueLabel}
              <textarea
                className={styles.softTextarea}
                value={importUnmatchedText}
                onChange={(event) => setImportUnmatchedText(event.target.value)}
                rows={5}
              />
            </label>
          </div>

          <div style={{marginTop: '1rem'}}>
            <label className={styles.fieldLabel}>
              Compiled Notes Preview
              <textarea className={styles.softTextarea} value={compiledImportNotes} readOnly rows={8} />
            </label>
          </div>

          <div className={styles.bottomActions}>
            <button type='button' onClick={resetImportState}>
              Cancel Review
            </button>
            <button type='button' onClick={() => void handleSaveImportedCharacter()}>
              {saveReviewLabel}
            </button>
          </div>
        </section>
      )}

      <div style={{display: 'flex', gap: '2rem', alignItems: 'flex-start'}}>
        {isShowingManualEditor && (
        <form onSubmit={handleSubmit} className={styles.formPanel}>
          <h2>{editingId ? 'Edit Character' : 'New Character'}</h2>

          <div className={styles.fieldGrid} style={{marginBottom: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Name *
              <input
                className={styles.softInput}
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              Age
              <input
                className={styles.softInput}
                type='text'
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Role
              <input
                className={styles.softInput}
                type='text'
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder='e.g., Protagonist, Mentor, Antagonist'
              />
            </label>
          </div>

          <div style={{marginBottom: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Description
              <textarea
                className={styles.softTextarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </label>
          </div>

          <div className={styles.fieldGrid} style={{marginBottom: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Dialogue Style
              <select
                className={styles.softSelect}
                value={characterStyleId}
                onChange={(e) => setCharacterStyleId(e.target.value)}
              >
                <option value=''>None</option>
                {settings?.characterStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Notes
              <textarea
                className={styles.softTextarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
              />
            </label>
          </div>

          {(editingImportedSections.length > 0 || !editingId) && (
            <div style={{marginBottom: '0.9rem', display: 'grid', gap: '0.75rem'}}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}
              >
                <strong>{editingId ? 'Imported Sections' : 'Additional Sections'}</strong>
                <button type='button' onClick={handleAddManualSection}>
                  Add Section
                </button>
              </div>
              {editingImportedSections.map((section, index) => {
                const assistKey = `${editingId ?? 'draft'}:${index}`;
                const assistState = editingSectionAssistStates[assistKey];
                return (
                  <div
                    key={section.id ?? `manual-section-${index}`}
                    className={styles.sectionCard}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}
                    >
                    <input
                      className={styles.softInput}
                      type='text'
                      value={section.title}
                        onChange={(event) =>
                          setEditingImportedSections((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index ? {...entry, title: event.target.value} : entry
                            )
                          )
                        }
                        style={{flex: 1, minWidth: '180px'}}
                      />
                      <button
                        type='button'
                        onClick={() => void handleAssistEditingSection(index, 'expand')}
                        disabled={assistState?.isLoading}
                      >
                        {assistState?.isLoading && assistState.intent === 'expand' ? 'Working...' : 'Expand'}
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleAssistEditingSection(index, 'sharpen')}
                        disabled={assistState?.isLoading}
                      >
                        {assistState?.isLoading && assistState.intent === 'sharpen' ? 'Working...' : 'Sharpen'}
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleAssistEditingSection(index, 'tension')}
                        disabled={assistState?.isLoading}
                      >
                        {assistState?.isLoading && assistState.intent === 'tension' ? 'Working...' : 'Find tension'}
                      </button>
                    <select
                      className={styles.softSelect}
                      value={section.action}
                        onChange={(event) =>
                          setEditingImportedSections((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    action: event.target.value as CharacterImportSectionAction
                                  }
                                : entry
                            )
                          )
                        }
                      >
                        <option value='notes'>Keep in details</option>
                        <option value='description'>Add to short description</option>
                        <option value='later'>Review later</option>
                        <option value='ignore'>Ignore for now</option>
                      </select>
                      <button
                        type='button'
                        onClick={() =>
                          setEditingImportedSections((prev) =>
                            prev.filter((_, entryIndex) => entryIndex !== index)
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  <textarea
                    className={styles.softTextarea}
                    value={section.content}
                      onChange={(event) =>
                        setEditingImportedSections((prev) =>
                          prev.map((entry, entryIndex) =>
                            entryIndex === index ? {...entry, content: event.target.value} : entry
                          )
                        )
                      }
                      rows={5}
                      style={{width: '100%'}}
                    />
                    {assistState?.suggestion && !assistState.isLoading && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.8rem',
                          border: '1px solid var(--surface-border-soft)',
                          borderRadius: '12px',
                          background: 'var(--surface-panel)'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            flexWrap: 'wrap',
                            alignItems: 'center'
                          }}
                        >
                          <strong>{getSectionAssistLabel(assistState.intent ?? 'sharpen')} suggestion</strong>
                          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                            <button
                              type='button'
                              onClick={() => {
                                setEditingImportedSections((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {...entry, content: assistState.suggestion}
                                      : entry
                                  )
                                );
                                setEditingSectionAssistStates((prev) => ({
                                  ...prev,
                                  [assistKey]: {
                                    ...prev[assistKey],
                                    suggestion: '',
                                    note: ''
                                  }
                                }));
                              }}
                            >
                              Replace section
                            </button>
                            <button
                              type='button'
                              onClick={() => {
                                setEditingImportedSections((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          content: entry.content.trim()
                                            ? `${entry.content.trim()}\n\n${assistState.suggestion}`
                                            : assistState.suggestion
                                        }
                                      : entry
                                  )
                                );
                                setEditingSectionAssistStates((prev) => ({
                                  ...prev,
                                  [assistKey]: {
                                    ...prev[assistKey],
                                    suggestion: '',
                                    note: ''
                                  }
                                }));
                              }}
                            >
                              Append
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                setEditingSectionAssistStates((prev) => ({
                                  ...prev,
                                  [assistKey]: {
                                    ...prev[assistKey],
                                    suggestion: '',
                                    note: ''
                                  }
                                }))
                              }
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                        {assistState.note && (
                          <div
                            style={{
                              marginTop: '0.45rem',
                              fontSize: '0.9em',
                              color: 'var(--color-text-secondary)'
                            }}
                          >
                            {assistState.note}
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: '0.6rem',
                            whiteSpace: 'pre-wrap',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                          {assistState.suggestion}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {editingId && (
            <div style={{marginBottom: '0.9rem'}}>
              <label className={styles.fieldLabel}>
                Source Residue
                <textarea
                  className={styles.softTextarea}
                  value={editingSourceResidue}
                  onChange={(event) => setEditingSourceResidue(event.target.value)}
                  rows={5}
                />
              </label>
            </div>
          )}

          <div
            style={{
              marginBottom: '1rem',
              padding: '0.9rem',
              border: '1px solid var(--surface-border-soft)',
              borderRadius: '14px',
              background: 'var(--surface-panel-elevated)',
              display: 'grid',
              gap: '0.75rem'
            }}
          >
            <div>
              <strong>Character Coach</strong>
              <p className={styles.lead} style={{marginTop: '0.35rem'}}>
                Ask the AI to spot missing dimensions, contradictions, weak motivations, or ways to make this character feel more complete. It suggests; you decide what to keep.
              </p>
            </div>
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button
                type='button'
                onClick={() =>
                  void handleAskCharacterCoach(
                    'What feels underdeveloped, vague, or generic in this character as currently written?',
                    {mode: 'gaps', replaceHistory: true}
                  )
                }
                disabled={isAskingCharacterCoach}
              >
                Find gaps
              </button>
              <button
                type='button'
                onClick={() =>
                  void handleAskCharacterCoach(
                    'What internal contradictions, tensions, blind spots, or pressure points are already latent in this character sheet?',
                    {mode: 'tension', replaceHistory: true}
                  )
                }
                disabled={isAskingCharacterCoach}
              >
                Find tension
              </button>
              <button
                type='button'
                onClick={() =>
                  void handleAskCharacterCoach(
                    'What concrete, character-specific details would make this person feel more lived-in on the page?',
                    {mode: 'texture', replaceHistory: true}
                  )
                }
                disabled={isAskingCharacterCoach}
              >
                Add texture
              </button>
            </div>
            <textarea
              className={styles.softTextarea}
              value={characterCoachInput}
              onChange={(event) => setCharacterCoachInput(event.target.value)}
              rows={3}
              placeholder='Ask about motivation, contradiction, voice, missing history, scene utility, relationships, or what still feels thin.'
            />
            <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
              <button
                type='button'
                onClick={() => void handleAskCharacterCoach()}
                disabled={isAskingCharacterCoach}
              >
                {isAskingCharacterCoach ? 'Thinking...' : 'Ask Character Coach'}
              </button>
              {characterCoachMessages.length > 0 && (
                <button
                  type='button'
                  onClick={() => setCharacterCoachMessages([])}
                  disabled={isAskingCharacterCoach}
                >
                  Clear Discussion
                </button>
              )}
            </div>
            {characterCoachMessages.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  maxHeight: '22rem',
                  overflowY: 'auto',
                  paddingRight: '0.25rem'
                }}
              >
                {characterCoachMessages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background:
                        message.role === 'assistant'
                          ? 'var(--surface-panel)'
                          : 'var(--surface-canvas)',
                      border: '1px solid var(--surface-border-soft)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginBottom: '0.35rem'
                      }}
                    >
                      {message.role === 'assistant' ? 'Character Coach' : 'You'}
                    </div>
                    <div style={{whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)'}}>
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button type='submit'>
              {editingId ? 'Save Changes' : 'Create Character'}
            </button>
            <button type='button' onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
        )}

        {!isFocusedCharacterTask && (
        <div style={{flex: 1}}>
          <h2>Character List</h2>
          {characters.length === 0 && (
            <p>
              No characters yet. Start with manual creation, import a long-form character doc, or generate an AI draft and review it before saving.
            </p>
          )}
          <ul style={{listStyle: 'none', padding: 0}}>
            {characters.map((character) => (
              <li
                key={character.id}
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  border: '1px solid var(--surface-border-soft)',
                  borderRadius: '12px',
                  background: 'var(--surface-panel-elevated)'
                }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                  <div style={{flex: 1}}>
                    <strong style={{fontSize: '1.2em'}}>{character.name}</strong>
                    <div style={{fontSize: '0.9em', color: 'var(--color-text-secondary)'}}>
                      {character.fields.role && <div>Role: {character.fields.role}</div>}
                      {character.characterStyleId && (
                        <div>Dialogue Style: {getStyleName(character.characterStyleId)}</div>
                      )}
                    </div>
                    {(character.description ||
                      character.fields.notes ||
                      importedSectionsForCharacter(character).length > 0) && (
                      <details style={{marginTop: '0.65rem'}}>
                        <summary style={{cursor: 'pointer'}}>Details</summary>
                        {character.description && (
                          <div style={{marginTop: '0.5rem'}}>
                            <strong>Profile Summary</strong>
                            <p
                              style={{
                                margin: '0.35rem 0 0',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {character.description}
                            </p>
                          </div>
                        )}
                        {importedSectionsForCharacter(character).length > 0 && (
                          <div style={{marginTop: '0.6rem', display: 'grid', gap: '0.5rem'}}>
                            <strong>Imported Sections</strong>
                            {importedSectionsForCharacter(character).map((section, index) => (
                              <div key={`${character.id}-${section.title}-${index}`}>
                                <div
                                  style={{
                                    fontSize: '0.88em',
                                    color: 'var(--color-text-secondary)'
                                  }}
                                >
                                  {section.title}
                                  {section.action === 'later' ? ' · review later' : ''}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.92em',
                                    color: 'var(--color-text-primary)',
                                    whiteSpace: 'pre-wrap'
                                  }}
                                >
                                  {section.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {character.fields.notes && (
                          <div style={{marginTop: '0.6rem'}}>
                            <strong>Source Residue</strong>
                            <div
                              style={{
                                marginTop: '0.35rem',
                                fontSize: '0.92em',
                                color: 'var(--color-text-secondary)',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {character.fields.notes}
                            </div>
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button
                      type='button'
                      onClick={() => handleCreateSheet(character)}
                      disabled={!canOpenSheets}
                      title={
                        canOpenSheets
                          ? 'Open the linked character sheet'
                          : 'Character sheets need a ruleset first'
                      }
                    >
                      {canOpenSheets ? 'Open Sheet' : 'Sheet Needs Ruleset'}
                    </button>
                    <button type='button' onClick={() => handleEdit(character)}>
                      Edit
                    </button>
                    <button type='button' onClick={() => void handleDelete(character.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>

      {settings && (
        <div
          style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid var(--surface-border-soft)'
          }}
        >
          <CharacterStyleList
            styles={settings.characterStyles}
            onUpdate={handleUpdateStyle}
            onDelete={handleDeleteStyle}
          />
        </div>
      )}
    </>
  );

  return embedded ? <>{content}</> : <section>{content}</section>;
}

export default CharactersRoute;

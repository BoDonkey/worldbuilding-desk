import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import type {Editor} from '@tiptap/core';
import type {
  Character,
  ChapterCard,
  ChapterCardStatus,
  EntityCategory,
  PlotPoint,
  ProgressionSnapshot,
  Project,
  ProjectMode,
  ProjectSettings
} from '../entityTypes';
import TipTapEditor from '../components/TipTapEditor';
import {getCharactersByProject} from '../characterStorage';
import {getCategoriesByProject} from '../categoryStorage';
import {getCorkboardBrainstormByProjectId, saveCorkboardBrainstorm} from '../corkboardBrainstormStorage';
import {getEntitiesByProject} from '../entityStorage';
import {LLMService} from '../services/llm/LLMService';
import {
  deleteChapterCard,
  getChapterCardsByProjectId,
  saveChapterCard
} from '../corkboardStorage';
import styles from '../styles/CorkboardRoute.module.css';
import {markdownToHtml} from '../utils/markdown';

interface CorkboardRouteProps {
  activeProject: Project | null;
  projectSettings?: ProjectSettings | null;
}

const EMPTY_FORM = {
  title: '',
  summary: '',
  status: 'planned' as ChapterCardStatus
};

const STATUS_LABELS: Record<ChapterCardStatus, string> = {
  planned: 'Planned',
  draft: 'Draft',
  written: 'Written'
};
const EMPTY_BRAINSTORM_CONTENT = '<p></p>';
type BrainstormScope = 'story' | 'chapter' | 'card';
type RightPanelView = 'structure' | 'ai';

const SCOPE_LABELS: Record<BrainstormScope, string> = {
  story: 'Story',
  chapter: 'Chapter',
  card: 'Card'
};
const SCOPE_OPTIONS: BrainstormScope[] = ['story', 'chapter', 'card'];

const normalizePlotPoint = (point: PlotPoint): PlotPoint => {
  if (point.title?.trim()) {
    return point;
  }
  const legacyText = point.text?.trim() ?? '';
  const titleSeed = legacyText.split('\n').find(Boolean)?.trim() || 'Untitled beat';
  return {
    ...point,
    title: titleSeed.slice(0, 72),
    notes: point.notes ?? legacyText
  };
};

const normalizeChapterCard = (card: ChapterCard): ChapterCard => ({
  ...card,
  plotPoints: (card.plotPoints ?? []).map(normalizePlotPoint)
});

const parseOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const plainTextToHtml = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<p></p>';
  }
  return trimmed
    .split(/\n{2,}/)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br />')}</p>`)
    .join('');
};

const appendHtmlBlock = (baseHtml: string, blockHtml: string): string => {
  const base = baseHtml.trim() || '<p></p>';
  if (base === '<p></p>') {
    return blockHtml;
  }
  return `${base}${blockHtml}`;
};

const getProjectModeLabel = (mode: ProjectMode) => {
  if (mode === 'general') return 'General Fiction';
  if (mode === 'game') return 'Game Systems';
  return 'LitRPG';
};

const htmlToPlainText = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();

const compactText = (value: string, limit = 180) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

function CorkboardRoute({
  activeProject,
  projectSettings = null
}: CorkboardRouteProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entities, setEntities] = useState<Array<{name: string; categoryName: string; summary: string}>>([]);
  const [chapterCards, setChapterCards] = useState<ChapterCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [brainstormScope, setBrainstormScope] = useState<BrainstormScope>('story');
  const [brainstormContent, setBrainstormContent] = useState(EMPTY_BRAINSTORM_CONTENT);
  const [selectedBrainstormText, setSelectedBrainstormText] = useState('');
  const [selectedAiText, setSelectedAiText] = useState('');
  const [brainstormStatus, setBrainstormStatus] = useState<
    'idle' | 'loading' | 'saving' | 'saved' | 'error'
  >('idle');
  const [brainstormCreatedAt, setBrainstormCreatedAt] = useState<number | null>(null);
  const [brainstormUpdatedAt, setBrainstormUpdatedAt] = useState<number | null>(null);
  const [title, setTitle] = useState(EMPTY_FORM.title);
  const [summary, setSummary] = useState(EMPTY_FORM.summary);
  const [status, setStatus] = useState<ChapterCardStatus>(EMPTY_FORM.status);
  const [progressionFocusCharacter, setProgressionFocusCharacter] = useState('');
  const [progressionLevel, setProgressionLevel] = useState('');
  const [progressionXp, setProgressionXp] = useState('');
  const [progressionNotable, setProgressionNotable] = useState('');
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [beatTitle, setBeatTitle] = useState('');
  const [beatNotes, setBeatNotes] = useState('');
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>('structure');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState<{
    scopeLabel: string;
    content: string;
  } | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const brainstormEditorRef = useRef<Editor | null>(null);
  const aiResultBodyRef = useRef<HTMLDivElement | null>(null);
  const lastSavedBrainstormContentRef = useRef(EMPTY_BRAINSTORM_CONTENT);
  const hydratedBrainstormProjectIdRef = useRef<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedCardId(null);
    setTitle(EMPTY_FORM.title);
    setSummary(EMPTY_FORM.summary);
    setStatus(EMPTY_FORM.status);
    setRightPanelView('structure');
    setProgressionFocusCharacter('');
    setProgressionLevel('');
    setProgressionXp('');
    setProgressionNotable('');
  }, []);

  const resetBeatForm = useCallback(() => {
    setEditingBeatId(null);
    setBeatTitle('');
    setBeatNotes('');
  }, []);

  const loadChapterCards = useCallback(async () => {
    if (!activeProject) {
      setChapterCards([]);
      resetForm();
      resetBeatForm();
      setSelectedBeatId(null);
      return;
    }
    const records = (await getChapterCardsByProjectId(activeProject.id)).map(normalizeChapterCard);
    setChapterCards(records);
    if (records.length === 0) {
      resetForm();
      resetBeatForm();
      setSelectedBeatId(null);
      return;
    }
    setSelectedCardId((prev) =>
      prev && records.some((card) => card.id === prev) ? prev : records[0].id
    );
  }, [activeProject, resetBeatForm, resetForm]);

  useEffect(() => {
    void loadChapterCards();
  }, [loadChapterCards]);

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setEntities([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [loadedCharacters, loadedEntities, loadedCategories] = await Promise.all([
          getCharactersByProject(activeProject.id),
          getEntitiesByProject(activeProject.id),
          getCategoriesByProject(activeProject.id)
        ]);
        if (cancelled) {
          return;
        }
        const categoryNameById = new Map<string, string>(
          loadedCategories.map((category: EntityCategory) => [category.id, category.name])
        );
        setCharacters(loadedCharacters);
        setEntities(
          loadedEntities.map((entity) => {
            const description = String(entity.fields.description ?? entity.fields.notes ?? '')
              .trim();
            const firstFieldValue = Object.entries(entity.fields)
              .find(([key, value]) => key !== 'description' && key !== 'notes' && String(value ?? '').trim())
              ?.[1];
            const summarySource =
              description || (firstFieldValue !== undefined ? String(firstFieldValue) : '');
            return {
              name: entity.name,
              categoryName: categoryNameById.get(entity.categoryId) ?? 'Entity',
              summary: compactText(summarySource, 160)
            };
          })
        );
      } catch {
        if (!cancelled) {
          setCharacters([]);
          setEntities([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setBrainstormContent(EMPTY_BRAINSTORM_CONTENT);
      setSelectedBrainstormText('');
      setBrainstormScope('story');
      setBrainstormCreatedAt(null);
      setBrainstormUpdatedAt(null);
      setBrainstormStatus('idle');
      hydratedBrainstormProjectIdRef.current = null;
      lastSavedBrainstormContentRef.current = EMPTY_BRAINSTORM_CONTENT;
      return;
    }

    let cancelled = false;
    setBrainstormStatus('loading');

    void (async () => {
      try {
        const brainstorm = await getCorkboardBrainstormByProjectId(activeProject.id);
        if (cancelled) {
          return;
        }
        const nextContent = brainstorm?.content || EMPTY_BRAINSTORM_CONTENT;
        setBrainstormContent(nextContent);
        setBrainstormCreatedAt(brainstorm?.createdAt ?? null);
        setBrainstormUpdatedAt(brainstorm?.updatedAt ?? null);
        lastSavedBrainstormContentRef.current = nextContent;
        hydratedBrainstormProjectIdRef.current = activeProject.id;
        setBrainstormStatus('idle');
      } catch {
        if (!cancelled) {
          setBrainstormStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      return;
    }
    if (hydratedBrainstormProjectIdRef.current !== activeProject.id) {
      return;
    }
    if (brainstormContent === lastSavedBrainstormContentRef.current) {
      return;
    }

    setBrainstormStatus('saving');
    const timeoutId = window.setTimeout(() => {
      const now = Date.now();
      void saveCorkboardBrainstorm({
        id: activeProject.id,
        projectId: activeProject.id,
        content: brainstormContent,
        createdAt: brainstormCreatedAt ?? now,
        updatedAt: now
      })
        .then(() => {
          lastSavedBrainstormContentRef.current = brainstormContent;
          setBrainstormCreatedAt((current) => current ?? now);
          setBrainstormUpdatedAt(now);
          setBrainstormStatus('saved');
        })
        .catch(() => {
          setBrainstormStatus('error');
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [activeProject, brainstormContent, brainstormCreatedAt]);

  const selectedCard = useMemo(
    () => chapterCards.find((card) => card.id === selectedCardId) ?? null,
    [chapterCards, selectedCardId]
  );
  const selectedBeat = useMemo(
    () => selectedCard?.plotPoints.find((point) => point.id === selectedBeatId) ?? null,
    [selectedBeatId, selectedCard]
  );
  const showProgressionSnapshot = projectSettings?.projectMode !== 'general';
  const activeProjectMode = projectSettings?.projectMode ?? 'litrpg';

  const updateSelectedBrainstormText = useCallback(() => {
    const editor = brainstormEditorRef.current;
    if (!editor) {
      setSelectedBrainstormText('');
      return;
    }
    const {from, to} = editor.state.selection;
    if (from === to) {
      setSelectedBrainstormText('');
      return;
    }
    const next = editor.state.doc.textBetween(from, to, '\n').trim();
    setSelectedBrainstormText(next);
  }, []);

  useEffect(() => {
    const editor = brainstormEditorRef.current;
    if (!editor) {
      return;
    }

    const syncSelection = () => {
      updateSelectedBrainstormText();
    };

    editor.on('selectionUpdate', syncSelection);
    editor.on('transaction', syncSelection);
    syncSelection();

    return () => {
      editor.off('selectionUpdate', syncSelection);
      editor.off('transaction', syncSelection);
    };
  }, [brainstormContent, updateSelectedBrainstormText]);

  useEffect(() => {
    setSelectedAiText('');
  }, [aiResult]);

  const brainstormSaveLabel = useMemo(() => {
    if (!activeProject) {
      return 'Select a project to use the brainstorm document.';
    }
    if (brainstormStatus === 'loading') {
      return 'Loading brainstorm document...';
    }
    if (brainstormStatus === 'saving') {
      return 'Saving brainstorm document...';
    }
    if (brainstormStatus === 'saved') {
      return 'Brainstorm saved.';
    }
    if (brainstormStatus === 'error') {
      return 'Save failed. Keep editing to retry.';
    }
    if (brainstormUpdatedAt) {
      return `Last updated ${new Date(brainstormUpdatedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })}.`;
    }
    return 'Autosaves to this project only.';
  }, [activeProject, brainstormStatus, brainstormUpdatedAt]);

  const brainstormWordCount = useMemo(() => {
    const text = htmlToPlainText(brainstormContent);
    if (!text) {
      return 0;
    }
    return text.split(/\s+/).filter(Boolean).length;
  }, [brainstormContent]);

  const scopeDescription = useMemo(() => {
    if (brainstormScope === 'story') {
      return 'Story scope treats this as whole-book planning context.';
    }
    if (!selectedCard) {
      return `${SCOPE_LABELS[brainstormScope]} scope needs a selected chapter card.`;
    }
    if (brainstormScope === 'chapter') {
      return `Chapter scope is anchored to "${selectedCard.title}".`;
    }
    if (!selectedBeat) {
      return 'Card scope needs a selected beat inside the current chapter.';
    }
    return `Card scope is anchored to beat "${selectedBeat.title}" in "${selectedCard.title}".`;
  }, [brainstormScope, selectedBeat, selectedCard]);

  const chapterCardSummary = useMemo(
    () =>
      chapterCards
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((card, index) => {
          const beatList = card.plotPoints
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((point) => `- ${point.title}${point.notes ? `: ${point.notes}` : ''}`)
            .join('\n');
          const progression = card.progressionSnapshot
            ? [
                card.progressionSnapshot.focusCharacter
                  ? `focus=${card.progressionSnapshot.focusCharacter}`
                  : null,
                card.progressionSnapshot.level !== undefined
                  ? `level=${card.progressionSnapshot.level}`
                  : null,
                card.progressionSnapshot.xp !== undefined
                  ? `xp=${card.progressionSnapshot.xp}`
                  : null,
                card.progressionSnapshot.notable?.length
                  ? `notable=${card.progressionSnapshot.notable.join(', ')}`
                  : null
              ]
                .filter(Boolean)
                .join('; ')
            : '';
          return [
            `Chapter ${index + 1}: ${card.title} [${card.status}]`,
            card.summary ? `Summary: ${card.summary}` : null,
            progression ? `Progression: ${progression}` : null,
            beatList ? `Beats:\n${beatList}` : null
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n'),
    [chapterCards]
  );

  const canonicalContextSummary = useMemo(() => {
    const contextHaystack = [
      htmlToPlainText(brainstormContent),
      selectedBrainstormText,
      selectedCard?.title ?? '',
      selectedCard?.summary ?? '',
      selectedBeat?.title ?? '',
      selectedBeat?.notes ?? ''
    ]
      .join(' ')
      .toLowerCase();

    const scoreNameMatch = (name: string) =>
      contextHaystack.includes(name.toLowerCase()) ? 1 : 0;

    const characterSummaries = characters
      .map((character) => {
        const parts = [
          character.fields.role ? `role=${String(character.fields.role)}` : null,
          character.fields.age ? `age=${String(character.fields.age)}` : null,
          character.description ? compactText(character.description, 120) : null,
          character.fields.notes ? compactText(String(character.fields.notes), 120) : null
        ].filter(Boolean);
        return {
          name: character.name,
          score: scoreNameMatch(character.name),
          summary: `Character: ${character.name}${parts.length ? ` (${parts.join('; ')})` : ''}`
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 6)
      .map((entry) => entry.summary);

    const entitySummaries = entities
      .map((entity) => ({
        ...entity,
        score: scoreNameMatch(entity.name)
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 8)
      .map(
        (entity) =>
          `${entity.categoryName}: ${entity.name}${entity.summary ? ` (${entity.summary})` : ''}`
      );

    return {
      characters: characterSummaries,
      entities: entitySummaries
    };
  }, [
    brainstormContent,
    characters,
    entities,
    selectedBeat?.notes,
    selectedBeat?.title,
    selectedBrainstormText,
    selectedCard?.summary,
    selectedCard?.title
  ]);

  const buildScopedAIPrompt = useCallback(() => {
    const userAsk =
      aiPrompt.trim() ||
      'Review the current plan and suggest concrete next moves, missing beats, and continuity risks.';
    const selectionContext = selectedBrainstormText.trim()
      ? `Selected brainstorm text:\n${selectedBrainstormText.trim()}`
      : '';
    const brainstormExcerpt = htmlToPlainText(brainstormContent).slice(0, 5000);

    const shared = [
      `Project mode: ${getProjectModeLabel(activeProjectMode)}`,
      `Scope: ${SCOPE_LABELS[brainstormScope]}`,
      brainstormExcerpt
        ? `Current brainstorm notes (may include rough, speculative, or contradictory ideas; treat them as working notes, not confirmed canon):\n${brainstormExcerpt}`
        : 'Brainstorm document is currently empty.',
      canonicalContextSummary.characters.length
        ? `Relevant character context:\n${canonicalContextSummary.characters.join('\n')}`
        : 'No character context available.',
      canonicalContextSummary.entities.length
        ? `Relevant world bible context:\n${canonicalContextSummary.entities.join('\n')}`
        : 'No world bible context available.',
      selectionContext
    ]
      .filter(Boolean)
      .join('\n\n');

    if (brainstormScope === 'story') {
      return [
        shared,
        chapterCardSummary
          ? `Current chapter outline (also provisional):\n${chapterCardSummary}`
          : 'No chapter cards yet.',
        `Author request:\n${userAsk}`
      ].join('\n\n');
    }

    if (!selectedCard) {
      return [
        shared,
        'No chapter card is currently selected, so fall back to story-level advice.',
        chapterCardSummary
          ? `Current chapter outline (also provisional):\n${chapterCardSummary}`
          : 'No chapter cards yet.',
        `Author request:\n${userAsk}`
      ].join('\n\n');
    }

    const selectedCardSummary = [
      `Selected chapter: ${selectedCard.title} [${selectedCard.status}]`,
      selectedCard.summary ? `Summary: ${selectedCard.summary}` : null,
      selectedCard.plotPoints.length
        ? `Beats:\n${selectedCard.plotPoints
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((point) => `- ${point.title}${point.notes ? `: ${point.notes}` : ''}`)
            .join('\n')}`
        : 'No beats yet.'
    ]
      .filter(Boolean)
      .join('\n');

    return [
      shared,
      selectedCardSummary,
      brainstormScope === 'card'
        ? selectedBeat
          ? [
              `Selected beat: ${selectedBeat.title}`,
              selectedBeat.notes ? `Beat notes: ${selectedBeat.notes}` : null,
              'Focus on the selected beat specifically. Stay concrete, local, and beat-level.'
            ]
              .filter(Boolean)
              .join('\n')
          : 'No beat is selected, so explain that card-level analysis is limited and do not pretend a specific beat was chosen.'
        : 'Focus on the selected chapter while considering its role in the wider outline.',
      `Author request:\n${userAsk}`
    ].join('\n\n');
  }, [
    activeProjectMode,
    aiPrompt,
    brainstormContent,
    brainstormScope,
    canonicalContextSummary.characters,
    canonicalContextSummary.entities,
    chapterCardSummary,
    selectedBeat,
    selectedBrainstormText,
    selectedCard
  ]);

  const handleAskAI = async () => {
    if (!projectSettings?.aiSettings) {
      setAiError('AI provider is not configured. Add an API key in Settings.');
      return;
    }

    setIsAskingAI(true);
    setAiError(null);
    setFeedback(null);
    setRightPanelView('ai');

    try {
      const llmService = new LLMService(projectSettings.aiSettings);
      const prompt = buildScopedAIPrompt();
      const systemPrompt = [
        'You are a planning assistant for a fiction story corkboard.',
        'Answer the user\'s direct question first.',
        'If the user asks a general craft question, answer it generally and do not overfit to provisional project notes.',
        'Treat brainstorm notes and chapter outlines as tentative working material, not confirmed canon or endorsed plot decisions.',
        'Do not restate a speculative note as if it is automatically a good idea, a true fact, or an accepted twist.',
        'Only apply the answer specifically to the current corkboard when the user clearly asks for project-specific analysis or when project context is directly relevant.',
        'When project context is relevant, keep it in a clearly labeled secondary section such as "Applied To Current Corkboard".',
        'Be willing to say a trope is common, risky, clichéd, or workable depending on execution.',
        'Respond with concise, high-signal planning guidance.',
        'Prefer sections titled: Direct Answer, Why It Works or Fails, Risks, Applied To Current Corkboard.',
        'If the project mode is General Fiction, avoid game-system assumptions.',
        'If the project mode is LitRPG or Game Systems, you may mention progression pacing, milestone timing, acquisitions, and system continuity when relevant.'
      ].join(' ');

      const response = await llmService.complete({
        messages: [{role: 'user', content: prompt}],
        systemPrompt,
        maxTokens: projectSettings.aiSettings.inspectorSettings?.maxResponseTokens
      });

      const label =
        brainstormScope === 'story'
          ? 'Story Scope'
          : brainstormScope === 'chapter'
            ? `Chapter Scope${selectedCard ? `: ${selectedCard.title}` : ''}`
            : `Card Scope${selectedBeat ? `: ${selectedBeat.title}` : ''}`;
      setAiResult({
        scopeLabel: label,
        content: response.content
      });
      setFeedback({tone: 'success', message: 'AI planning note is ready to review.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate corkboard AI note.';
      setAiError(message);
    } finally {
      setIsAskingAI(false);
    }
  };

  const getNormalizedPromotedText = (value?: string) => (value ?? selectedBrainstormText).trim();

  const handleInsertTextIntoBrainstorm = (value?: string) => {
    const contentToInsert = getNormalizedPromotedText(value);
    if (!contentToInsert) {
      return;
    }
    setBrainstormContent((prev) => appendHtmlBlock(prev, plainTextToHtml(contentToInsert)));
    setFeedback({tone: 'success', message: 'Selected text inserted into the brainstorm document.'});
  };

  useEffect(() => {
    if (!selectedCard) {
      setTitle(EMPTY_FORM.title);
      setSummary(EMPTY_FORM.summary);
      setStatus(EMPTY_FORM.status);
      setProgressionFocusCharacter('');
      setProgressionLevel('');
      setProgressionXp('');
      setProgressionNotable('');
      resetBeatForm();
      return;
    }
    setTitle(selectedCard.title);
    setSummary(selectedCard.summary);
    setStatus(selectedCard.status);
    setProgressionFocusCharacter(selectedCard.progressionSnapshot?.focusCharacter ?? '');
    setProgressionLevel(
      selectedCard.progressionSnapshot?.level !== undefined
        ? String(selectedCard.progressionSnapshot.level)
        : ''
    );
    setProgressionXp(
      selectedCard.progressionSnapshot?.xp !== undefined
        ? String(selectedCard.progressionSnapshot.xp)
        : ''
    );
    setProgressionNotable(
      selectedCard.progressionSnapshot?.notable?.join('\n') ?? ''
    );
    resetBeatForm();
    setSelectedBeatId((prev) =>
      prev && selectedCard.plotPoints.some((point) => point.id === prev) ? prev : null
    );
  }, [resetBeatForm, selectedCard]);

  const persistChapterCard = useCallback(
    async (card: ChapterCard, successMessage: string) => {
      await saveChapterCard(card);
      await loadChapterCards();
      setSelectedCardId(card.id);
      setFeedback({tone: 'success', message: successMessage});
    },
    [loadChapterCards]
  );

  const buildProgressionSnapshot = (): ProgressionSnapshot | undefined => {
    const focusCharacter = progressionFocusCharacter.trim();
    const level = parseOptionalNumber(progressionLevel);
    const xp = parseOptionalNumber(progressionXp);
    const notable = progressionNotable
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!focusCharacter && level === undefined && xp === undefined && notable.length === 0) {
      return undefined;
    }

    return {
      focusCharacter: focusCharacter || undefined,
      level,
      xp,
      notable: notable.length > 0 ? notable : undefined
    };
  };

  const handlePromoteTextToNewChapter = async (value?: string) => {
    if (!activeProject) {
      return;
    }
    const promotedText = getNormalizedPromotedText(value);
    if (!promotedText) {
      setFeedback({tone: 'error', message: 'Select brainstorm text to promote first.'});
      return;
    }

    setFeedback(null);
    try {
      const now = Date.now();
      const titleSeed = promotedText.split('\n').find(Boolean)?.trim() ?? 'New chapter';
      const nextCard: ChapterCard = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        title: titleSeed.slice(0, 72),
        summary: promotedText,
        status: 'planned',
        order: chapterCards.length > 0 ? Math.max(...chapterCards.map((card) => card.order)) + 1 : 1,
        progressionSnapshot: undefined,
        plotPoints: [],
        createdAt: now,
        updatedAt: now
      };
      await persistChapterCard(nextCard, 'Selection promoted to a new chapter.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to promote selection to a chapter.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleAppendTextToSummary = async (value?: string) => {
    const promotedText = getNormalizedPromotedText(value);
    if (!selectedCard || !promotedText) {
      setFeedback({
        tone: 'error',
        message: !selectedCard
          ? 'Select a chapter card before appending brainstorm text.'
          : 'Select brainstorm text to append first.'
      });
      return;
    }

    setFeedback(null);
    try {
      const nextCard: ChapterCard = {
        ...selectedCard,
        summary: selectedCard.summary
          ? `${selectedCard.summary}\n\n${promotedText}`
          : promotedText,
        updatedAt: Date.now()
      };
      await persistChapterCard(nextCard, 'Selection appended to chapter summary.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to append selection to summary.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleAddTextAsPlotPoint = async (value?: string) => {
    const promotedText = getNormalizedPromotedText(value);
    if (!selectedCard || !promotedText) {
      setFeedback({
        tone: 'error',
        message: !selectedCard
          ? 'Select a chapter card before adding a plot point.'
          : 'Select brainstorm text to promote first.'
      });
      return;
    }

    setFeedback(null);
    try {
      const now = Date.now();
      const nextCard: ChapterCard = {
        ...selectedCard,
        plotPoints: [
          ...selectedCard.plotPoints,
          {
            id: crypto.randomUUID(),
            chapterCardId: selectedCard.id,
            title: (promotedText.split('\n').find(Boolean)?.trim() || 'New beat').slice(0, 72),
            notes: promotedText,
            order:
              selectedCard.plotPoints.length > 0
                ? Math.max(...selectedCard.plotPoints.map((point) => point.order)) + 1
                : 1,
            createdAt: now,
            updatedAt: now
          }
        ],
        updatedAt: now
      };
      await persistChapterCard(nextCard, 'Selection added as a plot point.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create plot point.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleDeletePlotPoint = async (plotPointId: string) => {
    if (!selectedCard) {
      return;
    }

    setFeedback(null);
    try {
      const nextCard: ChapterCard = {
        ...selectedCard,
        plotPoints: selectedCard.plotPoints
          .filter((point) => point.id !== plotPointId)
          .map((point, index) => ({
            ...point,
            order: index + 1,
            updatedAt: Date.now()
          })),
        updatedAt: Date.now()
      };
      await persistChapterCard(nextCard, 'Plot point removed.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to remove plot point.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleEditPlotPoint = (point: PlotPoint) => {
    setEditingBeatId(point.id);
    setSelectedBeatId(point.id);
    setBeatTitle(point.title);
    setBeatNotes(point.notes ?? point.text ?? '');
  };

  const handleSaveBeat = async () => {
    if (!selectedCard || !beatTitle.trim()) {
      setFeedback({
        tone: 'error',
        message: !selectedCard
          ? 'Select a chapter card before saving a beat.'
          : 'Beat title is required.'
      });
      return;
    }

    setFeedback(null);
    try {
      const now = Date.now();
      const existingBeat = selectedCard.plotPoints.find((point) => point.id === editingBeatId);
      const nextBeat: PlotPoint = {
        id: existingBeat?.id ?? crypto.randomUUID(),
        chapterCardId: selectedCard.id,
        title: beatTitle.trim(),
        notes: beatNotes.trim() || undefined,
        order:
          existingBeat?.order ??
          (selectedCard.plotPoints.length > 0
            ? Math.max(...selectedCard.plotPoints.map((point) => point.order)) + 1
            : 1),
        createdAt: existingBeat?.createdAt ?? now,
        updatedAt: now
      };

      const remainingBeats = selectedCard.plotPoints.filter(
        (point) => point.id !== nextBeat.id
      );
      const nextCard: ChapterCard = {
        ...selectedCard,
        plotPoints: [...remainingBeats, nextBeat].sort((a, b) => a.order - b.order),
        updatedAt: now
      };
      await persistChapterCard(
        nextCard,
        existingBeat ? 'Beat updated.' : 'Beat added.'
      );
      resetBeatForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save beat.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !title.trim()) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const existing = selectedCard;
      const nextOrder =
        existing?.order ?? (chapterCards.length > 0 ? Math.max(...chapterCards.map((card) => card.order)) + 1 : 1);
      const nextCard: ChapterCard = {
        id: existing?.id ?? crypto.randomUUID(),
        projectId: activeProject.id,
        title: title.trim(),
        summary: summary.trim(),
        status,
        order: nextOrder,
        progressionSnapshot: buildProgressionSnapshot(),
        plotPoints: existing?.plotPoints ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };

      await saveChapterCard(nextCard);
      await loadChapterCards();
      setSelectedCardId(nextCard.id);
      setFeedback({
        tone: 'success',
        message: existing ? 'Chapter updated.' : 'Chapter added.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save chapter card.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (card: ChapterCard) => {
    const confirmed = window.confirm(`Delete chapter "${card.title}"?`);
    if (!confirmed) return;

    setDeletingCardId(card.id);
    setFeedback(null);
    try {
      await deleteChapterCard(card.id);
      await loadChapterCards();
      setFeedback({tone: 'success', message: 'Chapter deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete chapter card.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingCardId(null);
    }
  };

  const updateSelectedAiText = useCallback(() => {
    const container = aiResultBodyRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedAiText('');
      return;
    }

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;
    const withinContainer =
      commonNode instanceof Node &&
      (commonNode === container || container.contains(commonNode));

    if (!withinContainer) {
      setSelectedAiText('');
      return;
    }

    setSelectedAiText(selection.toString().trim());
  }, []);

  if (!activeProject) {
    return (
      <section className={styles.container}>
        <div className={styles.emptyState}>
          <h2 className={styles.pageTitle}>Story Corkboard</h2>
          <p className={styles.emptyText}>
            Select a project to start outlining chapters in the corkboard.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Story Corkboard</h2>
          <p className={styles.pageSubtitle}>
            A project-level planning board with a shared brainstorm document and
            chapter outline cards.
          </p>
        </div>
        <button type='button' onClick={resetForm}>
          New Chapter
        </button>
      </header>

      {feedback && (
        <div
          className={`${styles.feedbackBanner} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          <span>{feedback.message}</span>
          <button type='button' className={styles.feedbackDismiss} onClick={() => setFeedback(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.scopeHeader}>
        <div className={styles.scopeHeaderMain}>
          <div className={styles.scopeHeaderLabel}>Planning Scope</div>
          <div className={styles.scopeRow}>
            {SCOPE_OPTIONS.map((scope) => (
              <button
                key={scope}
                type='button'
                className={`${styles.scopeButton} ${
                  brainstormScope === scope ? styles.scopeButtonActive : ''
                }`}
                onClick={() => setBrainstormScope(scope)}
              >
                {SCOPE_LABELS[scope]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.scopeSummary}>{scopeDescription}</div>
      </div>

      <div className={styles.layout}>
        <section className={styles.brainstormPanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelEyebrow}>Brainstorm Workspace</div>
              <h3 className={styles.panelTitle}>Brainstorm Document</h3>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.brainstormMetaRow}>
                <span className={styles.brainstormStatus}>{brainstormSaveLabel}</span>
                <span className={styles.brainstormStatus}>
                  {brainstormWordCount} {brainstormWordCount === 1 ? 'word' : 'words'}
                </span>
              </div>
              <button type='button' onClick={() => setRightPanelView('ai')}>
                Ask AI
              </button>
            </div>
          </div>
          <div className={styles.brainstormScrollRegion}>
            <p className={styles.panelText}>
              Use this document to sketch beats, arcs, questions, and loose scene ideas
              before turning them into structured chapter cards.
            </p>
            <div className={styles.brainstormEditor}>
              <TipTapEditor
                content={brainstormContent}
                onChange={setBrainstormContent}
                onEditorReady={(editor) => {
                  brainstormEditorRef.current = editor;
                  updateSelectedBrainstormText();
                }}
                toolbarMode='basic'
              />
            </div>
            {selectedBrainstormText.trim() && (
              <div className={styles.selectionActionBar}>
                <div className={styles.selectionActionText}>
                  {`Selected: "${selectedBrainstormText.slice(0, 140)}${
                    selectedBrainstormText.length > 140 ? '...' : ''
                  }"`}
                </div>
                <div className={styles.selectionActionButtons}>
                  <button
                    type='button'
                    onClick={() => void handlePromoteTextToNewChapter()}
                  >
                    New Chapter
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleAppendTextToSummary()}
                    disabled={!selectedCard}
                  >
                    Append Summary
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleAddTextAsPlotPoint()}
                    disabled={!selectedCard}
                  >
                    Add Beat
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={styles.chapterPanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelEyebrow}>
                {rightPanelView === 'ai' ? 'Corkboard AI' : 'Chapter Outline'}
              </div>
              <h3 className={styles.panelTitle}>
                {rightPanelView === 'ai' ? 'AI Review' : 'Structure'}
              </h3>
            </div>
            <div className={styles.panelViewTabs}>
              <button
                type='button'
                className={rightPanelView === 'structure' ? styles.panelViewTabActive : ''}
                onClick={() => setRightPanelView('structure')}
              >
                Structure
              </button>
              <button
                type='button'
                className={rightPanelView === 'ai' ? styles.panelViewTabActive : ''}
                onClick={() => setRightPanelView('ai')}
              >
                AI
              </button>
            </div>
          </div>
          <div className={styles.chapterScrollRegion}>
            {rightPanelView === 'ai' ? (
              <div className={styles.aiSidePanel}>
                <div className={styles.aiPromptCard}>
                  <label className={styles.field}>
                    <span>Ask AI</span>
                    <textarea
                      value={aiPrompt}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setAiPrompt(event.target.value)
                      }
                      placeholder='What should the assistant analyze or suggest for this scope?'
                      rows={4}
                    />
                  </label>
                  <div className={styles.aiPromptActions}>
                    <button type='button' onClick={() => setAiPrompt('')}>
                      Clear Prompt
                    </button>
                    <button
                      type='button'
                      onClick={() => void handleAskAI()}
                      disabled={isAskingAI || (brainstormScope === 'card' && !selectedBeat)}
                    >
                      {isAskingAI ? 'Asking AI...' : 'Ask AI'}
                    </button>
                  </div>
                  {aiError && <div className={styles.aiError}>{aiError}</div>}
                </div>
                {aiResult ? (
                  <div className={styles.aiResultCard}>
                    <div className={styles.aiResultHeader}>
                      <div>
                        <div className={styles.panelEyebrow}>AI Result</div>
                        <div className={styles.aiResultScope}>{aiResult.scopeLabel}</div>
                      </div>
                      <div className={styles.aiResultActions}>
                        <button type='button' onClick={() => setAiResult(null)}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <div
                      ref={aiResultBodyRef}
                      className={styles.aiResultBody}
                      onMouseUp={updateSelectedAiText}
                      onKeyUp={updateSelectedAiText}
                      dangerouslySetInnerHTML={{__html: markdownToHtml(aiResult.content)}}
                    />
                    {selectedAiText ? (
                      <div className={styles.selectionActionBar}>
                        <div className={styles.selectionActionText}>
                          {`Selected: "${selectedAiText.slice(0, 140)}${
                            selectedAiText.length > 140 ? '...' : ''
                          }"`}
                        </div>
                        <div className={styles.selectionActionButtons}>
                          <button
                            type='button'
                            onClick={() => handleInsertTextIntoBrainstorm(selectedAiText)}
                          >
                            Insert
                          </button>
                          <button
                            type='button'
                            onClick={() => void handlePromoteTextToNewChapter(selectedAiText)}
                          >
                            New Chapter
                          </button>
                          <button
                            type='button'
                            onClick={() => void handleAppendTextToSummary(selectedAiText)}
                            disabled={!selectedCard}
                          >
                            Append Summary
                          </button>
                          <button
                            type='button'
                            onClick={() => void handleAddTextAsPlotPoint(selectedAiText)}
                            disabled={!selectedCard}
                          >
                            Add Beat
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={styles.listEmpty}>
                    Ask AI about the current story, chapter, or selected beat. Results stay here until you choose to insert them.
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.chapterShell}>
            <aside className={styles.chapterList}>
              <div className={styles.listHeader}>
                <h3 className={styles.panelTitle}>Chapters</h3>
                <span className={styles.countChip}>{chapterCards.length}</span>
              </div>
              {chapterCards.length === 0 ? (
                <div className={styles.listEmpty}>
                  No chapter cards yet. Start with a title and a short summary.
                </div>
              ) : (
                chapterCards.map((card, index) => (
                  <button
                    key={card.id}
                    type='button'
                    className={`${styles.chapterListItem} ${
                      selectedCardId === card.id ? styles.chapterListItemActive : ''
                    }`}
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setSelectedBeatId(null);
                    }}
                  >
                    <div className={styles.chapterListItemTop}>
                      <span className={styles.chapterOrder}>Ch {index + 1}</span>
                      <span
                        className={`${styles.statusChip} ${
                          styles[`statusChip${STATUS_LABELS[card.status]}`]
                        }`}
                      >
                        {STATUS_LABELS[card.status]}
                      </span>
                    </div>
                    <strong className={styles.chapterTitle}>{card.title}</strong>
                    <span className={styles.chapterSummary}>
                      {card.summary || 'No summary yet.'}
                    </span>
                  </button>
                ))
              )}
            </aside>

            <form className={styles.editorCard} onSubmit={handleSubmit}>
              <div className={styles.editorHeader}>
                <div>
                  <div className={styles.panelEyebrow}>
                    {selectedCard ? 'Edit Chapter' : 'Add Chapter'}
                  </div>
                  <h3 className={styles.panelTitle}>
                    {selectedCard ? selectedCard.title : 'New chapter card'}
                  </h3>
                </div>
                {selectedCard && (
                  <button
                    type='button'
                    onClick={() => void handleDelete(selectedCard)}
                    disabled={deletingCardId === selectedCard.id}
                  >
                    {deletingCardId === selectedCard.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>

              <label className={styles.field}>
                <span>Title</span>
                <input
                  type='text'
                  value={title}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setTitle(event.target.value)
                  }
                  placeholder='Chapter title'
                />
              </label>

              <label className={styles.field}>
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setStatus(event.target.value as ChapterCardStatus)
                  }
                >
                  <option value='planned'>Planned</option>
                  <option value='draft'>Draft</option>
                  <option value='written'>Written</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>Summary</span>
                <textarea
                  value={summary}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setSummary(event.target.value)
                  }
                  placeholder='What happens in this chapter?'
                  rows={6}
                />
              </label>

              {showProgressionSnapshot && (
                <div className={styles.progressionSection}>
                  <div className={styles.progressionHeader}>
                    <div className={styles.panelEyebrow}>Progression Snapshot</div>
                    <span className={styles.progressionHint}>
                      Track stat gains, XP, or major acquisitions for this chapter.
                    </span>
                  </div>
                  <div className={styles.progressionGrid}>
                    <label className={styles.field}>
                      <span>Focus Character</span>
                      <input
                        type='text'
                        value={progressionFocusCharacter}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setProgressionFocusCharacter(event.target.value)
                        }
                        placeholder='Optional for now'
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Level</span>
                      <input
                        type='number'
                        value={progressionLevel}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setProgressionLevel(event.target.value)
                        }
                        placeholder='e.g. 12'
                      />
                    </label>
                    <label className={styles.field}>
                      <span>XP</span>
                      <input
                        type='number'
                        value={progressionXp}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setProgressionXp(event.target.value)
                        }
                        placeholder='e.g. 4200'
                      />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span>Notable Gains / Acquisitions</span>
                    <textarea
                      value={progressionNotable}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                        setProgressionNotable(event.target.value)
                      }
                      placeholder={'One per line, e.g.\nLearned Fireball II\nRecovered the jade key\nUnlocked faction dossier'}
                      rows={4}
                    />
                  </label>
                </div>
              )}

              <div className={styles.metaRow}>
                <span>
                  Beats: <strong>{selectedCard?.plotPoints.length ?? 0}</strong>
                </span>
                <span>
                  Active scope: <strong>{SCOPE_LABELS[brainstormScope]}</strong>
                </span>
              </div>

              {selectedCard && (
                <div className={styles.plotPointSection}>
                  <div className={styles.plotPointHeader}>
                    <div className={styles.panelEyebrow}>Beats</div>
                    <span className={styles.countChip}>{selectedCard.plotPoints.length}</span>
                  </div>
                  <div className={styles.beatEditor}>
                    <label className={styles.field}>
                      <span>Beat Title</span>
                      <input
                        type='text'
                        value={beatTitle}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setBeatTitle(event.target.value)
                        }
                        placeholder='Beat title'
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Beat Notes</span>
                      <textarea
                        value={beatNotes}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                          setBeatNotes(event.target.value)
                        }
                        placeholder='Optional context or more detail'
                        rows={3}
                      />
                    </label>
                    <div className={styles.beatEditorActions}>
                      <button type='button' onClick={resetBeatForm}>
                        Clear Beat
                      </button>
                      <button
                        type='button'
                        onClick={() => void handleSaveBeat()}
                        disabled={!beatTitle.trim()}
                      >
                        {editingBeatId ? 'Save Beat' : 'Add Beat'}
                      </button>
                    </div>
                  </div>
                  {selectedCard.plotPoints.length === 0 ? (
                    <div className={styles.listEmpty}>
                      No beats yet. Promote selected brainstorm text or add one manually.
                    </div>
                  ) : (
                    <ul className={styles.plotPointList}>
                      {selectedCard.plotPoints
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((point, index) => (
                          <li
                            key={point.id}
                            className={`${styles.plotPointItem} ${
                              selectedBeatId === point.id ? styles.plotPointItemActive : ''
                            }`}
                          >
                            <div className={styles.plotPointTop}>
                              <button
                                type='button'
                                className={styles.plotPointSelect}
                                onClick={() => {
                                  setSelectedBeatId(point.id);
                                  setBrainstormScope('card');
                                }}
                              >
                                <span className={styles.chapterOrder}>Beat {index + 1}</span>
                                {selectedBeatId === point.id ? (
                                  <span className={styles.selectedBeatChip}>Selected</span>
                                ) : null}
                              </button>
                              <div className={styles.plotPointActions}>
                                <button
                                  type='button'
                                  className={styles.plotPointDelete}
                                  onClick={() => handleEditPlotPoint(point)}
                                >
                                  Edit
                                </button>
                                <button
                                  type='button'
                                  className={styles.plotPointDelete}
                                  onClick={() => void handleDeletePlotPoint(point.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className={styles.plotPointTitle}>{point.title}</div>
                            {(point.notes ?? point.text) && (
                              <div className={styles.plotPointText}>
                                {point.notes ?? point.text}
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              <div className={styles.actions}>
                <button type='button' onClick={resetForm}>
                  Clear
                </button>
                <button type='submit' disabled={isSaving || !title.trim()}>
                  {isSaving
                    ? 'Saving...'
                    : selectedCard
                      ? 'Save Changes'
                      : 'Add Chapter'}
                </button>
              </div>
            </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default CorkboardRoute;

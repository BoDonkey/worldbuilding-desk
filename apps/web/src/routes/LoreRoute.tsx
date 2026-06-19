import {useEffect, useMemo, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {useAppStore} from '../store/appStore';
import type {
  CanonicalFact,
  Character,
  LoreDocument,
  LoreDocumentKind,
  LoreDocumentLink,
  LoreEntityProposal,
  LoreFactProposal,
  WorldEntity
} from '../entityTypes';
import {getCharactersByProject} from '../characterStorage';
import {getEntitiesByProject} from '../entityStorage';
import {
  deleteLoreDocument,
  getLoreDocumentLinksByProject,
  getLoreDocumentsByProject,
  replaceLoreDocumentLinks,
  saveLoreDocument
} from '../loreStorage';
import {parseLoreImport} from '../services/lore/loreImport';
import {
  deleteCanonicalFact,
  getCanonicalFactsByProject,
  getLoreFactProposalsByProject,
  replaceLoreFactProposals,
  saveCanonicalFact,
  saveLoreFactProposal
} from '../services/lore/loreFactStorage';
import {
  getLoreEntityProposalsByProject,
  replaceLoreEntityProposals,
  saveLoreEntityProposal
} from '../services/lore/loreEntityProposalStorage';
import {extractLoreFactProposals} from '../services/lore/loreFactExtraction';
import {extractLoreEntityProposals} from '../services/lore/loreEntityExtraction';
import {
  applyCanonicalFactSideEffects,
  buildCanonicalFactSummary
} from '../services/lore/canonicalFactActions';
import {acceptLoreEntityProposal} from '../services/lore/entityProposalActions';
import {getRAGService} from '../services/rag/getRAGService';
import type {RAGProvider} from '../services/rag/RAGService';
import {ProjectScratchpadButton} from '../components/ProjectScratchpadButton';
import {PageHeader} from '../components/PageHeader';
import styles from '../styles/LoreRoute.module.css';

type LinkDraft = {
  targetType: 'character' | 'entity';
  targetId: string;
  relationship: LoreDocumentLink['relationship'];
};

const LORE_KIND_OPTIONS: Array<{value: LoreDocumentKind; label: string}> = [
  {value: 'character_dossier', label: 'Character dossier'},
  {value: 'place_history', label: 'Place history'},
  {value: 'faction_notes', label: 'Faction notes'},
  {value: 'item_history', label: 'Item history'},
  {value: 'myth', label: 'Myth or religion'},
  {value: 'timeline', label: 'Timeline'},
  {value: 'general_lore', label: 'General lore'}
];

const RELATIONSHIP_OPTIONS: Array<{
  value: LoreDocumentLink['relationship'];
  label: string;
}> = [
  {value: 'primary_subject', label: 'Primary subject'},
  {value: 'secondary_subject', label: 'Secondary subject'},
  {value: 'mentions', label: 'Mentions'},
  {value: 'supports', label: 'Supports canon'}
];

const summarizeContent = (content: string, limit = 220): string => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}...`;
};

const formatFactValue = (value: CanonicalFact['value'] | LoreFactProposal['value']): string =>
  typeof value === 'string' ? value : `${value.label}: ${value.value}`;

const getLoreRailStorageKey = (projectId: string) =>
  `wbd:lore:document-rail-collapsed:${projectId}`;

function LoreRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const [documents, setDocuments] = useState<LoreDocument[]>([]);
  const [documentLinks, setDocumentLinks] = useState<LoreDocumentLink[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [entityProposals, setEntityProposals] = useState<LoreEntityProposal[]>([]);
  const [proposals, setProposals] = useState<LoreFactProposal[]>([]);
  const [canonicalFacts, setCanonicalFacts] = useState<CanonicalFact[]>([]);
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LoreDocumentKind>('general_lore');
  const [content, setContent] = useState('');
  const [draftSource, setDraftSource] = useState<LoreDocument['source']>({type: 'manual'});
  const [linkDrafts, setLinkDrafts] = useState<LinkDraft[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actingProposalId, setActingProposalId] = useState<string | null>(null);
  const [actingEntityProposalId, setActingEntityProposalId] = useState<string | null>(null);
  const [removingFactId, setRemovingFactId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDocumentRailCollapsed, setIsDocumentRailCollapsed] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setIsDocumentRailCollapsed(false);
      return;
    }
    setIsDocumentRailCollapsed(
      window.localStorage.getItem(getLoreRailStorageKey(activeProject.id)) === 'true'
    );
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setDocuments([]);
      setDocumentLinks([]);
      setCharacters([]);
      setEntities([]);
      setProposals([]);
      setCanonicalFacts([]);
      setRagService(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const [
        loadedDocuments,
        loadedLinks,
        loadedCharacters,
        loadedEntities,
        loadedEntityProposals,
        loadedProposals,
        loadedFacts,
        nextRagService
      ] = await Promise.all([
        getLoreDocumentsByProject(activeProject.id),
        getLoreDocumentLinksByProject(activeProject.id),
        getCharactersByProject(activeProject.id),
        getEntitiesByProject(activeProject.id),
        getLoreEntityProposalsByProject(activeProject.id),
        getLoreFactProposalsByProject(activeProject.id),
        getCanonicalFactsByProject(activeProject.id),
        getRAGService({
          projectId: activeProject.id,
          inheritFromParent: activeProject.inheritRag,
          parentProjectId: activeProject.parentProjectId
        })
      ]);
      if (cancelled) return;
      setDocuments(loadedDocuments);
      setDocumentLinks(loadedLinks);
      setCharacters(loadedCharacters);
      setEntities(loadedEntities);
      setEntityProposals(loadedEntityProposals);
      setProposals(loadedProposals);
      setCanonicalFacts(loadedFacts);
      setRagService(nextRagService);
    };

    void load();
    const handleChanged = () => {
      void load();
    };
    window.addEventListener('wbd:lore-records-changed', handleChanged);
    window.addEventListener('wbd:lore-fact-records-changed', handleChanged);
    window.addEventListener('wbd:character-records-changed', handleChanged);
    window.addEventListener('wbd:entity-records-changed', handleChanged);
    window.addEventListener('wbd:alias-records-changed', handleChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('wbd:lore-records-changed', handleChanged);
      window.removeEventListener('wbd:lore-fact-records-changed', handleChanged);
      window.removeEventListener('wbd:character-records-changed', handleChanged);
      window.removeEventListener('wbd:entity-records-changed', handleChanged);
      window.removeEventListener('wbd:alias-records-changed', handleChanged);
    };
  }, [activeProject]);

  const linkableTargets = useMemo(
    () => [
      ...characters.map((character) => ({
        key: `character:${character.id}`,
        label: `${character.name} (Character)`,
        targetType: 'character' as const,
        targetId: character.id
      })),
      ...entities.map((entity) => ({
        key: `entity:${entity.id}`,
        label: `${entity.name} (World)`,
        targetType: 'entity' as const,
        targetId: entity.id
      }))
    ],
    [characters, entities]
  );

  const linksByDocumentId = useMemo(() => {
    const map = new Map<string, LoreDocumentLink[]>();
    documentLinks.forEach((link) => {
      const current = map.get(link.loreDocumentId) ?? [];
      current.push(link);
      map.set(link.loreDocumentId, current);
    });
    return map;
  }, [documentLinks]);

  const proposalsByDocumentId = useMemo(() => {
    const map = new Map<string, LoreFactProposal[]>();
    proposals.forEach((proposal) => {
      const current = map.get(proposal.loreDocumentId) ?? [];
      current.push(proposal);
      map.set(proposal.loreDocumentId, current);
    });
    return map;
  }, [proposals]);

  const entityProposalsByDocumentId = useMemo(() => {
    const map = new Map<string, LoreEntityProposal[]>();
    entityProposals.forEach((proposal) => {
      const current = map.get(proposal.loreDocumentId) ?? [];
      current.push(proposal);
      map.set(proposal.loreDocumentId, current);
    });
    return map;
  }, [entityProposals]);

  const canonicalFactsByDocumentId = useMemo(() => {
    const map = new Map<string, CanonicalFact[]>();
    canonicalFacts.forEach((fact) => {
      if (!fact.loreDocumentId) return;
      const current = map.get(fact.loreDocumentId) ?? [];
      current.push(fact);
      map.set(fact.loreDocumentId, current);
    });
    return map;
  }, [canonicalFacts]);

  const editingDocument = useMemo(
    () => documents.find((document) => document.id === editingId) ?? null,
    [documents, editingId]
  );

  const editingDocumentProposals = useMemo(
    () => (editingId ? proposalsByDocumentId.get(editingId) ?? [] : []),
    [editingId, proposalsByDocumentId]
  );

  const editingEntityProposals = useMemo(
    () => (editingId ? entityProposalsByDocumentId.get(editingId) ?? [] : []),
    [editingId, entityProposalsByDocumentId]
  );

  const editingDocumentFacts = useMemo(
    () => (editingId ? canonicalFactsByDocumentId.get(editingId) ?? [] : []),
    [canonicalFactsByDocumentId, editingId]
  );

  const indexLoreDocument = async (document: LoreDocument, links: LoreDocumentLink[]) => {
    if (!ragService) return;
    await ragService.indexDocument(`lore:${document.id}`, document.title, document.content, 'lore', {
      tags: [document.kind, 'lore'],
      entityIds: links.map((link) => link.targetId)
    });
  };

  const deleteLoreRagDocument = async (documentId: string) => {
    if (!ragService) return;
    await ragService.deleteDocument(`lore:${documentId}`);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setKind('general_lore');
    setContent('');
    setDraftSource({type: 'manual'});
    setLinkDrafts([]);
  };

  const beginEdit = (document: LoreDocument) => {
    setEditingId(document.id);
    setTitle(document.title);
    setKind(document.kind);
    setContent(document.content);
    setDraftSource(document.source);
    setLinkDrafts(
      (linksByDocumentId.get(document.id) ?? []).map((link) => ({
        targetType: link.targetType,
        targetId: link.targetId,
        relationship: link.relationship
      }))
    );
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !title.trim() || !content.trim()) return;

    setSaving(true);
    setFeedback(null);
    const now = Date.now();
    const existing = editingId
      ? documents.find((document) => document.id === editingId) ?? null
      : null;
    const documentId = editingId ?? crypto.randomUUID();
    const nextDocument: LoreDocument = {
      id: documentId,
      projectId: activeProject.id,
      title: title.trim(),
      kind,
      format: existing?.format ?? 'plain_text',
      content: content.trim(),
      summary: summarizeContent(content),
      source: existing?.source ?? draftSource,
      status: 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    const nextLinks: LoreDocumentLink[] = linkDrafts
      .filter((draft) => draft.targetId)
      .map((draft) => ({
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        loreDocumentId: documentId,
        targetType: draft.targetType,
        targetId: draft.targetId,
        relationship: draft.relationship,
        createdAt: now
      }));

    try {
      await saveLoreDocument(nextDocument);
      await replaceLoreDocumentLinks({loreDocumentId: documentId, links: nextLinks});
      await indexLoreDocument(nextDocument, nextLinks);
      resetForm();
      setFeedback({
        tone: 'success',
        message: editingId ? 'Lore document updated.' : 'Lore document created.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save lore document.';
      setFeedback({tone: 'error', message});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (document: LoreDocument) => {
    if (!window.confirm(`Delete lore document "${document.title}"?`)) return;
    setDeletingId(document.id);
    setFeedback(null);
    try {
      await deleteLoreDocument(document.id);
      await replaceLoreEntityProposals({
        projectId: document.projectId,
        loreDocumentId: document.id,
        proposals: []
      });
      await replaceLoreFactProposals({
        projectId: document.projectId,
        loreDocumentId: document.id,
        proposals: []
      });
      await deleteLoreRagDocument(document.id);
      if (editingId === document.id) {
        resetForm();
      }
      setFeedback({tone: 'success', message: 'Lore document deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete lore document.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeProject) return;

    setIsImporting(true);
    setFeedback(null);
    try {
      const parsed = await parseLoreImport(file);
      setEditingId(null);
      setTitle(parsed.title);
      setKind('general_lore');
      setContent(parsed.content);
      setDraftSource({
        type: 'import',
        fileName: parsed.fileName,
        mimeType: parsed.mimeType
      });
      setLinkDrafts([]);
      setFeedback({
        tone: 'success',
        message: `Imported "${parsed.fileName}". Review and save when ready.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import lore file.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsImporting(false);
    }
  };

  const handleExtractFacts = async (document: LoreDocument) => {
    if (!activeProject) return;
    setExtractingId(document.id);
    setFeedback(null);
    try {
      const links = linksByDocumentId.get(document.id) ?? [];
      const nextEntityProposals = extractLoreEntityProposals({
        projectId: activeProject.id,
        document,
        links,
        characters,
        entities
      });
      const nextProposals = extractLoreFactProposals({
        projectId: activeProject.id,
        document,
        links,
        knownTargets: [
          ...characters.map((character) => ({
            type: 'character' as const,
            id: character.id,
            name: character.name
          })),
          ...entities.map((entity) => ({
            type: 'entity' as const,
            id: entity.id,
            name: entity.name
          }))
        ],
        existingFacts: canonicalFacts
      });
      await replaceLoreEntityProposals({
        projectId: activeProject.id,
        loreDocumentId: document.id,
        proposals: nextEntityProposals
      });
      await replaceLoreFactProposals({
        projectId: activeProject.id,
        loreDocumentId: document.id,
        proposals: nextProposals
      });
      setFeedback({
        tone: 'success',
        message:
          nextEntityProposals.length + nextProposals.length > 0
            ? `Extracted ${nextEntityProposals.length} entity proposal${nextEntityProposals.length === 1 ? '' : 's'} and ${nextProposals.length} fact proposal${nextProposals.length === 1 ? '' : 's'}.`
            : 'No new entity or fact proposals were extracted from this document.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to extract lore facts.';
      setFeedback({tone: 'error', message});
    } finally {
      setExtractingId(null);
    }
  };

  const handleAcceptProposal = async (proposal: LoreFactProposal) => {
    if (!activeProject || !proposal.targetType || !proposal.targetId) {
      setFeedback({
        tone: 'error',
        message: 'This proposal needs a linked target before it can be accepted.'
      });
      return;
    }
    setActingProposalId(proposal.id);
    setFeedback(null);
    const now = Date.now();
    const fact: CanonicalFact = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      targetType: proposal.targetType,
      targetId: proposal.targetId,
      targetName: proposal.targetName,
      loreDocumentId: proposal.loreDocumentId,
      sourceLoreDocumentTitle:
        documents.find((document) => document.id === proposal.loreDocumentId)?.title ??
        undefined,
      sourceProposalId: proposal.id,
      factType: proposal.factType,
      value: proposal.value,
      evidenceText: proposal.evidence.text,
      evidenceStart: proposal.evidence.start,
      evidenceEnd: proposal.evidence.end,
      acceptedAt: now,
      updatedAt: now
    };

    const nextProposal: LoreFactProposal = {
      ...proposal,
      status: 'accepted',
      updatedAt: now
    };

    try {
      await saveCanonicalFact(fact);
      await saveLoreFactProposal(nextProposal);
      await applyCanonicalFactSideEffects(activeProject.id, fact);
      if (ragService) {
        await ragService.indexDocument(
          `canon-fact:${fact.id}`,
          fact.targetName ?? fact.targetId,
          buildCanonicalFactSummary(fact),
          'canon_fact',
          {
            tags: ['canon_fact', fact.factType],
            entityIds: [fact.targetId]
          }
        );
      }
      setFeedback({tone: 'success', message: 'Fact accepted into canon.'});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to accept fact.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingProposalId(null);
    }
  };

  const handleAcceptEntityProposal = async (proposal: LoreEntityProposal) => {
    setActingEntityProposalId(proposal.id);
    setFeedback(null);
    try {
      const existingLinks = linksByDocumentId.get(proposal.loreDocumentId) ?? [];
      const acceptedTarget = await acceptLoreEntityProposal({
        proposal,
        existingLinks
      });
      await saveLoreEntityProposal({
        ...proposal,
        status: 'accepted',
        targetType: acceptedTarget.targetType,
        targetId: acceptedTarget.targetId,
        updatedAt: Date.now()
      });
      setFeedback({
        tone: 'success',
        message:
          proposal.targetId
            ? `"${proposal.name}" linked to existing ${proposal.targetType === 'character' ? 'character' : 'world record'}.`
            : `"${proposal.name}" created from lore.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to accept entity proposal.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingEntityProposalId(null);
    }
  };

  const handleRejectEntityProposal = async (proposal: LoreEntityProposal) => {
    setActingEntityProposalId(proposal.id);
    setFeedback(null);
    try {
      await saveLoreEntityProposal({
        ...proposal,
        status: 'rejected',
        updatedAt: Date.now()
      });
      setFeedback({tone: 'success', message: 'Entity proposal rejected.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reject entity proposal.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingEntityProposalId(null);
    }
  };

  const handleRejectProposal = async (proposal: LoreFactProposal) => {
    setActingProposalId(proposal.id);
    setFeedback(null);
    try {
      await saveLoreFactProposal({
        ...proposal,
        status: 'rejected',
        updatedAt: Date.now()
      });
      setFeedback({tone: 'success', message: 'Proposal rejected.'});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reject proposal.';
      setFeedback({tone: 'error', message});
    } finally {
      setActingProposalId(null);
    }
  };

  const handleRemoveFact = async (fact: CanonicalFact) => {
    if (!window.confirm('Remove this accepted fact from canon?')) return;
    setRemovingFactId(fact.id);
    setFeedback(null);
    try {
      await deleteCanonicalFact(fact.id);
      const sourceProposal = proposals.find((proposal) => proposal.id === fact.sourceProposalId);
      if (sourceProposal) {
        await saveLoreFactProposal({
          ...sourceProposal,
          status: 'proposed',
          updatedAt: Date.now()
        });
      }
      if (ragService) {
        await ragService.deleteDocument(`canon-fact:${fact.id}`);
      }
      setFeedback({tone: 'success', message: 'Accepted fact removed.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to remove accepted fact.';
      setFeedback({tone: 'error', message});
    } finally {
      setRemovingFactId(null);
    }
  };

  const updateLinkDraft = (index: number, next: Partial<LinkDraft>) => {
    setLinkDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? {...draft, ...next} : draft
      )
    );
  };

  const addLinkDraft = () => {
    setLinkDrafts((current) => [
      ...current,
      {targetType: 'character', targetId: '', relationship: 'primary_subject'}
    ]);
  };

  const removeLinkDraft = (index: number) => {
    setLinkDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index));
  };

  const focusLoreEditor = () => {
    document.getElementById('lore-document-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    window.setTimeout(() => titleInputRef.current?.focus(), 120);
  };

  const handleToggleDocumentRail = () => {
    setIsDocumentRailCollapsed((current) => {
      const next = !current;
      if (activeProject) {
        window.localStorage.setItem(getLoreRailStorageKey(activeProject.id), String(next));
      }
      return next;
    });
  };

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <h1 className={styles.pageTitle}>Lore Documents</h1>
        <p className={styles.pageIntro}>
          Open a project first to create longform source documents.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Free-form worldbuilding'
        title='Lore Documents'
        description={
          <>
            Store dossiers, timelines, myths, and deep reference notes without forcing
            them into a rigid World Bible form. Extraction runs locally and produces
            reviewable fact proposals before anything becomes canon.
          </>
        }
        actions={
          <>
            <ProjectScratchpadButton projectId={activeProject.id} />
            <button type='button' onClick={handleToggleDocumentRail}>
              {isDocumentRailCollapsed ? 'Show Documents' : 'Hide Documents'}
            </button>
            <button type='button' onClick={handleImportClick} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import Document'}
            </button>
          </>
        }
      />
      <input
        ref={importInputRef}
        type='file'
        accept='.docx,.txt,.md,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        className={styles.hiddenInput}
        onChange={handleImport}
      />

      {feedback ? (
        <p
          className={`${styles.feedback} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
          role='status'
        >
          {feedback.message}
        </p>
      ) : null}

      <section className={styles.starterPanel} aria-label='Lore starting points'>
        <div className={styles.starterHeader}>
          <div>
            <div className={styles.starterEyebrow}>Start here</div>
            <h2>Document Intake</h2>
            <p>
              Capture freeform source material first, then extract only the facts and
              entities you want to promote into canon.
            </p>
          </div>
        </div>
        <div className={styles.starterGrid}>
          <div className={styles.starterCard}>
            <h3>Write Manually</h3>
            <p>Start a dossier, timeline, myth, or world note from a blank document.</p>
            <button type='button' onClick={focusLoreEditor}>
              Start Writing
            </button>
          </div>
          <div className={styles.starterCard}>
            <h3>Import Dossier</h3>
            <p>Bring in DOCX, Markdown, or plain text notes before reviewing them.</p>
            <button type='button' onClick={handleImportClick} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import File'}
            </button>
          </div>
          <div className={styles.starterCard}>
            <h3>Extract Canon</h3>
            <p>Turn the active saved document into reviewable entity and fact candidates.</p>
            <button
              type='button'
              onClick={() => editingDocument && void handleExtractFacts(editingDocument)}
              disabled={!editingDocument || extractingId === editingDocument.id}
            >
              {editingDocument && extractingId === editingDocument.id
                ? 'Extracting...'
                : 'Extract Facts'}
            </button>
          </div>
        </div>
      </section>

      <div
        className={`${styles.layout} ${
          isDocumentRailCollapsed ? styles.layoutRailCollapsed : ''
        }`}
      >
        {!isDocumentRailCollapsed && (
        <aside className={styles.listCard} aria-label='Lore documents'>
          <div className={styles.cardHeader}>
            <h2>Documents</h2>
            <span className={styles.countBadge}>{documents.length}</span>
          </div>
          {documents.length === 0 ? (
            <p className={styles.emptyState}>
              No lore documents yet. Import a dossier or start a longform world note.
            </p>
          ) : (
            <div className={styles.documentList}>
              {documents.map((document) => {
                const links = linksByDocumentId.get(document.id) ?? [];
                const documentEntityProposals = entityProposalsByDocumentId.get(document.id) ?? [];
                const documentProposals = proposalsByDocumentId.get(document.id) ?? [];
                const documentFacts = canonicalFactsByDocumentId.get(document.id) ?? [];
                return (
                  <article key={document.id} className={styles.documentCard}>
                    <div className={styles.documentHeader}>
                      <div>
                        <p className={styles.documentKind}>
                          {LORE_KIND_OPTIONS.find((option) => option.value === document.kind)?.label ??
                            'Lore'}
                        </p>
                        <h3>{document.title}</h3>
                      </div>
                      <div className={styles.inlineActions}>
                        <button type='button' onClick={() => beginEdit(document)}>
                          Edit
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleExtractFacts(document)}
                          disabled={extractingId === document.id}
                        >
                          {extractingId === document.id ? 'Extracting...' : 'Extract'}
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleDelete(document)}
                          disabled={deletingId === document.id}
                        >
                          {deletingId === document.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    <p className={styles.documentSummary}>
                      {document.summary || summarizeContent(document.content)}
                    </p>
                    <div className={styles.metaRow}>
                      <span>{documentEntityProposals.length} entity candidates</span>
                      <span>{documentProposals.length} fact candidates</span>
                      <span>{documentFacts.length} accepted</span>
                    </div>
                    {links.length > 0 ? (
                      <div className={styles.linkBadges}>
                        {links.map((link) => {
                          const label =
                            link.targetType === 'character'
                              ? characters.find((character) => character.id === link.targetId)?.name
                              : entities.find((entity) => entity.id === link.targetId)?.name;
                          return (
                            <span key={link.id} className={styles.linkBadge}>
                              {link.relationship.replace(/_/g, ' ')}: {label ?? 'Unknown'}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </aside>
        )}
        <div className={styles.editorStack}>
          <form
            id='lore-document-editor'
            className={styles.editorCard}
            onSubmit={handleSubmit}
          >
            <div className={styles.cardHeader}>
              <h2>{editingId ? 'Edit Lore Document' : 'New Lore Document'}</h2>
              <div className={styles.inlineActions}>
                {editingDocument ? (
                  <button
                    type='button'
                    onClick={() => void handleExtractFacts(editingDocument)}
                    disabled={extractingId === editingDocument.id}
                  >
                    {extractingId === editingDocument.id ? 'Extracting...' : 'Extract Facts'}
                  </button>
                ) : null}
                {editingId ? (
                  <button type='button' onClick={resetForm}>
                    New Document
                  </button>
                ) : null}
              </div>
            </div>

            <label className={styles.fieldLabel}>
              Title
              <input
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className={styles.fieldLabel}>
              Kind
              <select value={kind} onChange={(event) => setKind(event.target.value as LoreDocumentKind)}>
                {LORE_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.linkSection}>
              <div className={styles.subsectionHeader}>
                <h3>Linked Subjects</h3>
                <button type='button' onClick={addLinkDraft}>
                  Add Link
                </button>
              </div>
              <p className={styles.subsectionCopy}>
                Link a dossier to existing characters or world records now. Extraction uses
                these links to decide where accepted facts belong.
              </p>
              {linkDrafts.length === 0 ? (
                <p className={styles.emptyHint}>No links yet.</p>
              ) : null}
              {linkDrafts.map((draft, index) => (
                <div key={`${draft.targetType}-${draft.targetId}-${index}`} className={styles.linkRow}>
                  <select
                    value={`${draft.targetType}:${draft.targetId}`}
                    onChange={(event) => {
                      const [nextType, nextId] = event.target.value.split(':');
                      updateLinkDraft(index, {
                        targetType: nextType as LinkDraft['targetType'],
                        targetId: nextId
                      });
                    }}
                  >
                    <option value='character:'>Select target</option>
                    {linkableTargets.map((target) => (
                      <option key={target.key} value={`${target.targetType}:${target.targetId}`}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.relationship}
                    onChange={(event) =>
                      updateLinkDraft(index, {
                        relationship: event.target.value as LoreDocumentLink['relationship']
                      })
                    }
                  >
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type='button' onClick={() => removeLinkDraft(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <label className={styles.fieldLabel}>
              Content
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={18}
              />
            </label>

            <div className={styles.formActions}>
              <button type='submit' disabled={saving || !title.trim() || !content.trim()}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Lore Document'}
              </button>
            </div>
          </form>

          {editingDocument ? (
            <div className={styles.reviewCard}>
              <div className={styles.cardHeader}>
                <h2>Extraction Review</h2>
                <span className={styles.countBadge}>
                  {editingEntityProposals.length + editingDocumentProposals.length}
                </span>
              </div>
              <p className={styles.subsectionCopy}>
                Proposed facts are local, deterministic interpretations. Accept only what
                should become canon.
              </p>
              <div className={styles.acceptedSection}>
                <div className={styles.cardHeader}>
                  <h3>Entity Candidates</h3>
                  <span className={styles.countBadge}>{editingEntityProposals.length}</span>
                </div>
                {editingEntityProposals.length === 0 ? (
                  <p className={styles.emptyState}>
                    No entity candidates yet.
                  </p>
                ) : (
                  <div className={styles.proposalList}>
                    {editingEntityProposals.map((proposal) => (
                      <article key={proposal.id} className={styles.proposalCard}>
                        <div className={styles.proposalHeader}>
                          <strong>{proposal.entityKind}</strong>
                          <span className={styles.statusBadge}>{proposal.status}</span>
                        </div>
                        <p className={styles.proposalValue}>{proposal.name}</p>
                        <p className={styles.proposalMeta}>
                          {proposal.targetId
                            ? `Matches existing ${proposal.targetType === 'character' ? 'character' : 'world record'}`
                            : 'Will create a new record'}
                        </p>
                        <p className={styles.proposalMeta}>
                          Confidence: {Math.round(proposal.confidence * 100)}%
                        </p>
                        <p className={styles.evidenceText}>{proposal.evidence.text}</p>
                        {proposal.status === 'proposed' ? (
                          <div className={styles.inlineActions}>
                            <button
                              type='button'
                              onClick={() => void handleAcceptEntityProposal(proposal)}
                              disabled={actingEntityProposalId === proposal.id}
                            >
                              Accept
                            </button>
                            <button
                              type='button'
                              onClick={() => void handleRejectEntityProposal(proposal)}
                              disabled={actingEntityProposalId === proposal.id}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.acceptedSection}>
                <div className={styles.cardHeader}>
                  <h3>Fact Candidates</h3>
                  <span className={styles.countBadge}>{editingDocumentProposals.length}</span>
                </div>
                {editingDocumentProposals.length === 0 ? (
                  <p className={styles.emptyState}>
                    No fact proposals yet. Run extraction on this document after saving it.
                  </p>
                ) : (
                <div className={styles.proposalList}>
                  {editingDocumentProposals.map((proposal) => (
                    <article key={proposal.id} className={styles.proposalCard}>
                      <div className={styles.proposalHeader}>
                        <strong>{proposal.factType.replace(/_/g, ' ')}</strong>
                        <span className={styles.statusBadge}>{proposal.status}</span>
                      </div>
                      <p className={styles.proposalValue}>{formatFactValue(proposal.value)}</p>
                      <p className={styles.proposalMeta}>
                        Target:{' '}
                        {proposal.targetName
                          ? `${proposal.targetName} (${proposal.targetType})`
                          : 'No resolved target'}
                      </p>
                      <p className={styles.proposalMeta}>
                        Confidence: {Math.round(proposal.confidence * 100)}%
                      </p>
                      <p className={styles.evidenceText}>{proposal.evidence.text}</p>
                      {proposal.status === 'proposed' ? (
                        <div className={styles.inlineActions}>
                          <button
                            type='button'
                            onClick={() => void handleAcceptProposal(proposal)}
                            disabled={actingProposalId === proposal.id}
                          >
                            Accept
                          </button>
                          <button
                            type='button'
                            onClick={() => void handleRejectProposal(proposal)}
                            disabled={actingProposalId === proposal.id}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
                )}
              </div>

              <div className={styles.acceptedSection}>
                <div className={styles.cardHeader}>
                  <h3>Accepted Canon</h3>
                  <span className={styles.countBadge}>{editingDocumentFacts.length}</span>
                </div>
                {editingDocumentFacts.length === 0 ? (
                  <p className={styles.emptyState}>No accepted facts from this document yet.</p>
                ) : (
                  <div className={styles.factList}>
                    {editingDocumentFacts.map((fact) => (
                      <article key={fact.id} className={styles.factCard}>
                        <p className={styles.proposalValue}>{buildCanonicalFactSummary(fact)}</p>
                        <button
                          type='button'
                          onClick={() => void handleRemoveFact(fact)}
                          disabled={removingFactId === fact.id}
                        >
                          {removingFactId === fact.id ? 'Removing...' : 'Remove'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

      </div>
    </section>
  );
}

export default LoreRoute;

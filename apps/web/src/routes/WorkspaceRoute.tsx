import {useEffect, useState} from 'react';
import type {Project, WritingDocument} from '../entityTypes';
import {
  getDocumentsByProject,
  saveWritingDocument,
  deleteWritingDocument
} from '../writingStorage';
import TipTapEditor from '../components/TipTapEditor';
import {countWords} from '../utils/textHelpers';

interface WorkspaceRouteProps {
  activeProject: Project | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

function WorkspaceRoute({activeProject}: WorkspaceRouteProps) {
  const [documents, setDocuments] = useState<WritingDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [wordCount, setWordCount] = useState(0);

  // Load documents whenever the active project changes
  useEffect(() => {
    if (!activeProject) return;

    let cancelled = false;

    (async () => {
      const docs = await getDocumentsByProject(activeProject.id);
      if (cancelled) return;

      setDocuments(docs);

      if (docs.length > 0) {
        const first = docs[0];
        setSelectedId(first.id);
        setSelectedCreatedAt(first.createdAt);
        setTitle(first.title);
        setContent(first.content);
        setSaveStatus('idle');
      } else {
        setSelectedId(null);
        setSelectedCreatedAt(null);
        setTitle('');
        setContent('');
        setSaveStatus('idle');
        setLastSavedAt(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const resetEditor = () => {
    setSelectedId(null);
    setSelectedCreatedAt(null);
    setTitle('');
    setContent('');
    setSaveStatus('idle');
    setLastSavedAt(null);
  };

  const persistDoc = async (doc: WritingDocument) => {
    await saveWritingDocument(doc);

    setDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === doc.id);
      if (index === -1) {
        return [...prev, doc];
      }
      const copy = [...prev];
      copy[index] = doc;
      return copy;
    });

    setSelectedCreatedAt(doc.createdAt);
    setSaveStatus('saved');
    setLastSavedAt(Date.now());
  };

  const handleNewDocument = async () => {
    if (!activeProject) return;

    const now = Date.now();
    const doc: WritingDocument = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      title: 'Untitled scene',
      content: '<p></p>', // Empty paragraph for TipTap
      createdAt: now,
      updatedAt: now
    };

    await saveWritingDocument(doc);

    setDocuments((prev) => [...prev, doc]);
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('saved');
    setLastSavedAt(Date.now());
    setWordCount(0);
  };

  const handleSelectDocument = (doc: WritingDocument) => {
    setSelectedId(doc.id);
    setSelectedCreatedAt(doc.createdAt);
    setTitle(doc.title);
    setContent(doc.content);
    setSaveStatus('idle');
    setWordCount(countWords(doc.content));
  };

  const handleSave = async () => {
    if (!activeProject || !selectedId) return;

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: title.trim() || 'Untitled scene',
      content,
      createdAt,
      updatedAt: now
    };

    await persistDoc(doc);
  };

  const handleDelete = async (doc: WritingDocument) => {
    await deleteWritingDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

    if (selectedId === doc.id) {
      resetEditor();
    }
  };

  // Handle content changes from TipTap
  const handleContentChange = (html: string) => {
    setContent(html);
    setSaveStatus('idle'); // Mark as unsaved
    setWordCount(countWords(html));
  };

  // 🔁 AUTOSAVE EFFECT (debounced)
  useEffect(() => {
    if (!activeProject || !selectedId) return;

    const now = Date.now();
    const createdAt = selectedCreatedAt ?? now;

    const doc: WritingDocument = {
      id: selectedId,
      projectId: activeProject.id,
      title: title.trim() || 'Untitled scene',
      content,
      createdAt,
      updatedAt: now
    };

    const timeoutId = window.setTimeout(() => {
      setSaveStatus('saving');
      void persistDoc(doc);
    }, 800); // debounce delay (ms)

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, selectedId, activeProject, selectedCreatedAt]);

  if (!activeProject) {
    return (
      <section>
        <h1>Writing Workspace</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Writing Workspace</h1>

      <div style={{display: 'flex', gap: '1.5rem', alignItems: 'stretch'}}>
        {/* Sidebar: document list */}
        <aside
          style={{
            width: '260px',
            borderRight: '1px solid #ccc',
            paddingRight: '1rem'
          }}
        >
          <div style={{marginBottom: '1rem'}}>
            <button type='button' onClick={handleNewDocument}>
              + New Scene
            </button>
          </div>

          {documents.length === 0 && (
            <p style={{fontStyle: 'italic'}}>
              No scenes yet. Create one to start writing.
            </p>
          )}

          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {documents.map((doc) => (
              <li
                key={doc.id}
                style={{
                  marginBottom: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor:
                    doc.id === selectedId ? '#eee' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <div
                  onClick={() => handleSelectDocument(doc)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px'
                    }}
                  >
                    {doc.title || 'Untitled scene'}
                  </span>
                </div>
                <button
                  type='button'
                  onClick={() => handleDelete(doc)}
                  style={{marginTop: '0.25rem', fontSize: '0.8rem'}}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main editor */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
          {selectedId ? (
            <>
              <div style={{marginBottom: '0.75rem'}}>
                <label>
                  Title
                  <br />
                  <input
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{width: '100%'}}
                  />
                </label>
              </div>

              <div
                style={{
                  marginBottom: '0.75rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <label
                  style={{flex: 1, display: 'flex', flexDirection: 'column'}}
                >
                  Scene Text
                  <br />
                  {/* CRITICAL FIX: Remove the key prop! */}
                  {/* The key prop was causing remounts and triggering the bold bug */}
                  <TipTapEditor
                    content={content}
                    onChange={handleContentChange}
                  />
                </label>
              </div>

              <div
                style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}
              >
                <button type='button' onClick={handleSave}>
                  Save now
                </button>
                <span style={{fontSize: '0.85rem', fontStyle: 'italic'}}>
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved' && lastSavedAt && (
                    <>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</>
                  )}
                  {saveStatus === 'idle' && 'No recent changes'}
                  {' · '}
                  {wordCount} words
                </span>
              </div>
            </>
          ) : (
            <p>Select a scene from the left, or create a new one.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default WorkspaceRoute;
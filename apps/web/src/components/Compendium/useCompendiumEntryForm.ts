import {useState} from 'react';
import type {CompendiumDomain, CompendiumEntry} from '../../entityTypes';
import {saveCompendiumEntry} from '../../services/storage';
import {getDefaultActions} from '../../services/compendium/compendiumFormValues';
import {describeError} from '../../services/errors';
import type {CompendiumFormContext, SetFormValue} from './formTypes';

interface Options extends CompendiumFormContext {
  setEntries: SetFormValue<CompendiumEntry[]>;
}

export function useCompendiumEntryForm({activeProject, setFeedback, setEntries}: Options) {
  const [entryName, setEntryName] = useState('');
  const [entryDomain, setEntryDomain] = useState<CompendiumDomain>('beast');
  const handleCreateEntry = async () => {
    if (!activeProject || !entryName.trim()) return;
    const now = Date.now();
    const next: CompendiumEntry = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: entryName.trim(),
      domain: entryDomain,
      needsCompletion: false,
      actions: getDefaultActions(entryDomain),
      createdAt: now,
      updatedAt: now
    };

    setFeedback(null);
    try {
      await saveCompendiumEntry(next);
      setEntries((prev) => [...prev, next].sort((a, b) => a.name.localeCompare(b.name)));
      setEntryName('');
      setFeedback({tone: 'success', message: 'Compendium entry created.'});
    } catch (error) {
      const message =
        describeError(error, 'Unable to create entry.');
      setFeedback({tone: 'error', message});
    }
  };

  return {
    entryName,
    setEntryName,
    entryDomain,
    setEntryDomain,
    handleCreateEntry
  };
}

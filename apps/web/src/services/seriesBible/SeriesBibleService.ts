import type {Project} from '../../entityTypes';
import type {MemoryEntry} from '../shodh/ShodhMemoryService';
import {ShodhMemoryService} from '../shodh/ShodhMemoryService';
import {RAGService} from '../rag/RAGService';
import type {DocumentChunk} from '../rag/types';
import {
  getAllProjects,
  getProjectById,
  saveProject
} from '../../projectStorage';

export interface SeriesBibleConfig {
  parentProjectId?: string;
  inheritRag: boolean;
  inheritShodh: boolean;
  canonVersion?: string;
  lastSyncedCanon?: string;
  parentCanonVersion?: string;
}

const defaultConfig: SeriesBibleConfig = {
  inheritRag: true,
  inheritShodh: true
};

export function getSeriesBibleConfig(project: Project): SeriesBibleConfig {
  return {
    parentProjectId: project.parentProjectId,
    inheritRag: project.inheritRag ?? defaultConfig.inheritRag ?? true,
    inheritShodh: project.inheritShodh ?? defaultConfig.inheritShodh ?? true,
    canonVersion: project.canonVersion,
    lastSyncedCanon: project.lastSyncedCanon
  };
}

export async function getParentProject(
  project: Project
): Promise<Project | null> {
  if (!project.parentProjectId) return null;
  return getProjectById(project.parentProjectId);
}

export async function getCanonSyncState(project: Project): Promise<{
  parentCanonVersion?: string;
  childLastSynced?: string;
  parentName?: string;
}> {
  const parent = await getParentProject(project);
  return {
    parentCanonVersion: parent?.canonVersion,
    parentName: parent?.name,
    childLastSynced: project.lastSyncedCanon
  };
}

export function isChildProject(project: Project | null | undefined): boolean {
  return Boolean(project?.parentProjectId);
}

export async function linkProjectToParent(
  childProjectId: string,
  options: SeriesBibleConfig
): Promise<Project | null> {
  const project = await getProjectById(childProjectId);
  if (!project) {
    return null;
  }
  const config = {
    inheritRag: options.inheritRag ?? true,
    inheritShodh: options.inheritShodh ?? true,
    parentProjectId: options.parentProjectId,
    canonVersion: options.canonVersion,
    lastSyncedCanon: options.lastSyncedCanon
  };
  const updated: Project = {
    ...project,
    ...config,
    updatedAt: Date.now()
  };
  await saveProject(updated);
  return updated;
}

export async function unlinkProjectFromParent(
  childProjectId: string
): Promise<Project | null> {
  const project = await getProjectById(childProjectId);
  if (!project) {
    return null;
  }
  const updated: Project = {
    ...project,
    parentProjectId: undefined,
    inheritRag: undefined,
    inheritShodh: undefined,
    canonVersion: undefined,
    lastSyncedCanon: undefined,
    updatedAt: Date.now()
  };
  await saveProject(updated);
  return updated;
}

export async function getChildProjects(
  parentProjectId: string
) {
  const projects = await getAllProjects();
  return projects.filter(
    (project) => project.parentProjectId === parentProjectId
  );
}

export async function touchCanonVersion(
  projectId: string
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) {
    return null;
  }
  const updated: Project = {
    ...project,
    canonVersion: new Date().toISOString(),
    updatedAt: Date.now()
  };
  await saveProject(updated);
  return updated;
}

export async function promoteMemoryToParent(
  memory: MemoryEntry,
  parentProjectId: string
): Promise<void> {
  const parentService = new ShodhMemoryService();
  await parentService.init(parentProjectId);
  await parentService.addMemory({
    projectId: parentProjectId,
    documentId: memory.documentId,
    title: memory.title,
    summary: memory.summary,
    tags: Array.from(
      new Set([...(memory.tags ?? []), 'promoted-from-child'])
    )
  });
  await touchCanonVersion(parentProjectId);
}

export async function promoteDocumentToParent(options: {
  parentProjectId: string;
  documentId: string;
  title: string;
  content: string;
  type: DocumentChunk['metadata']['type'];
  tags?: string[];
  entityIds?: string[];
}): Promise<void> {
  const {parentProjectId, documentId, title, content, type, tags, entityIds} =
    options;
  const parentRag = new RAGService();
  await parentRag.init(parentProjectId);
  await parentRag.indexDocument(documentId, title, content, type, {
    tags,
    entityIds
  });
  await touchCanonVersion(parentProjectId);
}

export async function syncChildWithParent(
  childProjectId: string
): Promise<Project | null> {
  const child = await getProjectById(childProjectId);
  if (!child?.parentProjectId) {
    return child;
  }
  const parent = await getProjectById(child.parentProjectId);
  const updated: Project = {
    ...child,
    lastSyncedCanon: parent?.canonVersion ?? new Date().toISOString(),
    updatedAt: Date.now()
  };
  await saveProject(updated);
  return updated;
}

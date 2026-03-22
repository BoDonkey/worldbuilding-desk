import type {
  CompendiumActionLog,
  CompendiumEntry,
  CompendiumMilestone,
  CompendiumProgress,
  Project,
  SettlementModule,
  SettlementState,
  UnlockableRecipe,
  WorldEntity,
  ZoneAffinityProfile,
  ZoneAffinityProgress
} from '../entityTypes';
import {downloadJsonFile, sanitizeFileNamePart} from '../services/jsonTransfer';

export interface CompendiumExportPayload {
  schemaVersion: 1;
  exportedAt: number;
  project: {
    id: string;
    name: string;
  };
  compendium: {
    entries: CompendiumEntry[];
    milestones: CompendiumMilestone[];
    recipes: UnlockableRecipe[];
    progress: CompendiumProgress | null;
    actionLogs: CompendiumActionLog[];
  };
  worldSystems: {
    zoneProfiles: ZoneAffinityProfile[];
    zoneProgress: ZoneAffinityProgress[];
    settlementState: SettlementState | null;
    settlementModules: SettlementModule[];
  };
  linkedWorldEntities: WorldEntity[];
}

export function buildCompendiumExport(params: {
  project: Project;
  entries: CompendiumEntry[];
  milestones: CompendiumMilestone[];
  recipes: UnlockableRecipe[];
  progress: CompendiumProgress | null;
  actionLogs: CompendiumActionLog[];
  zoneProfiles: ZoneAffinityProfile[];
  zoneProgress: ZoneAffinityProgress[];
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  worldEntities: WorldEntity[];
}): CompendiumExportPayload {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    project: {
      id: params.project.id,
      name: params.project.name
    },
    compendium: {
      entries: params.entries,
      milestones: params.milestones,
      recipes: params.recipes,
      progress: params.progress,
      actionLogs: params.actionLogs
    },
    worldSystems: {
      zoneProfiles: params.zoneProfiles,
      zoneProgress: params.zoneProgress,
      settlementState: params.settlementState,
      settlementModules: params.settlementModules
    },
    linkedWorldEntities: params.worldEntities
  };
}

export function exportCompendiumJson(params: {
  project: Project;
  entries: CompendiumEntry[];
  milestones: CompendiumMilestone[];
  recipes: UnlockableRecipe[];
  progress: CompendiumProgress | null;
  actionLogs: CompendiumActionLog[];
  zoneProfiles: ZoneAffinityProfile[];
  zoneProgress: ZoneAffinityProgress[];
  settlementState: SettlementState | null;
  settlementModules: SettlementModule[];
  worldEntities: WorldEntity[];
}): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = sanitizeFileNamePart(params.project.name);
  downloadJsonFile(
    `${baseName}-compendium-${stamp}.json`,
    buildCompendiumExport(params)
  );
}

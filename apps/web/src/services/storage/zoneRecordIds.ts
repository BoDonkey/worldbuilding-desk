/**
 * Ids for zone-affinity records (project schema 8, slice 5.15b).
 *
 * These ids used to embed the zone's biome key, a slug of the zone or place
 * name. Record ids stay readable in a protected project, so ids are now
 * random and records are found by `biomeKey` instead. Older records are
 * rekeyed by the project schema migration and when a backup is imported.
 */
import type {ZoneAffinityProfile, ZoneAffinityProgress} from '../../entityTypes';

export const newZoneProfileId = (projectId: string): string => `zone-profile:${projectId}:${crypto.randomUUID()}`;
export const newZoneProgressId = (projectId: string): string => `zone-progress:${projectId}:${crypto.randomUUID()}`;

const legacyProfileId = (profile: ZoneAffinityProfile) => `zone-profile:${profile.projectId}:${profile.biomeKey}`;
const legacyProgressId = (progress: ZoneAffinityProgress) =>
  progress.characterSheetId
    ? `zone-progress:${progress.projectId}:${progress.biomeKey}:sheet:${progress.characterSheetId}`
    : `zone-progress:${progress.projectId}:${progress.biomeKey}:global`;

/** Gives every profile whose id embeds its biome key a random id; others are unchanged. */
export function rekeyZoneProfiles(profiles: ZoneAffinityProfile[]): ZoneAffinityProfile[] {
  return profiles.map((profile) =>
    profile.id === legacyProfileId(profile) ? {...profile, id: newZoneProfileId(profile.projectId)} : profile
  );
}

/** The same for zone progress records. */
export function rekeyZoneProgress(records: ZoneAffinityProgress[]): ZoneAffinityProgress[] {
  return records.map((record) =>
    record.id === legacyProgressId(record) ? {...record, id: newZoneProgressId(record.projectId)} : record
  );
}

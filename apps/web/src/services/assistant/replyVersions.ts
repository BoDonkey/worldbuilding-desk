import type {AITextProvenance} from '../editor/aiTextProvenance';

/**
 * Versions of one assistant reply (Slice 4.73). `content` and `provenance`
 * always mirror the version shown; sending the next message keeps it and
 * drops the rest, and only the version shown is ever saved or inserted.
 */
export interface VersionedReply {
  content: string;
  provenance?: AITextProvenance;
  versions?: {content: string; provenance?: AITextProvenance}[];
  versionIndex?: number;
}

export const MAX_ASSISTANT_REPLY_VERSIONS = 5;

export const replyVersionCount = (message: VersionedReply): number => message.versions?.length ?? 1;

export function startReplyVersion<M extends VersionedReply>(message: M, provenance?: AITextProvenance): M {
  const versions = [
    ...(message.versions ?? [{content: message.content, provenance: message.provenance}]),
    {content: '', provenance}
  ];
  return {...message, versions, versionIndex: versions.length - 1, content: '', provenance};
}

export function updateShownReply<M extends VersionedReply>(message: M, content: string): M {
  if (!message.versions || message.versionIndex === undefined) return {...message, content};
  return {
    ...message,
    content,
    versions: message.versions.map((version, index) => (index === message.versionIndex ? {...version, content} : version))
  };
}

export function showReplyVersion<M extends VersionedReply>(message: M, index: number): M {
  const version = message.versions?.[index];
  return version ? {...message, versionIndex: index, content: version.content, provenance: version.provenance} : message;
}

export function keepShownReply<M extends VersionedReply>(message: M): M {
  if (!message.versions) return message;
  const kept = {...message};
  delete kept.versions;
  delete kept.versionIndex;
  return kept;
}

/** Drops the version shown (a failed generation), going back to the one before it. */
export function dropShownReply<M extends VersionedReply>(message: M): M {
  if (!message.versions || message.versionIndex === undefined) return message;
  const versions = message.versions.filter((_, index) => index !== message.versionIndex);
  const kept = showReplyVersion({...message, versions}, Math.max(0, message.versionIndex - 1));
  return versions.length > 1 ? kept : keepShownReply(kept);
}

// src/trace/traceTypes.ts

/**
 * Contributor type: who made this code modification
 */
export type ContributorType = 'Human' | 'AI' | 'Mixed' | 'Unknown';

/**
 * Metadata for a contributor
 */
export interface Contributor {
  id: string; // Unique identifier (user ID, model ID)
  type: ContributorType;
  model?: string; // e.g., 'anthropic/claude-3-5-sonnet-20241022'
}

/**
 * Range of lines or AST node that this trace covers
 */
export interface TraceRange {
  startLine: number; // 1-indexed
  endLine: number;   // 1-indexed
  contentHash: string; // Murmur3 or SHA-256 hash of the code block or AST node
  contributor?: Contributor; // Optional override for complex handoffs
}

/**
 * Links to related resources like requirements or external tickets
 */
export interface RelatedResource {
  type: string; // e.g., 'Requirement', 'Ticket', 'Prompt'
  id: string;   // unique ID of the resource
  url?: string; // optional link
}

/**
 * Records all code generated in a single conversation/session
 */
export interface ConversationRecord {
  id: string; // Unique conversation ID
  timestamp: string; // RFC 3339 timestamp
  contributors: Contributor[];
  codeRanges: TraceRange[];
  related: RelatedResource[];
  conversationUrl?: string; // link to conversation logs if available
}

/**
 * File-level trace record
 */
export interface FileTrace {
  filePath: string; // relative path from repository root
  conversations: ConversationRecord[];
}

/**
 * Root trace record for a commit / workspace snapshot
 */
export interface TraceRecord {
  id: string; // unique ID for this trace
  timestamp: string; // RFC 3339
  vcsId: string; // Git commit SHA or Jujutsu change ID
  files: FileTrace[];
  version: string; // version of Agent Trace spec
}

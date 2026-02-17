// src/types/hook.ts

/**
 * Defines types for Hook Engine and lifecycle hooks
 */

export type HookPhase = "PreToolUse" | "PostToolUse" | "PreCompact";

export type CommandRiskLevel = "Safe" | "Destructive" | "Unknown";

export interface HookContext {
  agentId: string;                // ID of the agent invoking the hook
  command: string;                // Command or action attempted
  filePath?: string;              // Optional file path being affected
  contentHash?: string;           // Optional hash of affected content
  timestamp: string;              // RFC 3339 timestamp
}

export interface HookResult {
  approved: boolean;              // Whether the action is allowed
  reason?: string;                // Optional explanation for rejection
  modifiedCommand?: string;       // Optional modified command to enforce safety
}

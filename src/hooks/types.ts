/**
 * Hook Engine Type Definitions
 * TRP1 Challenge Week 1 - Final Implementation
 */

/**
 * Context passed to hook interceptors
 */
export interface HookContext {
  toolName: string;
  params: any;
  sessionId: string;
  timestamp: string;
  result?: any;
  activeIntentId?: string;
}

/**
 * Result returned from PreToolUse hook
 */
export interface HookResult {
  allowed: boolean;
  blocked?: boolean;
  errorResponse?: {
    error: string;
    message: string;
  };
  metadata?: {
    intentContext?: string;
    contentHash?: string;
    traceId?: string;
    riskLevel?: CommandRiskLevel;
  };
}

/**
 * Command risk classification for HITL
 */
export enum CommandRiskLevel {
  Safe = 'safe',
  Review = 'review',
  Destructive = 'destructive',
}

/**
 * Agent Trace Record Schema (Agent Trace Spec v1)
 */
export interface AgentTraceRecord {
  id: string;
  timestamp: string;
  vcs: {
    revision_id: string;
  };
  files: Array<{
    relative_path: string;
    conversations: Array<{
      url: string;
      contributor: {
        entity_type: 'Human' | 'AI' | 'Mixed' | 'Unknown';
        model_identifier: string;
      };
      ranges: Array<{
        start_line: number;
        end_line: number;
        content_hash: string;
        mutation_class?: 'AST_REFACTOR' | 'INTENT_EVOLUTION' | 'BUG_FIX' | 'DOC_UPDATE';
      }>;
      related?: Array<{
        type: 'specification' | 'ticket' | 'constitution';
        value: string;
      }>;
    }>;
  }>;
}

/**
 * Intent Specification Schema
 */
export interface IntentSpec {
  id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  owned_scope: string[];
  constraints: string[];
  acceptance_criteria: string[];
  created_at: string;
  updated_at: string;
}
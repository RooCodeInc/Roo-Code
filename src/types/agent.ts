// src/types/agent.ts

/**
 * Defines the types for Agent entities
 */

export type AgentType = "Supervisor" | "Worker" | "Planner" | "Reviewer";

export interface AgentMetadata {
  id: string; // Unique identifier for the agent
  type: AgentType;
  model?: string; // e.g., "anthropic/claude-3-5-sonnet-20241022"
  createdAt: string; // RFC 3339 timestamp
  activeTaskId?: string; // Optional reference to the current task
}

export interface AgentSession {
  agent: AgentMetadata;
  context: Record<string, any>; // key-value context for the agent session
  isActive: boolean; // Whether the agent is currently running
  startedAt: string;
  endedAt?: string;
}

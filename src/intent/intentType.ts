// src/intent/intentType.ts

/**
 * Enum for the different types of requirements an agent can process.
 */
export enum RequirementType {
  FEATURE = 'feature',
  BUGFIX = 'bugfix',
  REFACTOR = 'refactor',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
}

/**
 * Interface representing a single requirement from the specification.
 */
export interface Requirement {
  id: string;                  // Unique requirement identifier
  title: string;               // Short descriptive title
  description: string;         // Full requirement description
  type: RequirementType;       // Type of requirement
  priority?: number;           // Optional priority (1-5)
  relatedFiles?: string[];     // Optional related file paths
}

/**
 * Interface for the intent metadata the agent can consume.
 */
export interface IntentMetadata {
  requirementId: string;       // Links back to a Requirement
  assignedAgent?: string;      // Optional agent assigned to handle this requirement
  timestamp: string;           // ISO timestamp when this intent was created
}

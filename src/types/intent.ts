// src/types/intent.ts

/**
 * Defines types for handling agent intents and specifications
 */

export type IntentCategory = "Feature" | "BugFix" | "Refactor" | "Test";

export interface IntentMetadata {
  intentId: string;               // Unique identifier for the intent
  title: string;                  // Short description of the intent
  category: IntentCategory;       // Category of the intent
  specReference?: string;         // Link to SpecKit or requirement document
  createdBy: string;              // Human or agent that created the intent
  createdAt: string;              // RFC 3339 timestamp
}

export interface SelectedIntent {
  intent: IntentMetadata;
  contextSnippet?: string;        // Optional snippet of relevant code or spec
}

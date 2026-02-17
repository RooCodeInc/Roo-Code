import type { Intent } from "../models/Intent"

export function buildIntentContextBlock(intent: Intent): string {
  const constraints = intent.constraints?.length
    ? intent.constraints.map((c) => `- ${c}`).join("\n")
    : "- (none)"
  const scope = intent.owned_scope?.length ? intent.owned_scope.join(", ") : "(none)"
  const ac = intent.acceptance_criteria?.length
    ? intent.acceptance_criteria.map((c) => `- ${c}`).join("\n")
    : "- (none)"

  return [
    "<intent_context>",
    `  Active Intent: ${intent.name ?? intent.id} (ID: ${intent.id})`,
    "  Constraints:",
    `  ${constraints}`,
    "  Scope:",
    `  ${scope}`,
    "  Acceptance Criteria:",
    `  ${ac}`,
    "</intent_context>",
  ].join("\n")
}

export function buildIntentHandshakeInstruction(): string {
  return [
    "You are an Intent-Driven Architect.",
    "You MUST NOT write code immediately.",
    "Your first action MUST be to analyze the user request and call select_active_intent(intent_id) to load the necessary context.",
  ].join("\n")
}

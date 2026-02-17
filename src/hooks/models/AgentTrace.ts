export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION"

export type AgentTraceRange = {
  start_line: number
  end_line: number
  content_hash: string
}

export type AgentTraceEntry = {
  id: string
  timestamp: string
  vcs?: { revision_id?: string }
  files: Array<{
    relative_path: string
    conversations: Array<{
      url?: string
      contributor?: {
        entity_type?: "AI" | "Human"
        model_identifier?: string
      }
      ranges: AgentTraceRange[]
      related?: Array<{ type: string; value: string }>
    }>
  }>
}

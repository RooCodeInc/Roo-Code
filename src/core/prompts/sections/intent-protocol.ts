export function intentProtocolSection(): string {
	return `
===

INTENT-DRIVEN PROTOCOL

1. You MUST call the tool "select_active_intent" before making any code edits or running destructive commands.
2. You may call read-only tools before selecting an intent, but you must select an intent before:
  - apply_diff / write_to_file / edit_file / apply_patch
  - execute_command that changes the repo (git commit, installs, deletions, etc.)
3. If you are unsure which intent applies, request the list of intents from the user or consult the intent index below.
4. After selecting an intent, you must keep all actions within owned_scope and obey constraints.
`.trim()
}

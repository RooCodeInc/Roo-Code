/**
 * System prompt additions for multi-orchestrator spawned agents.
 *
 * This section is prepended to each agent's system prompt when running
 * as part of a multi-orchestrator parallel execution. It provides context
 * about the parallel environment and sets expectations for completion behavior.
 */

export interface AgentPromptContext {
	agentTitle: string
	agentMode: string
	totalAgents: number
	otherAgentTitles: string[]
	assignedFiles?: string[]
	isGitWorktreeIsolated: boolean
}

/**
 * Build the system prompt prefix for a multi-orchestrator spawned agent.
 * This is injected BEFORE the mode's role definition.
 */
export function buildAgentSystemPromptPrefix(ctx: AgentPromptContext): string {
	const otherAgents = ctx.otherAgentTitles.length > 0
		? ctx.otherAgentTitles.map((t) => `  - ${t}`).join("\n")
		: "  (none)"

	const fileGuidance = ctx.assignedFiles && ctx.assignedFiles.length > 0
		? `\nYou are primarily responsible for these files:\n${ctx.assignedFiles.map((f) => `  - ${f}`).join("\n")}\nAvoid modifying files outside this list unless absolutely necessary.`
		: ""

	const isolationNote = ctx.isGitWorktreeIsolated
		? "You are working in an isolated git worktree — your file changes will not affect other agents."
		: "WARNING: You are sharing the same working directory with other agents. Be careful not to overwrite files that other agents may be editing."

	return `MULTI-AGENT EXECUTION CONTEXT
=============================
You are operating as one of ${ctx.totalAgents} parallel agents under a Multi-Orchestrator.
Your role: "${ctx.agentTitle}" (${ctx.agentMode} mode)

Other agents working alongside you:
${otherAgents}

${isolationNote}
${fileGuidance}

IMPORTANT INSTRUCTIONS FOR PARALLEL EXECUTION:
1. Focus ONLY on your assigned task. Do not attempt work that belongs to other agents.
2. Be thorough and complete — other agents depend on your output.
3. When you use attempt_completion, provide a DETAILED summary of everything you did:
   - Every file you created or modified (with brief description of changes)
   - Any decisions you made and why
   - Any issues or edge cases you encountered
   - What the next steps would be if applicable
   This detailed summary will be sent to the Multi-Orchestrator for the final report.
4. Do not ask the user questions — you are running autonomously.
5. Complete your task from start to finish without stopping for feedback.
=============================

`
}

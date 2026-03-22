// src/core/multi-orchestrator/report-aggregator.ts
import type { AgentState, MergeResult } from "./types"

/**
 * Aggregate all agent reports and merge results into a unified markdown summary.
 */
export function aggregateReports(
	agents: AgentState[],
	mergeResults: MergeResult[],
): string {
	const sections: string[] = []

	// Header
	sections.push(`# Multi-Orchestration Report`)
	sections.push(`**${agents.length} agents** executed in parallel.\n`)

	// Agent summaries
	sections.push(`## Agent Results\n`)
	for (const agent of agents) {
		const status = agent.status === "completed" ? "✅" : "❌"
		const duration =
			agent.startedAt && agent.completedAt
				? `${Math.round((agent.completedAt - agent.startedAt) / 1000)}s`
				: "unknown"

		sections.push(`### ${status} ${agent.title} (${agent.mode} mode)`)
		sections.push(`- **Status:** ${agent.status}`)
		sections.push(`- **Duration:** ${duration}`)
		if (agent.tokenUsage) {
			sections.push(`- **Tokens:** ${agent.tokenUsage.input} in / ${agent.tokenUsage.output} out`)
		}
		if (agent.completionReport) {
			sections.push(`- **Report:** ${agent.completionReport}`)
		}
		sections.push("")
	}

	// Merge results (if any)
	if (mergeResults.length > 0) {
		sections.push(`## Merge Results\n`)
		for (const result of mergeResults) {
			const status = result.success ? "✅" : "⚠️"
			sections.push(`### ${status} Branch: ${result.branch}`)
			sections.push(`- **Success:** ${result.success}`)
			sections.push(`- **Files changed:** ${result.filesChanged.length}`)
			if (result.conflictsFound > 0) {
				sections.push(`- **Conflicts found:** ${result.conflictsFound}`)
				sections.push(`- **Conflicts resolved:** ${result.conflictsResolved}`)
			}
			sections.push("")
		}
	}

	// Summary stats
	const completed = agents.filter((a) => a.status === "completed").length
	const failed = agents.filter((a) => a.status === "failed").length
	const mergeSuccesses = mergeResults.filter((r) => r.success).length
	const mergeFailures = mergeResults.filter((r) => !r.success).length

	sections.push(`## Summary`)
	sections.push(`- **Agents:** ${completed} completed, ${failed} failed`)
	if (mergeResults.length > 0) {
		sections.push(`- **Merges:** ${mergeSuccesses} succeeded, ${mergeFailures} had conflicts`)
	}

	return sections.join("\n")
}

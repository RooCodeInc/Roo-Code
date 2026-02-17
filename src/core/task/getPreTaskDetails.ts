import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { TaskTypeMapping } from "../../shared/globalFileNames"
import { PLANNING_WORKFLOW_STEPS, PLANNING_INSTRUCTIONS } from "@siid-code/types"
import { experiments } from "../../shared/experiments"
import type { Experiments } from "@siid-code/types"

export interface PreTaskOptions {
	globalStorageUri: vscode.Uri | undefined
	taskGuidesFetched?: boolean
	hasTodoList?: boolean
	cwd?: string
	experiments?: Experiments
}

/**
 * Generates pre-task instructions for the AI.
 * Content is dynamic based on current task state.
 */
export async function getPreTaskDetails(globalStorageUri: vscode.Uri | undefined, options?: Partial<PreTaskOptions>) {
	const { taskGuidesFetched = false, hasTodoList = false, cwd, experiments: exps } = options || {}

	let preTask = "<pre-task>\n\n"

	if (globalStorageUri) {
		// Dynamic instruction based on whether guides were already fetched
		if (taskGuidesFetched) {
			preTask += `**Note:** Task guides already loaded. Focus on execution.\n\n`
		} else {
			preTask += `**IMPORTANT:** Use 'get_task_guides' tool to get all required instructions for your task.\n\n`
		}

		// Dynamic todo list reminder
		if (hasTodoList) {
			preTask += `**Todo List:** A todo list exists. UPDATE it as you progress - don't recreate.\n\n`
		}

		preTask += `---\n\n`

		// Check if planning workflow is enabled
		const planningEnabled = exps ? experiments.isEnabled(exps, "planningWorkflow") : false

		if (planningEnabled) {
			// Check for existing planning files
			let existingPlanningFiles = ""
			if (cwd) {
				try {
					const planningDir = path.join(cwd, ".siid-code", "planning")
					const dirExists = await fs
						.access(planningDir)
						.then(() => true)
						.catch(() => false)
					if (dirExists) {
						const files = await fs.readdir(planningDir)
						const planFiles = files.filter((f) => f.endsWith("-plan.md"))
						if (planFiles.length > 0) {
							existingPlanningFiles = `\n\n**Existing Planning Files:**\n`
							for (const file of planFiles) {
								existingPlanningFiles += `- \`.siid-code/planning/${file}\` (Read and maintain during task)\n`
							}
						}
					}
				} catch {
					// Ignore errors
				}
			}

			// Include planning workflow steps
			preTask += PLANNING_WORKFLOW_STEPS
			preTask += existingPlanningFiles
			preTask += `\n\n**Detailed Planning Instructions:**\n${PLANNING_INSTRUCTIONS}\n\n`
			preTask += `---\n\n`
		}
		// If planning workflow is disabled, don't include planning instructions at all
		preTask += `- **code:** Apex, async Apex, LWC, triggers, test classes, development\n\n`

		preTask += `---\n\n`

		// Available Task Types (from TaskTypeMapping)
		if (!taskGuidesFetched) {
			preTask += `### Available Task Types for get_task_guides\n\n`
			const taskTypes = Object.entries(TaskTypeMapping)
			for (const [taskType, config] of taskTypes) {
				preTask += `- **${taskType}:** ${config.description}\n`
			}
			preTask += `\nExample:\n`
			preTask += `<get_task_guides>\n`
			preTask += `<task_type>create-lwc-with-apex</task_type>\n`
			preTask += `</get_task_guides>\n`
		}
	}

	preTask += `\n</pre-task>`
	return preTask
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use getPreTaskDetails with options object
 */
export async function getPreTaskDetailsLegacy(
	globalStorageUri: vscode.Uri | undefined,
	_includeFileDetails: boolean = false,
) {
	return getPreTaskDetails(globalStorageUri, {})
}

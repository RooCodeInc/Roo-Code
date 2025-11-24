import path from "path"
import os from "os"
import fs from "fs/promises"

import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import delay from "delay"

import type { ExperimentId } from "@roo-code/types"
import { DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT, MAX_WORKSPACE_FILES } from "@roo-code/types"

import { EXPERIMENT_IDS, experiments as Experiments } from "../../shared/experiments"
import { formatLanguage } from "../../shared/language"
import { defaultModeSlug, getFullModeDetails } from "../../shared/modes"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { listFiles } from "../../services/glob/list-files"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../integrations/terminal/Terminal"
import { arePathsEqual } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { getGitStatus } from "../../utils/git"

import { Task } from "../task/Task"
import { formatReminderSection } from "./reminder"
import { getShell, getWindowsTerminalInfo } from "../../utils/shell"
import { getOperatingSystem } from "../../utils/zgsmUtils"
import { defaultLang } from "../../utils/language"

export async function getEnvironmentDetails(cline: Task, includeFileDetails: boolean = false) {
	let details = ""
	// const shell = getShell()
	const clineProvider = cline.providerRef.deref()
	const state = await clineProvider?.getState()
	const {
		terminalOutputLineLimit = 500,
		terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
		maxWorkspaceFiles = MAX_WORKSPACE_FILES,
		terminalShellIntegrationDisabled,
	} = state ?? {}
	const shell = getShell(terminalShellIntegrationDisabled)

	// It could be useful for cline to know if the user went from one or no
	// file to another between messages, so we always include this context.
	const visibleFilePaths = vscode.window.visibleTextEditors
		?.map((editor) => editor.document?.uri?.fsPath)
		.filter(Boolean)
		.map((absolutePath) => path.relative(cline.cwd, absolutePath))
		.slice(0, maxWorkspaceFiles)

	// Filter paths through rooIgnoreController
	const allowedVisibleFiles = cline.rooIgnoreController
		? cline.rooIgnoreController.filterPaths(visibleFilePaths)
		: visibleFilePaths.map((p) => p.toPosix()).join("\n")

	if (allowedVisibleFiles) {
		details += "\n\n# VSCode Visible Files"
		details += `\n${allowedVisibleFiles}`
	}

	const { maxOpenTabsContext } = state ?? {}
	const maxTabs = maxOpenTabsContext ?? 20

	// 获取所有文本编辑器标签的文件路径
	const tabUris = vscode.window.tabGroups.all
		.flatMap((group) => group.tabs)
		.filter((tab) => tab.input instanceof vscode.TabInputText)
		.map((tab) => (tab.input as vscode.TabInputText).uri)
		.filter(Boolean)

	// 使用 Promise.all 并行检查文件是否存在
	const existingTabPaths = await Promise.all(
		tabUris.map(async (uri) => {
			try {
				// 检查文件是否存在
				await fs.stat(uri.fsPath)
				// 文件存在，返回相对路径
				const absolutePath = uri.fsPath
				return path.relative(cline.cwd, absolutePath).toPosix()
			} catch (error) {
				// 文件不存在或无法访问，返回 null
				return null
			}
		}),
	)

	// 过滤掉 null 值（不存在的文件）并限制数量
	const openTabPaths = existingTabPaths.filter((path) => path !== null).slice(0, maxTabs)

	// Filter paths through rooIgnoreController
	const allowedOpenTabs = cline.rooIgnoreController
		? cline.rooIgnoreController.filterPaths(openTabPaths)
		: openTabPaths.map((p) => p.toPosix()).join("\n")

	if (allowedOpenTabs) {
		details += "\n\n# VSCode Open Tabs"
		details += `\n${allowedOpenTabs}`
	}

	// Get task-specific and background terminals.
	const busyTerminals = [
		...TerminalRegistry.getTerminals(true, cline.taskId),
		...TerminalRegistry.getBackgroundTerminals(true),
	]

	const inactiveTerminals = [
		...TerminalRegistry.getTerminals(false, cline.taskId),
		...TerminalRegistry.getBackgroundTerminals(false),
	]

	if (busyTerminals.length > 0) {
		if (cline.didEditFile) {
			await delay(300) // Delay after saving file to let terminals catch up.
		}

		// Wait for terminals to cool down.
		await pWaitFor(() => busyTerminals.every((t) => !TerminalRegistry.isProcessHot(t.id)), {
			interval: 100,
			timeout: 5_000,
		}).catch(() => {})
	}

	// Reset, this lets us know when to wait for saved files to update terminals.
	cline.didEditFile = false

	// Waiting for updated diagnostics lets terminal output be the most
	// up-to-date possible.
	let terminalDetails = ""

	if (busyTerminals.length > 0) {
		// Terminals are cool, let's retrieve their output.
		terminalDetails += "\n\n# Actively Running Terminals"

		for (const busyTerminal of busyTerminals) {
			const cwd = busyTerminal.getCurrentWorkingDirectory()
			terminalDetails += `\n## Terminal ${busyTerminal.id} (Active)`
			terminalDetails += `\n### Working Directory: \`${cwd}\``
			terminalDetails += `\n### Original command: \`${busyTerminal.getLastCommand()}\``
			let newOutput = TerminalRegistry.getUnretrievedOutput(busyTerminal.id)

			if (newOutput) {
				newOutput = Terminal.compressTerminalOutput(
					newOutput,
					terminalOutputLineLimit,
					terminalOutputCharacterLimit,
				)
				terminalDetails += `\n### New Output\n${newOutput}`
			}
		}
	}

	// First check if any inactive terminals in this task have completed
	// processes with output.
	const terminalsWithOutput = inactiveTerminals.filter((terminal) => {
		const completedProcesses = terminal.getProcessesWithOutput()
		return completedProcesses.length > 0
	})

	// Only add the header if there are terminals with output.
	if (terminalsWithOutput.length > 0) {
		terminalDetails += "\n\n# Inactive Terminals with Completed Process Output"

		// Process each terminal with output.
		for (const inactiveTerminal of terminalsWithOutput) {
			let terminalOutputs: string[] = []

			// Get output from completed processes queue.
			const completedProcesses = inactiveTerminal.getProcessesWithOutput()

			for (const process of completedProcesses) {
				let output = process.getUnretrievedOutput()

				if (output) {
					output = Terminal.compressTerminalOutput(
						output,
						terminalOutputLineLimit,
						terminalOutputCharacterLimit,
					)
					terminalOutputs.push(`Command: \`${process.command}\`\n${output}`)
				}
			}

			// Clean the queue after retrieving output.
			inactiveTerminal.cleanCompletedProcessQueue()

			// Add this terminal's outputs to the details.
			if (terminalOutputs.length > 0) {
				const cwd = inactiveTerminal.getCurrentWorkingDirectory()
				terminalDetails += `\n## Terminal ${inactiveTerminal.id} (Inactive)`
				terminalDetails += `\n### Working Directory: \`${cwd}\``
				terminalOutputs.forEach((output) => {
					terminalDetails += `\n### New Output\n${output}`
				})
			}
		}
	}
	// Add recently modified files section.
	const recentlyModifiedFiles = cline.fileContextTracker.getAndClearRecentlyModifiedFiles()

	if (recentlyModifiedFiles.length > 0) {
		details +=
			"\n\n# Recently Modified Files\nThese files have been modified since you last accessed them (file was just edited so you may need to re-read it before editing):"
		for (const filePath of recentlyModifiedFiles) {
			details += `\n${filePath}`
		}
	}

	if (terminalDetails) {
		details += terminalDetails
	}

	// Get settings for time and cost display
	const { includeCurrentTime = true, includeCurrentCost = true, maxGitStatusFiles = 0 } = state ?? {}

	// Add current time information with timezone (if enabled).
	if (includeCurrentTime) {
		const now = new Date()

		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const timeZoneOffset = -now.getTimezoneOffset() / 60 // Convert to hours and invert sign to match conventional notation
		const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
		const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
		const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes.toString().padStart(2, "0")}`
		details += `\n\n# Current Time\nCurrent time in ISO 8601 UTC format: ${now.toISOString()}\nUser time zone: ${timeZone}, UTC${timeZoneOffsetStr}`
	}

	// Add git status information (if enabled with maxGitStatusFiles > 0).
	if (maxGitStatusFiles > 0) {
		const gitStatus = await getGitStatus(cline.cwd, maxGitStatusFiles)
		if (gitStatus) {
			details += `\n\n# Git Status\n${gitStatus}`
		}
	}

	// Add context tokens information (if enabled).
	if (includeCurrentCost) {
		const { totalCost } = getApiMetrics(cline.clineMessages)
		details += `\n\n# Current Cost\n${totalCost !== null ? `$${totalCost.toFixed(2)}` : "(Not available)"}`
	}

	const { id: modelId } = cline.api.getModel()

	// Add current mode and any mode-specific warnings.
	const {
		mode,
		customModes,
		customModePrompts,
		experiments = {} as Record<ExperimentId, boolean>,
		customInstructions: globalCustomInstructions,
		language,
		apiConfiguration,
	} = state ?? {}

	const currentMode = mode ?? defaultModeSlug

	const modeDetails = await getFullModeDetails(currentMode, customModes, customModePrompts, {
		cwd: cline.cwd,
		globalCustomInstructions,
		language: language ?? formatLanguage(await defaultLang()),
		shell,
	})

	const formatUnsupport = (data: string[]): string => {
		return data.join("\n")
	}

	details += `\n\n# Operating System\n${getOperatingSystem()}`
	details += `\n\n# Current Shell\n${shell}`
	const winTerminalInfo = getWindowsTerminalInfo(shell)

	if (winTerminalInfo) {
		const { unsupportSyntax, features } = winTerminalInfo

		if (unsupportSyntax) {
			details += `\n\n## Shell Unsupport Syntax\n${formatUnsupport(unsupportSyntax)}`
		}

		if (features) {
			details += `\n\n## Shell Support Syntax\n${formatUnsupport(features)}`
		}
	}

	details += `\n\n# Current Mode\n`
	details += `<slug>${currentMode}</slug>\n`
	details += `<name>${modeDetails.name}</name>\n`
	details += `<model>${modelId}</model>\n`

	if (Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.POWER_STEERING)) {
		details += `<role>${modeDetails.roleDefinition}</role>\n`

		if (modeDetails.customInstructions) {
			details += `<custom_instructions>${modeDetails.customInstructions}</custom_instructions>\n`
		}
	}

	// Add browser session status - Only show when active to prevent cluttering context
	const isBrowserActive = cline.browserSession.isSessionActive()

	if (isBrowserActive) {
		// Build viewport info for status (prefer actual viewport if available, else fallback to configured setting)
		const configuredViewport = (state?.browserViewportSize as string | undefined) ?? "900x600"
		let configuredWidth: number | undefined
		let configuredHeight: number | undefined
		if (configuredViewport.includes("x")) {
			const parts = configuredViewport.split("x").map((v) => Number(v))
			configuredWidth = parts[0]
			configuredHeight = parts[1]
		}

		let actualWidth: number | undefined
		let actualHeight: number | undefined
		const vp = cline.browserSession.getViewportSize?.()
		if (vp) {
			actualWidth = vp.width
			actualHeight = vp.height
		}

		const width = actualWidth ?? configuredWidth
		const height = actualHeight ?? configuredHeight
		const viewportInfo = width && height ? `\nCurrent viewport size: ${width}x${height} pixels.` : ""

		details += `\n# Browser Session Status\nActive - A browser session is currently open and ready for browser_action commands${viewportInfo}\n`
	}

	if (
		includeFileDetails ||
		(Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.ALWAYS_INCLUDE_FILE_DETAILS) ??
			apiConfiguration?.apiProvider === "zgsm")
	) {
		details += `\n\n# Current Workspace Directory (${cline.cwd.toPosix()}) Files\n`
		const isDesktop = arePathsEqual(cline.cwd, path.join(os.homedir(), "Desktop"))

		if (isDesktop) {
			// Don't want to immediately access desktop since it would show
			// permission popup.
			details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
		} else {
			const maxFiles = maxWorkspaceFiles ?? MAX_WORKSPACE_FILES

			// Early return for limit of 0
			if (maxFiles === 0) {
				details += "(Workspace files context disabled. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(cline.cwd, true, maxFiles)
				const { showRooIgnoredFiles = false } = state ?? {}

				const result = formatResponse.formatFilesList(
					cline.cwd,
					files,
					didHitLimit,
					cline.rooIgnoreController,
					showRooIgnoredFiles,
				)

				details += result
			}
		}
	}

	const todoListEnabled =
		state && typeof state.apiConfiguration?.todoListEnabled === "boolean"
			? state.apiConfiguration.todoListEnabled
			: true
	const reminderSection = todoListEnabled ? formatReminderSection(cline.todoList) : ""
	return `<environment_details>\n${details.trim()}\n${reminderSection}\n</environment_details>`
}

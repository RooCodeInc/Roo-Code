import os from "os"
import * as path from "path"
import fs from "fs/promises"
import EventEmitter from "events"

import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"
import axios from "axios"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import {
	type TaskProviderLike,
	type TaskProviderEvents,
	type GlobalState,
	type ProviderName,
	type ProviderSettings,
	type RooCodeSettings,
	type ProviderSettingsEntry,
	type ProviderSettingsWithId,
	type TelemetryProperties,
	type TelemetryPropertiesProvider,
	type CodeActionId,
	type CodeActionName,
	type TerminalActionId,
	type TerminalActionPromptType,
	type HistoryItem,
	type CloudUserInfo,
	RooCodeEventName,
	requestyDefaultModelId,
	openRouterDefaultModelId,
	glamaDefaultModelId,
	ORGANIZATION_ALLOW_ALL,
	DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
	DEFAULT_WRITE_DELAY_MS,
} from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"
import { CloudService, getRooCodeApiUrl } from "@roo-code/cloud"

import { Package } from "../../shared/package"
import { findLast } from "../../shared/array"
import { supportPrompt } from "../../shared/support-prompt"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { ExtensionMessage, MarketplaceInstalledMetadata } from "../../shared/ExtensionMessage"
import { Mode, defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { getDefaultModelForMode, getModelsForMode } from "../../shared/mode-models"
import { experimentDefault } from "../../shared/experiments"
import { formatLanguage } from "../../shared/language"
import { analyzeTaskComplexity } from "../task/analyzeTaskComplexity"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { EMBEDDING_MODEL_PROFILES } from "../../shared/embeddingModels"
import { ProfileValidator } from "../../shared/ProfileValidator"
import { perfLog } from "../../utils/performanceLogger"

import { Terminal } from "../../integrations/terminal/Terminal"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { exportTaskDebugJson } from "../../integrations/misc/export-debug-json"
import { getTheme } from "../../integrations/theme/getTheme"
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"

import { McpHub } from "../../services/mcp/McpHub"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { MarketplaceManager } from "../../services/marketplace"
import { ShadowCheckpointService } from "../../services/checkpoints/ShadowCheckpointService"
import { CodeIndexManager } from "../../services/code-index/manager"
import type { IndexProgressUpdate } from "../../services/code-index/interfaces/manager"
import { MdmService } from "../../services/mdm/MdmService"

import { fileExistsAtPath } from "../../utils/fs"
import { setTtsEnabled, setTtsSpeed } from "../../utils/tts"
import { getWorkspaceGitInfo } from "../../utils/git"
import { getWorkspacePath } from "../../utils/path"

import { setPanel } from "../../activate/registerCommands"

import { t } from "../../i18n"

import { buildApiHandler } from "../../api"
import { forceFullModelDetailsLoad, hasLoadedFullDetails } from "../../api/providers/fetchers/lmstudio"

import { ContextProxy } from "../config/ContextProxy"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { CustomModesManager } from "../config/CustomModesManager"
import { Task, TaskOptions } from "../task/Task"
import { webviewMessageHandler } from "./webviewMessageHandler"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { logger } from "../../utils/logging"
import { isAuthenticated } from "../../utils/firebaseHelper"

/**
 * https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts
 * https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
 */

export class ClineProvider
	extends EventEmitter<TaskProviderEvents>
	implements vscode.WebviewViewProvider, TelemetryPropertiesProvider, TaskProviderLike
{
	// Used in package.json as the view's id. This value cannot be changed due
	// to how VSCode caches views based on their id, and updating the id would
	// break existing instances of the extension.
	public static readonly sideBarId = `${Package.name}.SidebarProvider`
	public static readonly tabPanelId = `${Package.name}.TabPanelProvider`
	private static activeInstances: Set<ClineProvider> = new Set()
	private disposables: vscode.Disposable[] = []
	private webviewDisposables: vscode.Disposable[] = []
	private view?: vscode.WebviewView | vscode.WebviewPanel
	private clineStack: Task[] = []
	private codeIndexStatusSubscription?: vscode.Disposable
	private currentWorkspaceManager?: CodeIndexManager
	private _workspaceTracker?: WorkspaceTracker // workSpaceTracker read-only for access outside this class
	public get workspaceTracker(): WorkspaceTracker | undefined {
		return this._workspaceTracker
	}
	protected mcpHub?: McpHub // Change from private to protected
	private marketplaceManager: MarketplaceManager
	private mdmService?: MdmService
	private cachedFirebaseAuthState?: boolean // Cache for Firebase authentication state

	public isViewLaunched = false
	public settingsImportedAt?: number
	public readonly latestAnnouncementId = "jul-29-2025-3-25-0" // Update for v3.25.0 announcement
	public readonly providerSettingsManager: ProviderSettingsManager
	public readonly customModesManager: CustomModesManager
	public readonly api: import("../../extension/api").API

	constructor(
		readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
		private readonly renderContext: "sidebar" | "editor" = "sidebar",
		public readonly contextProxy: ContextProxy,
		mdmService?: MdmService,
		apiInstance?: import("../../extension/api").API,
	) {
		const constructorStart = Date.now()
		super()

		// Don't call this.log() here - it blocks for 7-8 seconds on first call due to output channel initialization

		ClineProvider.activeInstances.add(this)

		this.mdmService = mdmService

		this.updateGlobalState("codebaseIndexModels", EMBEDDING_MODEL_PROFILES)

		// Start configuration loading (which might trigger indexing) in the background.
		// Don't await, allowing activation to continue immediately.

		// Register this provider with the telemetry service to enable it to add
		// properties like mode and provider.
		TelemetryService.instance.setProvider(this)

		this._workspaceTracker = new WorkspaceTracker(this)

		this.providerSettingsManager = new ProviderSettingsManager(this.context)

		this.customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview()
		})

		// Initialize MCP Hub in the background (deferred to not block activation)
		Promise.resolve().then(async () => {
			try {
				const hub = await McpServerManager.getInstance(this.context, this)
				this.mcpHub = hub
				this.mcpHub.registerClient()
			} catch (error) {}
		})

		this.marketplaceManager = new MarketplaceManager(this.context, this.customModesManager)

		// Initialize Roo Code Cloud profile sync.
		this.initializeCloudProfileSync().catch((error) => {})

		this.api = apiInstance!
	}

	/**
	 * Initialize cloud profile synchronization
	 */
	private async initializeCloudProfileSync() {
		try {
			// Check if authenticated and sync profiles
			if (CloudService.hasInstance() && CloudService.instance.isAuthenticated()) {
				await this.syncCloudProfiles()
			}

			// Set up listener for future updates
			if (CloudService.hasInstance()) {
				CloudService.instance.on("settings-updated", this.handleCloudSettingsUpdate)
			}
		} catch (error) {
			this.log(`Error in initializeCloudProfileSync: ${error}`)
		}
	}

	/**
	 * Handle cloud settings updates
	 */
	private handleCloudSettingsUpdate = async () => {
		try {
			await this.syncCloudProfiles()
		} catch (error) {
			this.log(`Error handling cloud settings update: ${error}`)
		}
	}

	/**
	 * Synchronize cloud profiles with local profiles
	 */
	private async syncCloudProfiles() {
		try {
			const settings = CloudService.instance.getOrganizationSettings()
			if (!settings?.providerProfiles) {
				return
			}

			const currentApiConfigName = this.getGlobalState("currentApiConfigName")
			const result = await this.providerSettingsManager.syncCloudProfiles(
				settings.providerProfiles as any,
				currentApiConfigName,
			)

			if (result.hasChanges) {
				// Update list
				await this.updateGlobalState("listApiConfigMeta", await this.providerSettingsManager.listConfig())

				if (result.activeProfileChanged && result.activeProfileId) {
					// Reload full settings for new active profile
					const profile = await this.providerSettingsManager.getProfile({
						id: result.activeProfileId,
					})
					await this.activateProviderProfile({ name: profile.name })
				}

				await this.postStateToWebview()
			}
		} catch (error) {
			this.log(`Error syncing cloud profiles: ${error}`)
		}
	}

	// Adds a new Task instance to clineStack, marking the start of a new task.
	// The instance is pushed to the top of the stack (LIFO order).
	// When the task is completed, the top instance is removed, reactivating the previous task.
	async addClineToStack(task: Task) {
		// Add this cline instance into the stack that represents the order of all the called tasks.
		this.clineStack.push(task)
		task.emit(RooCodeEventName.TaskFocused)

		// Perform special setup provider specific tasks.
		await this.performPreparationTasks(task)

		// Ensure getState() resolves correctly.
		const state = await this.getState()

		if (!state || typeof state.mode !== "string") {
			throw new Error(t("common:errors.retrieve_current_mode"))
		}
	}

	async performPreparationTasks(cline: Task) {
		// LMStudio: We need to force model loading in order to read its context
		// size; we do it now since we're starting a task with that model selected.
		if (cline.apiConfiguration && cline.apiConfiguration.apiProvider === "lmstudio") {
			try {
				if (!hasLoadedFullDetails(cline.apiConfiguration.lmStudioModelId!)) {
					await forceFullModelDetailsLoad(
						cline.apiConfiguration.lmStudioBaseUrl ?? "http://localhost:1234",
						cline.apiConfiguration.lmStudioModelId!,
					)
				}
			} catch (error) {
				this.log(`Failed to load full model details for LM Studio: ${error}`)
				vscode.window.showErrorMessage(error.message)
			}
		}
	}

	// Removes and destroys the top Cline instance (the current finished task),
	// activating the previous one (resuming the parent task).
	async removeClineFromStack() {
		if (this.clineStack.length === 0) {
			return
		}

		// Pop the top Cline instance from the stack.
		let task = this.clineStack.pop()

		if (task) {
			try {
				// Abort the running task and set isAbandoned to true so
				// all running promises will exit as well.
				await task.abortTask(true)
			} catch (e) {
				this.log(
					`[subtasks] encountered error while aborting task ${task.taskId}.${task.instanceId}: ${e.message}`,
				)
			}

			task.emit(RooCodeEventName.TaskUnfocused)

			// Make sure no reference kept, once promises end it will be
			// garbage collected.
			task = undefined
		}
	}

	// returns the current cline object in the stack (the top one)
	// if the stack is empty, returns undefined
	getCurrentCline(): Task | undefined {
		if (this.clineStack.length === 0) {
			return undefined
		}
		return this.clineStack[this.clineStack.length - 1]
	}

	// returns the current clineStack length (how many cline objects are in the stack)
	getClineStackSize(): number {
		return this.clineStack.length
	}

	public getCurrentTaskStack(): string[] {
		return this.clineStack.map((cline) => cline.taskId)
	}

	// remove the current task/cline instance (at the top of the stack), so this task is finished
	// and resume the previous task/cline instance (if it exists)
	// this is used when a sub task is finished and the parent task needs to be resumed
	async finishSubTask(lastMessage: string) {
		// remove the last cline instance from the stack (this is the finished sub task)
		await this.removeClineFromStack()
		// resume the last cline instance in the stack (if it exists - this is the 'parent' calling task)
		await this.getCurrentCline()?.resumePausedTask(lastMessage)
	}

	// Clear the current task without treating it as a subtask
	// This is used when the user cancels a task that is not a subtask
	async clearTask() {
		await this.removeClineFromStack()
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	private clearWebviewResources() {
		while (this.webviewDisposables.length) {
			const x = this.webviewDisposables.pop()
			if (x) {
				x.dispose()
			}
		}
	}

	async dispose() {
		this.log("Disposing ClineProvider...")

		// Clear all tasks from the stack.
		while (this.clineStack.length > 0) {
			await this.removeClineFromStack()
		}

		this.log("Cleared all tasks")

		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.log("Disposed webview")
		}

		this.clearWebviewResources()

		// Clean up cloud service event listener
		if (CloudService.hasInstance()) {
			CloudService.instance.off("settings-updated", this.handleCloudSettingsUpdate)
		}

		while (this.disposables.length) {
			const x = this.disposables.pop()

			if (x) {
				x.dispose()
			}
		}

		this._workspaceTracker?.dispose()
		this._workspaceTracker = undefined
		await this.mcpHub?.unregisterClient()
		this.mcpHub = undefined
		this.marketplaceManager?.cleanup()
		this.customModesManager?.dispose()
		this.log("Disposed all disposables")
		ClineProvider.activeInstances.delete(this)

		// Clean up any event listeners attached to this provider
		this.removeAllListeners()

		McpServerManager.unregisterProvider(this)
	}

	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance) => instance.view?.visible === true)
	}

	public static async getInstance(): Promise<ClineProvider | undefined> {
		let visibleProvider = ClineProvider.getVisibleInstance()

		// If no visible provider, try to show the sidebar view
		if (!visibleProvider) {
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
			// Wait briefly for the view to become visible
			await delay(100)
			visibleProvider = ClineProvider.getVisibleInstance()
		}

		// If still no visible provider, return
		if (!visibleProvider) {
			return
		}

		return visibleProvider
	}

	public static async isActiveTask(): Promise<boolean> {
		const visibleProvider = await ClineProvider.getInstance()

		if (!visibleProvider) {
			return false
		}

		// Check if there is a cline instance in the stack (if this provider has an active task)
		if (visibleProvider.getCurrentCline()) {
			return true
		}

		return false
	}

	public static async handleCodeAction(
		command: CodeActionId,
		promptType: CodeActionName,
		params: Record<string, string | any[]>,
	): Promise<void> {
		// Capture telemetry for code action usage
		TelemetryService.instance.captureCodeActionUsed(promptType)

		const visibleProvider = await ClineProvider.getInstance()

		if (!visibleProvider) {
			return
		}

		const { customSupportPrompts } = await visibleProvider.getState()

		// TODO: Improve type safety for promptType.
		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command === "addToContext") {
			await visibleProvider.postMessageToWebview({ type: "invoke", invoke: "setChatBoxMessage", text: prompt })
			return
		}

		await visibleProvider.initClineWithTask(prompt)
	}

	public static async handleTerminalAction(
		command: TerminalActionId,
		promptType: TerminalActionPromptType,
		params: Record<string, string | any[]>,
	): Promise<void> {
		TelemetryService.instance.captureCodeActionUsed(promptType)

		const visibleProvider = await ClineProvider.getInstance()

		if (!visibleProvider) {
			return
		}

		const { customSupportPrompts } = await visibleProvider.getState()
		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command === "terminalAddToContext") {
			await visibleProvider.postMessageToWebview({ type: "invoke", invoke: "setChatBoxMessage", text: prompt })
			return
		}

		try {
			await visibleProvider.initClineWithTask(prompt)
		} catch (error) {
			if (error instanceof OrganizationAllowListViolationError) {
				// Errors from terminal commands seem to get swallowed / ignored.
				vscode.window.showErrorMessage(error.message)
			}

			throw error
		}
	}

	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		const resolveStart = Date.now()

		this.view = webviewView

		// Set panel reference according to webview type
		const inTabMode = "onDidChangeViewState" in webviewView
		if (inTabMode) {
			// Tag page type
			setPanel(webviewView, "tab")
		} else if ("onDidChangeVisibility" in webviewView) {
			// Sidebar Type
			setPanel(webviewView, "sidebar")
		}

		// Initialize out-of-scope variables that need to receive persistent global state values
		this.getState().then(
			({
				terminalShellIntegrationTimeout = Terminal.defaultShellIntegrationTimeout,
				terminalShellIntegrationDisabled = false,
				terminalCommandDelay = 0,
				terminalZshClearEolMark = true,
				terminalZshOhMy = false,
				terminalZshP10k = false,
				terminalPowershellCounter = false,
				terminalZdotdir = false,
			}) => {
				Terminal.setShellIntegrationTimeout(terminalShellIntegrationTimeout)
				Terminal.setShellIntegrationDisabled(terminalShellIntegrationDisabled)
				Terminal.setCommandDelay(terminalCommandDelay)
				Terminal.setTerminalZshClearEolMark(terminalZshClearEolMark)
				Terminal.setTerminalZshOhMy(terminalZshOhMy)
				Terminal.setTerminalZshP10k(terminalZshP10k)
				Terminal.setPowershellCounter(terminalPowershellCounter)
				Terminal.setTerminalZdotdir(terminalZdotdir)
			},
		)

		// Initialize tts enabled state
		this.getState().then(({ ttsEnabled }) => {
			setTtsEnabled(ttsEnabled ?? false)
		})

		// Initialize tts speed state
		this.getState().then(({ ttsSpeed }) => {
			setTtsSpeed(ttsSpeed ?? 1)
		})

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this.contextProxy.extensionUri],
		}

		const htmlGenerationStart = Date.now()
		webviewView.webview.html =
			this.contextProxy.extensionMode === vscode.ExtensionMode.Development
				? await this.getHMRHtmlContent(webviewView.webview)
				: this.getHtmlContent(webviewView.webview)

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is received
		this.setWebviewMessageListener(webviewView.webview)

		// Initialize code index status subscription for the current workspace
		this.updateCodeIndexStatusSubscription()

		// Listen for active editor changes to update code index status for the current workspace
		const activeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => {
			// Update subscription when workspace might have changed
			this.updateCodeIndexStatusSubscription()
		})
		this.webviewDisposables.push(activeEditorSubscription)

		// Logs show up in bottom panel > Debug Console

		// Listen for when the panel becomes visible
		// https://github.com/microsoft/vscode-discussions/discussions/840
		if ("onDidChangeViewState" in webviewView) {
			// WebviewView and WebviewPanel have all the same properties except for this visibility listener
			// panel
			const viewStateDisposable = webviewView.onDidChangeViewState(() => {
				if (this.view?.visible) {
					this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
				}
			})
			this.webviewDisposables.push(viewStateDisposable)
		} else if ("onDidChangeVisibility" in webviewView) {
			// sidebar
			const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
				if (this.view?.visible) {
					this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
				}
			})
			this.webviewDisposables.push(visibilityDisposable)
		}

		// Listen for when the view is disposed
		// This happens when the user closes the view or when the view is closed programmatically
		webviewView.onDidDispose(
			async () => {
				if (inTabMode) {
					this.log("Disposing ClineProvider instance for tab view")
					await this.dispose()
				} else {
					this.log("Clearing webview resources for sidebar view")
					this.clearWebviewResources()
					// Reset current workspace manager reference when view is disposed
					this.currentWorkspaceManager = undefined
				}
			},
			null,
			this.disposables,
		)

		// Listen for when color changes
		const configDisposable = vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e && e.affectsConfiguration("workbench.colorTheme")) {
				// Sends latest theme name to webview
				await this.postMessageToWebview({ type: "theme", text: JSON.stringify(await getTheme()) })
			}
		})
		this.webviewDisposables.push(configDisposable)

		// If the extension is starting a new session, clear previous task state.
		await this.removeClineFromStack()
	}

	public async initClineWithSubTask(parent: Task, task?: string, images?: string[]) {
		return this.initClineWithTask(task, images, parent)
	}

	// When initializing a new task, (not from history but from a tool command
	// new_task) there is no need to remove the previous task since the new
	// task is a subtask of the previous one, and when it finishes it is removed
	// from the stack and the caller is resumed in this way we can have a chain
	// of tasks, each one being a sub task of the previous one until the main
	// task is finished.
	public async initClineWithTask(
		text?: string,
		images?: string[],
		parentTask?: Task,
		options: Partial<
			Pick<
				TaskOptions,
				"enableDiff" | "enableCheckpoints" | "fuzzyMatchThreshold" | "consecutiveMistakeLimit" | "experiments"
			>
		> = {},
	) {
		const {
			apiConfiguration,
			organizationAllowList,
			diffEnabled: enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			experiments: baseExperiments,
		} = await this.getState()

		if (!ProfileValidator.isProfileAllowed(apiConfiguration, organizationAllowList)) {
			throw new OrganizationAllowListViolationError(t("common:errors.violated_organization_allowlist"))
		}

		// Analyze task complexity and auto-enable/disable planning workflow
		// unless experiments are explicitly provided in options (user override)
		let experiments = baseExperiments
		let complexity = { isComplex: false, score: 0, factors: [] as string[] }

		if (!options.experiments) {
			complexity = analyzeTaskComplexity(text)
			experiments = {
				...baseExperiments,
				planningWorkflow: complexity.isComplex,
			}
			// Update global state with the new experiments value so toggle reflects in UI
			await this.updateGlobalState("experiments", experiments)
		} else {
			// Use provided experiments, but don't override if planningWorkflow is not explicitly set
			experiments = { ...baseExperiments, ...options.experiments }
		}

		// Extract experiments from options to prevent it from being spread again
		const { experiments: optionsExperiments, ...restOptions } = options

		const task = new Task({
			provider: this,
			apiConfiguration,
			enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
			task: text,
			images,
			experiments,
			rootTask: this.clineStack.length > 0 ? this.clineStack[0] : undefined,
			parentTask,
			taskNumber: this.clineStack.length + 1,
			onCreated: (instance) => this.emit(RooCodeEventName.TaskCreated, instance),
			...restOptions,
		})

		await this.addClineToStack(task)

		// Listen for task completion to update webview state
		task.on(RooCodeEventName.TaskCompleted, async () => {
			await this.postStateToWebview()
		})

		// Listen for task idle/active to update timer in webview
		task.on(RooCodeEventName.TaskIdle, async () => {
			await this.postStateToWebview()
		})
		task.on(RooCodeEventName.TaskActive, async () => {
			await this.postStateToWebview()
		})

		// Add complexity analysis message - show in chat after initial task message
		if (!options.experiments && complexity.score > 0) {
			const complexityText = complexity.isComplex
				? `**Creating planning file for better task organization and tracking.**`
				: `**No plan file required.**`

			// Send message after a small delay to ensure the task's initial say() message is in place
			setTimeout(() => {
				const complexityMessage: any = {
					ts: Date.now(),
					type: "say",
					say: "text",
					text: complexityText,
				}

				// Add to the task's messages so it appears in the chat history
				task.clineMessages.push(complexityMessage)

				// Notify webview to update
				this.postStateToWebview().catch((err: any) => {
					console.error("Failed to update webview with complexity message:", err)
				})
			}, 150)
		}

		// Update webview with new experiments state
		await this.postStateToWebview()

		this.log(
			`[subtasks] ${task.parentTask ? "child" : "parent"} task ${task.taskId}.${task.instanceId} instantiated`,
		)

		return task
	}

	public async initClineWithHistoryItem(historyItem: HistoryItem & { rootTask?: Task; parentTask?: Task }) {
		await this.removeClineFromStack()

		// Restore parent/root task references from IDs if not already provided
		// This allows subtask relationships to survive window reloads
		let parentTask = historyItem.parentTask
		let rootTask = historyItem.rootTask

		if (!parentTask && historyItem.parentTaskId) {
			// Try to find the parent task in the current stack by ID
			parentTask = this.clineStack.find((t) => t.taskId === historyItem.parentTaskId)
			if (parentTask) {
				this.log(`[subtasks] Restored parentTask reference from stack: ${historyItem.parentTaskId}`)
			} else {
				// Parent not in stack - try to load it from history first (recursive restore)
				try {
					const parentHistory = await this.getTaskWithId(historyItem.parentTaskId)
					if (parentHistory) {
						this.log(
							`[subtasks] Parent task ${historyItem.parentTaskId} not in stack, loading from history first`,
						)
						// Recursively load the parent task (this will add it to the stack)
						// Note: We don't await removeClineFromStack for the parent since we want it to stay
						parentTask = await this.loadParentTaskFromHistory(parentHistory.historyItem)
						if (parentTask) {
							this.log(`[subtasks] Successfully restored parent task chain from history`)
						}
					}
				} catch (error) {
					this.log(`[subtasks] Warning: Could not restore parent task ${historyItem.parentTaskId}: ${error}`)
				}
			}
		}

		if (!rootTask && historyItem.rootTaskId) {
			// Try to find the root task in the current stack by ID
			rootTask = this.clineStack.find((t) => t.taskId === historyItem.rootTaskId)
			if (rootTask) {
				this.log(`[subtasks] Restored rootTask reference from ID: ${historyItem.rootTaskId}`)
			}
		}

		// If the history item has a saved mode, restore it and its associated API configuration
		if (historyItem.mode) {
			// Validate that the mode still exists
			const customModes = await this.customModesManager.getCustomModes()
			const modeExists = getModeBySlug(historyItem.mode, customModes) !== undefined

			if (!modeExists) {
				// Mode no longer exists, fall back to default mode
				this.log(
					`Mode '${historyItem.mode}' from history no longer exists. Falling back to default mode '${defaultModeSlug}'.`,
				)
				historyItem.mode = defaultModeSlug
			}

			await this.updateGlobalState("mode", historyItem.mode)

			// Load the saved API config for the restored mode if it exists
			// Note: Modes no longer have associated API configs - configs are selected manually
			const modeConfig = getModeBySlug(historyItem.mode, customModes)

			const listApiConfig = await this.providerSettingsManager.listConfig()

			// Update listApiConfigMeta first to ensure UI has latest data
			await this.updateGlobalState("listApiConfigMeta", listApiConfig)
		}

		const {
			apiConfiguration,
			diffEnabled: enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			experiments,
		} = await this.getState()

		const task = new Task({
			provider: this,
			apiConfiguration,
			enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
			historyItem,
			experiments,
			rootTask: rootTask,
			parentTask: parentTask,
			taskNumber: historyItem.number,
			onCreated: (instance) => this.emit(RooCodeEventName.TaskCreated, instance),
		})

		// Listen for task completion to update webview state
		task.on(RooCodeEventName.TaskCompleted, async () => {
			await this.postStateToWebview()
		})

		// Listen for task idle/active to update timer in webview
		task.on(RooCodeEventName.TaskIdle, async () => {
			await this.postStateToWebview()
		})
		task.on(RooCodeEventName.TaskActive, async () => {
			await this.postStateToWebview()
		})

		await this.addClineToStack(task)

		this.log(
			`[subtasks] ${task.parentTask ? "child" : "parent"} task ${task.taskId}.${task.instanceId} instantiated`,
		)

		return task
	}

	/**
	 * Load a parent task from history and add it to the stack in paused state.
	 * This is used to restore the parent task chain when loading a subtask after window reload.
	 */
	private async loadParentTaskFromHistory(historyItem: HistoryItem): Promise<Task | undefined> {
		const {
			apiConfiguration,
			diffEnabled: enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			experiments,
		} = await this.getState()

		// Recursively load the parent's parent if needed
		let parentTask: Task | undefined = undefined
		let rootTask: Task | undefined = undefined

		if (historyItem.parentTaskId) {
			parentTask = this.clineStack.find((t) => t.taskId === historyItem.parentTaskId)
			if (!parentTask) {
				try {
					const grandparentHistory = await this.getTaskWithId(historyItem.parentTaskId)
					if (grandparentHistory) {
						parentTask = await this.loadParentTaskFromHistory(grandparentHistory.historyItem)
					}
				} catch (error) {
					this.log(`[subtasks] Could not load grandparent task: ${error}`)
				}
			}
		}

		if (historyItem.rootTaskId) {
			rootTask = this.clineStack.find((t) => t.taskId === historyItem.rootTaskId)
		}

		// Create the parent task in paused/non-starting state
		const task = new Task({
			provider: this,
			apiConfiguration,
			enableDiff,
			enableCheckpoints,
			fuzzyMatchThreshold,
			consecutiveMistakeLimit: apiConfiguration.consecutiveMistakeLimit,
			historyItem,
			experiments,
			rootTask: rootTask,
			parentTask: parentTask,
			taskNumber: historyItem.number,
			startTask: false, // Don't start the task - it should be paused waiting for subtask
			onCreated: (instance) => this.emit(RooCodeEventName.TaskCreated, instance),
		})

		// Listen for task completion to update webview state
		task.on(RooCodeEventName.TaskCompleted, async () => {
			await this.postStateToWebview()
		})

		// Listen for task idle/active to update timer in webview
		task.on(RooCodeEventName.TaskIdle, async () => {
			await this.postStateToWebview()
		})
		task.on(RooCodeEventName.TaskActive, async () => {
			await this.postStateToWebview()
		})

		// Mark as paused since it's waiting for a subtask to complete
		task.isPaused = true

		// Add to stack (but don't call addClineToStack which has additional setup)
		this.clineStack.push(task)

		this.log(`[subtasks] Loaded parent task ${task.taskId} from history in paused state`)

		return task
	}

	public async postMessageToWebview(message: ExtensionMessage) {
		await this.view?.webview.postMessage(message)
	}

	private async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
		// Try to read the port from the file
		let localPort = "5173" // Default fallback
		try {
			const fs = require("fs")
			const path = require("path")
			const portFilePath = path.resolve(__dirname, "../../.vite-port")

			if (fs.existsSync(portFilePath)) {
				localPort = fs.readFileSync(portFilePath, "utf8").trim()
			} else {
				console.log(
					`[ClineProvider:Vite] Port file not found at ${portFilePath}, using default port: ${localPort}`,
				)
			}
		} catch (err) {
			// Continue with default port if file reading fails
		}

		const localServerUrl = `localhost:${localPort}`

		// Quick check if Vite dev server is running with reliable timeout
		const viteCheckStart = Date.now()
		let viteIsRunning = false

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Timeout")), 500),
			)

			// Race between fetch and timeout
			await Promise.race([fetch(`http://${localServerUrl}`, { method: "HEAD" }), timeoutPromise])

			viteIsRunning = true
		} catch (error) {
			console.log(
				`⏱️ Vite dev server check failed after ${Date.now() - viteCheckStart}ms - using production build`,
			)
		}

		// If dev server not running, fall back to production build
		if (!viteIsRunning) {
			return this.getHtmlContent(webview)
		}

		const nonce = getNonce()

		const stylesUri = getUri(webview, this.contextProxy.extensionUri, [
			"webview-ui",
			"build",
			"assets",
			"index.css",
		])

		const codiconsUri = getUri(webview, this.contextProxy.extensionUri, ["assets", "codicons", "codicon.css"])
		const materialIconsUri = getUri(webview, this.contextProxy.extensionUri, [
			"assets",
			"vscode-material-icons",
			"icons",
		])
		const imagesUri = getUri(webview, this.contextProxy.extensionUri, ["assets", "images"])
		const audioUri = getUri(webview, this.contextProxy.extensionUri, ["webview-ui", "audio"])

		const file = "src/index.tsx"
		const scriptUri = `http://${localServerUrl}/${file}`

		const reactRefresh = /*html*/ `
			<script nonce="${nonce}" type="module">
				import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
				RefreshRuntime.injectIntoGlobalHook(window)
				window.$RefreshReg$ = () => {}
				window.$RefreshSig$ = () => (type) => type
				window.__vite_plugin_react_preamble_installed__ = true
			</script>
		`

		const csp = [
			"default-src 'none'",
			`font-src ${webview.cspSource} data:`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
			`img-src ${webview.cspSource} https://storage.googleapis.com https://img.clerk.com data:`,
			`media-src ${webview.cspSource}`,
			`script-src 'unsafe-eval' ${webview.cspSource} https://* https://*.posthog.com http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
			`connect-src ${webview.cspSource} https://* https://*.posthog.com ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
		]

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<link href="${codiconsUri}" rel="stylesheet" />
					<script nonce="${nonce}">
						window.IMAGES_BASE_URI = "${imagesUri}"
						window.AUDIO_BASE_URI = "${audioUri}"
						window.MATERIAL_ICONS_BASE_URI = "${materialIconsUri}"
					</script>
					<title>Roo Code</title>
				</head>
				<body>
					<div id="root"></div>
					${reactRefresh}
					<script type="module" src="${scriptUri}"></script>
				</body>
			</html>
		`
	}

	/**
	 * Defines and returns the HTML that should be rendered within the webview panel.
	 *
	 * @remarks This is also the place where references to the React webview build files
	 * are created and inserted into the webview HTML.
	 *
	 * @param webview A reference to the extension webview
	 * @param extensionUri The URI of the directory containing the extension
	 * @returns A template string literal containing the HTML that should be
	 * rendered within the webview panel
	 */
	private getHtmlContent(webview: vscode.Webview): string {
		// Get the local path to main script run in the webview,
		// then convert it to a uri we can use in the webview.

		// The CSS file from the React build output
		const stylesUri = getUri(webview, this.contextProxy.extensionUri, [
			"webview-ui",
			"build",
			"assets",
			"index.css",
		])

		const scriptUri = getUri(webview, this.contextProxy.extensionUri, ["webview-ui", "build", "assets", "index.js"])
		const codiconsUri = getUri(webview, this.contextProxy.extensionUri, ["assets", "codicons", "codicon.css"])
		const materialIconsUri = getUri(webview, this.contextProxy.extensionUri, [
			"assets",
			"vscode-material-icons",
			"icons",
		])
		const imagesUri = getUri(webview, this.contextProxy.extensionUri, ["assets", "images"])
		const audioUri = getUri(webview, this.contextProxy.extensionUri, ["webview-ui", "audio"])

		// Use a nonce to only allow a specific script to be run.
		/*
		content security policy of your webview to only allow scripts that have a specific nonce
		create a content security policy meta tag so that only loading scripts with a nonce is allowed
		As your extension grows you will likely want to add custom styles, fonts, and/or images to your webview. If you do, you will need to update the content security policy meta tag to explicitly allow for these resources. E.g.
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
		- 'unsafe-inline' is required for styles due to vscode-webview-toolkit's dynamic style injection
		- since we pass base64 images to the webview, we need to specify img-src ${webview.cspSource} data:;

		in meta tag we add nonce attribute: A cryptographic nonce (only used once) to allow scripts. The server must generate a unique nonce value each time it transmits a policy. It is critical to provide a nonce that cannot be guessed as bypassing a resource's policy is otherwise trivial.
		*/
		const nonce = getNonce()

		// Tip: Install the es6-string-html VS Code extension to enable code highlighting below
		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https://storage.googleapis.com https://img.clerk.com data:; media-src ${webview.cspSource}; script-src ${webview.cspSource} 'wasm-unsafe-eval' 'nonce-${nonce}' https://us-assets.i.posthog.com 'strict-dynamic'; connect-src ${webview.cspSource} https://openrouter.ai https://api.requesty.ai https://us.i.posthog.com https://us-assets.i.posthog.com;">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
			<script nonce="${nonce}">
				window.IMAGES_BASE_URI = "${imagesUri}"
				window.AUDIO_BASE_URI = "${audioUri}"
				window.MATERIAL_ICONS_BASE_URI = "${materialIconsUri}"
			</script>
            <title>Roo Code</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is received.
	 *
	 * @param webview A reference to the extension webview
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		const onReceiveMessage = async (message: WebviewMessage) =>
			webviewMessageHandler(this, message, this.marketplaceManager)

		const messageDisposable = webview.onDidReceiveMessage(onReceiveMessage)
		this.webviewDisposables.push(messageDisposable)
	}

	/**
	 * Handle switching to a new mode
	 * @param newMode The mode to switch to
	 */
	public async handleModeSwitch(newMode: Mode) {
		logger.info(`Switching to mode: ${newMode}`)
		const cline = this.getCurrentCline()

		if (cline) {
			TelemetryService.instance.captureModeSwitch(cline.taskId, newMode)
			cline.emit(RooCodeEventName.TaskModeSwitched, cline.taskId, newMode)

			// Store the current mode in case we need to rollback
			const previousMode = (cline as any)._taskMode

			try {
				// Update the task history with the new mode first
				const history = this.getGlobalState("taskHistory") ?? []
				const taskHistoryItem = history.find((item) => item.id === cline.taskId)
				if (taskHistoryItem) {
					taskHistoryItem.mode = newMode
					await this.updateTaskHistory(taskHistoryItem)
				}

				// Only update the task's mode after successful persistence
				;(cline as any)._taskMode = newMode
			} catch (error) {
				// If persistence fails, log the error but don't update the in-memory state
				this.log(
					`Failed to persist mode switch for task ${cline.taskId}: ${error instanceof Error ? error.message : String(error)}`,
				)

				// Optionally, we could emit an event to notify about the failure
				// This ensures the in-memory state remains consistent with persisted state
				throw error
			}
		}

		await this.updateGlobalState("mode", newMode)

		// Auto-switch model to the default/recommended model for this mode
		// Respect useFreeModels setting when selecting the model
		const { useFreeModels } = await this.getState()
		const allModels = getModelsForMode(newMode)

		console.log("[ClineProvider.handleModeSwitch] Mode:", newMode)
		console.log("[ClineProvider.handleModeSwitch] useFreeModels:", useFreeModels)
		console.log(
			"[ClineProvider.handleModeSwitch] All models:",
			allModels.map((m) => ({ id: m.modelId, tier: m.tier })),
		)

		// Filter models based on useFreeModels setting
		let availableModels = allModels
		if (useFreeModels === true) {
			// Only include free models when useFreeModels is true
			availableModels = allModels.filter((model) => model.tier === "free")
			console.log(
				"[ClineProvider.handleModeSwitch] Filtered to free models only:",
				availableModels.map((m) => ({ id: m.modelId, tier: m.tier })),
			)
		} else {
			// Show all models when useFreeModels is false
			console.log("[ClineProvider.handleModeSwitch] Showing all models (useFreeModels=false)")
		}

		const defaultModel = availableModels[0] // Pick first available model after filtering

		if (defaultModel) {
			console.log(
				"[ClineProvider.handleModeSwitch] Selected model:",
				defaultModel.modelId,
				"tier:",
				defaultModel.tier,
			)
			logger.info(
				`ClineProvider.handleModeSwitch: auto-switching to model ${defaultModel.modelId} (tier=${defaultModel.tier}) for mode ${newMode} with useFreeModels=${useFreeModels}`,
			)

			const { apiConfiguration, currentApiConfigName } = await this.getState()

			// Update the correct model field based on the provider
			let newConfiguration: ProviderSettings
			switch (apiConfiguration.apiProvider) {
				case "openrouter":
					newConfiguration = { ...apiConfiguration, openRouterModelId: defaultModel.modelId }
					break
				case "anthropic":
				case "vertex":
				case "bedrock":
				case "gemini":
				case "gemini-cli":
				case "openai-native":
				case "mistral":
				case "deepseek":
				case "doubao":
				case "moonshot":
				case "claude-code":
					newConfiguration = { ...apiConfiguration, apiModelId: defaultModel.modelId }
					break
				case "openai":
					newConfiguration = { ...apiConfiguration, openAiModelId: defaultModel.modelId }
					break
				case "ollama":
					newConfiguration = { ...apiConfiguration, ollamaModelId: defaultModel.modelId }
					break
				case "lmstudio":
					newConfiguration = { ...apiConfiguration, lmStudioModelId: defaultModel.modelId }
					break
				case "glama":
					newConfiguration = { ...apiConfiguration, glamaModelId: defaultModel.modelId }
					break
				case "unbound":
					newConfiguration = { ...apiConfiguration, unboundModelId: defaultModel.modelId }
					break
				case "requesty":
					newConfiguration = { ...apiConfiguration, requestyModelId: defaultModel.modelId }
					break
				default:
					logger.warn(
						`ClineProvider.handleModeSwitch: Unknown provider ${apiConfiguration.apiProvider}, using apiModelId`,
					)
					newConfiguration = { ...apiConfiguration, apiModelId: defaultModel.modelId }
			}

			// Save the updated configuration
			// Note: upsertProviderProfile already calls postStateToWebview, so we don't need to call it again
			await this.upsertProviderProfile(currentApiConfigName, newConfiguration, true)
			return // Early return since state is already posted
		}

		await this.postStateToWebview()
	}

	// Provider Profile Management

	getProviderProfileEntries(): ProviderSettingsEntry[] {
		return this.contextProxy.getValues().listApiConfigMeta || []
	}

	getProviderProfileEntry(name: string): ProviderSettingsEntry | undefined {
		return this.getProviderProfileEntries().find((profile) => profile.name === name)
	}

	public hasProviderProfileEntry(name: string): boolean {
		return !!this.getProviderProfileEntry(name)
	}

	async upsertProviderProfile(
		name: string,
		providerSettings: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		logger.info(
			`[upsertProviderProfile] Starting upsert for profile: ${name}, provider: ${providerSettings.apiProvider}, activate: ${activate}`,
		)
		try {
			// TODO: Do we need to be calling `activateProfile`? It's not
			// clear to me what the source of truth should be; in some cases
			// we rely on the `ContextProxy`'s data store and in other cases
			// we rely on the `ProviderSettingsManager`'s data store. It might
			// be simpler to unify these two.
			const id = await this.providerSettingsManager.saveConfig(name, providerSettings)
			logger.info(`[upsertProviderProfile] Saved config with id: ${id}`)

			if (activate) {
				const { mode } = await this.getState()

				// These promises do the following:
				// 1. Adds or updates the list of provider profiles.
				// 2. Sets the current provider profile.
				// 3. Sets the current mode's provider profile.
				// 4. Copies the provider settings to the context.
				//
				// Note: 1, 2, and 4 can be done in one `ContextProxy` call:
				// this.contextProxy.setValues({ ...providerSettings, listApiConfigMeta: ..., currentApiConfigName: ... })
				// We should probably switch to that and verify that it works.
				// I left the original implementation in just to be safe.
				await Promise.all([
					this.updateGlobalState("listApiConfigMeta", await this.providerSettingsManager.listConfig()),
					this.updateGlobalState("currentApiConfigName", name),
					this.contextProxy.setProviderSettings(providerSettings),
				])
				logger.info(`[upsertProviderProfile] Activated profile for mode: ${mode}`)

				// Change the provider for the current task.
				// TODO: We should rename `buildApiHandler` for clarity (e.g. `getProviderClient`).
				const task = this.getCurrentCline()

				if (task) {
					task.api = buildApiHandler(providerSettings)
					logger.info(`[upsertProviderProfile] Updated API handler for current task`)
				}
			} else {
				await this.updateGlobalState("listApiConfigMeta", await this.providerSettingsManager.listConfig())
				logger.info(`[upsertProviderProfile] Updated listApiConfigMeta without activation`)
			}

			await this.postStateToWebview()
			logger.info(`[upsertProviderProfile] Posted state to webview, returning id: ${id}`)
			return id
		} catch (error) {
			logger.error(`[upsertProviderProfile] Error upserting profile ${name}:`, error)
			this.log(
				`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)

			vscode.window.showErrorMessage(t("common:errors.create_api_config"))
			return undefined
		}
	}

	async deleteProviderProfile(profileToDelete: ProviderSettingsEntry) {
		const globalSettings = this.contextProxy.getValues()
		let profileToActivate: string | undefined = globalSettings.currentApiConfigName

		if (profileToDelete.name === profileToActivate) {
			profileToActivate = this.getProviderProfileEntries().find(({ name }) => name !== profileToDelete.name)?.name
		}

		if (!profileToActivate) {
			throw new Error("You cannot delete the last profile")
		}

		const entries = this.getProviderProfileEntries().filter(({ name }) => name !== profileToDelete.name)

		await this.contextProxy.setValues({
			...globalSettings,
			currentApiConfigName: profileToActivate,
			listApiConfigMeta: entries,
		})

		await this.postStateToWebview()
	}

	async activateProviderProfile(args: { name: string } | { id: string }) {
		const { name, id, ...providerSettings } = await this.providerSettingsManager.activateProfile(args)

		// See `upsertProviderProfile` for a description of what this is doing.
		await Promise.all([
			this.contextProxy.setValue("listApiConfigMeta", await this.providerSettingsManager.listConfig()),
			this.contextProxy.setValue("currentApiConfigName", name),
			this.contextProxy.setProviderSettings(providerSettings),
		])

		const { mode } = await this.getState()

		// Note: No longer saving mode-to-config mapping

		// Change the provider for the current task.
		const task = this.getCurrentCline()

		if (task) {
			task.api = buildApiHandler(providerSettings)
		}

		await this.postStateToWebview()
	}

	// Task Management

	async cancelTask() {
		const cline = this.getCurrentCline()

		if (!cline) {
			return
		}

		const { historyItem } = await this.getTaskWithId(cline.taskId)
		// Preserve parent and root task information for history item.
		const rootTask = cline.rootTask
		const parentTask = cline.parentTask

		await cline.abortTask()

		await pWaitFor(
			() =>
				this.getCurrentCline()! === undefined ||
				this.getCurrentCline()!.isStreaming === false ||
				this.getCurrentCline()!.didFinishAbortingStream ||
				// If only the first chunk is processed, then there's no
				// need to wait for graceful abort (closes edits, browser,
				// etc).
				this.getCurrentCline()!.isWaitingForFirstChunk,
			{
				timeout: 3_000,
			},
		).catch(() => {})

		// Send frozen timer to webview while old Task is still getCurrentCline()
		// (before initClineWithHistoryItem replaces it with a new instance)
		await this.postStateToWebview()

		if (this.getCurrentCline()) {
			// 'abandoned' will prevent this Cline instance from affecting
			// future Cline instances. This may happen if its hanging on a
			// streaming request.
			this.getCurrentCline()!.abandoned = true
		}

		// Clears task again, so we need to abortTask manually above.
		// Re-fetch historyItem since abortTask saved updated duration
		const { historyItem: updatedHistoryItem } = await this.getTaskWithId(cline.taskId)
		await this.initClineWithHistoryItem({ ...updatedHistoryItem, rootTask, parentTask })
	}

	async updateCustomInstructions(instructions?: string) {
		// User may be clearing the field.
		await this.updateGlobalState("customInstructions", instructions || undefined)
		await this.postStateToWebview()
	}

	// MCP

	async ensureMcpServersDirectoryExists(): Promise<string> {
		// Get platform-specific application data directory
		let mcpServersDir: string
		if (process.platform === "win32") {
			// Windows: %APPDATA%\Roo-Code\MCP
			mcpServersDir = path.join(os.homedir(), "AppData", "Roaming", "Roo-Code", "MCP")
		} else if (process.platform === "darwin") {
			// macOS: ~/Documents/Cline/MCP
			mcpServersDir = path.join(os.homedir(), "Documents", "Cline", "MCP")
		} else {
			// Linux: ~/.local/share/Cline/MCP
			mcpServersDir = path.join(os.homedir(), ".local", "share", "Roo-Code", "MCP")
		}

		try {
			await fs.mkdir(mcpServersDir, { recursive: true })
		} catch (error) {
			// Fallback to a relative path if directory creation fails
			return path.join(os.homedir(), ".roo-code", "mcp")
		}
		return mcpServersDir
	}

	async ensureSettingsDirectoryExists(): Promise<string> {
		const { getSettingsDirectoryPath } = await import("../../utils/storage")
		const globalStoragePath = this.contextProxy.globalStorageUri.fsPath
		return getSettingsDirectoryPath(globalStoragePath)
	}

	// OpenRouter

	async handleOpenRouterCallback(code: string) {
		let { apiConfiguration, currentApiConfigName } = await this.getState()

		let apiKey: string
		try {
			const baseUrl = apiConfiguration.openRouterBaseUrl || "https://openrouter.ai/api/v1"
			// Extract the base domain for the auth endpoint
			const baseUrlDomain = baseUrl.match(/^(https?:\/\/[^\/]+)/)?.[1] || "https://openrouter.ai"
			const response = await axios.post(`${baseUrlDomain}/api/v1/auth/keys`, { code })
			if (response.data && response.data.key) {
				apiKey = response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			this.log(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}

		const newConfiguration: ProviderSettings = {
			...apiConfiguration,
			apiProvider: "openrouter",
			openRouterApiKey: apiKey,
			openRouterModelId: apiConfiguration?.openRouterModelId || openRouterDefaultModelId,
		}

		await this.upsertProviderProfile(currentApiConfigName, newConfiguration)
	}

	// Glama

	async handleGlamaCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://glama.ai/api/gateway/v1/auth/exchange-code", { code })
			if (response.data && response.data.apiKey) {
				apiKey = response.data.apiKey
			} else {
				throw new Error("Invalid response from Glama API")
			}
		} catch (error) {
			this.log(
				`Error exchanging code for API key: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
			throw error
		}

		const { apiConfiguration, currentApiConfigName } = await this.getState()

		const newConfiguration: ProviderSettings = {
			...apiConfiguration,
			apiProvider: "glama",
			glamaApiKey: apiKey,
			glamaModelId: apiConfiguration?.glamaModelId || glamaDefaultModelId,
		}

		await this.upsertProviderProfile(currentApiConfigName, newConfiguration)
	}

	// Requesty

	async handleRequestyCallback(code: string) {
		let { apiConfiguration, currentApiConfigName } = await this.getState()

		const newConfiguration: ProviderSettings = {
			...apiConfiguration,
			apiProvider: "requesty",
			requestyApiKey: code,
			requestyModelId: apiConfiguration?.requestyModelId || requestyDefaultModelId,
		}

		await this.upsertProviderProfile(currentApiConfigName, newConfiguration)
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = this.getGlobalState("taskHistory") ?? []
		const historyItem = history.find((item) => item.id === id)

		if (historyItem) {
			const { getTaskDirectoryPath } = await import("../../utils/storage")
			const globalStoragePath = this.contextProxy.globalStorageUri.fsPath
			const taskDirPath = await getTaskDirectoryPath(globalStoragePath, id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)

			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))

				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					apiConversationHistory,
				}
			}
		}

		// if we tried to get a task that doesn't exist, remove it from state
		// FIXME: this seems to happen sometimes when the json file doesnt save to disk for some reason
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async showTaskWithId(id: string) {
		if (id !== this.getCurrentCline()?.taskId) {
			// Non-current task.
			const { historyItem } = await this.getTaskWithId(id)
			await this.initClineWithHistoryItem(historyItem) // Clears existing task.
		}

		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async exportTaskDebugJsonWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)

		// Try to get the system prompt from the active task if it matches
		let systemPrompt: string | undefined
		const activeTask = this.clineStack.find((t) => t.taskId === id)
		if (activeTask) {
			try {
				systemPrompt = await activeTask.getSystemPrompt()
			} catch {
				// Task may not be in a state to generate system prompt
			}
		}

		await exportTaskDebugJson(apiConversationHistory as any, {
			taskId: historyItem.id,
			timestamp: historyItem.ts,
			taskNumber: historyItem.number,
			workspace: historyItem.workspace,
			mode: historyItem.mode,
			systemPrompt,
		})
	}

	/* Condenses a task's message history to use fewer tokens. */
	async condenseTaskContext(taskId: string) {
		let task: Task | undefined
		for (let i = this.clineStack.length - 1; i >= 0; i--) {
			if (this.clineStack[i].taskId === taskId) {
				task = this.clineStack[i]
				break
			}
		}
		if (!task) {
			throw new Error(`Task with id ${taskId} not found in stack`)
		}
		await task.condenseContext()
		await this.postMessageToWebview({ type: "condenseTaskContextResponse", text: taskId })
	}

	// this function deletes a task from task hidtory, and deletes it's checkpoints and delete the task folder
	async deleteTaskWithId(id: string) {
		try {
			// get the task directory full path
			const { taskDirPath } = await this.getTaskWithId(id)

			// remove task from stack if it's the current task
			if (id === this.getCurrentCline()?.taskId) {
				// if we found the taskid to delete - call finish to abort this task and allow a new task to be started,
				// if we are deleting a subtask and parent task is still waiting for subtask to finish - it allows the parent to resume (this case should neve exist)
				await this.finishSubTask(t("common:tasks.deleted"))
			}

			// delete task from the task history state
			await this.deleteTaskFromState(id)

			// Delete associated shadow repository or branch.
			// TODO: Store `workspaceDir` in the `HistoryItem` object.
			const globalStorageDir = this.contextProxy.globalStorageUri.fsPath
			const workspaceDir = this.cwd

			try {
				await ShadowCheckpointService.deleteTask({ taskId: id, globalStorageDir, workspaceDir })
			} catch (error) {
				console.error(
					`[deleteTaskWithId${id}] failed to delete associated shadow repository or branch: ${error instanceof Error ? error.message : String(error)}`,
				)
			}

			// delete the entire task directory including checkpoints and all content
			try {
				await fs.rm(taskDirPath, { recursive: true, force: true })
			} catch (error) {
				console.error(
					`[deleteTaskWithId${id}] failed to remove task directory: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} catch (error) {
			// If task is not found, just remove it from state
			if (error instanceof Error && error.message === "Task not found") {
				await this.deleteTaskFromState(id)
				return
			}
			throw error
		}
	}

	async deleteTaskFromState(id: string) {
		const taskHistory = this.getGlobalState("taskHistory") ?? []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.updateGlobalState("taskHistory", updatedTaskHistory)
		await this.postStateToWebview()
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		this.postMessageToWebview({ type: "state", state })

		// Check MDM compliance and send user to account tab if not compliant
		if (!this.checkMdmCompliance()) {
			await this.postMessageToWebview({ type: "action", action: "accountButtonClicked" })
		}
	}

	/**
	 * Update the cached Firebase authentication state
	 * This should be called when login/logout events occur
	 */
	public setFirebaseAuthState(isAuthenticated: boolean) {
		this.cachedFirebaseAuthState = isAuthenticated

		// When user logs in, fetch and update API keys from Firebase
		if (isAuthenticated) {
			this.providerSettingsManager.updateApiKeysFromFirebase().catch((error) => {
				this.outputChannel.appendLine(
					`[setFirebaseAuthState] Error updating API keys after login: ${error instanceof Error ? error.message : String(error)}`,
				)
			})
		}
	}

	/**
	 * Fetches marketplace data on demand to avoid blocking main state updates
	 */
	async fetchMarketplaceData() {
		try {
			const [marketplaceResult, marketplaceInstalledMetadata] = await Promise.all([
				this.marketplaceManager.getMarketplaceItems().catch((error) => {
					return { organizationMcps: [], marketplaceItems: [], errors: [error.message] }
				}),
				this.marketplaceManager.getInstallationMetadata().catch((error) => {
					return { project: {}, global: {} } as MarketplaceInstalledMetadata
				}),
			])

			// Send marketplace data separately
			this.postMessageToWebview({
				type: "marketplaceData",
				organizationMcps: marketplaceResult.organizationMcps || [],
				marketplaceItems: marketplaceResult.marketplaceItems || [],
				marketplaceInstalledMetadata: marketplaceInstalledMetadata || { project: {}, global: {} },
				errors: marketplaceResult.errors,
			})
		} catch (error) {
			// Send empty data on error to prevent UI from hanging
			this.postMessageToWebview({
				type: "marketplaceData",
				organizationMcps: [],
				marketplaceItems: [],
				marketplaceInstalledMetadata: { project: {}, global: {} },
				errors: [error instanceof Error ? error.message : String(error)],
			})

			// Show user-friendly error notification for network issues
			if (error instanceof Error && error.message.includes("timeout")) {
				vscode.window.showWarningMessage(
					"Marketplace data could not be loaded due to network restrictions. Core functionality remains available.",
				)
			}
		}
	}

	/**
	 * Merges allowed commands from global state and workspace configuration
	 * with proper validation and deduplication
	 */
	private mergeAllowedCommands(globalStateCommands?: string[]): string[] {
		return this.mergeCommandLists("allowedCommands", "allowed", globalStateCommands)
	}

	/**
	 * Merges denied commands from global state and workspace configuration
	 * with proper validation and deduplication
	 */
	private mergeDeniedCommands(globalStateCommands?: string[]): string[] {
		return this.mergeCommandLists("deniedCommands", "denied", globalStateCommands)
	}

	/**
	 * Common utility for merging command lists from global state and workspace configuration.
	 * Implements the Command Denylist feature's merging strategy with proper validation.
	 *
	 * @param configKey - VSCode workspace configuration key
	 * @param commandType - Type of commands for error logging
	 * @param globalStateCommands - Commands from global state
	 * @returns Merged and deduplicated command list
	 */
	private mergeCommandLists(
		configKey: "allowedCommands" | "deniedCommands",
		commandType: "allowed" | "denied",
		globalStateCommands?: string[],
	): string[] {
		try {
			// Validate and sanitize global state commands
			const validGlobalCommands = Array.isArray(globalStateCommands)
				? globalStateCommands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			// Get workspace configuration commands
			const workspaceCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>(configKey) || []

			// Validate and sanitize workspace commands
			const validWorkspaceCommands = Array.isArray(workspaceCommands)
				? workspaceCommands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			// Combine and deduplicate commands
			// Global state takes precedence over workspace configuration
			const mergedCommands = [...new Set([...validGlobalCommands, ...validWorkspaceCommands])]

			return mergedCommands
		} catch (error) {
			// Return empty array as fallback to prevent crashes
			return []
		}
	}

	async getStateToPostToWebview() {
		const {
			apiConfiguration,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowReadOnlyOutsideWorkspace,
			alwaysAllowWrite,
			alwaysAllowWriteOutsideWorkspace,
			alwaysAllowWriteProtected,
			alwaysAllowExecute,
			allowedCommands,
			deniedCommands,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysAllowUpdateTodoList,
			allowedMaxRequests,
			allowedMaxCost,
			autoCondenseContext,
			autoCondenseContextPercent,
			notificationsEnabled,
			soundEnabled,
			ttsEnabled,
			ttsSpeed,
			diffEnabled,
			enableCheckpoints,
			taskHistory,
			soundVolume,
			browserViewportSize,
			screenshotQuality,
			remoteBrowserHost,
			remoteBrowserEnabled,
			cachedChromeHostUrl,
			writeDelayMs,
			terminalOutputLineLimit,
			terminalOutputCharacterLimit,
			terminalShellIntegrationTimeout,
			terminalShellIntegrationDisabled,
			terminalCommandDelay,
			terminalPowershellCounter,
			terminalZshClearEolMark,
			terminalZshOhMy,
			terminalZshP10k,
			terminalZdotdir,
			fuzzyMatchThreshold,
			mcpEnabled,
			enableMcpServerCreation,
			enablePmdRules,
			alwaysApproveResubmit,
			requestDelaySeconds,
			currentApiConfigName,
			listApiConfigMeta,
			pinnedApiConfigs,
			mode,
			customModePrompts,
			customSupportPrompts,
			enhancementApiConfigId,
			autoApprovalEnabled,
			customModes,
			experiments,
			maxOpenTabsContext,
			maxWorkspaceFiles,
			browserToolEnabled,
			telemetrySetting,
			showRooIgnoredFiles,
			language,
			maxReadFileLine,
			maxImageFileSize,
			maxTotalImageSize,
			terminalCompressProgressBar,
			historyPreviewCollapsed,
			cloudUserInfo,
			cloudIsAuthenticated,
			firebaseIsAuthenticated,
			sharingEnabled,
			organizationAllowList,
			organizationSettingsVersion,
			maxConcurrentFileReads,
			condensingApiConfigId,
			customCondensingPrompt,
			codebaseIndexConfig,
			codebaseIndexModels,
			profileThresholds,
			alwaysAllowFollowupQuestions,
			followupAutoApproveTimeoutMs,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
			includeTaskHistoryInEnhance,
			developerMode,
			useFreeModels,
		} = await this.getState()

		const telemetryKey = process.env.POSTHOG_API_KEY
		const machineId = vscode.env.machineId
		const mergedAllowedCommands = this.mergeAllowedCommands(allowedCommands)
		const mergedDeniedCommands = this.mergeDeniedCommands(deniedCommands)
		const cwd = this.cwd

		// Check if there's a system prompt override for the current mode
		const currentMode = mode ?? defaultModeSlug

		return {
			version: this.context.extension?.packageJSON?.version ?? "",
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowReadOnlyOutsideWorkspace: alwaysAllowReadOnlyOutsideWorkspace ?? false,
			alwaysAllowWrite: alwaysAllowWrite ?? false,
			alwaysAllowWriteOutsideWorkspace: alwaysAllowWriteOutsideWorkspace ?? false,
			alwaysAllowWriteProtected: alwaysAllowWriteProtected ?? false,
			alwaysAllowExecute: alwaysAllowExecute ?? false,
			alwaysAllowBrowser: alwaysAllowBrowser ?? false,
			alwaysAllowMcp: alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: alwaysAllowSubtasks ?? false,
			alwaysAllowUpdateTodoList: alwaysAllowUpdateTodoList ?? false,
			allowedMaxRequests,
			allowedMaxCost,
			autoCondenseContext: autoCondenseContext ?? true,
			autoCondenseContextPercent: autoCondenseContextPercent ?? 100,
			uriScheme: vscode.env.uriScheme,
			currentTaskItem: this.getCurrentCline()?.taskId
				? (taskHistory || []).find((item: HistoryItem) => item.id === this.getCurrentCline()?.taskId)
				: undefined,
			taskStartTime:
				this.getCurrentCline()?.taskStartTime && !this.getCurrentCline()?.taskCompleted
					? this.getCurrentCline()?.taskStartTime
					: 0,
			taskElapsedTime: this.getCurrentCline()?.getTaskDuration(),
			taskCompleted: this.getCurrentCline()?.taskCompleted,
			clineMessages: this.getCurrentCline()?.clineMessages || [],
			taskHistory: (taskHistory || [])
				.filter((item: HistoryItem) => item.ts && item.task)
				.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts),
			notificationsEnabled: notificationsEnabled ?? false,
			soundEnabled: soundEnabled ?? false,
			ttsEnabled: ttsEnabled ?? false,
			ttsSpeed: ttsSpeed ?? 1.0,
			diffEnabled: diffEnabled ?? true,
			enableCheckpoints: enableCheckpoints ?? true,
			shouldShowAnnouncement:
				telemetrySetting !== "unset" && lastShownAnnouncementId !== this.latestAnnouncementId,
			allowedCommands: mergedAllowedCommands,
			deniedCommands: mergedDeniedCommands,
			soundVolume: soundVolume ?? 0.5,
			browserViewportSize: browserViewportSize ?? "900x600",
			screenshotQuality: screenshotQuality ?? 75,
			remoteBrowserHost,
			remoteBrowserEnabled: remoteBrowserEnabled ?? false,
			cachedChromeHostUrl: cachedChromeHostUrl,
			writeDelayMs: writeDelayMs ?? DEFAULT_WRITE_DELAY_MS,
			terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
			terminalOutputCharacterLimit: terminalOutputCharacterLimit ?? DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
			terminalShellIntegrationTimeout: terminalShellIntegrationTimeout ?? Terminal.defaultShellIntegrationTimeout,
			terminalShellIntegrationDisabled: terminalShellIntegrationDisabled ?? false,
			terminalCommandDelay: terminalCommandDelay ?? 0,
			terminalPowershellCounter: terminalPowershellCounter ?? false,
			terminalZshClearEolMark: terminalZshClearEolMark ?? true,
			terminalZshOhMy: terminalZshOhMy ?? false,
			terminalZshP10k: terminalZshP10k ?? false,
			terminalZdotdir: terminalZdotdir ?? false,
			fuzzyMatchThreshold: fuzzyMatchThreshold ?? 1.0,
			mcpEnabled: mcpEnabled ?? true,
			enableMcpServerCreation: enableMcpServerCreation ?? true,
			enablePmdRules: enablePmdRules ?? true,
			alwaysApproveResubmit: alwaysApproveResubmit ?? false,
			requestDelaySeconds: requestDelaySeconds ?? 10,
			currentApiConfigName: currentApiConfigName ?? "default",
			listApiConfigMeta: listApiConfigMeta ?? [],
			pinnedApiConfigs: pinnedApiConfigs ?? {},
			mode: mode ?? defaultModeSlug,
			customModePrompts: customModePrompts ?? {},
			customSupportPrompts: customSupportPrompts ?? {},
			enhancementApiConfigId,
			autoApprovalEnabled: autoApprovalEnabled ?? false,
			customModes,
			experiments: experiments ?? experimentDefault,
			mcpServers: this.mcpHub?.getAllServers() ?? [],
			maxOpenTabsContext: maxOpenTabsContext ?? 20,
			maxWorkspaceFiles: maxWorkspaceFiles ?? 200,
			cwd,
			browserToolEnabled: browserToolEnabled ?? true,
			telemetrySetting,
			telemetryKey,
			machineId,
			showRooIgnoredFiles: showRooIgnoredFiles ?? true,
			language: language ?? formatLanguage(vscode.env.language),
			renderContext: this.renderContext,
			maxReadFileLine: maxReadFileLine ?? -1,
			maxImageFileSize: maxImageFileSize ?? 5,
			maxTotalImageSize: maxTotalImageSize ?? 20,
			maxConcurrentFileReads: maxConcurrentFileReads ?? 5,
			settingsImportedAt: this.settingsImportedAt,
			terminalCompressProgressBar: terminalCompressProgressBar ?? true,
			historyPreviewCollapsed: historyPreviewCollapsed ?? false,
			cloudUserInfo,
			cloudIsAuthenticated: cloudIsAuthenticated ?? false,
			firebaseIsAuthenticated: firebaseIsAuthenticated ?? false,
			sharingEnabled: sharingEnabled ?? false,
			organizationAllowList,
			organizationSettingsVersion,
			// Explicitly add condensing settings
			condensingApiConfigId: condensingApiConfigId,
			customCondensingPrompt: customCondensingPrompt,
			codebaseIndexModels: codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
			codebaseIndexConfig: {
				codebaseIndexEnabled: codebaseIndexConfig?.codebaseIndexEnabled ?? true,
				codebaseIndexQdrantUrl: codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "http://localhost:6333",
				codebaseIndexEmbedderProvider: codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
				codebaseIndexEmbedderBaseUrl: codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? "",
				codebaseIndexEmbedderModelId: codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
				codebaseIndexEmbedderModelDimension: codebaseIndexConfig?.codebaseIndexEmbedderModelDimension ?? 1536,
				codebaseIndexOpenAiCompatibleBaseUrl: codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
				codebaseIndexSearchMaxResults: codebaseIndexConfig?.codebaseIndexSearchMaxResults,
				codebaseIndexSearchMinScore: codebaseIndexConfig?.codebaseIndexSearchMinScore,
			},
			mdmCompliant: this.checkMdmCompliance(),
			profileThresholds: profileThresholds ?? {},
			cloudApiUrl: getRooCodeApiUrl(),
			hasOpenedModeSelector: this.getGlobalState("hasOpenedModeSelector") ?? false,
			alwaysAllowFollowupQuestions: alwaysAllowFollowupQuestions ?? false,
			followupAutoApproveTimeoutMs: followupAutoApproveTimeoutMs ?? 60000,
			includeDiagnosticMessages: includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: maxDiagnosticMessages ?? 50,
			includeTaskHistoryInEnhance: includeTaskHistoryInEnhance ?? false,
			useFreeModels: useFreeModels ?? false,
			developerMode: developerMode ?? false,
		}
	}

	/**
	 * Storage
	 * https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco
	 * https://www.eliostruyf.com/devhack-code-extension-storage-options/
	 */

	async getState() {
		const getStateStart = Date.now()
		const stateValues = this.contextProxy.getValues()
		const customModes = await this.customModesManager.getCustomModes()
		perfLog(`[Performance] getState: contextProxy.getValues + customModes took ${Date.now() - getStateStart}ms`)

		// Determine apiProvider with the same logic as before.
		const apiProvider: ProviderName = stateValues.apiProvider ? stateValues.apiProvider : "anthropic"

		// Build the apiConfiguration object combining state values and secrets.
		const providerSettings = this.contextProxy.getProviderSettings()

		// Ensure apiProvider is set properly if not already in state
		if (!providerSettings.apiProvider) {
			providerSettings.apiProvider = apiProvider
		}

		let organizationAllowList = ORGANIZATION_ALLOW_ALL

		const cloudStart = Date.now()
		try {
			organizationAllowList = await CloudService.instance.getAllowList()
		} catch (error) {
			console.error(
				`[getState] failed to get organization allow list: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
		perfLog(`[Performance] getState: getAllowList took ${Date.now() - cloudStart}ms`)

		let cloudUserInfo: CloudUserInfo | null = null

		try {
			cloudUserInfo = CloudService.instance.getUserInfo()
		} catch (error) {
			console.error(
				`[getState] failed to get cloud user info: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		let cloudIsAuthenticated: boolean = false

		try {
			cloudIsAuthenticated = CloudService.instance.isAuthenticated()
		} catch (error) {
			console.error(
				`[getState] failed to get cloud authentication state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		let sharingEnabled: boolean = false

		const sharingStart = Date.now()
		try {
			sharingEnabled = await CloudService.instance.canShareTask()
		} catch (error) {
			console.error(
				`[getState] failed to get sharing enabled state: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
		perfLog(`[Performance] getState: canShareTask took ${Date.now() - sharingStart}ms`)

		let organizationSettingsVersion: number = -1

		try {
			if (CloudService.hasInstance()) {
				const settings = CloudService.instance.getOrganizationSettings()
				organizationSettingsVersion = settings?.version ?? -1
			}
		} catch (error) {
			console.error(
				`[getState] failed to get organization settings version: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// Use cached Firebase auth state if available to avoid unnecessary checks
		// The cache is updated when login/logout happens
		let firebaseIsAuthenticated: boolean = this.cachedFirebaseAuthState ?? false

		// Only check Firebase auth if we don't have a cached value
		try {
			// Use Firebase API helper instead of command
			firebaseIsAuthenticated = await isAuthenticated(this.outputChannel)
			this.cachedFirebaseAuthState = firebaseIsAuthenticated
		} catch (error) {
			console.error(
				`[getState] failed to get Firebase authentication state: ${error instanceof Error ? error.message : String(error)}`,
			)
			// Keep the cached value or default to false
			firebaseIsAuthenticated = this.cachedFirebaseAuthState ?? false
		}
		const stateResult = {
			apiConfiguration: providerSettings,
			lastShownAnnouncementId: stateValues.lastShownAnnouncementId,
			customInstructions: stateValues.customInstructions,
			apiModelId: stateValues.apiModelId,
			alwaysAllowReadOnly: stateValues.alwaysAllowReadOnly ?? false,
			alwaysAllowReadOnlyOutsideWorkspace: stateValues.alwaysAllowReadOnlyOutsideWorkspace ?? false,
			alwaysAllowWrite: stateValues.alwaysAllowWrite ?? false,
			alwaysAllowWriteOutsideWorkspace: stateValues.alwaysAllowWriteOutsideWorkspace ?? false,
			alwaysAllowWriteProtected: stateValues.alwaysAllowWriteProtected ?? false,
			alwaysAllowExecute: stateValues.alwaysAllowExecute ?? false,
			alwaysAllowBrowser: stateValues.alwaysAllowBrowser ?? false,
			alwaysAllowMcp: stateValues.alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: stateValues.alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: stateValues.alwaysAllowSubtasks ?? false,
			alwaysAllowFollowupQuestions: stateValues.alwaysAllowFollowupQuestions ?? false,
			alwaysAllowUpdateTodoList: stateValues.alwaysAllowUpdateTodoList ?? false,
			alwaysAllowDeploySfMetadata: stateValues.alwaysAllowDeploySfMetadata ?? false,
			alwaysAllowRetrieveSfMetadata: stateValues.alwaysAllowRetrieveSfMetadata ?? false,
			followupAutoApproveTimeoutMs: stateValues.followupAutoApproveTimeoutMs ?? 60000,
			diagnosticsEnabled: stateValues.diagnosticsEnabled ?? true,
			allowedMaxRequests: stateValues.allowedMaxRequests,
			allowedMaxCost: stateValues.allowedMaxCost,
			autoCondenseContext: stateValues.autoCondenseContext ?? true,
			autoCondenseContextPercent: stateValues.autoCondenseContextPercent ?? 100,
			taskHistory: stateValues.taskHistory,
			allowedCommands: stateValues.allowedCommands,
			deniedCommands: stateValues.deniedCommands,
			notificationsEnabled: stateValues.notificationsEnabled ?? false,
			soundEnabled: stateValues.soundEnabled ?? false,
			ttsEnabled: stateValues.ttsEnabled ?? false,
			ttsSpeed: stateValues.ttsSpeed ?? 1.0,
			diffEnabled: stateValues.diffEnabled ?? true,
			enableCheckpoints: stateValues.enableCheckpoints ?? true,
			soundVolume: stateValues.soundVolume,
			browserViewportSize: stateValues.browserViewportSize ?? "900x600",
			screenshotQuality: stateValues.screenshotQuality ?? 75,
			remoteBrowserHost: stateValues.remoteBrowserHost,
			remoteBrowserEnabled: stateValues.remoteBrowserEnabled ?? false,
			cachedChromeHostUrl: stateValues.cachedChromeHostUrl as string | undefined,
			fuzzyMatchThreshold: stateValues.fuzzyMatchThreshold ?? 1.0,
			writeDelayMs: stateValues.writeDelayMs ?? 100, // Reduced to 100ms for faster file operations
			terminalOutputLineLimit: stateValues.terminalOutputLineLimit ?? 500,
			terminalOutputCharacterLimit:
				stateValues.terminalOutputCharacterLimit ?? DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
			terminalShellIntegrationTimeout:
				stateValues.terminalShellIntegrationTimeout ?? Terminal.defaultShellIntegrationTimeout,
			terminalShellIntegrationDisabled: stateValues.terminalShellIntegrationDisabled ?? false,
			terminalCommandDelay: stateValues.terminalCommandDelay ?? 0,
			terminalPowershellCounter: stateValues.terminalPowershellCounter ?? false,
			terminalZshClearEolMark: stateValues.terminalZshClearEolMark ?? true,
			terminalZshOhMy: stateValues.terminalZshOhMy ?? false,
			terminalZshP10k: stateValues.terminalZshP10k ?? false,
			terminalZdotdir: stateValues.terminalZdotdir ?? false,
			terminalCompressProgressBar: stateValues.terminalCompressProgressBar ?? true,
			mode: stateValues.mode ?? defaultModeSlug,
			language: stateValues.language ?? formatLanguage(vscode.env.language),
			mcpEnabled: stateValues.mcpEnabled ?? true,
			enableMcpServerCreation: stateValues.enableMcpServerCreation ?? true,
			enablePmdRules: stateValues.enablePmdRules ?? true,
			alwaysApproveResubmit: stateValues.alwaysApproveResubmit ?? false,
			requestDelaySeconds: Math.max(0, stateValues.requestDelaySeconds ?? 2), // Reduced to 2s default, 0s minimum for maximum speed
			currentApiConfigName: stateValues.currentApiConfigName ?? "default",
			listApiConfigMeta: stateValues.listApiConfigMeta ?? [],
			pinnedApiConfigs: stateValues.pinnedApiConfigs ?? {},
			modeApiConfigs: stateValues.modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: stateValues.customModePrompts ?? {},
			customSupportPrompts: stateValues.customSupportPrompts ?? {},
			enhancementApiConfigId: stateValues.enhancementApiConfigId,
			experiments: stateValues.experiments ?? experimentDefault,
			autoApprovalEnabled: stateValues.autoApprovalEnabled ?? false,
			customModes,
			maxOpenTabsContext: stateValues.maxOpenTabsContext ?? 20,
			maxWorkspaceFiles: stateValues.maxWorkspaceFiles ?? 200,
			openRouterUseMiddleOutTransform: stateValues.openRouterUseMiddleOutTransform ?? true,
			browserToolEnabled: stateValues.browserToolEnabled ?? true,
			telemetrySetting: stateValues.telemetrySetting || "unset",
			showRooIgnoredFiles: stateValues.showRooIgnoredFiles ?? true,
			maxReadFileLine: stateValues.maxReadFileLine ?? -1,
			maxImageFileSize: stateValues.maxImageFileSize ?? 5,
			maxTotalImageSize: stateValues.maxTotalImageSize ?? 20,
			maxConcurrentFileReads: stateValues.maxConcurrentFileReads ?? 5,
			historyPreviewCollapsed: stateValues.historyPreviewCollapsed ?? false,
			cloudUserInfo,
			cloudIsAuthenticated,
			firebaseIsAuthenticated,
			sharingEnabled,
			organizationAllowList,
			organizationSettingsVersion,
			// Explicitly add condensing settings
			condensingApiConfigId: stateValues.condensingApiConfigId,
			customCondensingPrompt: stateValues.customCondensingPrompt,
			codebaseIndexModels: stateValues.codebaseIndexModels ?? EMBEDDING_MODEL_PROFILES,
			codebaseIndexConfig: {
				codebaseIndexEnabled: stateValues.codebaseIndexConfig?.codebaseIndexEnabled ?? true,
				codebaseIndexQdrantUrl:
					stateValues.codebaseIndexConfig?.codebaseIndexQdrantUrl ?? "http://localhost:6333",
				codebaseIndexEmbedderProvider:
					stateValues.codebaseIndexConfig?.codebaseIndexEmbedderProvider ?? "openai",
				codebaseIndexEmbedderBaseUrl: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl ?? "",
				codebaseIndexEmbedderModelId: stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelId ?? "",
				codebaseIndexEmbedderModelDimension:
					stateValues.codebaseIndexConfig?.codebaseIndexEmbedderModelDimension,
				codebaseIndexOpenAiCompatibleBaseUrl:
					stateValues.codebaseIndexConfig?.codebaseIndexOpenAiCompatibleBaseUrl,
				codebaseIndexSearchMaxResults: stateValues.codebaseIndexConfig?.codebaseIndexSearchMaxResults,
				codebaseIndexSearchMinScore: stateValues.codebaseIndexConfig?.codebaseIndexSearchMinScore,
			},
			profileThresholds: stateValues.profileThresholds ?? {},
			// Add diagnostic message settings
			includeDiagnosticMessages: stateValues.includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: stateValues.maxDiagnosticMessages ?? 50,
			// Add includeTaskHistoryInEnhance setting
			includeTaskHistoryInEnhance: stateValues.includeTaskHistoryInEnhance ?? false,
			useFreeModels: stateValues.useFreeModels,
			developerMode: stateValues.developerMode ?? false,
		}

		perfLog(`[Performance] getState: TOTAL time ${Date.now() - getStateStart}ms`)
		return stateResult
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = (this.getGlobalState("taskHistory") as HistoryItem[] | undefined) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)

		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}

		await this.updateGlobalState("taskHistory", history)
		return history
	}

	// ContextProxy

	// @deprecated - Use `ContextProxy#setValue` instead.
	private async updateGlobalState<K extends keyof GlobalState>(key: K, value: GlobalState[K]) {
		logger.info(`[updateGlobalState] Updating key: ${key} with value: ${JSON.stringify(value)}`)
		await this.contextProxy.setValue(key, value)
	}

	// @deprecated - Use `ContextProxy#getValue` instead.
	private getGlobalState<K extends keyof GlobalState>(key: K) {
		return this.contextProxy.getValue(key)
	}

	public async setValue<K extends keyof RooCodeSettings>(key: K, value: RooCodeSettings[K]) {
		await this.contextProxy.setValue(key, value)
	}

	public getValue<K extends keyof RooCodeSettings>(key: K) {
		return this.contextProxy.getValue(key)
	}

	public getValues() {
		return this.contextProxy.getValues()
	}

	public async setValues(values: RooCodeSettings) {
		await this.contextProxy.setValues(values)
	}

	// cwd

	get cwd() {
		return getWorkspacePath()
	}

	// dev

	async resetState() {
		const answer = await vscode.window.showInformationMessage(
			t("common:confirmation.reset_state"),
			{ modal: true },
			t("common:answers.yes"),
		)

		if (answer !== t("common:answers.yes")) {
			return
		}

		// Clear Firebase auth cache
		this.cachedFirebaseAuthState = undefined

		await this.contextProxy.resetAllState()
		await this.providerSettingsManager.resetAllConfigs()
		await this.customModesManager.resetCustomModes()
		await this.removeClineFromStack()
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	// logging

	public log(message: string) {
		this.outputChannel.appendLine(message)
	}

	// integration tests

	get viewLaunched() {
		return this.isViewLaunched
	}

	get messages() {
		return this.getCurrentCline()?.clineMessages || []
	}

	// Add public getter
	public getMcpHub(): McpHub | undefined {
		return this.mcpHub
	}

	/**
	 * Check if the current state is compliant with MDM policy
	 * @returns true if compliant, false if blocked
	 */
	public checkMdmCompliance(): boolean {
		if (!this.mdmService) {
			return true // No MDM service, allow operation
		}

		const compliance = this.mdmService.isCompliant()

		if (!compliance.compliant) {
			return false
		}

		return true
	}

	/**
	 * Returns properties to be included in every telemetry event
	 * This method is called by the telemetry service to get context information
	 * like the current mode, API provider, git repository information, etc.
	 */
	public async getTelemetryProperties(): Promise<TelemetryProperties> {
		const { mode, apiConfiguration, language } = await this.getState()
		const task = this.getCurrentCline()

		const packageJSON = this.context.extension?.packageJSON

		// Get Roo Code Cloud authentication state
		let cloudIsAuthenticated: boolean | undefined

		try {
			if (CloudService.hasInstance()) {
				cloudIsAuthenticated = CloudService.instance.isAuthenticated()
			}
		} catch (error) {
			// Silently handle errors to avoid breaking telemetry collection
			this.log(`[getTelemetryProperties] Failed to get cloud auth state: ${error}`)
		}

		// Get git repository information
		const gitInfo = await getWorkspaceGitInfo()

		// Calculate todo list statistics
		const todoList = task?.todoList
		let todos: { total: number; completed: number; inProgress: number; pending: number } | undefined

		if (todoList && todoList.length > 0) {
			todos = {
				total: todoList.length,
				completed: todoList.filter((todo) => todo.status === "completed").length,
				inProgress: todoList.filter((todo) => todo.status === "in_progress").length,
				pending: todoList.filter((todo) => todo.status === "pending").length,
			}
		}

		// Return all properties including git info - clients will filter as needed
		return {
			appName: packageJSON?.name ?? Package.name,
			appVersion: packageJSON?.version ?? Package.version,
			vscodeVersion: vscode.version,
			platform: process.platform,
			editorName: vscode.env.appName,
			language,
			mode,
			apiProvider: apiConfiguration?.apiProvider,
			modelId: task?.api?.getModel().id,
			diffStrategy: task?.diffStrategy?.getName(),
			isSubtask: task ? !!task.parentTask : undefined,
			cloudIsAuthenticated,
			...(todos && { todos }),
			...gitInfo,
		}
	}

	/**
	 * Gets the CodeIndexManager for the current active workspace
	 * @returns CodeIndexManager instance for the current workspace or the default one
	 */
	public getCurrentWorkspaceCodeIndexManager(): CodeIndexManager | undefined {
		return CodeIndexManager.getInstance(this.context)
	}

	/**
	 * Updates the code index status subscription to listen to the current workspace manager
	 */
	private updateCodeIndexStatusSubscription(): void {
		// Get the current workspace manager
		const currentManager = this.getCurrentWorkspaceCodeIndexManager()

		// If the manager hasn't changed, no need to update subscription
		if (currentManager === this.currentWorkspaceManager) {
			return
		}

		// Dispose the old subscription if it exists
		if (this.codeIndexStatusSubscription) {
			this.codeIndexStatusSubscription.dispose()
			this.codeIndexStatusSubscription = undefined
		}

		// Update the current workspace manager reference
		this.currentWorkspaceManager = currentManager

		// Subscribe to the new manager's progress updates if it exists
		if (currentManager) {
			this.codeIndexStatusSubscription = currentManager.onProgressUpdate((update: IndexProgressUpdate) => {
				// Only send updates if this manager is still the current one
				if (currentManager === this.getCurrentWorkspaceCodeIndexManager()) {
					// Get the full status from the manager to ensure we have all fields correctly formatted
					const fullStatus = currentManager.getCurrentStatus()
					this.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: fullStatus,
					})
				}
			})

			if (this.view) {
				this.webviewDisposables.push(this.codeIndexStatusSubscription)
			}

			// Send initial status for the current workspace
			this.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: currentManager.getCurrentStatus(),
			})
		}
	}
}

class OrganizationAllowListViolationError extends Error {
	constructor(message: string) {
		super(message)
	}
}

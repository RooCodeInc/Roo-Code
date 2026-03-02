import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import * as yaml from "yaml"
import { logger } from "../../utils/logging"

import {
	type Language,
	type ProviderSettings,
	type GlobalState,
	type ClineMessage,
	TelemetryEventName,
} from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"
import { type ApiMessage } from "../task-persistence/apiMessages"

import { ClineProvider } from "./ClineProvider"
import { changeLanguage, t } from "../../i18n"
import { Package } from "../../shared/package"
import { RouterName, toRouterName, ModelRecord } from "../../shared/api"
import { supportPrompt } from "../../shared/support-prompt"
import { MessageEnhancer } from "./messageEnhancer"

import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema, WebviewMessage } from "../../shared/WebviewMessage"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { openFile } from "../../integrations/misc/open-file"
import { CodeIndexManager } from "../../services/code-index/manager"
import { openImage, saveImage } from "../../integrations/misc/image-handler"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { discoverChromeHostUrl, tryChromeHostUrl } from "../../services/browser/browserDiscovery"
import { searchWorkspaceFiles } from "../../services/search/file-search"
import { fileExistsAtPath } from "../../utils/fs"
import { playTts, setTtsEnabled, setTtsSpeed, stopTts } from "../../utils/tts"
import { searchCommits } from "../../utils/git"
import { exportSettings, importSettingsWithFeedback } from "../config/importExport"
import { getOpenAiModels } from "../../api/providers/openai"
import { getVsCodeLmModels } from "../../api/providers/vscode-lm"
import { openMention } from "../mentions"
import { TelemetrySetting } from "../../shared/TelemetrySetting"
import { getWorkspacePath } from "../../utils/path"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { Mode, defaultModeSlug } from "../../shared/modes"
import { getModelsForMode } from "../../shared/mode-models"
import { getModels, flushModels } from "../../api/providers/fetchers/modelCache"
import { GetModelsOptions } from "../../shared/api"
import { generateSystemPrompt } from "./generateSystemPrompt"
import { getCommand } from "../../utils/commands"

const ALLOWED_VSCODE_SETTINGS = new Set(["terminal.integrated.inheritEnv"])

import { MarketplaceManager, MarketplaceItemType } from "../../services/marketplace"
import { setPendingTodoList } from "../tools/updateTodoListTool"
import { FileChangesService } from "../../services/file-changes"

export const webviewMessageHandler = async (
	provider: ClineProvider,
	message: WebviewMessage,
	marketplaceManager?: MarketplaceManager,
) => {
	// Utility functions provided for concise get/update of global state via contextProxy API.
	const getGlobalState = <K extends keyof GlobalState>(key: K) => provider.contextProxy.getValue(key)
	const updateGlobalState = async <K extends keyof GlobalState>(key: K, value: GlobalState[K]) =>
		await provider.contextProxy.setValue(key, value)

	/**
	 * Shared utility to find message indices based on timestamp
	 */
	const findMessageIndices = (messageTs: number, currentCline: any) => {
		const timeCutoff = messageTs - 1000 // 1 second buffer before the message
		const messageIndex = currentCline.clineMessages.findIndex((msg: ClineMessage) => msg.ts && msg.ts >= timeCutoff)
		const apiConversationHistoryIndex = currentCline.apiConversationHistory.findIndex(
			(msg: ApiMessage) => msg.ts && msg.ts >= timeCutoff,
		)
		return { messageIndex, apiConversationHistoryIndex }
	}

	/**
	 * Removes the target message and all subsequent messages
	 */
	const removeMessagesThisAndSubsequent = async (
		currentCline: any,
		messageIndex: number,
		apiConversationHistoryIndex: number,
	) => {
		// Delete this message and all that follow
		await currentCline.overwriteClineMessages(currentCline.clineMessages.slice(0, messageIndex))

		if (apiConversationHistoryIndex !== -1) {
			await currentCline.overwriteApiConversationHistory(
				currentCline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
			)
		}
	}

	/**
	 * Handles message deletion operations with user confirmation
	 */
	const handleDeleteOperation = async (messageTs: number): Promise<void> => {
		// Send message to webview to show delete confirmation dialog
		await provider.postMessageToWebview({
			type: "showDeleteMessageDialog",
			messageTs,
		})
	}

	/**
	 * Handles confirmed message deletion from webview dialog
	 */
	const handleDeleteMessageConfirm = async (messageTs: number): Promise<void> => {
		// Only proceed if we have a current cline
		if (provider.getCurrentCline()) {
			const currentCline = provider.getCurrentCline()!
			const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

			if (messageIndex !== -1) {
				try {
					const { historyItem } = await provider.getTaskWithId(currentCline.taskId)

					// Delete this message and all subsequent messages
					await removeMessagesThisAndSubsequent(currentCline, messageIndex, apiConversationHistoryIndex)

					// Initialize with history item after deletion
					await provider.initClineWithHistoryItem(historyItem)
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error deleting message: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	/**
	 * Handles message editing operations with user confirmation
	 */
	const handleEditOperation = async (messageTs: number, editedContent: string, images?: string[]): Promise<void> => {
		// Send message to webview to show edit confirmation dialog
		await provider.postMessageToWebview({
			type: "showEditMessageDialog",
			messageTs,
			text: editedContent,
			images,
		})
	}

	/**
	 * Handles confirmed message editing from webview dialog
	 */
	const handleEditMessageConfirm = async (
		messageTs: number,
		editedContent: string,
		images?: string[],
	): Promise<void> => {
		// Only proceed if we have a current cline
		if (provider.getCurrentCline()) {
			const currentCline = provider.getCurrentCline()!

			// Use findMessageIndices to find messages based on timestamp
			const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

			if (messageIndex !== -1) {
				try {
					// Edit this message and delete subsequent
					await removeMessagesThisAndSubsequent(currentCline, messageIndex, apiConversationHistoryIndex)

					// Process the edited message as a regular user message
					// This will add it to the conversation and trigger an AI response
					webviewMessageHandler(provider, {
						type: "askResponse",
						askResponse: "messageResponse",
						text: editedContent,
						images,
					})

					// Don't initialize with history item for edit operations
					// The webviewMessageHandler will handle the conversation state
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error editing message: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}
	}

	/**
	 * Handles message modification operations (delete or edit) with confirmation dialog
	 * @param messageTs Timestamp of the message to operate on
	 * @param operation Type of operation ('delete' or 'edit')
	 * @param editedContent New content for edit operations
	 * @returns Promise<void>
	 */
	const handleMessageModificationsOperation = async (
		messageTs: number,
		operation: "delete" | "edit",
		editedContent?: string,
		images?: string[],
	): Promise<void> => {
		if (operation === "delete") {
			await handleDeleteOperation(messageTs)
		} else if (operation === "edit" && editedContent) {
			await handleEditOperation(messageTs, editedContent, images)
		}
	}

	console.log(`[DEBUG] Received webview message type: ${message.type}`)

	switch (message.type) {
		case "debugStopTimer": {
			const task = provider.getCurrentCline()
			if (task) {
				task.manualPauseTimer()
				await provider.postStateToWebview()
			}
			break
		}
		case "webviewDidLaunch":
			// Calculate and log time from activation to UI ready
			const activationStartTime = provider.getValue("activationStartTime")
			if (activationStartTime) {
				const timeToReady = Date.now() - activationStartTime
				provider.log(`🚀 Webview UI ready in ${timeToReady}ms (${(timeToReady / 1000).toFixed(2)}s)`)
				// Clear the start time after logging to avoid re-logging on subsequent launches
				await provider.setValue("activationStartTime", undefined)
			}

			// Load custom modes first
			const customModes = await provider.customModesManager.getCustomModes()
			await updateGlobalState("customModes", customModes)

			provider.postStateToWebview()
			provider.workspaceTracker?.initializeFilePaths() // Don't await.

			getTheme().then((theme) => provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }))

			// If MCP Hub is already initialized, update the webview with
			// current server list.
			const mcpHub = provider.getMcpHub()

			if (mcpHub) {
				provider.postMessageToWebview({ type: "mcpServers", mcpServers: mcpHub.getAllServers() })
			}

			provider.providerSettingsManager
				.listConfig()
				.then(async (listApiConfig) => {
					if (!listApiConfig) {
						return
					}

					if (listApiConfig.length === 1) {
						// Check if first time init then sync with exist config.
						if (!checkExistKey(listApiConfig[0])) {
							const { apiConfiguration } = await provider.getState()

							await provider.providerSettingsManager.saveConfig(
								listApiConfig[0].name ?? "default",
								apiConfiguration,
							)

							listApiConfig[0].apiProvider = apiConfiguration.apiProvider
						}
					}

					const currentConfigName = getGlobalState("currentApiConfigName")

					if (currentConfigName) {
						if (!(await provider.providerSettingsManager.hasConfig(currentConfigName))) {
							// Current config name not valid, get first config in list.
							const name = listApiConfig[0]?.name
							await updateGlobalState("currentApiConfigName", name)

							if (name) {
								await provider.activateProviderProfile({ name })
								return
							}
						}
					}

					await Promise.all([
						await updateGlobalState("listApiConfigMeta", listApiConfig),
						await provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
					])
				})
				.catch((error) =>
					provider.log(
						`Error list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					),
				)

			// If user already opted in to telemetry, enable telemetry service
			provider.getStateToPostToWebview().then((state) => {
				const { telemetrySetting } = state
				const isOptedIn = telemetrySetting === "enabled"
				TelemetryService.instance.updateTelemetryState(isOptedIn)
			})

			provider.isViewLaunched = true
			break
		case "newTask":
			// Initializing new instance of Cline will make sure that any
			// agentically running promises in old instance don't affect our new
			// task. This essentially creates a fresh slate for the new task.
			await provider.initClineWithTask(message.text, message.images)
			break
		case "customInstructions":
			await provider.updateCustomInstructions(message.text)
			break
		case "alwaysAllowReadOnly":
			await updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "executeCommand":
			if (message.commands) {
				try {
					const command = message.commands[0]
					await vscode.commands.executeCommand(command)
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error executing command ${message.commands}: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		case "firebaseSignInWithApiKey":
			// Store the user-provided API key temporarily
			if (message.apiKey) {
				await updateGlobalState("pendingUserApiKey", message.apiKey)

				// If user is signing in with their own API key, prefer free models by default
				// so the UI reflects the intention to use OpenRouter free configs immediately.
				await updateGlobalState("useFreeModels", true)
				// Push updated state to webview so the checkbox updates immediately
				await provider.postStateToWebview()
			}
			// Execute Firebase sign-in command
			try {
				await vscode.commands.executeCommand("firebase-service.signIn")
			} catch (error) {
				vscode.window.showErrorMessage(
					`Error executing Firebase sign-in: ${error instanceof Error ? error.message : String(error)}`,
				)
				// Clear pending API key on error
				await updateGlobalState("pendingUserApiKey", undefined)
			}
			break
		case "alwaysAllowReadOnlyOutsideWorkspace":
			await updateGlobalState("alwaysAllowReadOnlyOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWrite":
			await updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteOutsideWorkspace":
			await updateGlobalState("alwaysAllowWriteOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteProtected":
			await updateGlobalState("alwaysAllowWriteProtected", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowExecute":
			await updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowBrowser":
			await updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowMcp":
			await updateGlobalState("alwaysAllowMcp", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowModeSwitch":
			await updateGlobalState("alwaysAllowModeSwitch", message.bool)
			await provider.postStateToWebview()
			break
		case "useFreeModels":
			console.log("[webviewMessageHandler] useFreeModels handler called with value:", message.bool)
			await updateGlobalState("useFreeModels", message.bool)

			// Validate and update current model if needed
			const {
				apiConfiguration: useFreeModelsApiConfig,
				mode: useFreeModelsMode,
				currentApiConfigName,
			} = await provider.getState()
			const allModelsForUseFreeModels = getModelsForMode(useFreeModelsMode)
			console.log("[webviewMessageHandler] Current mode:", useFreeModelsMode)
			console.log(
				"[webviewMessageHandler] All models for mode:",
				allModelsForUseFreeModels.map((m) => ({ id: m.modelId, tier: m.tier })),
			)

			// Get current model from apiConfiguration
			let currentModelId: string | undefined
			switch (useFreeModelsApiConfig.apiProvider) {
				case "openrouter":
					currentModelId = useFreeModelsApiConfig.openRouterModelId
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
					currentModelId = useFreeModelsApiConfig.apiModelId
					break
				case "openai":
					currentModelId = useFreeModelsApiConfig.openAiModelId
					break
				default:
					currentModelId = undefined
			}

			console.log("[webviewMessageHandler] Current modelId:", currentModelId)

			// Find current model's tier
			const currentModel = allModelsForUseFreeModels.find((m) => m.modelId === currentModelId)
			const currentTier = currentModel?.tier
			console.log("[webviewMessageHandler] Current model tier:", currentTier)

			// Check if current model is compatible with new useFreeModels setting
			// When useFreeModels=true, only free models are allowed
			// When useFreeModels=false, all models are allowed (no validation needed)
			const isIncompatible = message.bool === true && currentTier !== "free"
			console.log("[webviewMessageHandler] Is model incompatible?", isIncompatible)

			if (isIncompatible) {
				console.log(
					"[webviewMessageHandler] Current model is paid but useFreeModels=true, switching to free model",
				)
				// Filter to free models only
				const freeModels = allModelsForUseFreeModels.filter((m) => m.tier === "free")
				console.log(
					"[webviewMessageHandler] Free models available:",
					freeModels.map((m) => ({ id: m.modelId, tier: m.tier })),
				)

				if (freeModels.length > 0) {
					const newModelId = freeModels[0].modelId
					console.log("[webviewMessageHandler] Switching to model:", newModelId)

					// Update the model
					let newConfiguration: ProviderSettings
					switch (useFreeModelsApiConfig.apiProvider) {
						case "openrouter":
							newConfiguration = { ...useFreeModelsApiConfig, openRouterModelId: newModelId }
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
							newConfiguration = { ...useFreeModelsApiConfig, apiModelId: newModelId }
							break
						case "openai":
							newConfiguration = { ...useFreeModelsApiConfig, openAiModelId: newModelId }
							break
						default:
							newConfiguration = useFreeModelsApiConfig
					}

					// Save the updated configuration
					try {
						await provider.providerSettingsManager.saveConfig(currentApiConfigName, newConfiguration)
						console.log("[webviewMessageHandler] Model updated successfully")
					} catch (error) {
						console.error("[webviewMessageHandler] Error updating model:", error)
						provider.log(
							`Error updating model when useFreeModels changed: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
					}
				} else {
					console.log("[webviewMessageHandler] No free models available for mode:", useFreeModelsMode)
				}
			}

			await provider.postStateToWebview()
			break
		case "allowedMaxRequests":
			await updateGlobalState("allowedMaxRequests", message.value)
			await provider.postStateToWebview()
			break
		case "allowedMaxCost":
			await updateGlobalState("allowedMaxCost", message.value)
			await provider.postStateToWebview()
			break
		case "alwaysAllowSubtasks":
			await updateGlobalState("alwaysAllowSubtasks", message.bool)
			await provider.postStateToWebview()
			break
		
		case "alwaysAllowDeploySfMetadata":
			await updateGlobalState("alwaysAllowDeploySfMetadata", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowRetrieveSfMetadata":
			await updateGlobalState("alwaysAllowRetrieveSfMetadata", message.bool)
			await provider.postStateToWebview()
			break
		case "askResponse":
			{
				const task = provider.getCurrentCline()
				if (!task) {
					break
				}
				if (message.taskId && message.taskId !== task.taskId) {
					provider.log(
						`[TIMER_TRACE] Ignored askResponse for stale taskId=${message.taskId}; current=${task.taskId}`,
					)
					break
				}
				task.handleWebviewAskResponse(message.askResponse!, message.text, message.images, message.messageTs)
			}
			break
		case "autoCondenseContext":
			await updateGlobalState("autoCondenseContext", message.bool)
			await provider.postStateToWebview()
			break
		case "autoCondenseContextPercent":
			await updateGlobalState("autoCondenseContextPercent", message.value)
			await provider.postStateToWebview()
			break
		case "terminalOperation":
			if (message.terminalOperation) {
				provider.getCurrentCline()?.handleTerminalOperation(message.terminalOperation)
			}
			break
		case "clearTask":
			// clear task resets the current session and allows for a new task to be started, if this session is a subtask - it allows the parent task to be resumed
			// Check if the current task actually has a parent task
			const currentTask = provider.getCurrentCline()
			if (currentTask && currentTask.parentTask) {
				await provider.finishSubTask(t("common:tasks.canceled"))
			} else {
				// Regular task - just clear it
				await provider.clearTask()
			}
			await provider.postStateToWebview()
			break
		case "didShowAnnouncement":
			await updateGlobalState("lastShownAnnouncementId", provider.latestAnnouncementId)
			await provider.postStateToWebview()
			break
		case "selectImages":
			const images = await selectImages()
			await provider.postMessageToWebview({
				type: "selectedImages",
				images,
				context: message.context,
				messageTs: message.messageTs,
			})
			break
		case "exportCurrentTask":
			const currentTaskId = provider.getCurrentCline()?.taskId
			if (currentTaskId) {
				provider.exportTaskWithId(currentTaskId)
			}
			break
		case "exportCurrentTaskDebugJson": {
			const debugTaskId = provider.getCurrentCline()?.taskId
			if (debugTaskId) {
				provider.exportTaskDebugJsonWithId(debugTaskId)
			}
			break
		}
		case "showTaskWithId":
			provider.showTaskWithId(message.text!)
			break
		case "condenseTaskContextRequest":
			provider.condenseTaskContext(message.text!)
			break
		case "deleteTaskWithId":
			provider.deleteTaskWithId(message.text!)
			break
		case "deleteMultipleTasksWithIds": {
			const ids = message.ids

			if (Array.isArray(ids)) {
				// Process in batches of 20 (or another reasonable number)
				const batchSize = 20
				const results = []

				// Only log start and end of the operation

				for (let i = 0; i < ids.length; i += batchSize) {
					const batch = ids.slice(i, i + batchSize)

					const batchPromises = batch.map(async (id) => {
						try {
							await provider.deleteTaskWithId(id)
							return { id, success: true }
						} catch (error) {
							// Keep error logging for debugging purposes

							return { id, success: false }
						}
					})

					// Process each batch in parallel but wait for completion before starting the next batch
					const batchResults = await Promise.all(batchPromises)
					results.push(...batchResults)

					// Update the UI after each batch to show progress
					await provider.postStateToWebview()
				}

				// Log final results
				const successCount = results.filter((r) => r.success).length
				const failCount = results.length - successCount
			}
			break
		}
		case "exportTaskWithId":
			provider.exportTaskWithId(message.text!)
			break
		case "exportTaskDebugJson":
			provider.exportTaskDebugJsonWithId(message.text!)
			break
		case "importSettings": {
			await importSettingsWithFeedback({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
				customModesManager: provider.customModesManager,
				provider: provider,
			})

			break
		}
		case "exportSettings":
			await exportSettings({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
			})

			break
		case "resetState":
			await provider.resetState()
			break
		case "flushRouterModels":
			const routerNameFlush: RouterName = toRouterName(message.text)
			await flushModels(routerNameFlush)
			break
		case "requestRouterModels":
			const { apiConfiguration } = await provider.getState()

			const routerModels: Partial<Record<RouterName, ModelRecord>> = {
				openrouter: {},
				requesty: {},
				glama: {},
				unbound: {},
				litellm: {},
				ollama: {},
				lmstudio: {},
			}

			const safeGetModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
				return await getModels(options)
			}

			const modelFetchPromises: Array<{ key: RouterName; options: GetModelsOptions }> = [
				{ key: "openrouter", options: { provider: "openrouter" } },
				{ key: "requesty", options: { provider: "requesty", apiKey: apiConfiguration.requestyApiKey } },
				{ key: "glama", options: { provider: "glama" } },
				{ key: "unbound", options: { provider: "unbound", apiKey: apiConfiguration.unboundApiKey } },
			]

			// Don't fetch Ollama and LM Studio models by default anymore
			// They have their own specific handlers: requestOllamaModels and requestLmStudioModels

			const litellmApiKey = apiConfiguration.litellmApiKey || message?.values?.litellmApiKey
			const litellmBaseUrl = apiConfiguration.litellmBaseUrl || message?.values?.litellmBaseUrl
			if (litellmApiKey && litellmBaseUrl) {
				modelFetchPromises.push({
					key: "litellm",
					options: { provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl },
				})
			}

			const results = await Promise.allSettled(
				modelFetchPromises.map(async ({ key, options }) => {
					const models = await safeGetModels(options)
					return { key, models } // key is RouterName here
				}),
			)

			const fetchedRouterModels: Partial<Record<RouterName, ModelRecord>> = {
				...routerModels,
				// Initialize ollama and lmstudio with empty objects since they use separate handlers
				ollama: {},
				lmstudio: {},
			}

			results.forEach((result, index) => {
				const routerName = modelFetchPromises[index].key // Get RouterName using index

				if (result.status === "fulfilled") {
					fetchedRouterModels[routerName] = result.value.models

					// Ollama and LM Studio settings pages still need these events
					if (routerName === "ollama" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "ollamaModels",
							ollamaModels: Object.keys(result.value.models),
						})
					} else if (routerName === "lmstudio" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "lmStudioModels",
							lmStudioModels: result.value.models,
						})
					}
				} else {
					// Handle rejection: Post a specific error message for this provider
					const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason)

					fetchedRouterModels[routerName] = {} // Ensure it's an empty object in the main routerModels message

					provider.postMessageToWebview({
						type: "singleRouterModelFetchResponse",
						success: false,
						error: errorMessage,
						values: { provider: routerName },
					})
				}
			})

			provider.postMessageToWebview({
				type: "routerModels",
				routerModels: fetchedRouterModels as Record<RouterName, ModelRecord>,
			})

			break
		case "requestOllamaModels": {
			// Specific handler for Ollama models only
			const { apiConfiguration: ollamaApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models
				await flushModels("ollama")

				const ollamaModels = await getModels({
					provider: "ollama",
					baseUrl: ollamaApiConfig.ollamaBaseUrl,
				})

				if (Object.keys(ollamaModels).length > 0) {
					provider.postMessageToWebview({
						type: "ollamaModels",
						ollamaModels: Object.keys(ollamaModels),
					})
				}
			} catch (error) {
				// Silently fail - user hasn't configured Ollama yet
			}
			break
		}
		case "requestLmStudioModels": {
			// Specific handler for LM Studio models only
			const { apiConfiguration: lmStudioApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models
				await flushModels("lmstudio")

				const lmStudioModels = await getModels({
					provider: "lmstudio",
					baseUrl: lmStudioApiConfig.lmStudioBaseUrl,
				})

				if (Object.keys(lmStudioModels).length > 0) {
					provider.postMessageToWebview({
						type: "lmStudioModels",
						lmStudioModels: lmStudioModels,
					})
				}
			} catch (error) {
				// Silently fail - user hasn't configured LM Studio yet
			}
			break
		}
		case "requestOpenAiModels":
			if (message?.values?.baseUrl && message?.values?.apiKey) {
				const openAiModels = await getOpenAiModels(
					message?.values?.baseUrl,
					message?.values?.apiKey,
					message?.values?.openAiHeaders,
				)

				provider.postMessageToWebview({ type: "openAiModels", openAiModels })
			}

			break
		case "requestVsCodeLmModels":
			const vsCodeLmModels = await getVsCodeLmModels()
			// TODO: Cache like we do for OpenRouter, etc?
			provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
			break
		case "requestHuggingFaceModels":
			try {
				const { getHuggingFaceModelsWithMetadata } = await import("../../api/providers/fetchers/huggingface")
				const huggingFaceModelsResponse = await getHuggingFaceModelsWithMetadata()
				provider.postMessageToWebview({
					type: "huggingFaceModels",
					huggingFaceModels: huggingFaceModelsResponse.models,
				})
			} catch (error) {
				provider.postMessageToWebview({
					type: "huggingFaceModels",
					huggingFaceModels: [],
				})
			}
			break
		case "openImage":
			openImage(message.text!, { values: message.values })
			break
		case "saveImage":
			saveImage(message.dataUri!)
			break
		case "openFile":
			{
				const requested = message.text ?? (message as any).path ?? ""

				try {
					// Normalize and detect any attempts to open internal .roo instruction files

					if (
						typeof requested === "string" &&
						(requested.includes(".roo/") ||
							requested.includes("/.roo/") ||
							requested.startsWith(".roo") ||
							requested.includes("./.roo/"))
					) {
						provider.log(`[webviewMessageHandler] Blocked attempt to open internal .roo file: ${requested}`)

						// Notify webview that opening internal instruction files is blocked and provide only the filename

						await (provider.postMessageToWebview as any)({
							type: "fileOpenBlocked",
							text: path.basename(String(requested)),
						})

						break
					}

					// If the requested path is an absolute path outside the workspace, block it.

					const workspacePath = getWorkspacePath()

					if (typeof requested === "string" && path.isAbsolute(requested) && workspacePath) {
						const normalizedRequested = path.normalize(requested)

						const normalizedWorkspace = path.normalize(workspacePath)

						const relative = path.relative(normalizedWorkspace, normalizedRequested)

						// If relative starts with '..' or is absolute, it's outside the workspace

						if (relative.startsWith("..") || path.isAbsolute(relative)) {
							provider.log(
								`[webviewMessageHandler] Blocked attempt to open file outside workspace: ${requested}`,
							)

							await (provider.postMessageToWebview as any)({
								type: "fileOpenBlocked",
								text: path.basename(String(requested)),
							})

							break
						}
					}
				} catch (err) {
					// Fall through to normal openFile behavior if detection fails for any reason
				}

				// If webview sent `path` instead of `text`, accept that too.
				openFile(requested, message.values as { create?: boolean; content?: string; line?: number })
			}
			break
		case "openDiff":
			{
				// Open VS Code native diff editor for a file change
				const diffPayload = message.values as
					| {
							filePath?: string
							diff?: string
							original?: string
							modified?: string
							status?: string
					  }
					| undefined

				if (!diffPayload?.filePath) break

				const workDir = getWorkspacePath()
				const filePath = diffPayload.filePath
				const absolutePath = path.isAbsolute(filePath)
					? filePath
					: workDir
						? path.resolve(workDir, filePath.replace(/^\.\//, ""))
						: filePath

				try {
					// If we have a diff string, reconstruct original content from current file
					if (diffPayload.diff) {
						const currentContent = await fs.readFile(absolutePath, "utf-8").catch(() => "")
						const originalContent = diffPayload.original ?? currentContent

						// Create a virtual document URI for the original content
						const { DIFF_VIEW_URI_SCHEME } = await import("../../integrations/editor/DiffViewProvider")
						const fileName = path.basename(absolutePath)
						const originalUri = vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
							query: Buffer.from(originalContent).toString("base64"),
						})
						const modifiedUri = vscode.Uri.file(absolutePath)

						await vscode.commands.executeCommand(
							"vscode.diff",
							originalUri,
							modifiedUri,
							`${fileName}: Changes`,
							{ preview: true, preserveFocus: false },
						)
					} else {
						// No diff available, just open the file
						openFile(absolutePath)
					}
				} catch (err) {
					console.error("Failed to open diff view:", err)
					// Fallback: just open the file
					openFile(absolutePath)
				}
			}
			break
		case "openMention":
			openMention(message.text)
			break
		case "openExternal":
			if (message.url) {
				vscode.env.openExternal(vscode.Uri.parse(message.url))
			}
			break
		case "checkpointDiff":
			const result = checkoutDiffPayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.getCurrentCline()?.checkpointDiff(result.data)
			}

			break
		case "checkpointRestore": {
			const result = checkoutRestorePayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.cancelTask()

				try {
					await pWaitFor(() => provider.getCurrentCline()?.isInitialized === true, { timeout: 3_000 })
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
				}

				try {
					await provider.getCurrentCline()?.checkpointRestore(result.data)
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
				}
			}

			break
		}
		case "cancelTask":
			await provider.cancelTask()
			break
		case "allowedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("allowedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("allowedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "deniedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("deniedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("deniedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "openCustomModesSettings": {
			const customModesFilePath = await provider.customModesManager.getCustomModesFilePath()

			if (customModesFilePath) {
				openFile(customModesFilePath)
			}

			break
		}
		case "openMcpSettings": {
			const mcpSettingsFilePath = await provider.getMcpHub()?.getMcpSettingsFilePath()

			if (mcpSettingsFilePath) {
				openFile(mcpSettingsFilePath)
			}

			break
		}
		case "openProjectMcpSettings": {
			if (!vscode.workspace.workspaceFolders?.length) {
				vscode.window.showErrorMessage(t("common:errors.no_workspace"))
				return
			}

			const workspaceFolder = vscode.workspace.workspaceFolders[0]
			const rooDir = path.join(workspaceFolder.uri.fsPath, ".roo")
			const mcpPath = path.join(rooDir, "mcp.json")

			try {
				await fs.mkdir(rooDir, { recursive: true })
				const exists = await fileExistsAtPath(mcpPath)

				if (!exists) {
					await safeWriteJson(mcpPath, { mcpServers: {} })
				}

				await openFile(mcpPath)
			} catch (error) {
				vscode.window.showErrorMessage(t("mcp:errors.create_json", { error: `${error}` }))
			}

			break
		}
		case "deleteMcpServer": {
			if (!message.serverName) {
				break
			}

			try {
				provider.log(`Attempting to delete MCP server: ${message.serverName}`)
				await provider.getMcpHub()?.deleteServer(message.serverName, message.source as "global" | "project")
				provider.log(`Successfully deleted MCP server: ${message.serverName}`)

				// Refresh the webview state
				await provider.postStateToWebview()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to delete MCP server: ${errorMessage}`)
				// Error messages are already handled by McpHub.deleteServer
			}
			break
		}
		case "restartMcpServer": {
			try {
				await provider.getMcpHub()?.restartConnection(message.text!, message.source as "global" | "project")
			} catch (error) {
				provider.log(
					`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolAlwaysAllow": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolAlwaysAllow(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.alwaysAllow),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolEnabledForPrompt": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolEnabledForPrompt(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.isEnabled),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle enabled for prompt for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleMcpServer": {
			try {
				await provider
					.getMcpHub()
					?.toggleServerDisabled(
						message.serverName!,
						message.disabled!,
						message.source as "global" | "project",
					)
			} catch (error) {
				provider.log(
					`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "mcpEnabled":
			const mcpEnabled = message.bool ?? true
			const currentMcpEnabled = getGlobalState("mcpEnabled") ?? true

			// Always update the state to ensure consistency
			await updateGlobalState("mcpEnabled", mcpEnabled)

			// Only refresh MCP connections if the value actually changed
			// This prevents expensive MCP server refresh operations when saving unrelated settings
			if (currentMcpEnabled !== mcpEnabled) {
				// Delegate MCP enable/disable logic to McpHub
				const mcpHubInstance = provider.getMcpHub()
				if (mcpHubInstance) {
					await mcpHubInstance.handleMcpEnabledChange(mcpEnabled)
				}
			}

			await provider.postStateToWebview()
			break
		case "enableMcpServerCreation":
			await updateGlobalState("enableMcpServerCreation", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "enablePmdRules":
			await updateGlobalState("enablePmdRules", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "refreshAllMcpServers": {
			const mcpHub = provider.getMcpHub()
			if (mcpHub) {
				await mcpHub.refreshAllConnections()
			}
			break
		}
		// playSound handler removed - now handled directly in the webview
		case "soundEnabled":
			const soundEnabled = message.bool ?? true
			await updateGlobalState("soundEnabled", soundEnabled)
			await provider.postStateToWebview()
			break
		case "notificationsEnabled":
			const notificationsEnabled = message.bool ?? true
			await updateGlobalState("notificationsEnabled", notificationsEnabled)
			await provider.postStateToWebview()
			break
		case "soundVolume":
			const soundVolume = message.value ?? 0.5
			await updateGlobalState("soundVolume", soundVolume)
			await provider.postStateToWebview()
			break
		case "ttsEnabled":
			const ttsEnabled = message.bool ?? true
			await updateGlobalState("ttsEnabled", ttsEnabled)
			setTtsEnabled(ttsEnabled) // Add this line to update the tts utility
			await provider.postStateToWebview()
			break
		case "ttsSpeed":
			const ttsSpeed = message.value ?? 1.0
			await updateGlobalState("ttsSpeed", ttsSpeed)
			setTtsSpeed(ttsSpeed)
			await provider.postStateToWebview()
			break
		case "playTts":
			if (message.text) {
				playTts(message.text, {
					onStart: () => provider.postMessageToWebview({ type: "ttsStart", text: message.text }),
					onStop: () => provider.postMessageToWebview({ type: "ttsStop", text: message.text }),
				})
			}
			break
		case "stopTts":
			stopTts()
			break
		case "showOsNotification":
			if (message.text) {
				// Only show VS Code notification when the window is NOT focused.
				// This prevents spamming the user with notifications while they are
				// actively using the editor.
				try {
					if (!vscode.window.state.focused) {
						vscode.window.showInformationMessage(message.text)
					}
				} catch (err) {
					// If for some reason we cannot determine focus state, fall back to
					// showing the message to avoid silently dropping important alerts.
					vscode.window.showInformationMessage(message.text)
				}
			}
			break
		case "diffEnabled":
			const diffEnabled = message.bool ?? true
			await updateGlobalState("diffEnabled", diffEnabled)
			await provider.postStateToWebview()
			break
		case "enableCheckpoints":
			const enableCheckpoints = message.bool ?? true
			await updateGlobalState("enableCheckpoints", enableCheckpoints)
			await provider.postStateToWebview()
			break
		case "browserViewportSize":
			const browserViewportSize = message.text ?? "900x600"
			await updateGlobalState("browserViewportSize", browserViewportSize)
			await provider.postStateToWebview()
			break
		case "remoteBrowserHost":
			await updateGlobalState("remoteBrowserHost", message.text)
			await provider.postStateToWebview()
			break
		case "remoteBrowserEnabled":
			// Store the preference in global state
			// remoteBrowserEnabled now means "enable remote browser connection"
			await updateGlobalState("remoteBrowserEnabled", message.bool ?? false)
			// If disabling remote browser connection, clear the remoteBrowserHost
			if (!message.bool) {
				await updateGlobalState("remoteBrowserHost", undefined)
			}
			await provider.postStateToWebview()
			break
		case "testBrowserConnection":
			// If no text is provided, try auto-discovery
			if (!message.text) {
				// Use testBrowserConnection for auto-discovery
				const chromeHostUrl = await discoverChromeHostUrl()

				if (chromeHostUrl) {
					// Send the result back to the webview
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: !!chromeHostUrl,
						text: `Auto-discovered and tested connection to Chrome: ${chromeHostUrl}`,
						values: { endpoint: chromeHostUrl },
					})
				} else {
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: false,
						text: "No Chrome instances found on the network. Make sure Chrome is running with remote debugging enabled (--remote-debugging-port=9222).",
					})
				}
			} else {
				// Test the provided URL
				const customHostUrl = message.text
				const hostIsValid = await tryChromeHostUrl(message.text)

				// Send the result back to the webview
				await provider.postMessageToWebview({
					type: "browserConnectionResult",
					success: hostIsValid,
					text: hostIsValid
						? `Successfully connected to Chrome: ${customHostUrl}`
						: "Failed to connect to Chrome",
				})
			}
			break
		case "fuzzyMatchThreshold":
			await updateGlobalState("fuzzyMatchThreshold", message.value)
			await provider.postStateToWebview()
			break
		case "updateVSCodeSetting": {
			const { setting, value } = message

			if (setting !== undefined && value !== undefined) {
				if (ALLOWED_VSCODE_SETTINGS.has(setting)) {
					await vscode.workspace.getConfiguration().update(setting, value, true)
				} else {
					vscode.window.showErrorMessage(`Cannot update restricted VSCode setting: ${setting}`)
				}
			}

			break
		}
		case "developerMode":
			await updateGlobalState("developerMode", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "getVSCodeSetting":
			const { setting } = message

			if (setting) {
				try {
					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						value: vscode.workspace.getConfiguration().get(setting),
					})
				} catch (error) {
					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						error: `Failed to get setting: ${error.message}`,
						value: undefined,
					})
				}
			}

			break
		case "alwaysApproveResubmit":
			await updateGlobalState("alwaysApproveResubmit", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "requestDelaySeconds":
			await updateGlobalState("requestDelaySeconds", message.value ?? 5)
			await provider.postStateToWebview()
			break
		case "writeDelayMs":
			await updateGlobalState("writeDelayMs", message.value)
			await provider.postStateToWebview()
			break
		case "diagnosticsEnabled":
			await updateGlobalState("diagnosticsEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "terminalOutputLineLimit":
			// Validate that the line limit is a positive number
			const lineLimit = message.value
			if (typeof lineLimit === "number" && lineLimit > 0) {
				await updateGlobalState("terminalOutputLineLimit", lineLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_line_limit") || "Terminal output line limit must be a positive number",
				)
			}
			break
		case "terminalOutputCharacterLimit":
			// Validate that the character limit is a positive number
			const charLimit = message.value
			if (typeof charLimit === "number" && charLimit > 0) {
				await updateGlobalState("terminalOutputCharacterLimit", charLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_character_limit") ||
						"Terminal output character limit must be a positive number",
				)
			}
			break
		case "terminalShellIntegrationTimeout":
			await updateGlobalState("terminalShellIntegrationTimeout", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setShellIntegrationTimeout(message.value)
			}
			break
		case "terminalShellIntegrationDisabled":
			await updateGlobalState("terminalShellIntegrationDisabled", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setShellIntegrationDisabled(message.bool)
			}
			break
		case "terminalCommandDelay":
			await updateGlobalState("terminalCommandDelay", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setCommandDelay(message.value)
			}
			break
		case "terminalPowershellCounter":
			await updateGlobalState("terminalPowershellCounter", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setPowershellCounter(message.bool)
			}
			break
		case "terminalZshClearEolMark":
			await updateGlobalState("terminalZshClearEolMark", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshClearEolMark(message.bool)
			}
			break
		case "terminalZshOhMy":
			await updateGlobalState("terminalZshOhMy", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshOhMy(message.bool)
			}
			break
		case "terminalZshP10k":
			await updateGlobalState("terminalZshP10k", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshP10k(message.bool)
			}
			break
		case "terminalZdotdir":
			await updateGlobalState("terminalZdotdir", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZdotdir(message.bool)
			}
			break
		case "terminalCompressProgressBar":
			await updateGlobalState("terminalCompressProgressBar", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setCompressProgressBar(message.bool)
			}
			break
		case "mode":
			await provider.handleModeSwitch(message.text as Mode)
			break
		case "updateModel":
			try {
				if (!message.text) {
					provider.log("updateModel message received with no model ID")
					return
				}

				const modelId = message.text
				const { apiConfiguration, currentApiConfigName } = await provider.getState()

				// Update the correct model field based on the provider
				let newConfiguration: ProviderSettings
				switch (apiConfiguration.apiProvider) {
					case "openrouter":
						newConfiguration = { ...apiConfiguration, openRouterModelId: modelId }
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
						newConfiguration = { ...apiConfiguration, apiModelId: modelId }
						break
					case "openai":
						newConfiguration = { ...apiConfiguration, openAiModelId: modelId }
						break
					case "ollama":
						newConfiguration = { ...apiConfiguration, ollamaModelId: modelId }
						break
					case "lmstudio":
						newConfiguration = { ...apiConfiguration, lmStudioModelId: modelId }
						break
					case "glama":
						newConfiguration = { ...apiConfiguration, glamaModelId: modelId }
						break
					case "unbound":
						newConfiguration = { ...apiConfiguration, unboundModelId: modelId }
						break
					case "requesty":
						newConfiguration = { ...apiConfiguration, requestyModelId: modelId }
						break
					default:
						provider.log(`Unknown provider: ${apiConfiguration.apiProvider}, using apiModelId`)
						newConfiguration = { ...apiConfiguration, apiModelId: modelId }
				}

				// Save the updated configuration
				await provider.upsertProviderProfile(currentApiConfigName, newConfiguration, true)

				provider.log(`Updated model to: ${modelId} for provider: ${apiConfiguration.apiProvider}`)
			} catch (error) {
				provider.log(`Error updating model: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.update_model"))
			}
			break
		case "updateSupportPrompt":
			try {
				if (!message?.values) {
					return
				}

				// Replace all prompts with the new values from the cached state
				await updateGlobalState("customSupportPrompts", message.values)
				await provider.postStateToWebview()
			} catch (error) {
				provider.log(
					`Error update support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.update_support_prompt"))
			}
			break
		case "updatePrompt":
			if (message.promptMode && message.customPrompt !== undefined) {
				const existingPrompts = getGlobalState("customModePrompts") ?? {}
				const updatedPrompts = { ...existingPrompts, [message.promptMode]: message.customPrompt }
				await updateGlobalState("customModePrompts", updatedPrompts)
				const currentState = await provider.getStateToPostToWebview()
				const stateWithPrompts = {
					...currentState,
					customModePrompts: updatedPrompts,
					hasOpenedModeSelector: currentState.hasOpenedModeSelector ?? false,
				}
				provider.postMessageToWebview({ type: "state", state: stateWithPrompts })

				if (TelemetryService.hasInstance()) {
					// Determine which setting was changed by comparing objects
					const oldPrompt = existingPrompts[message.promptMode] || {}
					const newPrompt = message.customPrompt
					const changedSettings = Object.keys(newPrompt).filter(
						(key) =>
							JSON.stringify((oldPrompt as Record<string, unknown>)[key]) !==
							JSON.stringify((newPrompt as Record<string, unknown>)[key]),
					)

					if (changedSettings.length > 0) {
						TelemetryService.instance.captureModeSettingChanged(changedSettings[0])
					}
				}
			}
			break
		case "deleteMessage": {
			if (provider.getCurrentCline() && typeof message.value === "number" && message.value) {
				await handleMessageModificationsOperation(message.value, "delete")
			}
			break
		}
		case "submitEditedMessage": {
			if (
				provider.getCurrentCline() &&
				typeof message.value === "number" &&
				message.value &&
				message.editedMessageContent
			) {
				await handleMessageModificationsOperation(
					message.value,
					"edit",
					message.editedMessageContent,
					message.images,
				)
			}
			break
		}
		case "screenshotQuality":
			await updateGlobalState("screenshotQuality", message.value)
			await provider.postStateToWebview()
			break
		case "maxOpenTabsContext":
			const tabCount = Math.min(Math.max(0, message.value ?? 20), 500)
			await updateGlobalState("maxOpenTabsContext", tabCount)
			await provider.postStateToWebview()
			break
		case "maxWorkspaceFiles":
			const fileCount = Math.min(Math.max(0, message.value ?? 200), 500)
			await updateGlobalState("maxWorkspaceFiles", fileCount)
			await provider.postStateToWebview()
			break
		
		
		case "browserToolEnabled":
			await updateGlobalState("browserToolEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "language":
			changeLanguage(message.text ?? "en")
			await updateGlobalState("language", message.text as Language)
			await provider.postStateToWebview()
			break
		case "showRooIgnoredFiles":
			await updateGlobalState("showRooIgnoredFiles", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "hasOpenedModeSelector":
			await updateGlobalState("hasOpenedModeSelector", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "maxReadFileLine":
			await updateGlobalState("maxReadFileLine", message.value)
			await provider.postStateToWebview()
			break
		case "maxImageFileSize":
			await updateGlobalState("maxImageFileSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxTotalImageSize":
			await updateGlobalState("maxTotalImageSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxConcurrentFileReads":
			const valueToSave = message.value // Capture the value intended for saving
			await updateGlobalState("maxConcurrentFileReads", valueToSave)
			await provider.postStateToWebview()
			break
		case "includeDiagnosticMessages":
			// Only apply default if the value is truly undefined (not false)
			const includeValue = message.bool !== undefined ? message.bool : true
			await updateGlobalState("includeDiagnosticMessages", includeValue)
			await provider.postStateToWebview()
			break
		case "maxDiagnosticMessages":
			await updateGlobalState("maxDiagnosticMessages", message.value ?? 50)
			await provider.postStateToWebview()
			break
		case "setHistoryPreviewCollapsed": // Add the new case handler
			await updateGlobalState("historyPreviewCollapsed", message.bool ?? false)
			// No need to call postStateToWebview here as the UI already updated optimistically
			break
		case "toggleApiConfigPin":
			if (message.text) {
				const currentPinned = getGlobalState("pinnedApiConfigs") ?? {}
				const updatedPinned: Record<string, boolean> = { ...currentPinned }

				if (currentPinned[message.text]) {
					delete updatedPinned[message.text]
				} else {
					updatedPinned[message.text] = true
				}

				await updateGlobalState("pinnedApiConfigs", updatedPinned)
				await provider.postStateToWebview()
			}
			break
		case "enhancementApiConfigId":
			await updateGlobalState("enhancementApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		case "includeTaskHistoryInEnhance":
			await updateGlobalState("includeTaskHistoryInEnhance", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "condensingApiConfigId":
			await updateGlobalState("condensingApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		case "updateCondensingPrompt":
			// Store the condensing prompt in customSupportPrompts["CONDENSE"] instead of customCondensingPrompt
			const currentSupportPrompts = getGlobalState("customSupportPrompts") ?? {}
			const updatedSupportPrompts = { ...currentSupportPrompts, CONDENSE: message.text }
			await updateGlobalState("customSupportPrompts", updatedSupportPrompts)
			// Also update the old field for backward compatibility during migration
			await updateGlobalState("customCondensingPrompt", message.text)
			await provider.postStateToWebview()
			break
		case "profileThresholds":
			await updateGlobalState("profileThresholds", message.values)
			await provider.postStateToWebview()
			break
		case "updateExperimental":
			await updateGlobalState("experiments", message.values)
			await provider.postStateToWebview()
			break
		case "autoApprovalEnabled":
			await updateGlobalState("autoApprovalEnabled", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "enhancePrompt":
			if (message.text) {
				try {
					const state = await provider.getState()
					const {
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta,
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
					} = state

					const currentCline = provider.getCurrentCline()
					const result = await MessageEnhancer.enhanceMessage({
						text: message.text,
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta,
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
						currentClineMessages: currentCline?.clineMessages,
						providerSettingsManager: provider.providerSettingsManager,
					})

					if (result.success && result.enhancedText) {
						// Capture telemetry for prompt enhancement
						MessageEnhancer.captureTelemetry(currentCline?.taskId, includeTaskHistoryInEnhance)
						await provider.postMessageToWebview({ type: "enhancedPrompt", text: result.enhancedText })
					} else {
						throw new Error(result.error || "Unknown error")
					}
				} catch (error) {
					provider.log(
						`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.enhance_prompt"))
					await provider.postMessageToWebview({ type: "enhancedPrompt" })
				}
			}
			break
		case "getSystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await provider.postMessageToWebview({
					type: "systemPrompt",
					text: systemPrompt,
					mode: message.mode,
				})
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "copySystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await vscode.env.clipboard.writeText(systemPrompt)
				await vscode.window.showInformationMessage(t("common:info.clipboard_copy"))
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "searchCommits": {
			const cwd = provider.cwd
			if (cwd) {
				try {
					const commits = await searchCommits(message.query || "", cwd)
					await provider.postMessageToWebview({
						type: "commitSearchResults",
						commits,
					})
				} catch (error) {
					provider.log(
						`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.search_commits"))
				}
			}
			break
		}
		case "searchFiles": {
			const workspacePath = getWorkspacePath()

			if (!workspacePath) {
				// Handle case where workspace path is not available
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					requestId: message.requestId,
					error: "No workspace path available",
				})
				break
			}
			try {
				// Call file search service with query from message
				const results = await searchWorkspaceFiles(
					message.query || "",
					workspacePath,
					20, // Use default limit, as filtering is now done in the backend
				)

				// Send results back to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results,
					requestId: message.requestId,
				})
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Send error response to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					error: errorMessage,
					requestId: message.requestId,
				})
			}
			break
		}
		case "updateTodoList": {
			const payload = message.payload as { todos?: any[] }
			const todos = payload?.todos
			if (Array.isArray(todos)) {
				await setPendingTodoList(todos)
			}
			break
		}
		case "saveApiConfiguration":
			if (message.text && message.apiConfiguration) {
				try {
					await provider.providerSettingsManager.saveConfig(message.text, message.apiConfiguration)
					const listApiConfig = await provider.providerSettingsManager.listConfig()
					await updateGlobalState("listApiConfigMeta", listApiConfig)
				} catch (error) {
					provider.log(
						`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.save_api_config"))
				}
			}
			break
		case "upsertApiConfiguration":
			if (message.text && message.apiConfiguration) {
				logger.info(`[webviewMessageHandler] Handling upsertApiConfiguration for profile: ${message.text}`)
				await provider.upsertProviderProfile(message.text, message.apiConfiguration)
				logger.info(`[webviewMessageHandler] upsertApiConfiguration completed for profile: ${message.text}`)
			} else {
				logger.warn(
					`[webviewMessageHandler] upsertApiConfiguration called with invalid message: text=${message.text}, apiConfiguration=${!!message.apiConfiguration}`,
				)
			}
			break
		case "renameApiConfiguration":
			if (message.values && message.apiConfiguration) {
				try {
					const { oldName, newName } = message.values

					if (oldName === newName) {
						break
					}

					// Load the old configuration to get its ID.
					const { id } = await provider.providerSettingsManager.getProfile({ name: oldName })

					// Create a new configuration with the new name and old ID.
					await provider.providerSettingsManager.saveConfig(newName, { ...message.apiConfiguration, id })

					// Delete the old configuration.
					await provider.providerSettingsManager.deleteConfig(oldName)

					// Re-activate to update the global settings related to the
					// currently activated provider profile.
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
				}
			}
			break
		case "loadApiConfiguration":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ name: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break
		case "loadApiConfigurationById":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ id: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break

		case "deleteApiConfiguration":
			if (message.text) {
				const answer = await vscode.window.showInformationMessage(
					t("common:confirmation.delete_config_profile"),
					{ modal: true },
					t("common:answers.yes"),
				)

				if (answer !== t("common:answers.yes")) {
					break
				}

				const oldName = message.text

				const newName = (await provider.providerSettingsManager.listConfig()).filter(
					(c) => c.name !== oldName,
				)[0]?.name

				if (!newName) {
					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
					return
				}

				try {
					await provider.providerSettingsManager.deleteConfig(oldName)
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
				}
			}
			break

		// File Changes Database handlers
		case "getFileChanges": {
			const taskId = message.text
			if (taskId) {
				try {
					const service = FileChangesService.getInstance()
					const fileChanges = await service.getTaskFileChanges(taskId)
					await provider.postMessageToWebview({
						type: "fileChanges",
						fileChanges: fileChanges.map((fc) => ({
							path: fc.filePath,
							additions: fc.additions,
							deletions: fc.deletions,
							status: fc.status,
							diff: fc.diff,
							deploymentStatus: fc.deploymentStatus,
							timestamp: fc.timestamp,
							error: fc.error,
						})),
					})
				} catch (error) {
					provider.log(
						`Error getting file changes: ${error instanceof Error ? error.message : String(error)}`,
					)
					await provider.postMessageToWebview({
						type: "fileChanges",
						fileChanges: [],
					})
				}
			}
			break
		}

		case "updateFileDeploymentStatus": {
			const values = message.values as
				| {
						taskId: string
						filePath: string
						deploymentStatus: string
						error?: string
				  }
				| undefined
			if (values?.taskId && values?.filePath && values?.deploymentStatus) {
				try {
					const service = FileChangesService.getInstance()
					await service.updateDeploymentStatus(
						values.taskId,
						values.filePath,
						values.deploymentStatus as "local" | "dry-run" | "deploying" | "deployed" | "failed",
						values.error,
					)
				} catch (error) {
					provider.log(
						`Error updating deployment status: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}

		case "clearFileChanges": {
			const taskId = message.text
			if (taskId) {
				try {
					const service = FileChangesService.getInstance()
					const db = service.getDatabase()
					await db.deleteAllFileChangesForTask(taskId)
				} catch (error) {
					provider.log(
						`Error clearing file changes: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}

		case "getFileChangesStatistics": {
			const taskId = message.text
			if (taskId) {
				try {
					const service = FileChangesService.getInstance()
					const db = service.getDatabase()
					const stats = await db.getTaskStatistics(taskId)
					await provider.postMessageToWebview({
						type: "fileChangesStatistics",
						statistics: stats,
					})
				} catch (error) {
					provider.log(
						`Error getting file changes statistics: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}

		case "migrateFileChanges": {
			const taskId = message.text
			const localFileChanges = message.values?.fileChanges as
				| Array<{
						path: string
						additions?: number
						deletions?: number
						status?: "modified" | "created" | "deleted"
						diff?: string
						deploymentStatus?: string
						timestamp?: number
						error?: string
				  }>
				| undefined

			if (taskId && Array.isArray(localFileChanges) && localFileChanges.length > 0) {
				try {
					const service = FileChangesService.getInstance()
					const db = service.getDatabase()

					provider.log(`Migrating ${localFileChanges.length} file changes for task ${taskId}`)

					for (const fc of localFileChanges) {
						if (fc.path) {
							await db.addFileChange({
								taskId,
								filePath: fc.path,
								status: fc.status || "modified",
								additions: fc.additions,
								deletions: fc.deletions,
								deploymentStatus: (fc.deploymentStatus as any) || "local",
								timestamp: fc.timestamp || Date.now(),
								diff: fc.diff,
								error: fc.error,
							})
						}
					}

					provider.log(`Successfully migrated file changes for task ${taskId}`)
				} catch (error) {
					provider.log(
						`Error migrating file changes: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}
	}
}

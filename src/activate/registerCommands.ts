import * as vscode from "vscode"
import delay from "delay"

import type { CommandId } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Package } from "../shared/package"
import { getCommand } from "../utils/commands"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { focusPanel } from "../utils/focusPanel"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"
import { CodeIndexManager } from "../services/code-index/manager"
import { importSettingsWithFeedback } from "../core/config/importExport"
import { MdmService } from "../services/mdm/MdmService"
import { t } from "../i18n"
import { EditorContext, EditorUtils } from "../integrations/editor/EditorUtils"
import * as path from "path"
import { handleGenerateCommitMessage } from "../core/costrict/commit"
import { isJetbrainsPlatform } from "../utils/platform"

interface UriSource {
	path: string
	external: string
	fsPath: string
}

interface ProcessedResource {
	type: "path" | "image"
	content: string
}

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible CoStrict instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel or WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
	taskId?: string
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		if (id === "generateCommitMessage" && isJetbrainsPlatform()) {
			console.log("Running on JetBrains platform, Git extension dependency not required")
			continue
		}
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions): Record<CommandId, any> => ({
	activationCompleted: () => {},
	cloudButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("cloud")

		visibleProvider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	},
	plusButtonClicked: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("plus")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.refreshWorkspace()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		// Send focusInput action immediately after chatButtonClicked
		// This ensures the focus happens after the view has switched
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	mcpButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("mcp")

		visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
	},
	promptsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("prompts")

		visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
	},
	popoutButtonClicked: (taskId?: string) => {
		TelemetryService.instance.captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel, taskId })
	},
	openInNewTab: (taskId?: string) => openClineInNewTab({ context, outputChannel, taskId }),
	settingsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		// Also explicitly post the visibility message to trigger scroll reliably
		visibleProvider.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
	},
	historyButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	marketplaceButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) return
		visibleProvider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
	showHumanRelayDialog: (params: { requestId: string; promptText: string }) => {
		const panel = getPanel()

		if (panel) {
			panel?.webview.postMessage({
				type: "showHumanRelayDialog",
				requestId: params.requestId,
				promptText: params.promptText,
			})
		}
	},
	registerHumanRelayCallback: registerHumanRelayCallback,
	unregisterHumanRelayCallback: unregisterHumanRelayCallback,
	handleHumanRelayResponse: handleHumanRelayResponse,
	newTask: handleNewTask,
	setCustomStoragePath: async () => {
		const { promptForCustomStoragePath } = await import("../utils/storage")
		await promptForCustomStoragePath()
	},
	importSettings: async (filePath?: string) => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: visibleProvider.providerSettingsManager,
				contextProxy: visibleProvider.contextProxy,
				customModesManager: visibleProvider.customModesManager,
				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			// Send focus input message only for sidebar panels
			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	addFileToContext: async (...args: [UriSource] | [unknown, UriSource[]]) => {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		let sources: (UriSource | EditorContext)[] = []
		if (args.length > 1 && Array.isArray(args[1]) && args[1].length > 0) {
			sources = args[1]
		} else {
			let singleSource: UriSource | EditorContext | undefined | null
			if (args.length > 0) {
				;[singleSource] = args as [UriSource]
			} else {
				singleSource = EditorUtils.getEditorContext()
			}
			if (singleSource) {
				sources = [singleSource]
			}
		}

		if (sources.length === 0) {
			return
		}

		const processedResourcePromises = sources.map(async (source): Promise<ProcessedResource | null> => {
			if (!(source as UriSource).path && !(source as EditorContext).filePath) {
				return null
			}
			const resourceUri = vscode.Uri.parse(
				(source as UriSource).path || path.join(visibleProvider.cwd, (source as EditorContext).filePath),
			)
			return createAliasedPath(resourceUri)
		})

		const processedResources = (await Promise.all(processedResourcePromises)).filter(
			(p): p is ProcessedResource => !!p,
		)

		if (processedResources.length === 0) {
			return
		}

		const textPaths: string[] = []
		const imageSources: string[] = []

		for (const resource of processedResources) {
			if (resource.type === "path") {
				textPaths.push(resource.content)
			} else if (resource.type === "image") {
				imageSources.push(resource.content)
			}
		}

		const chatMessage = textPaths.length > 0 ? textPaths.join(" ") + " " : ""

		const payload: { text: string; images?: string[] } = {
			text: chatMessage,
		}
		if (imageSources.length > 0) {
			payload.images = imageSources
		}

		await Promise.all([
			visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" }),
			visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessageByContext",
				...payload,
			}),
		])
	},
	toggleAutoApprove: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({
			type: "action",
			action: "toggleAutoApprove",
		})
	},
	generateCommitMessage: async (e: any) => {
		try {
			await handleGenerateCommitMessage(provider, (mssage: string) => {
				e.inputBox.value = mssage
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMessage}`)
		}
	},
})

async function createAliasedPath(resourceUri: vscode.Uri): Promise<ProcessedResource | null> {
	const imageExtensions = new Set([".png", ".jpeg", ".webp"])
	const fileExtension = path.extname(resourceUri.fsPath).toLowerCase()
	if (imageExtensions.has(fileExtension)) {
		try {
			const fileData = await vscode.workspace.fs.readFile(resourceUri)
			const base64Data = Buffer.from(fileData).toString("base64")
			const mimeType = `image/${fileExtension.slice(1)}`
			const dataUrl = `data:${mimeType};base64,${base64Data}`

			return { type: "image", content: dataUrl }
		} catch (error) {
			console.error(`Error reading or converting image file ${resourceUri.fsPath}:`, error)
			return null
		}
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(resourceUri)
	if (!workspaceFolder) {
		console.warn(`Resource ${resourceUri.fsPath} is not in an open workspace folder.`)
		return null
	}

	let stat: vscode.FileStat
	try {
		stat = await vscode.workspace.fs.stat(resourceUri)
	} catch (error) {
		return null
	}

	const rootPath = workspaceFolder.uri.path
	const fullPath = resourceUri.path

	let relativePath = fullPath.startsWith(rootPath) ? fullPath.substring(rootPath.length) : fullPath

	if (stat.type === vscode.FileType.Directory && !relativePath.endsWith("/")) {
		relativePath += "/"
	}

	return { type: "path", content: `@${relativePath}` }
}

export const openClineInNewTab = async ({
	context,
	outputChannel,
	taskId,
}: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const contextProxy = await ContextProxy.getInstance(context)
	// const codeIndexManager = CodeIndexManager.getInstance(context)

	// Get the existing MDM service instance to ensure consistent policy enforcement
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch (error) {
		// MDM service not initialized, which is fine - extension can work without it
		mdmService = undefined
	}

	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy, mdmService)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(
		taskId ? `zgsm.task-${taskId}` : ClineProvider.tabPanelId,
		taskId ? `Task-${taskId}` : "CoStrict",
		targetCol,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		},
	)

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "costrict", "logo.svg"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "costrict", "logo.svg"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	// Add listener for visibility changes to notify webview
	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" }) // Use the same message type as in SettingsView.tsx
			}
		},
		null, // First null is for `thisArgs`
		context.subscriptions, // Register listener for disposal
	)

	// Handle panel closing events.
	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions, // Also register dispose listener
	)

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	if (taskId) {
		setTimeout(() => {
			tabProvider.showTaskWithId(taskId)
		}, 300)
	}

	return tabProvider
}

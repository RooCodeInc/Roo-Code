// src/core/multi-orchestrator/panel-spawner.ts
import * as vscode from "vscode"
import { ClineProvider } from "../webview/ClineProvider"
import { ContextProxy } from "../config/ContextProxy"

export interface SpawnedPanel {
	id: string
	provider: ClineProvider
	panel: vscode.WebviewPanel
}

export class PanelSpawner {
	private panels: Map<string, SpawnedPanel> = new Map()
	private savedLayout: unknown = null

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
	) {}

	/**
	 * Spawn N editor tab panels in equal-width columns.
	 *
	 * Uses `vscode.setEditorLayout` to create an N-column layout FIRST,
	 * then places each panel into its assigned ViewColumn. This ensures
	 * all panels appear side-by-side in equal proportions without
	 * overlapping existing editors.
	 */
	async spawnPanels(count: number, titles: string[]): Promise<Map<string, SpawnedPanel>> {
		const contextProxy = await ContextProxy.getInstance(this.context)
		const errors: Array<{ index: number; title: string; error: Error }> = []

		// Save the current layout so we can restore it after orchestration
		try {
			this.savedLayout = await vscode.commands.executeCommand("vscode.getEditorLayout")
			console.log("[PanelSpawner] Saved current editor layout")
		} catch {
			console.warn("[PanelSpawner] Could not save current editor layout")
		}

		// Set up an N-column layout with equal widths.
		// orientation: 0 = horizontal (columns side by side)
		const equalSize = 1 / count
		const groups = Array.from({ length: count }, () => ({ size: equalSize }))

		try {
			await vscode.commands.executeCommand("vscode.setEditorLayout", {
				orientation: 0,
				groups,
			})
			console.log(`[PanelSpawner] Set editor layout to ${count} equal columns`)
			// Brief delay for VS Code to apply the layout
			await new Promise((resolve) => setTimeout(resolve, 300))
		} catch (err) {
			console.warn("[PanelSpawner] Failed to set editor layout:", err)
		}

		// Create each panel in its designated ViewColumn (1-based).
		// Sequential creation avoids race conditions in VS Code's panel placement.
		for (let i = 0; i < count; i++) {
			const id = `agent-${i}`
			const title = titles[i] || `Agent ${i + 1}`
			// ViewColumn is 1-indexed: column 1, 2, 3, ...
			const viewColumn = (i + 1) as vscode.ViewColumn

			const result = await this.spawnSinglePanel(id, title, viewColumn, contextProxy)
			if (result.error) {
				errors.push({ index: i, title, error: result.error })
			}

			// Minimal delay between panels for layout stability
			if (i < count - 1) {
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
		}

		if (errors.length > 0 && this.panels.size === 0) {
			throw new Error(
				`[PanelSpawner] Failed to spawn any panels (${errors.length}/${count} failed). ` +
					`First error: ${errors[0].error.message}`,
			)
		}

		if (errors.length > 0) {
			console.warn(
				`[PanelSpawner] ${errors.length}/${count} panel(s) failed to spawn: ` +
					errors.map((e) => `"${e.title}"`).join(", "),
			)
		}

		return new Map(this.panels)
	}

	/**
	 * Spawn a single editor panel with its own ClineProvider.
	 */
	private async spawnSinglePanel(
		id: string,
		title: string,
		viewColumn: vscode.ViewColumn,
		contextProxy: ContextProxy,
	): Promise<{ error: Error | undefined }> {
		try {
			const provider = new ClineProvider(this.context, this.outputChannel, "editor", contextProxy)

			const panel = vscode.window.createWebviewPanel(
				ClineProvider.tabPanelId,
				`⚡ ${title}`,
				{ viewColumn, preserveFocus: true },
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [this.context.extensionUri],
				},
			)

			await provider.resolveWebviewView(panel)

			panel.onDidDispose(() => {
				this.panels.delete(id)
			})

			this.panels.set(id, { id, provider, panel })
			return { error: undefined }
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error))
			console.error(`[PanelSpawner] Failed to spawn panel ${id} ("${title}"): ${err.message}`)
			return { error: err }
		}
	}

	/**
	 * Close a specific panel and dispose its provider.
	 */
	async closePanel(id: string): Promise<void> {
		const spawned = this.panels.get(id)
		if (!spawned) return

		this.panels.delete(id)

		try {
			await spawned.provider.dispose()
		} catch (error) {
			console.error(`[PanelSpawner] Error disposing provider for ${id}:`, error)
		}

		try {
			spawned.panel.dispose()
		} catch (error) {
			console.error(`[PanelSpawner] Error disposing panel for ${id}:`, error)
		}
	}

	/**
	 * Close all panels and restore the original editor layout.
	 */
	async closeAllPanels(): Promise<void> {
		const ids = [...this.panels.keys()]
		for (const id of ids) {
			await this.closePanel(id)
		}

		// Restore the editor layout that was active before orchestration
		if (this.savedLayout) {
			try {
				await vscode.commands.executeCommand("vscode.setEditorLayout", this.savedLayout)
				console.log("[PanelSpawner] Restored original editor layout")
			} catch {
				console.warn("[PanelSpawner] Could not restore original editor layout")
			}
			this.savedLayout = null
		}
	}

	/** Get all active spawned panels */
	getPanels(): Map<string, SpawnedPanel> {
		return new Map(this.panels)
	}

	/** Get a specific provider by ID */
	getProvider(id: string): ClineProvider | undefined {
		return this.panels.get(id)?.provider
	}
}

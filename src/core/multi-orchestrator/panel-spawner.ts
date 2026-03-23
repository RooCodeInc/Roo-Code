// src/core/multi-orchestrator/panel-spawner.ts
import * as vscode from "vscode"
import { ClineProvider } from "../webview/ClineProvider"
import { ContextProxy } from "../config/ContextProxy"

export interface SpawnedPanel {
	id: string
	provider: ClineProvider
	panel: vscode.WebviewPanel
	/** The ViewColumn this panel was placed in (1-indexed) */
	viewColumn: vscode.ViewColumn
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
	 * then walks focus across editor groups using `focusNextGroup`,
	 * placing each panel at `ViewColumn.Active`. This avoids relying on
	 * explicit ViewColumn numbers whose group-index mapping is unreliable
	 * in VS Code after a programmatic layout change (BUG-003).
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
			// Wait for VS Code to fully apply the layout before placing panels
			await new Promise((resolve) => setTimeout(resolve, 500))
		} catch (err) {
			console.warn("[PanelSpawner] Failed to set editor layout:", err)
		}

		// Focus the first editor group so panel placement starts at the leftmost column
		try {
			await vscode.commands.executeCommand("workbench.action.focusFirstEditorGroup")
			await new Promise((resolve) => setTimeout(resolve, 100))
		} catch {
			console.warn("[PanelSpawner] Could not focus first editor group")
		}

		// Walk focus across groups, creating each panel at ViewColumn.Active.
		// This guarantees each panel lands in the correct column regardless of
		// how VS Code internally indexes its editor groups after setEditorLayout.
		for (let i = 0; i < count; i++) {
			const id = `agent-${i}`
			const title = titles[i] || `Agent ${i + 1}`

			if (i > 0) {
				// Move focus to the next editor group (next column)
				await vscode.commands.executeCommand("workbench.action.focusNextGroup")
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			const result = await this.spawnSinglePanel(id, title, vscode.ViewColumn.Active, contextProxy)
			if (result.error) {
				errors.push({ index: i, title, error: result.error })
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

			// Thread the ViewColumn to the provider so that file operations
			// (diffs, showTextDocument) target this specific editor column
			// instead of the globally active editor group. (BUG-001 fix)
			provider.viewColumn = viewColumn

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

			this.panels.set(id, { id, provider, panel, viewColumn })
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

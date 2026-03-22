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

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
	) {}

	/**
	 * Spawn N editor tab panels, each with an independent ClineProvider.
	 *
	 * Panels are distributed across VS Code ViewColumns 1–9. If `count`
	 * exceeds 9, columns are reused (panels stack in the same column group —
	 * standard VS Code behaviour, no existing panels are overwritten).
	 *
	 * All panels are created in parallel via `Promise.all` — each panel uses
	 * a different ViewColumn so there are no serialisation constraints.
	 *
	 * Individual panel failures are logged and skipped so that a single
	 * failure does not orphan the entire batch. If *all* panels fail, the
	 * method throws with the first error encountered.
	 */
	async spawnPanels(count: number, titles: string[]): Promise<Map<string, SpawnedPanel>> {
		const contextProxy = await ContextProxy.getInstance(this.context)

		// Spawn panels SEQUENTIALLY to avoid VS Code ViewColumn race conditions.
		// Each panel uses ViewColumn.Beside to create a new split to the RIGHT
		// of whatever is currently focused, avoiding overlap with existing editors.
		const errors: Array<{ index: number; title: string; error: Error }> = []

		for (let i = 0; i < count; i++) {
			const id = `agent-${i}`
			const title = titles[i] || `Agent ${i + 1}`
			// Use ViewColumn.Beside for all panels — each one splits beside the previous
			const result = await this.spawnSinglePanel(id, title, vscode.ViewColumn.Beside, contextProxy)
			if (result.error) {
				errors.push({ index: i, title, error: result.error })
			}
			// Small delay between panels to let VS Code settle its layout
			if (i < count - 1) {
				await new Promise((resolve) => setTimeout(resolve, 200))
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
	 *
	 * Returns `{ error: undefined }` on success or `{ error: Error }` on
	 * failure. Never throws — callers aggregate errors from the batch.
	 */
	private async spawnSinglePanel(
		id: string,
		title: string,
		viewColumn: vscode.ViewColumn,
		contextProxy: ContextProxy,
	): Promise<{ error: Error | undefined }> {
		try {
			// Create independent ClineProvider
			const provider = new ClineProvider(this.context, this.outputChannel, "editor", contextProxy)

			// Create WebviewPanel — can throw if no editor area is visible
			const panel = vscode.window.createWebviewPanel(
				ClineProvider.tabPanelId,
				`⚡ ${title}`,
				viewColumn,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [this.context.extensionUri],
				},
			)

			// Wire provider to panel — must complete before panel is usable
			await provider.resolveWebviewView(panel)

			// Track for cleanup (onDidDispose also registered inside
			// resolveWebviewView, which handles provider disposal in tab mode)
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
	 * Close a specific panel and explicitly dispose its provider.
	 *
	 * Order: remove from map → dispose provider → dispose panel.
	 * Provider.dispose() is idempotent (_disposed guard), so the secondary
	 * disposal triggered by the panel's onDidDispose handler is harmless.
	 */
	async closePanel(id: string): Promise<void> {
		const spawned = this.panels.get(id)
		if (!spawned) {
			return
		}

		// Remove from map first to prevent the onDidDispose callback from
		// racing with a concurrent closePanel / closeAllPanels call.
		this.panels.delete(id)

		// Explicitly dispose provider to ensure task cleanup even if
		// resolveWebviewView's onDidDispose handler was never registered.
		try {
			await spawned.provider.dispose()
		} catch (error) {
			console.error(`[PanelSpawner] Error disposing provider for ${id}:`, error)
		}

		// Dispose the panel (no-op if provider.dispose() already disposed it).
		try {
			spawned.panel.dispose()
		} catch (error) {
			console.error(`[PanelSpawner] Error disposing panel for ${id}:`, error)
		}
	}

	/** Close all panels. Snapshots keys to avoid mutation during iteration. */
	async closeAllPanels(): Promise<void> {
		const ids = [...this.panels.keys()]
		for (const id of ids) {
			await this.closePanel(id)
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

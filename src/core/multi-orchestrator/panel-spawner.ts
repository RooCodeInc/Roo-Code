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
	 * Panels are placed across ViewColumns 1-6.
	 */
	async spawnPanels(count: number, titles: string[]): Promise<Map<string, SpawnedPanel>> {
		const contextProxy = await ContextProxy.getInstance(this.context)

		for (let i = 0; i < count; i++) {
			const id = `agent-${i}`
			const title = titles[i] || `Agent ${i + 1}`
			const viewColumn = (i + 1) as vscode.ViewColumn // ViewColumn.One through Six

			// Create independent ClineProvider
			const provider = new ClineProvider(this.context, this.outputChannel, "editor", contextProxy)

			// Create WebviewPanel
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

			// Wire provider to panel
			await provider.resolveWebviewView(panel)

			// Track for cleanup
			panel.onDidDispose(() => {
				this.panels.delete(id)
			})

			this.panels.set(id, { id, provider, panel })
		}

		return new Map(this.panels)
	}

	/** Close a specific panel and dispose its provider */
	async closePanel(id: string): Promise<void> {
		const spawned = this.panels.get(id)
		if (spawned) {
			spawned.panel.dispose()
			this.panels.delete(id)
		}
	}

	/** Close all panels */
	async closeAllPanels(): Promise<void> {
		for (const [id] of this.panels) {
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

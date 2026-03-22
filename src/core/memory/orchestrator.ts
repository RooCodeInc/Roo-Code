import * as crypto from "crypto"
import * as path from "path"
import { execSync } from "child_process"
import type { ProviderSettings } from "@roo-code/types"
import { MemoryStore } from "./memory-store"
import { preprocessMessages, type MessageLike } from "./preprocessor"
import { runAnalysis } from "./analysis-agent"
import { processObservations } from "./memory-writer"
import { compileMemoryPrompt, compileMemoryForAgent } from "./prompt-compiler"
import { MEMORY_CONSTANTS } from "./types"
import { readApiMessages } from "../task-persistence/apiMessages"

function getWorkspaceId(workspacePath: string): string {
	const folderName = path.basename(workspacePath)
	let gitRemote: string | null = null
	try {
		gitRemote = execSync("git remote get-url origin", {
			cwd: workspacePath,
			encoding: "utf-8",
			timeout: 3000,
		}).trim()
	} catch {
		// Not a git repo or no remote
	}
	const raw = gitRemote ? `${gitRemote}::${folderName}` : folderName
	return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)
}

/** Top-level coordinator that drives the memory analysis pipeline. */
export class MemoryOrchestrator {
	private store: MemoryStore
	private messageCounter = 0
	private watermark = 0
	private analysisInFlight = false
	private analysisQueued = false
	private enabled = false
	private workspaceId: string | null = null
	private analysisFrequency: number

	constructor(
		private storagePath: string,
		private workspacePath: string | null,
		analysisFrequency?: number,
	) {
		this.store = new MemoryStore(storagePath)
		this.analysisFrequency = analysisFrequency || MEMORY_CONSTANTS.DEFAULT_ANALYSIS_FREQUENCY
		if (workspacePath) {
			this.workspaceId = getWorkspaceId(workspacePath)
		}
	}

	async init(): Promise<void> {
		await this.store.init()
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled
		if (!enabled) {
			this.messageCounter = 0
		}
	}

	isEnabled(): boolean {
		return this.enabled
	}

	/**
	 * Call this on each user message during an active chat session.
	 * Returns true if an analysis cycle was triggered.
	 */
	onUserMessage(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): boolean {
		if (!this.enabled || !providerSettings) return false

		this.messageCounter++

		if (this.messageCounter >= this.analysisFrequency) {
			this.triggerAnalysis(messages, taskId, providerSettings)
			this.messageCounter = 0
			return true
		}

		return false
	}

	/**
	 * Call on session end to catch remaining unanalyzed messages.
	 */
	onSessionEnd(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings | null,
	): void {
		if (!this.enabled || !providerSettings) return
		if (this.watermark < messages.length) {
			this.triggerAnalysis(messages, taskId, providerSettings)
		}
	}

	private async triggerAnalysis(
		messages: unknown[],
		taskId: string | null,
		providerSettings: ProviderSettings,
	): Promise<void> {
		if (this.analysisInFlight) {
			this.analysisQueued = true
			return
		}

		this.analysisInFlight = true

		try {
			// Grab messages since last watermark
			const batch = messages.slice(this.watermark)
			this.watermark = messages.length

			if (batch.length === 0) return

			// Preprocess
			const preprocessed = preprocessMessages(batch as MessageLike[])
			if (preprocessed.cleaned.trim().length === 0) return

			// Get existing memory for context
			const scoredEntries = this.store.getScoredEntries(this.workspaceId)
			const existingReport = compileMemoryForAgent(scoredEntries)

			// Run analysis
			const result = await runAnalysis(providerSettings, preprocessed.cleaned, existingReport)

			if (result && result.observations.length > 0) {
				const writeResult = processObservations(
					this.store,
					result.observations,
					this.workspaceId,
					taskId,
				)

				// Log the analysis
				this.store.logAnalysis({
					id: crypto.randomUUID(),
					timestamp: Math.floor(Date.now() / 1000),
					taskId,
					messagesAnalyzed: batch.length,
					tokensUsed: preprocessed.cleanedTokenEstimate * 2, // rough: input + output
					entriesCreated: writeResult.entriesCreated,
					entriesReinforced: writeResult.entriesReinforced,
				})

				// Run garbage collection
				this.store.garbageCollect()
			}
		} catch (error) {
			console.error("[MemoryOrchestrator] Analysis pipeline error:", error)
		} finally {
			this.analysisInFlight = false

			if (this.analysisQueued) {
				this.analysisQueued = false
				// Re-trigger with current state
				this.triggerAnalysis(messages, taskId, providerSettings)
			}
		}
	}

	/**
	 * Analyze a batch of prior chat histories to bootstrap the memory database.
	 * Processes each task sequentially to avoid API rate limits.
	 */
	async batchAnalyzeHistory(
		taskIds: string[],
		globalStoragePath: string,
		providerSettings: ProviderSettings,
		onProgress: (completed: number, total: number) => void,
	): Promise<{ totalAnalyzed: number; entriesCreated: number; entriesReinforced: number }> {
		let totalAnalyzed = 0
		let entriesCreated = 0
		let entriesReinforced = 0

		for (let i = 0; i < taskIds.length; i++) {
			const taskId = taskIds[i]

			try {
				// Read conversation history for this task
				const messages = await readApiMessages({ taskId, globalStoragePath })

				if (!messages || messages.length === 0) {
					onProgress(i + 1, taskIds.length)
					continue
				}

				// Preprocess
				const preprocessed = preprocessMessages(messages as MessageLike[])
				if (preprocessed.cleaned.trim().length === 0) {
					onProgress(i + 1, taskIds.length)
					continue
				}

				// Get existing memory for context
				const scoredEntries = this.store.getScoredEntries(this.workspaceId)
				const existingReport = compileMemoryForAgent(scoredEntries)

				// Run analysis
				const result = await runAnalysis(providerSettings, preprocessed.cleaned, existingReport)

				if (result && result.observations.length > 0) {
					const writeResult = processObservations(
						this.store,
						result.observations,
						this.workspaceId,
						taskId,
					)

					entriesCreated += writeResult.entriesCreated
					entriesReinforced += writeResult.entriesReinforced

					// Log the analysis
					this.store.logAnalysis({
						id: crypto.randomUUID(),
						timestamp: Math.floor(Date.now() / 1000),
						taskId,
						messagesAnalyzed: messages.length,
						tokensUsed: preprocessed.cleanedTokenEstimate * 2,
						entriesCreated: writeResult.entriesCreated,
						entriesReinforced: writeResult.entriesReinforced,
					})
				}

				totalAnalyzed++
			} catch (error) {
				console.error(`[MemoryOrchestrator] Batch analysis error for task ${taskId}:`, error)
			}

			onProgress(i + 1, taskIds.length)
		}

		// Run garbage collection after all tasks
		this.store.garbageCollect()

		return { totalAnalyzed, entriesCreated, entriesReinforced }
	}

	/**
	 * Clear all memory entries and analysis logs.
	 */
	clearAllMemory(): void {
		this.store.deleteAllEntries()
	}

	/**
	 * Get the compiled user profile section for the system prompt.
	 */
	getUserProfileSection(): string {
		if (!this.store) return ""
		const entries = this.store.getScoredEntries(this.workspaceId)
		return compileMemoryPrompt(entries)
	}

	getStore(): MemoryStore {
		return this.store
	}

	close(): void {
		this.store.close()
	}
}

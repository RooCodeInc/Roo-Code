import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { TelemetryService } from "@roo-code/telemetry"
import { FileChangeType } from "@roo-code/types"

import { Task } from "../task/Task"

import { getWorkspacePath } from "../../utils/path"
import { checkGitInstalled } from "../../utils/git"
import { t } from "../../i18n"

import { ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics } from "../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../services/checkpoints"
import { FileChangeManager } from "../../services/file-changes/FileChangeManager"
import { CheckpointResult } from "../../services/checkpoints/types"

export async function getCheckpointService(
	task: Task,
	{ interval = 250, timeout = 15_000 }: { interval?: number; timeout?: number } = {},
) {
	if (!task.enableCheckpoints) {
		return undefined
	}
	if (task.checkpointService) {
		return task.checkpointService
	}

	const provider = task.providerRef.deref()

	const log = (message: string) => {
		console.log(message)

		try {
			provider?.log(message)
		} catch (err) {
			// NO-OP
		}
	}

	try {
		const workspaceDir = task.cwd || getWorkspacePath()

		if (!workspaceDir) {
			log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
			task.enableCheckpoints = false
			return undefined
		}

		const globalStorageDir = provider?.context.globalStorageUri.fsPath

		if (!globalStorageDir) {
			log("[Task#getCheckpointService] globalStorageDir not found, disabling checkpoints")
			task.enableCheckpoints = false
			return undefined
		}

		const options: CheckpointServiceOptions = {
			taskId: task.taskId,
			workspaceDir,
			shadowDir: globalStorageDir,
			log,
		}
		if (task.checkpointServiceInitializing) {
			await pWaitFor(
				() => {
					return !!task.checkpointService && !!task?.checkpointService?.isInitialized
				},
				{ interval, timeout },
			)
			if (!task?.checkpointService) {
				task.enableCheckpoints = false
				return undefined
			}
			return task.checkpointService
		}
		if (!task.enableCheckpoints) {
			return undefined
		}
		const service = RepoPerTaskCheckpointService.create(options)
		task.checkpointServiceInitializing = true
		await checkGitInstallation(task, service, log, provider)
		task.checkpointService = service
		return service
	} catch (err) {
		log(`[Task#getCheckpointService] ${err.message}`)
		task.enableCheckpoints = false
		task.checkpointServiceInitializing = false
		return undefined
	}
}

async function checkGitInstallation(
	task: Task,
	service: RepoPerTaskCheckpointService,
	log: (message: string) => void,
	provider: any,
) {
	try {
		const gitInstalled = await checkGitInstalled()

		if (!gitInstalled) {
			log("[Task#getCheckpointService] Git is not installed, disabling checkpoints")
			task.enableCheckpoints = false
			task.checkpointServiceInitializing = false

			// Show user-friendly notification
			const selection = await vscode.window.showWarningMessage(
				t("common:errors.git_not_installed"),
				t("common:buttons.learn_more"),
			)

			if (selection === t("common:buttons.learn_more")) {
				await vscode.env.openExternal(vscode.Uri.parse("https://git-scm.com/downloads"))
			}

			return
		}

		// Git is installed, proceed with initialization
		service.on("initialize", async () => {
			log("[Task#getCheckpointService] service initialized")

			try {
				// Debug logging to understand checkpoint detection

				const checkpointMessages = task.clineMessages.filter(({ say }) => say === "checkpoint_saved")

				const isCheckpointNeeded = checkpointMessages.length === 0

				task.checkpointService = service
				task.checkpointServiceInitializing = false

				// Update FileChangeManager baseline to match checkpoint service
				try {
					const fileChangeManager = provider?.getFileChangeManager() ?? provider?.ensureFileChangeManager()
					if (fileChangeManager) {
						const currentBaseline = fileChangeManager.getChanges().baseCheckpoint
						if (currentBaseline === "HEAD") {
							if (isCheckpointNeeded) {
								// New task: set baseline to initial checkpoint
								if (service.baseHash && service.baseHash !== "HEAD") {
									await fileChangeManager.updateBaseline(service.baseHash)
									log(
										`[Task#getCheckpointService] New task: Updated FileChangeManager baseline from HEAD to ${service.baseHash}`,
									)
								}
							} else {
								// Existing task: do not set baseline yet; establish on first new checkpoint
								log(
									"[Task#getCheckpointService] Existing task: Will set baseline to first new checkpoint to show only fresh changes",
								)
							}
						}
					}
				} catch (error) {
					log(`[Task#getCheckpointService] Failed to update FileChangeManager baseline: ${error}`)
					// Don't throw - allow checkpoint service to continue initializing
				}

				// Note: No initialization checkpoint needed - first checkpoint before file edit serves as baseline
				if (isCheckpointNeeded) {
					log(
						"[Task#getCheckpointService] no checkpoints found, will create baseline checkpoint before first file edit",
					)
				} else {
					log("[Task#getCheckpointService] existing checkpoints found, using existing checkpoint as baseline")
				}
			} catch (err) {
				log("[Task#getCheckpointService] caught error in on('initialize'), disabling checkpoints")
				task.enableCheckpoints = false
			}
		})

	service.on("checkpoint", async ({ fromHash, toHash }) => {
		try {
			// Record the last checkpoint for delta-based FCO updates
			try {
				provider?.setLastCheckpointForTask?.(task.taskId, toHash)
			} catch {}
			provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: toHash })

			await task.say(
				"checkpoint_saved",
				toHash,
				undefined,
				undefined,
				{ from: fromHash, to: toHash },
				undefined,
				{ isNonInteractive: true },
			)

			// Calculate changes using checkpoint service directly
			try {
				const checkpointFileChangeManager =
					provider?.getFileChangeManager() ?? provider?.ensureFileChangeManager()
				if (checkpointFileChangeManager) {
					// Get the current baseline for cumulative tracking
					let currentBaseline = checkpointFileChangeManager.getChanges().baseCheckpoint

					// If session baseline is still HEAD (existing task), set to fromHash now
					if (currentBaseline === "HEAD") {
						await checkpointFileChangeManager.updateBaseline(fromHash)
						log(
							`[Task#checkpointCreated] Existing task with HEAD baseline - setting baseline to fromHash ${fromHash} for fresh tracking`,
						)
						currentBaseline = fromHash
					} else {
						// Validate existing baseline; if invalid, use fromHash
						try {
							await service.getDiff({ from: currentBaseline, to: currentBaseline })
							log(
								`[Task#checkpointCreated] Using existing baseline ${currentBaseline} for cumulative tracking`,
							)
						} catch (baselineValidationError) {
							log(
								`[Task#checkpointCreated] Baseline validation failed for ${currentBaseline}: ${baselineValidationError instanceof Error ? baselineValidationError.message : String(baselineValidationError)}`,
							)
							log(`[Task#checkpointCreated] Updating baseline to fromHash: ${fromHash}`)
							currentBaseline = fromHash
							try {
								await checkpointFileChangeManager.updateBaseline(currentBaseline)
								log(`[Task#checkpointCreated] Successfully updated baseline to ${currentBaseline}`)
							} catch (updateError) {
								log(
									`[Task#checkpointCreated] Failed to update baseline: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
								)
								throw updateError
							}
						}
					}

					log(
						`[Task#checkpointCreated] Calculating cumulative changes from baseline ${currentBaseline} to ${toHash}`,
					)

					// Calculate cumulative diff from baseline to new checkpoint using checkpoint service
					const changes = await service.getDiff({ from: currentBaseline, to: toHash })

					if (changes && changes.length > 0) {
						// Convert to FileChange format with correct checkpoint references
						const fileChanges = changes.map((change: any) => {
							// Prefer service-provided type when available for consistency with FCO update
							const type = (change.type ||
								(change.paths.newFile
									? "create"
									: change.paths.deletedFile
										? "delete"
										: "edit")) as FileChangeType

							// Calculate actual line differences for the change
							let linesAdded = 0
							let linesRemoved = 0

							if (type === "create") {
								// New file: all lines are added
								linesAdded = change.content.after ? change.content.after.split("\n").length : 0
								linesRemoved = 0
							} else if (type === "delete") {
								// Deleted file: all lines are removed
								linesAdded = 0
								linesRemoved = change.content.before ? change.content.before.split("\n").length : 0
							} else {
								// Modified file: use FileChangeManager's improved calculation method
								const lineDifferences = FileChangeManager.calculateLineDifferences(
									change.content.before || "",
									change.content.after || "",
								)
								linesAdded = lineDifferences.linesAdded
								linesRemoved = lineDifferences.linesRemoved
							}

							return {
								uri: change.paths.relative,
								type,
								fromCheckpoint: currentBaseline, // Reference current baseline for cumulative view
								toCheckpoint: toHash, // Current checkpoint for comparison
								linesAdded,
								linesRemoved,
							}
						})

						log(`[Task#checkpointCreated] Found ${fileChanges.length} cumulative file changes`)

						// Apply per-file baselines to show only incremental changes for accepted files
						const updatedChanges = await checkpointFileChangeManager.applyPerFileBaselines(
							fileChanges,
							service,
							toHash,
						)

						log(
							`[Task#checkpointCreated] Applied per-file baselines, ${updatedChanges.length} changes after filtering`,
						)

						// Update FileChangeManager with the per-file baseline changes
						checkpointFileChangeManager.setFiles(updatedChanges)

						// DON'T clear accepted/rejected state here - preserve user's accept/reject decisions
						// The state should only be cleared on baseline changes (checkpoint restore) or task restart

						// Get changeset that excludes already accepted/rejected files and only shows LLM-modified files
						const filteredChangeset = await checkpointFileChangeManager.getLLMOnlyChanges(
							task.taskId,
							task.fileContextTracker,
						)

						// Create changeset and send to webview (unaccepted files)
						const serializableChangeset = {
							baseCheckpoint: filteredChangeset.baseCheckpoint,
							files: filteredChangeset.files,
						}

						log(
							`[Task#checkpointCreated] Sending ${filteredChangeset.files.length} LLM-only file changes to webview`,
						)

						provider?.postMessageToWebview({
							type: "filesChanged",
							filesChanged: serializableChangeset,
						})
					} else {
						log(`[Task#checkpointCreated] No changes found between ${currentBaseline} and ${toHash}`)
						// Clear Files Changed Overview when no changes remain
						provider?.postMessageToWebview({
							type: "filesChanged",
							filesChanged: undefined,
						})
					}

					// DON'T update the baseline - keep it at current baseline for cumulative tracking
					// The baseline should only change when explicitly requested (e.g., checkpoint restore)
					log(
						`[Task#checkpointCreated] Keeping FileChangeManager baseline at ${currentBaseline} for cumulative tracking`,
					)
				}
			} catch (error) {
				log(`[Task#checkpointCreated] Error calculating/sending file changes: ${error}`)
			}
			} catch (err) {
				log(
					"[Task#getCheckpointService] caught unexpected error in on('checkpointCreated'), disabling checkpoints",
				)
				console.error(err)
				task.enableCheckpoints = false
			}
		})

		log("[Task#getCheckpointService] initializing shadow git")
		try {
			await service.initShadowGit()
		} catch (err) {
			log(`[Task#getCheckpointService] initShadowGit -> ${err.message}`)
			task.enableCheckpoints = false
		}
	} catch (err) {
		log(`[Task#getCheckpointService] Unexpected error during Git check: ${err.message}`)
		console.error("Git check error:", err)
		task.enableCheckpoints = false
		task.checkpointServiceInitializing = false
	}
}

export async function getInitializedCheckpointService(
	task: Task,
	{ interval = 250, timeout = 15_000 }: { interval?: number; timeout?: number } = {},
) {
	const service = await getCheckpointService(task)

	if (!service || service.isInitialized) {
		return service
	}

	try {
		await pWaitFor(
			() => {
				return service.isInitialized
			},
			{ interval, timeout },
		)

		return service
	} catch (err) {
		return undefined
	}
}

export async function checkpointSave(task: Task, force = false, files?: vscode.Uri[]) {
	// Create a unique key for this checkpoint save operation (task-scoped, no need for taskId in key)
	const filesKey = files
		? files
				.map((f) => f.fsPath)
				.sort()
				.join("|")
		: "all"
	const saveKey = `${force}-${filesKey}`

	// If there's already an ongoing checkpoint save for this exact operation, return the existing promise
	if (task.ongoingCheckpointSaves && task.ongoingCheckpointSaves.has(saveKey)) {
		const provider = task.providerRef.deref()
		provider?.log(`[checkpointSave] duplicate checkpoint save detected for ${saveKey}, using existing operation`)
		// Since ongoingCheckpointSaves is a Map, we can get the promise
		return (task.ongoingCheckpointSaves as any).get(saveKey)
	}
	const service = await getInitializedCheckpointService(task)

	if (!service) {
		return
	}

	TelemetryService.instance.captureCheckpointCreated(task.taskId)

	// Get provider for messaging
	const provider = task.providerRef.deref()

	// Capture the previous checkpoint BEFORE saving the new one
	const previousCheckpoint = service.getCurrentCheckpoint()

	// Start the checkpoint process in the background and track it
	const savePromise = service
		.saveCheckpoint(`Task: ${task.taskId}, Time: ${Date.now()}`, { allowEmpty: force, files })
		.then(async (result: any) => {
			// Notify FCO that checkpoint was created
			if (provider && result) {
				try {
					provider.postMessageToWebview({
						type: "checkpoint",
						checkpoint: result.commit,
						previousCheckpoint: previousCheckpoint,
					} as any)

					// NOTE: Don't send filesChanged here - it's handled by the checkpointCreated event
					// to avoid duplicate/conflicting messages that override cumulative tracking.
					// The checkpointCreated event handler calculates cumulative changes from the baseline
					// and sends the complete filesChanged message with all accumulated changes.
				} catch (error) {
					console.error("[Task#checkpointSave] Failed to notify FCO of checkpoint creation:", error)
				}
			}
			return result
		})
		.catch((err: any) => {
			console.error("[Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
			task.enableCheckpoints = false
		})
		.finally(() => {
			// Clean up the tracking once completed
			if (task.ongoingCheckpointSaves) {
				task.ongoingCheckpointSaves.delete(saveKey)
			}
		})

	// Initialize as Map if not already
	if (!task.ongoingCheckpointSaves) {
		task.ongoingCheckpointSaves = new Map() as any
	}
	;(task.ongoingCheckpointSaves as any).set(saveKey, savePromise)
	return savePromise
}

export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
	operation?: "delete" | "edit" // Optional to maintain backward compatibility
}

export async function checkpointRestore(
	task: Task,
	{ ts, commitHash, mode, operation = "delete" }: CheckpointRestoreOptions,
) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	const index = task.clineMessages.findIndex((m) => m.ts === ts)

	if (index === -1) {
		return
	}

	const provider = task.providerRef.deref()

	try {
		await service.restoreCheckpoint(commitHash)
		TelemetryService.instance.captureCheckpointRestored(task.taskId)
		await provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })

		// Update FileChangeManager baseline to restored checkpoint and clear accept/reject state
		try {
			const fileChangeManager = provider?.getFileChangeManager()
			if (fileChangeManager) {
				// Reset baseline to restored checkpoint (fresh start from this point)
				await fileChangeManager.updateBaseline(commitHash)
				provider?.log(
					`[checkpointRestore] Reset FileChangeManager baseline to restored checkpoint ${commitHash}`,
				)

				// Clear accept/reject state - checkpoint restore is time travel, start with clean slate
				if (typeof fileChangeManager.clearFileStates === "function") {
					fileChangeManager.clearFileStates()
					provider?.log(`[checkpointRestore] Cleared accept/reject state for fresh start`)
				}

				// Calculate and send current changes with LLM-only filtering (should be empty immediately after restore)
				if (task.taskId && task.fileContextTracker) {
					const changes = await fileChangeManager.getLLMOnlyChanges(task.taskId, task.fileContextTracker)
					provider?.postMessageToWebview({
						type: "filesChanged",
						filesChanged: changes.files.length > 0 ? changes : undefined,
					})
				}
			}
		} catch (error) {
			provider?.log(`[checkpointRestore] Failed to update FileChangeManager baseline: ${error}`)
			// Don't throw - allow restore to continue even if FCO sync fails
		}

		// Notify FCO that checkpoint was restored
		try {
			await provider?.postMessageToWebview({
				type: "checkpointRestored",
				checkpoint: commitHash,
			} as any)
		} catch (error) {
			console.error("[checkpointRestore] Failed to notify FCO of checkpoint restore:", error)
		}

		if (mode === "restore") {
			await task.overwriteApiConversationHistory(task.apiConversationHistory.filter((m) => !m.ts || m.ts < ts))

			const deletedMessages = task.clineMessages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				task.combineMessages(deletedMessages),
			)

			// For delete operations, exclude the checkpoint message itself
			// For edit operations, include the checkpoint message (to be edited)
			const endIndex = operation === "edit" ? index + 1 : index
			await task.overwriteClineMessages(task.clineMessages.slice(0, endIndex))

			// TODO: Verify that this is working as expected.
			await task.say(
				"api_req_deleted",
				JSON.stringify({
					tokensIn: totalTokensIn,
					tokensOut: totalTokensOut,
					cacheWrites: totalCacheWrites,
					cacheReads: totalCacheReads,
					cost: totalCost,
				} satisfies ClineApiReqInfo),
			)
		}

		// The task is already cancelled by the provider beforehand, but we
		// need to re-init to get the updated messages.
		//
		// This was taken from Cline's implementation of the checkpoints
		// feature. The task instance will hang if we don't cancel twice,
		// so this is currently necessary, but it seems like a complicated
		// and hacky solution to a problem that I don't fully understand.
		// I'd like to revisit this in the future and try to improve the
		// task flow and the communication between the webview and the
		// Cline instance.
		provider?.cancelTask()
	} catch (err) {
		provider?.log("[checkpointRestore] disabling checkpoints for this task")
		task.enableCheckpoints = false
	}
}

export type CheckpointDiffOptions = {
	ts: number
	previousCommitHash?: string
	commitHash: string
	mode: "full" | "checkpoint"
}

export async function checkpointDiff(task: Task, { ts, previousCommitHash, commitHash, mode }: CheckpointDiffOptions) {
	const service = await getCheckpointService(task)

	if (!service) {
		return
	}

	TelemetryService.instance.captureCheckpointDiffed(task.taskId)

	let prevHash = commitHash
	let nextHash: string | undefined = undefined

	if (mode !== "full") {
		const checkpoints = task.clineMessages.filter(({ say }) => say === "checkpoint_saved").map(({ text }) => text!)
		const idx = checkpoints.indexOf(commitHash)
		if (idx !== -1 && idx < checkpoints.length - 1) {
			nextHash = checkpoints[idx + 1]
		} else {
			nextHash = undefined
		}
	}

	try {
		const changes = await service.getDiff({ from: prevHash, to: nextHash })

		if (!changes?.length) {
			vscode.window.showInformationMessage("No changes found.")
			return
		}

		await vscode.commands.executeCommand(
			"vscode.changes",
			mode === "full" ? "Changes since task started" : "Changes since previous checkpoint",
			changes.map((change: any) => [
				vscode.Uri.file(change.paths.absolute),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.before ?? "").toString("base64"),
				}),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.after ?? "").toString("base64"),
				}),
			]),
		)
	} catch (err) {
		const provider = task.providerRef.deref()
		provider?.log("[checkpointDiff] disabling checkpoints for this task")
		task.enableCheckpoints = false
	}
}

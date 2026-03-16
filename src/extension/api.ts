import { EventEmitter } from "events"
import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import {
	type RooCodeAPI,
	type RooCodeSettings,
	type RooCodeEvents,
	type ProviderSettings,
	type ProviderSettingsEntry,
	type TaskEvent,
	RooCodeEventName,
	TaskCommandName,
	isSecretStateKey,
	IpcOrigin,
	IpcMessageType,
} from "@siid-code/types"
import { IpcServer } from "@siid-code/ipc"

import { Package } from "../shared/package"
import { ClineProvider } from "../core/webview/ClineProvider"
import { openClineInNewTab } from "../activate/registerCommands"
import { t } from "../i18n"
import {
	logout,
	onFirebaseLogin,
	onFirebaseLogout,
	getUserProperties,
	updateUserProperties,
} from "../utils/firebaseHelper"
import { logger } from "../utils/logging"
import { getOpenRouterKeyService } from "../services/openrouter/api-key-service"

export class API extends EventEmitter<RooCodeEvents> implements RooCodeAPI {
	private readonly outputChannel: vscode.OutputChannel
	private readonly sidebarProvider: ClineProvider
	private readonly context: vscode.ExtensionContext
	private readonly ipc?: IpcServer
	private readonly taskMap = new Map<string, ClineProvider>()
	private readonly log: (...args: unknown[]) => void
	private logfile?: string

	constructor(
		outputChannel: vscode.OutputChannel,
		provider: ClineProvider,
		socketPath?: string,
		enableLogging = false,
	) {
		super()

		// Make prototype methods enumerable on the instance for better API exposure
		const proto = Object.getPrototypeOf(this)
		Object.getOwnPropertyNames(proto).forEach((name) => {
			const descriptor = Object.getOwnPropertyDescriptor(proto, name)
			if (descriptor && typeof descriptor.value === "function" && name !== "constructor") {
				Object.defineProperty(this, name, {
					value: descriptor.value.bind(this),
					enumerable: true,
					configurable: true,
					writable: true,
				})
			}
		})

		this.outputChannel = outputChannel
		this.sidebarProvider = provider
		this.context = provider.context

		if (enableLogging) {
			this.log = (...args: unknown[]) => {
				this.outputChannelLog(...args)
			}

			this.logfile = path.join(os.tmpdir(), "roo-code-messages.log")
		} else {
			this.log = () => {}
		}

		this.registerListeners(this.sidebarProvider)

		if (socketPath) {
			const ipc = (this.ipc = new IpcServer(socketPath, this.log))

			ipc.listen()
			this.log(`[API] ipc server started: socketPath=${socketPath}, pid=${process.pid}, ppid=${process.ppid}`)

			ipc.on(IpcMessageType.TaskCommand, async (_clientId, { commandName, data }) => {
				switch (commandName) {
					case TaskCommandName.StartNewTask:
						this.log(`[API] StartNewTask -> ${data.text}, ${JSON.stringify(data.configuration)}`)
						await this.startNewTask(data)
						break
					case TaskCommandName.CancelTask:
						this.log(`[API] CancelTask -> ${data}`)
						await this.cancelTask(data)
						break
					case TaskCommandName.CloseTask:
						this.log(`[API] CloseTask -> ${data}`)
						await vscode.commands.executeCommand("workbench.action.files.saveFiles")
						await vscode.commands.executeCommand("workbench.action.closeWindow")
						break
				}
			})
		}
	}

	public override emit<K extends keyof RooCodeEvents>(
		eventName: K,
		...args: K extends keyof RooCodeEvents ? RooCodeEvents[K] : never
	) {
		const data = { eventName: eventName as RooCodeEventName, payload: args } as TaskEvent
		this.ipc?.broadcast({ type: IpcMessageType.TaskEvent, origin: IpcOrigin.Server, data })
		return super.emit(eventName, ...args)
	}

	public async startNewTask({
		configuration,
		text,
		images,
		newTab,
	}: {
		configuration: RooCodeSettings
		text?: string
		images?: string[]
		newTab?: boolean
	}) {
		let provider: ClineProvider

		if (newTab) {
			await vscode.commands.executeCommand("workbench.action.files.revert")
			await vscode.commands.executeCommand("workbench.action.closeAllEditors")

			provider = await openClineInNewTab({ context: this.context, outputChannel: this.outputChannel })
			this.registerListeners(provider)
		} else {
			await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)

			provider = this.sidebarProvider
		}

		if (configuration) {
			await provider.setValues(configuration)

			if (configuration.allowedCommands) {
				await vscode.workspace
					.getConfiguration(Package.name)
					.update("allowedCommands", configuration.allowedCommands, vscode.ConfigurationTarget.Global)
			}

			if (configuration.deniedCommands) {
				await vscode.workspace
					.getConfiguration(Package.name)
					.update("deniedCommands", configuration.deniedCommands, vscode.ConfigurationTarget.Global)
			}

			if (configuration.commandExecutionTimeout !== undefined) {
				await vscode.workspace
					.getConfiguration(Package.name)
					.update(
						"commandExecutionTimeout",
						configuration.commandExecutionTimeout,
						vscode.ConfigurationTarget.Global,
					)
			}
		}

		await provider.removeClineFromStack()
		await provider.postStateToWebview()
		await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await provider.postMessageToWebview({ type: "invoke", invoke: "newChat", text, images })

		const cline = await provider.initClineWithTask(text, images, undefined, {
			consecutiveMistakeLimit: Number.MAX_SAFE_INTEGER,
		})

		if (!cline) {
			throw new Error("Failed to create task due to policy restrictions")
		}

		return cline.taskId
	}

	public async resumeTask(taskId: string): Promise<void> {
		const { historyItem } = await this.sidebarProvider.getTaskWithId(taskId)
		await this.sidebarProvider.initClineWithHistoryItem(historyItem)
		await this.sidebarProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	public async isTaskInHistory(taskId: string): Promise<boolean> {
		try {
			await this.sidebarProvider.getTaskWithId(taskId)
			return true
		} catch {
			return false
		}
	}

	public getCurrentTaskStack() {
		return this.sidebarProvider.getCurrentTaskStack()
	}

	public async clearCurrentTask(lastMessage?: string) {
		await this.sidebarProvider.finishSubTask(lastMessage ?? "")
		await this.sidebarProvider.postStateToWebview()
	}

	public async cancelCurrentTask() {
		await this.sidebarProvider.cancelTask()
	}

	public async cancelTask(taskId: string) {
		const provider = this.taskMap.get(taskId)

		if (provider) {
			await provider.cancelTask()
			this.taskMap.delete(taskId)
		}
	}

	public async sendMessage(text?: string, images?: string[]) {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "sendMessage", text, images })
	}

	public async pressPrimaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
	}

	public async pressSecondaryButton() {
		await this.sidebarProvider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
	}

	public isReady() {
		return this.sidebarProvider.viewLaunched
	}

	private registerListeners(provider: ClineProvider) {
		provider.on(RooCodeEventName.TaskCreated, (task) => {
			// Task Lifecycle

			task.on(RooCodeEventName.TaskStarted, async () => {
				this.emit(RooCodeEventName.TaskStarted, task.taskId)
				this.taskMap.set(task.taskId, provider)
				await this.fileLog(`[${new Date().toISOString()}] taskStarted -> ${task.taskId}\n`)
			})

			task.on(RooCodeEventName.TaskCompleted, async (_, tokenUsage, toolUsage) => {
				let isSubtask = false

				if (typeof task.rootTask !== "undefined") {
					isSubtask = true
				}

				this.emit(RooCodeEventName.TaskCompleted, task.taskId, tokenUsage, toolUsage, { isSubtask: isSubtask })
				this.taskMap.delete(task.taskId)

				await this.fileLog(
					`[${new Date().toISOString()}] taskCompleted -> ${task.taskId} | ${JSON.stringify(tokenUsage, null, 2)} | ${JSON.stringify(toolUsage, null, 2)}\n`,
				)
			})

			task.on(RooCodeEventName.TaskAborted, () => {
				this.emit(RooCodeEventName.TaskAborted, task.taskId)
				this.taskMap.delete(task.taskId)
			})

			// Optional:
			// RooCodeEventName.TaskFocused
			// RooCodeEventName.TaskUnfocused
			// RooCodeEventName.TaskActive
			// RooCodeEventName.TaskIdle

			// Subtask Lifecycle

			task.on(RooCodeEventName.TaskPaused, () => {
				this.emit(RooCodeEventName.TaskPaused, task.taskId)
			})

			task.on(RooCodeEventName.TaskUnpaused, () => {
				this.emit(RooCodeEventName.TaskUnpaused, task.taskId)
			})

			task.on(RooCodeEventName.TaskSpawned, (childTaskId) => {
				this.emit(RooCodeEventName.TaskSpawned, task.taskId, childTaskId)
			})

			// Task Execution

			task.on(RooCodeEventName.Message, async (message) => {
				this.emit(RooCodeEventName.Message, { taskId: task.taskId, ...message })

				if (message.message.partial !== true) {
					await this.fileLog(`[${new Date().toISOString()}] ${JSON.stringify(message.message, null, 2)}\n`)
				}
			})

			task.on(RooCodeEventName.TaskModeSwitched, (taskId, mode) => {
				this.emit(RooCodeEventName.TaskModeSwitched, taskId, mode)
			})

			task.on(RooCodeEventName.TaskAskResponded, () => {
				this.emit(RooCodeEventName.TaskAskResponded, task.taskId)
			})

			// Task Analytics

			task.on(RooCodeEventName.TaskToolFailed, (taskId, tool, error) => {
				this.emit(RooCodeEventName.TaskToolFailed, taskId, tool, error)
			})

			task.on(RooCodeEventName.TaskTokenUsageUpdated, (_, usage) => {
				this.emit(RooCodeEventName.TaskTokenUsageUpdated, task.taskId, usage)
			})

			// Let's go!

			this.emit(RooCodeEventName.TaskCreated, task.taskId)
		})
	}

	// Logging

	private outputChannelLog(...args: unknown[]) {
		for (const arg of args) {
			if (arg === null) {
				this.outputChannel.appendLine("null")
			} else if (arg === undefined) {
				this.outputChannel.appendLine("undefined")
			} else if (typeof arg === "string") {
				this.outputChannel.appendLine(arg)
			} else if (arg instanceof Error) {
				this.outputChannel.appendLine(`Error: ${arg.message}\n${arg.stack || ""}`)
			} else {
				try {
					this.outputChannel.appendLine(
						JSON.stringify(
							arg,
							(key, value) => {
								if (typeof value === "bigint") return `BigInt(${value})`
								if (typeof value === "function") return `Function: ${value.name || "anonymous"}`
								if (typeof value === "symbol") return value.toString()
								return value
							},
							2,
						),
					)
				} catch (error) {
					this.outputChannel.appendLine(`[Non-serializable object: ${Object.prototype.toString.call(arg)}]`)
				}
			}
		}
	}

	private async fileLog(message: string) {
		if (!this.logfile) {
			return
		}

		try {
			await fs.appendFile(this.logfile, message, "utf8")
		} catch (_) {
			this.logfile = undefined
		}
	}

	// Global Settings Management

	public getConfiguration(): RooCodeSettings {
		return Object.fromEntries(
			Object.entries(this.sidebarProvider.getValues()).filter(([key]) => !isSecretStateKey(key)),
		)
	}

	public async setConfiguration(values: RooCodeSettings) {
		await this.sidebarProvider.contextProxy.setValues(values)
		await this.sidebarProvider.providerSettingsManager.saveConfig(values.currentApiConfigName || "default", values)
		await this.sidebarProvider.postStateToWebview()
	}

	// Provider Profile Management

	public getProfiles(): string[] {
		return this.sidebarProvider.getProviderProfileEntries().map(({ name }) => name)
	}

	public getProfileEntry(name: string): ProviderSettingsEntry | undefined {
		return this.sidebarProvider.getProviderProfileEntry(name)
	}

	public async createProfile(name: string, profile?: ProviderSettings, activate: boolean = true) {
		const entry = this.getProfileEntry(name)

		if (entry) {
			throw new Error(`Profile with name "${name}" already exists`)
		}

		const id = await this.sidebarProvider.upsertProviderProfile(name, profile ?? {}, activate)

		if (!id) {
			throw new Error(`Failed to create profile with name "${name}"`)
		}

		return id
	}

	public async updateProfile(
		name: string,
		profile: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		const id = await this.sidebarProvider.upsertProviderProfile(name, profile, activate)

		if (!id) {
			throw new Error(`Failed to update profile with name "${name}"`)
		}

		return id
	}

	public async upsertProfile(
		name: string,
		profile: ProviderSettings,
		activate: boolean = true,
	): Promise<string | undefined> {
		const id = await this.sidebarProvider.upsertProviderProfile(name, profile, activate)

		if (!id) {
			throw new Error(`Failed to upsert profile with name "${name}"`)
		}

		return id
	}

	public async deleteProfile(name: string): Promise<void> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		await this.sidebarProvider.deleteProviderProfile(entry)
	}

	public getActiveProfile(): string | undefined {
		return this.getConfiguration().currentApiConfigName
	}

	public async setActiveProfile(name: string): Promise<string | undefined> {
		const entry = this.getProfileEntry(name)

		if (!entry) {
			throw new Error(`Profile with name "${name}" does not exist`)
		}

		await this.sidebarProvider.activateProviderProfile({ name })
		return this.getActiveProfile()
	}

	public async onFirebaseLogin(loginData?: unknown): Promise<void> {
		try {
			this.outputChannel.appendLine("Firebase login event received - user is now authenticated")

			// Update the cached Firebase auth state
			this.sidebarProvider.setFirebaseAuthState(true)
			this.outputChannel.appendLine("Firebase auth state updated to authenticated")

			// Setup user API key directly without routing through webview
			// Firebase Service extension sends: { uid, user: { uid, email, displayName, ... }, session: {...} }
			const data = loginData as {
				uid?: string
				user?: { uid: string; email?: string; displayName?: string }
				userInfo?: { uid: string; email?: string; displayName?: string } // Legacy format support
			}

			// Support both new format (user) and legacy format (userInfo)
			const userInfo = data?.user || data?.userInfo
			// Use a safe stringify that handles circular references
			const safeStringify = (obj: any) => {
				try {
					return JSON.stringify(obj, (key, value) => {
						// Skip circular references and functions
						if (typeof value === "function" || value instanceof Promise) {
							return undefined
						}
						return value
					})
				} catch (e) {
					return "{...circular reference...}"
				}
			}
			logger.info(`[onFirebaseLogin] User info extracted from loginData: userInfo: ${safeStringify(userInfo)}`)
			this.outputChannel.appendLine(`User info extracted from loginData: ${safeStringify(userInfo)}`)

			if (userInfo) {
				logger.info(`[onFirebaseLogin] Setting up API key for user: ${userInfo.uid}`)
				this.outputChannel.appendLine(`Setting up API key for user: ${userInfo.uid}`)
				try {
					const userId = userInfo.uid
					const userEmail = userInfo.email || `user_${userId}`

					logger.info(`[onFirebaseLogin] Processing login for user: ${userId}`)
					this.outputChannel.appendLine(`[onFirebaseLogin] Processing login for user: ${userId}`)

					// Check if user provided their own API key
					const pendingApiKey = this.sidebarProvider.contextProxy.getValue("pendingUserApiKey")

					if (pendingApiKey) {
						// User provided their own OpenRouter API key
						logger.info(`[onFirebaseLogin] Using user-provided API key for user: ${userId}`)
						this.outputChannel.appendLine(
							`[onFirebaseLogin] Using user-provided API key for user: ${userId}`,
						)

						try {
							// Store the user-provided API key in Firebase user properties
							await updateUserProperties(
								{
									openRouterApiKey: pendingApiKey,
									apiKeySource: "user-provided",
								},
								this.outputChannel,
							)

							logger.info(
								`[onFirebaseLogin] User-provided API key stored successfully for user: ${userId}`,
							)
							this.outputChannel.appendLine(
								`[onFirebaseLogin] User-provided API key stored successfully for user: ${userId}`,
							)
						} catch (error) {
							logger.error("[onFirebaseLogin] Failed to store user-provided API key:", error)
							this.outputChannel.appendLine(
								`[onFirebaseLogin] Failed to store user-provided API key: ${error instanceof Error ? error.message : String(error)}`,
							)
							throw error
						} finally {
							// Clear pending API key from global state
							await this.sidebarProvider.contextProxy.setValue("pendingUserApiKey", undefined)
						}
					} else {
						// Auto-provision API key (default flow)
						logger.info(`[onFirebaseLogin] Auto-provisioning API key for user: ${userId}`)
						this.outputChannel.appendLine(`[onFirebaseLogin] Auto-provisioning API key for user: ${userId}`)

						const keyService = await getOpenRouterKeyService(this.outputChannel)

						// Setup user API key (fetches provisioning key, creates user key, stores it)
						await keyService.setupUserApiKey(userId, userEmail)

						logger.info(`[onFirebaseLogin] Successfully auto-provisioned API key for user: ${userId}`)
						this.outputChannel.appendLine(
							`[onFirebaseLogin] Successfully auto-provisioned API key for user: ${userId}`,
						)
					}

					// Setup useFreeModels preference
					try {
						logger.info(`[onFirebaseLogin] Setting up useFreeModels for user: ${userId}`)
						this.outputChannel.appendLine(`[onFirebaseLogin] Setting up useFreeModels for user: ${userId}`)

						let useFreeModels: boolean

						// If the user provided their own API key via the pending flow,
						// prefer explicit (paid/custom) configs and disable the "use free models" flag.
						if (pendingApiKey) {
							useFreeModels = false
							logger.info(
								`[onFirebaseLogin] pendingApiKey present - forcing useFreeModels=false for user: ${userId}`,
							)
							this.outputChannel.appendLine(
								`[onFirebaseLogin] pendingApiKey present - forcing useFreeModels=false for user: ${userId}`,
							)
							// Persist to Firebase so subsequent sessions respect this choice
							await updateUserProperties({ useFreeModels: false }, this.outputChannel)
						} else {
							// No pending API key: user is logging in with auto-provisioned key
							// Always set useFreeModels to true for auto-provisioned users
							useFreeModels = true
							logger.info(
								`[onFirebaseLogin] No pendingApiKey - using auto-provisioned key, setting useFreeModels=true for user: ${userId}`,
							)
							this.outputChannel.appendLine(
								`[onFirebaseLogin] No pendingApiKey - using auto-provisioned key, setting useFreeModels=true for user: ${userId}`,
							)
							// Persist to Firebase so subsequent sessions respect this choice
							await updateUserProperties({ useFreeModels: true }, this.outputChannel)
						}

						// Store in IDE global state
						await this.sidebarProvider.contextProxy.setValue("useFreeModels", useFreeModels)
						logger.info(`[onFirebaseLogin] useFreeModels set to ${useFreeModels} in IDE storage`)
						this.outputChannel.appendLine(
							`[onFirebaseLogin] useFreeModels set to ${useFreeModels} in IDE storage`,
						)

						// Update API keys based on useFreeModels preference
						await this.sidebarProvider.providerSettingsManager.updateApiKeysFromFirebase()

						// Reload the active profile into ContextProxy so the in-memory provider
						// settings (used by requests/webview state) immediately pick up the key.
						const activeProfile = this.sidebarProvider.getValue("currentApiConfigName") || "default"
						await this.sidebarProvider.activateProviderProfile({ name: activeProfile })
					} catch (error) {
						logger.error("[onFirebaseLogin] Failed to setup useFreeModels:", error)
						this.outputChannel.appendLine(
							`[onFirebaseLogin] Failed to setup useFreeModels: ${error instanceof Error ? error.message : String(error)}`,
						)
						// Don't throw - continue with login even if this fails
					}

					vscode.window.showInformationMessage(
						`Welcome ${userInfo.displayName || userEmail}! Your account is ready.`,
					)
				} catch (error) {
					logger.error("[onFirebaseLogin] Failed to setup user API key:", error)
					this.outputChannel.appendLine(
						`[onFirebaseLogin] Failed to setup user API key: ${error instanceof Error ? error.message : String(error)}`,
					)
					vscode.window.showErrorMessage(
						`Failed to setup your account: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			} else {
				logger.warn("[onFirebaseLogin] No user data found in loginData")
				this.outputChannel.appendLine("[onFirebaseLogin] No user data found in loginData")
			}

			// Post a custom message to webview indicating login success
			// This bypasses the Firebase command check which may have timing issues
			await this.sidebarProvider.postMessageToWebview({
				type: "state",
				state: {
					...(await this.sidebarProvider.getStateToPostToWebview()),
					firebaseIsAuthenticated: true, // Override to ensure we show as authenticated
				},
			} as any)

			this.outputChannel.appendLine("Firebase login successful - updated API keys and refreshed state")
		} catch (error) {
			this.outputChannel.appendLine(`Error handling Firebase login: ${error}`)
			vscode.window.showErrorMessage(
				`Error handling Firebase login: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	public async onFirebaseLogout(): Promise<void> {
		try {
			this.outputChannel.appendLine("Firebase logout event received - user is now logged out")

			// Update the cached Firebase auth state
			this.sidebarProvider.setFirebaseAuthState(false)

			// Post a custom message to webview indicating logout
			// This bypasses the Firebase command check which may have timing issues
			await this.sidebarProvider.postMessageToWebview({
				type: "state",
				state: {
					...(await this.sidebarProvider.getStateToPostToWebview()),
					firebaseIsAuthenticated: false, // Override to ensure we show as logged out
				},
			} as any)

			this.outputChannel.appendLine("Firebase logout - refreshed state")
			vscode.window.showInformationMessage("You have been logged out")
		} catch (error) {
			this.outputChannel.appendLine(`Error handling Firebase logout: ${error}`)
			vscode.window.showErrorMessage(
				`Error handling Firebase logout: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}

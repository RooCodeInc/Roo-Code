import * as os from "os"
import * as vscode from "vscode"
import type { ClineProvider } from "./../../webview/ClineProvider"
import * as fs from "fs"
import * as path from "path"
import { CodebaseIndexClient } from "./client"
// import { PlatformDetector } from "./platform"
import {
	ICodebaseIndexManager,
	VersionInfo,
	CodebaseIndexClientConfig,
	WorkspaceEventRequest,
	IndexBuildRequest,
	IgnoreFilesRequest,
	IndexStatusResponse,
	IndexSwitchRequest,
	ApiResponse,
} from "./types"
import { TelemetryErrorType } from "../telemetry"
import { TelemetryService } from "@roo-code/telemetry"
import { ZgsmAuthService } from "../auth"
import { ILogger } from "../../../utils/logger"
// import { getWorkspacePath } from "../../../utils/path"
import pWaitFor from "p-wait-for"
import { t } from "../../../i18n"

/**
 * CodebaseIndex manager implementation class (singleton pattern)
 * Responsible for managing codebase-index client initialization, version checking, upgrades and restart operations
 */
export class ZgsmCodebaseIndexManager implements ICodebaseIndexManager {
	public static instance: ZgsmCodebaseIndexManager
	public client: CodebaseIndexClient | null = null
	private logger: ILogger | null = null
	private clineProvider: ClineProvider | null = null
	// private platformDetector: PlatformDetector
	private isInitialized: boolean = false
	// private serverEndpoint = ""
	private preBuildInfo = {
		type: "",
		time: 0,
	}

	// Health check related properties
	private healthCheckTimer: NodeJS.Timeout | null = null
	private healthCheckFailureCount: number = 0
	private isHealthCheckRunning: boolean = false

	// // Index build polling related properties
	// private indexBuildPollTimer: NodeJS.Timeout | null = null
	// private isIndexBuildPollRunning: boolean = false

	// Cache to prevent duplicate calls
	private pendingIndexStatusRequests = new Map<string, Promise<ApiResponse<IndexStatusResponse>>>()
	// Recently completed request cache (prevents duplicate calls in short time)
	private recentCompletedRequests = new Map<string, { result: ApiResponse<IndexStatusResponse>; timestamp: number }>()

	// Constants definition
	private readonly HEALTH_CHECK_INTERVAL: number = 60000 // 1 minute
	private readonly MAX_FAILURE_COUNT: number = 2 // Maximum failure count
	// private readonly INDEX_BUILD_POLL_INTERVAL: number = 600_000 // 10 minutes
	/**
	 * Private constructor to ensure singleton pattern
	 */
	private constructor() {
		// this.platformDetector = new PlatformDetector()
	}

	/**
	 * Get singleton instance
	 * @returns ZgsmCodebaseIndexManager instance
	 */
	public static getInstance(): ZgsmCodebaseIndexManager {
		if (!ZgsmCodebaseIndexManager.instance) {
			ZgsmCodebaseIndexManager.instance = new ZgsmCodebaseIndexManager()
		}
		return ZgsmCodebaseIndexManager.instance
	}

	/**
	 * Set logger provider
	 * @param logger Logger provider
	 */
	public setLogger(logger: ILogger): void {
		this.logger = logger
	}
	public setProvider(clineProvider: ClineProvider): void {
		this.clineProvider = clineProvider
	}

	/**
	 * Internal logging method
	 * @param message Log message
	 * @param type Log type
	 * @param id Log ID
	 */
	private log(message: string, type: "info" | "error" = "info", id: string = ""): void {
		// If no logger provider is provided, use console.log
		if (this.logger?.[type]) {
			this.logger[type](`[${id}] ${message}`)
		} else {
			const logMessage = `[${new Date().toLocaleString()}] [${type}]${id ? ` [${id}] ` : ""} ${message}`
			console.log(logMessage)
		}
	}

	/**
	 * Initialize client
	 */
	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			// this.log("CodebaseKeeper client already initialized, skipping", "info", "ZgsmCodebaseIndexManager")
			return
		}

		// Check if client is already installed locally
		try {
			// Create client configuration
			const config: CodebaseIndexClientConfig = {
				downloadTimeout: 30_000,
				getLocalVersion: () => this.getLocalVersion(),
			}

			// Create client instance
			this.client = new CodebaseIndexClient(config)
			// Check and upgrade client
			const state = await this.checkAndUpgradeClient()
			if (state === "failed") {
				const selection = await vscode.window.showWarningMessage(
					t("common:errors.codebase_startup_failed"),
					t("common:confirmation.fixCodebase"),
				)
				if (selection === t("common:confirmation.fixCodebase")) {
					// eslint-disable-next-line @typescript-eslint/no-unused-expressions
					this.clineProvider
						? this.clineProvider?.fixCodebase()
						: vscode.commands.executeCommand("workbench.action.reloadWindow")
				}
				return
			}
			if (state === "needZgsm") {
				this.log("Only CoStrict provider supports this service", "info", "ZgsmCodebaseIndexManager")
				return
			}

			// Stop all scheduled tasks
			this.stopHealthCheck()
			// this.stopIndexBuildPoll()

			const versionInfo = await this.getLocalVersion()
			await this.client!.startClient(versionInfo!, state !== "noUpdate")
			this.isInitialized = true
			// this.log("CodebaseKeeper client initialized successfully", "info", "ZgsmCodebaseIndexManager")

			// Start scheduled detection
			this.startHealthCheck()
			// this.triggerIndexBuildPoll()
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown error occurred while initializing CodebaseKeeper client"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}
	public async stopExistingClient() {
		await this.ensureClientInited("stopExistingClient")
		return await this.client!.stopExistingClient()
	}

	/**
	 * Restart client
	 */
	public async restartClient(): Promise<void> {
		try {
			await this.ensureClientInited("restartClient")
			this.isInitialized = false
			await this.initialize()
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while restarting CodebaseKeeper client"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Check and upgrade client
	 */
	public async checkAndUpgradeClient(): Promise<
		"firstInstall" | "failed" | "upgraded" | "noUpdate" | "needZgsm" | "updating"
	> {
		try {
			let localVersionInfo = await this.getLocalVersion()
			// Check if client is already installed locally

			if (localVersionInfo) {
				const elapsed = Date.now() - (localVersionInfo.updateAt || 0)
				if (localVersionInfo.status === "downloading" && elapsed <= 60_000) {
					try {
						this.log(`Client download operation already in progress...`, "info", "ZgsmCodebaseIndexManager")
						await pWaitFor(
							async () => {
								const localVersionInfo = await this.getLocalVersion()
								const ok = localVersionInfo && localVersionInfo.status !== "downloading"
								return !!ok
							},
							{
								interval: 10_000,
								timeout: 120_000,
							},
						)
					} catch (error) {
						this.log(`Client download wait timeout`, "info", "ZgsmCodebaseIndexManager")

						return "failed"
					}
				}
				if (localVersionInfo.status === "downloading" && elapsed > 60_000) {
					this.saveLocalVersion({
						...localVersionInfo,
						status: "failed",
					})
				}
			}

			await this.ensureClientInited("checkAndUpgradeClient")
			// Get latest version information
			const latestVersionInfo = await this.client!.getLatestVersion()
			localVersionInfo = await this.getLocalVersion()
			if (!localVersionInfo || !fs.existsSync(this.client!.getTargetPath().targetPath)) {
				// Not installed locally, install latest version directly
				await this.client!.stopExistingClient()
				await this.downloadAndInstallClient(latestVersionInfo)
				return "firstInstall"
			} else {
				const hasUpdate = await this.client!.shouldUpdate(localVersionInfo)

				if (hasUpdate) {
					await this.client!.stopExistingClient()
					this.log("New version detected, starting upgrade", "info", "ZgsmCodebaseIndexManager")
					await this.downloadAndInstallClient(latestVersionInfo)
					this.log("CodebaseKeeper client check and upgrade completed", "info", "ZgsmCodebaseIndexManager")
					return "upgraded"
				} else {
					this.log("Current version is already latest, no upgrade needed", "info", "ZgsmCodebaseIndexManager")
					return "noUpdate"
				}
			}
		} catch (error) {
			if (error.__NEED_ZGSM__) {
				return "needZgsm"
			}
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown error occurred while checking and upgrading CodebaseKeeper client"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			return "failed"
		}
	}

	private async ensureClientInited(src: string) {
		if (!this.client) {
			throw new Error(`${src ? `[${src}] ` : ""}Client not initialized`)
		}

		if (!this.clineProvider) {
			throw new Error(`${src ? `[${src}] ` : ""}clineProvider not initialized`)
		}

		const { apiConfiguration } = await this.clineProvider.getState()

		if (apiConfiguration.apiProvider !== "zgsm") {
			const err = new Error("Only CoStrict provider supports this service")
			Object.assign(err, { __NEED_ZGSM__: true })
			throw err
		}
	}

	/**
	 * Get local version information
	 * @returns Local version information, returns null if not exists
	 */
	private async getLocalVersion(): Promise<VersionInfo | undefined> {
		try {
			const homeDir = os.homedir()

			if (!homeDir) {
				throw new Error("Unable to determine user home directory path")
			}

			const versionDir = path.join(homeDir, ".costrict", "share")
			const versionFilePath = path.join(versionDir, "version.json")

			// Check if version file exists
			if (!fs.existsSync(versionFilePath)) {
				this.log("Local version file does not exist", "info", "ZgsmCodebaseIndexManager")
				return
			}

			// Read version file
			const versionContent = fs.readFileSync(versionFilePath, "utf8")
			const versionData = JSON.parse(versionContent)

			// Verify basic structure of version data
			if (!versionData || typeof versionData !== "object") {
				throw new Error("Version file format is invalid")
			}

			return versionData
		} catch (error) {
			if (error instanceof SyntaxError) {
				this.log(`Local version file parsing failed: JSON format error`, "error", "ZgsmCodebaseIndexManager")
			} else {
				this.log(
					`Failed to read local version information: ${error instanceof Error ? error.message : "Unknown error"}`,
					"error",
					"ZgsmCodebaseIndexManager",
				)
			}
			return
		}
	}

	/**
	 * Download and install client
	 * @param versionInfo Version information
	 */
	private async downloadAndInstallClient(versionInfo: VersionInfo): Promise<void> {
		try {
			await this.saveLocalVersion({
				...versionInfo,
				updateAt: Date.now(),
				status: "downloading",
			})
			const versionString = `${versionInfo?.versionId?.major}.${versionInfo?.versionId?.minor}.${versionInfo?.versionId?.micro}`
			this.log(`Starting to download client version: ${versionString}`, "info", "ZgsmCodebaseIndexManager")

			const result = await this.client!.downloadAndInstallClient(versionInfo, (progress) => {
				this.log(
					`Download progress: ${progress.progress}%, ${progress.downloaded}/${progress.total}`,
					"info",
					"ZgsmCodebaseIndexManager",
				)
			})

			if (result.success && result.filePath) {
				this.log(
					`Client downloaded and installed successfully: ${result.filePath}`,
					"info",
					"ZgsmCodebaseIndexManager",
				)

				// Save local version information
				await this.saveLocalVersion({
					...versionInfo,
					packageInfo: result.packageInfo,
					updateAt: Date.now(),
					status: "downloaded",
				})
			} else {
				// Save local version information
				await this.saveLocalVersion({
					...versionInfo,
					packageInfo: result.packageInfo,
					updateAt: Date.now(),
					status: "failed",
				})
				throw new Error(result.error || "Failed to download and install client")
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Unknown error occurred while downloading and installing client"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			// Save local version information with failed status
			await this.saveLocalVersion({
				...versionInfo,
				updateAt: Date.now(),
				status: "failed",
			})
			throw new Error(errorMessage)
		}
	}

	/**
	 * Save local version information
	 * @param versionId Version ID
	 */
	private async saveLocalVersion(versionInfo: VersionInfo): Promise<void> {
		try {
			const homeDir = os.homedir()

			if (!homeDir) {
				throw new Error("Unable to determine user home directory path")
			}

			const versionDir = path.join(homeDir, ".costrict", "share")
			const packageDir = path.join(homeDir, ".costrict", "package")
			const packageInfoDir = path.join(packageDir, "costrict.json")
			const packageInfoVersionDir = path.join(
				packageDir,
				`costrict-${versionInfo.versionId.major}.${versionInfo.versionId.minor}.${versionInfo.versionId.micro}.json`,
			)
			const versionFilePath = path.join(versionDir, "version.json")

			// Ensure directory exists
			if (!fs.existsSync(versionDir)) {
				fs.mkdirSync(versionDir, { recursive: true })
			}

			// Ensure directory exists
			if (!fs.existsSync(packageDir)) {
				fs.mkdirSync(packageDir, { recursive: true })
			}

			// Write version file
			const versionData = {
				...versionInfo,
				updateAt: Date.now(),
			}

			fs.writeFileSync(versionFilePath, JSON.stringify(versionData || {}, null, 2), "utf8")
			fs.writeFile(packageInfoDir, JSON.stringify(versionData.packageInfo || {}, null, 2), (err) => {
				if (err) console.error(err.message)
			})
			fs.writeFile(packageInfoVersionDir, JSON.stringify(versionData.packageInfo || {}, null, 2), (err) => {
				if (err) console.error(err.message)
			})
		} catch (error) {
			this.log(
				`Failed to save local version information: ${error instanceof Error ? error.message : "Unknown error"}`,
				"error",
				"ZgsmCodebaseIndexManager",
			)
		}
	}
	recordError(type: TelemetryErrorType) {
		TelemetryService.instance.captureError(`CodeBaseError_${type}`)
	}

	/**
	 * Publish workspace events
	 * @param request Workspace event request
	 */
	public async publishWorkspaceEvents(request: WorkspaceEventRequest): Promise<ApiResponse<number>> {
		try {
			await this.ensureClientInited("publishWorkspaceEvents")
			// this.log(`Publish workspace events: ${request.workspace}`, "info", "ZgsmCodebaseIndexManager")
			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.publishWorkspaceEvents(request, token)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while publishing workspace events"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Manually trigger index build
	 * @param request Index build request
	 */
	public async triggerIndexBuild(request: IndexBuildRequest): Promise<ApiResponse<number>> {
		if (this.preBuildInfo.type === request.type && Date.now() - this.preBuildInfo.time < 300)
			throw new Error("Skip duplicate index build trigger:" + request.type)
		this.preBuildInfo.type = request.type
		this.preBuildInfo.time = Date.now()
		try {
			await this.ensureClientInited("triggerIndexBuild")
			this.log(`Trigger index build: ${request.workspace} - ${request.type}`, "info", "ZgsmCodebaseIndexManager")

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.triggerIndexBuild(request, token)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while triggering index build"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Health check
	 */
	public async healthCheck(): Promise<{
		message: string
		status: string | boolean
		[key: string]: any
	}> {
		const url = `http://localhost:${this.client!.getCostrictServerPort(9527)}/healthz`
		try {
			await this.ensureClientInited("healthCheck")
			// this.log("Performing health check", "info", "CostrictHealthCheck")

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.healthCheck(url, token)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during health check"
			// this.log(errorMessage, "error", "CostrictHealthCheck")
			throw new Error(`[${url}] ` + errorMessage)
		}
	}

	// Token passing interface
	public async syncToken(): Promise<ApiResponse<number>> {
		try {
			await this.ensureClientInited("syncToken")
			this.log("Token update", "info", "ZgsmCodebaseIndexManager")

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.syncToken(token)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during token update"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Check ignore files
	 * @param request Ignore files request
	 */
	public async checkIgnoreFiles(request: IgnoreFilesRequest): Promise<ApiResponse<boolean>> {
		try {
			await this.ensureClientInited("checkIgnoreFiles")
			this.log(`Checking ignore files: ${request.workspacePath}`, "info", "ZgsmCodebaseIndexManager")

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.checkIgnoreFiles(request, token)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while checking ignore files"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Query index status
	 * @param workspace Workspace path
	 */
	public async getIndexStatus(workspace: string): Promise<ApiResponse<IndexStatusResponse>> {
		// Check if there is already the same request in progress
		const requestKey = `getIndexStatus:${workspace}`
		const now = Date.now()

		// Check recently completed requests (within 1 second)
		const recentRequest = this.recentCompletedRequests.get(requestKey)
		if (recentRequest && now - recentRequest.timestamp < 1000) {
			this.log(
				`Reusing recently completed query index status request result: ${workspace} (${now - recentRequest.timestamp}ms ago)`,
				"info",
				"ZgsmCodebaseIndexManager",
			)
			return recentRequest.result
		}

		if (this.pendingIndexStatusRequests.has(requestKey)) {
			// If there is already the same request in progress, wait for it to complete and reuse the result
			this.log(`Reusing ongoing query index status request: ${workspace}`, "info", "ZgsmCodebaseIndexManager")
			return await this.pendingIndexStatusRequests.get(requestKey)!
		}
		const requestPromise = this._getIndexStatusInternal(workspace)
		this.pendingIndexStatusRequests.set(requestKey, requestPromise)

		try {
			const result = await requestPromise
			// Cache result for 1 second to prevent duplicate calls in short time
			this.recentCompletedRequests.set(requestKey, { result, timestamp: now })

			// Clean up expired cache (keep last 5 minutes)
			for (const [key, cache] of this.recentCompletedRequests.entries()) {
				if (now - cache.timestamp > 300000) {
					// 5 minutes
					this.recentCompletedRequests.delete(key)
				}
			}

			return result
		} finally {
			// Clear pending request cache after completion
			this.pendingIndexStatusRequests.delete(requestKey)
		}
	}

	/**
	 * Internal method to query index status
	 * @param workspace Workspace path
	 */
	private async _getIndexStatusInternal(workspace: string): Promise<ApiResponse<IndexStatusResponse>> {
		try {
			await this.ensureClientInited("_getIndexStatusInternal")

			// Add call stack information to trace call source
			this.log(`Querying index status: ${workspace}`, "info", "ZgsmCodebaseIndexManager")

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.getIndexStatus(workspace, token)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while querying index status"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Index function toggle
	 * @param request Toggle request
	 */
	public async toggleIndexSwitch(request: IndexSwitchRequest): Promise<ApiResponse<boolean>> {
		try {
			await this.ensureClientInited("toggleIndexSwitch")
			this.log(
				`Toggle index function: ${request.workspace} - ${request.switch}`,
				"info",
				"ZgsmCodebaseIndexManager",
			)

			// Read access token
			const token = await this.readAccessToken()
			return await this.client!.toggleIndexSwitch(request, token)
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred while toggling index function"
			this.log(errorMessage, "error", "ZgsmCodebaseIndexManager")
			throw new Error(errorMessage)
		}
	}

	/**
	 * Read access token
	 * @returns Access token
	 */
	async readAccessToken() {
		const zgsmAuthService = ZgsmAuthService.getInstance()
		const tokens = await zgsmAuthService.getTokens()
		if (!tokens) {
			throw new Error("readAccessToken failed to get access token")
		}
		return tokens.access_token
	}

	/**
	 * Start scheduled detection
	 */
	private startHealthCheck(): void {
		if (this.isHealthCheckRunning) {
			this.log("Health check already started", "info", "CostrictHealthCheck")
			return
		}

		// this.log("Starting health check", "info", "CostrictHealthCheck")
		this.isHealthCheckRunning = true
		this.healthCheckTimer = setInterval(async () => {
			if (!this.clineProvider) return
			const { apiConfiguration } = await this.clineProvider.getState()
			if (!apiConfiguration || apiConfiguration.apiProvider !== "zgsm") {
				return
			}
			await this.performHealthCheck()
		}, this.HEALTH_CHECK_INTERVAL)
	}

	/**
	 * Stop scheduled detection
	 */
	public stopHealthCheck(): void {
		if (!this.isHealthCheckRunning) {
			return
		}

		this.log("Stopping scheduled detection", "info", "CostrictHealthCheck")

		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}

		this.isHealthCheckRunning = false
		this.healthCheckFailureCount = 0
	}

	/**
	 * Perform single health check
	 */
	private async performHealthCheck(): Promise<void> {
		try {
			const [active, pids] = await this.client!.isRunning()
			const data = await this.healthCheck()
			if (active && ["success", "UP", true].includes(data.status)) {
				this.healthCheckFailureCount = 0 // Reset failure counter
				// this.log(
				// 	`[pids: ${pids.join("|")} ] ${this.client?.processName} running`,
				// 	"info",
				// 	"CostrictHealthCheck",
				// )
			} else {
				this.log(`Health check abnormal${active ? ` pids: ${pids}` : ""}`, "error", "CostrictHealthCheck")
				await this.handleHealthCheckFailure()
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during health check"
			this.log(errorMessage, "error", "CostrictHealthCheck")
			await this.handleHealthCheckFailure()
		}
	}

	/**
	 * Handle health check failure
	 */
	private async handleHealthCheckFailure(): Promise<void> {
		this.healthCheckFailureCount++

		if (this.healthCheckFailureCount > this.MAX_FAILURE_COUNT) {
			// this.log(
			// 	`Failed ${this.healthCheckFailureCount} times consecutively, exceeding threshold, preparing to restart client`,
			// 	"error",
			// 	"CostrictHealthCheck",
			// )

			try {
				await this.restartClient()
				this.log("Client restarted successfully, reset failure counter", "info", "CostrictHealthCheck")
				this.healthCheckFailureCount = 0
			} catch (restartError) {
				const restartErrorMessage =
					restartError instanceof Error
						? restartError.message
						: "Unknown error occurred while restarting client"
				this.log(restartErrorMessage, "error", "CostrictHealthCheck")
			}
		} else {
			this.log(
				`Health check failure count: ${this.healthCheckFailureCount}/${this.MAX_FAILURE_COUNT}`,
				"info",
				"CostrictHealthCheck",
			)
		}
	}
}

// Export singleton instance
export const zgsmCodebaseIndexManager = ZgsmCodebaseIndexManager.getInstance()

// Export interfaces and types
export type {
	DownloadProgress,
	DownloadResult,
	CodebaseIndexClientConfig,
	VersionId,
	VersionInfo,
	PlatformResponse,
	PackageInfoResponse,
	WorkspaceEventRequest,
	IndexBuildRequest,
	IgnoreFilesRequest,
	IndexStatusResponse,
	IndexSwitchRequest,
	ApiResponse,
	RequestHeaders,
	WorkspaceEventType,
	WorkspaceEventData,
	IndexStatusInfo,
} from "./types"

// Default export manager class
export default ZgsmCodebaseIndexManager

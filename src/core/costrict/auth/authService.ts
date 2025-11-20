import * as vscode from "vscode"
import { jwtDecode } from "jwt-decode"
import { ZgsmAuthStorage } from "./authStorage"
import { ZgsmAuthApi } from "./authApi"
import { ZgsmAuthConfig } from "./authConfig"
import type { ProviderSettings, ZgsmUserInfo } from "@roo-code/types"
import type { ClineProvider } from "../../webview/ClineProvider"
import { getParams, retryWrapper } from "../../../utils/zgsmUtils"
import { joinUrl } from "../../../utils/joinUrl"
import { ZgsmAuthStatus, ZgsmAuthTokens, ZgsmLoginState, LoginTokenResponse } from "./types"
import { generateNewSessionClientId, getClientId } from "../../../utils/getClientId"
import { sendZgsmLogout } from "./ipc/client"
import { CompletionStatusBar } from "../completion"
import { t } from "../../../i18n"

let _loginState = ""

export class ZgsmAuthService {
	private static instance: ZgsmAuthService
	private static hasStatusBarLoginTip = false
	private static clineProvider: ClineProvider

	private loginStateTmp: ZgsmLoginState | undefined
	private waitLoginPollingInterval?: NodeJS.Timeout
	private tokenRefreshInterval?: NodeJS.Timeout
	private startLoginTokenPollInterval?: NodeJS.Timeout
	private disposed = false
	private userInfo = {} as ZgsmUserInfo

	public static setProvider(clineProvider: ClineProvider): void {
		ZgsmAuthService.clineProvider = clineProvider
	}

	public static getInstance(): ZgsmAuthService {
		if (!ZgsmAuthService.instance) {
			if (!ZgsmAuthService.clineProvider) {
				throw new Error("ZgsmAuthService not initialized")
			}

			ZgsmAuthService.instance = new ZgsmAuthService()
		}
		return ZgsmAuthService.instance
	}

	/**
	 * Resets the singleton instance for testing purposes.
	 * @internal
	 */
	public static _resetForTesting(): void {
		ZgsmAuthService.instance = undefined!
	}

	/**
	 * Get API configuration
	 */
	private async getApiConfiguration(): Promise<ProviderSettings> {
		if (ZgsmAuthService.clineProvider) {
			try {
				const state = await ZgsmAuthService.clineProvider.getState()
				return state.apiConfiguration
			} catch (error) {
				console.error("Failed to get API configuration:", error)
			}
		}

		// Return default configuration
		return {
			apiProvider: "zgsm",
			apiKey: "",
			zgsmBaseUrl: ZgsmAuthConfig.getInstance().getDefaultLoginBaseUrl(),
		}
	}

	/**
	 * Start login process
	 */
	async startLogin(): Promise<ZgsmLoginState> {
		this.stopWaitLoginPolling()
		this.stopRefreshToken()
		this.stopStartLoginTokenPoll()
		// Generate new login state parameters
		this.loginStateTmp = this.generateLoginState()
		_loginState = this.loginStateTmp!.state
		// Build login URL
		const loginUrl = await this.buildLoginUrl(this.loginStateTmp)

		// Open login page in default browser
		await vscode.env.openExternal(vscode.Uri.parse(loginUrl))

		// Show notification
		const result = await this.getStartLoginTokenPoll(this.loginStateTmp!.state)
		this.startWaitLoginPolling(Object.assign(this.loginStateTmp, result.data))

		return this.loginStateTmp
	}

	getStartLoginTokenPoll(state: string): Promise<LoginTokenResponse> {
		return new Promise((resolve, reject) => {
			const maxAttempt = 60
			let attempt = 0
			// Clear previous timer
			this.stopStartLoginTokenPoll()

			if (this.disposed) {
				reject(new Error("AuthService has been disposed"))
				return
			}

			const run = async () => {
				if (_loginState !== state) {
					throw new Error(`Login state changed: ${_loginState} <-- ${state}`)
				}

				attempt++
				if (attempt > maxAttempt) {
					this.stopStartLoginTokenPoll()
					reject(new Error("Timeout getting login token"))
					return
				}

				ZgsmAuthApi.getInstance()
					.getRefreshUserToken("", this.getMachineId(), state)
					.then((result) => {
						if (result.data?.access_token && result.data?.refresh_token && result.data?.state === state) {
							this.stopStartLoginTokenPoll()
							resolve(result)
						} else {
							this.startLoginTokenPollInterval = setTimeout(run, 3000)
						}
					})
					.catch((error) => {
						console.error(`Attempt ${attempt} failed to get login token:`, error)
					})
			}

			run()
		})
	}

	/**
	 * Start polling login status
	 */
	private async startWaitLoginPolling(loginState: ZgsmLoginState & ZgsmAuthTokens): Promise<void> {
		const maxAttempt = 60
		let attempt = 0
		const pollLoginState = async () => {
			if (_loginState !== loginState.state) {
				throw new Error(`Login state changed: ${_loginState} <-- ${loginState.state}`)
			}

			try {
				const { data, success } = await retryWrapper(
					"pollLoginState",
					() => ZgsmAuthApi.getInstance().getUserLoginState(loginState.state, loginState.access_token),
					undefined,
					0,
				)

				if (
					success &&
					data?.state &&
					data.state === this.loginStateTmp?.state &&
					data?.status === ZgsmAuthStatus.LOGGED_IN
				) {
					// Login successful, save tokens
					await ZgsmAuthStorage.getInstance().saveTokens(loginState)
					// After successful login, save login status locally
					await ZgsmAuthStorage.getInstance().saveLoginState(loginState)
					// Stop polling
					this.stopWaitLoginPolling()

					// Start token refresh timer
					this.startTokenRefresh(
						loginState.refresh_token,
						loginState.machineId || getClientId(),
						loginState.state,
					)

					// Trigger login success event
					this.onLoginSuccess(loginState)
					return
				}
			} catch (error) {
				console.error("Failed to poll login status:", error)
			}

			if (++attempt > maxAttempt) {
				vscode.window.showInformationMessage("Login timeout!")
				return
			}

			// Set polling interval (check every 5 seconds)
			this.waitLoginPollingInterval = setTimeout(
				pollLoginState,
				ZgsmAuthConfig.getInstance().getWaitLoginPollingInterval(),
			)
		}

		// Execute immediately once
		await pollLoginState()
	}

	/**
	 * Stop polling
	 */
	private stopStartLoginTokenPoll(): void {
		if (this.startLoginTokenPollInterval) {
			clearInterval(this.startLoginTokenPollInterval)
			this.startLoginTokenPollInterval = undefined
		}
	}
	private stopWaitLoginPolling(): void {
		if (this.waitLoginPollingInterval) {
			clearTimeout(this.waitLoginPollingInterval)
			this.waitLoginPollingInterval = undefined
		}
	}

	private stopRefreshToken(): void {
		if (this.tokenRefreshInterval) {
			clearInterval(this.tokenRefreshInterval)
			this.tokenRefreshInterval = undefined
		}
	}

	/**
	 * Start token refresh timer
	 */
	startTokenRefresh(refreshToken: string, machineId: string, state: string): void {
		// Clear previous timer
		this.stopRefreshToken()
		if (this.disposed) return
		// Periodically refresh token
		this.tokenRefreshInterval = setInterval(
			async (refreshToken, machineId, state) => {
				try {
					await this.refreshToken(refreshToken, machineId, state)
				} catch (error) {
					console.error("Failed to auto-refresh token:", error)
					vscode.window.showErrorMessage("Token refresh failed, please login again")
				}
			},
			ZgsmAuthConfig.getInstance().getTokenRefreshInterval(refreshToken),
			refreshToken,
			machineId,
			state,
		)
	}

	/**
	 * Refresh token
	 */
	async refreshToken(refreshToken: string, machineId: string, state: string, auto = true): Promise<ZgsmAuthTokens> {
		try {
			const { success, data, message } = await retryWrapper("refreshToken", () =>
				ZgsmAuthApi.getInstance().getRefreshUserToken(refreshToken, machineId, state),
			)

			if (
				success &&
				data &&
				data.access_token &&
				data.refresh_token &&
				this.loginStateTmp?.state === data.state
			) {
				// Update saved tokens
				await ZgsmAuthStorage.getInstance().saveTokens(data)

				// Update refresh timer
				if (auto) {
					this.startTokenRefresh(data.refresh_token, machineId, state)
				}

				return data
			} else {
				throw new Error(`[${state}]` + (message || "Failed to refresh token"))
			}
		} catch (error) {
			console.error(`[${state}] Failed to refresh token`, error)
			throw error
		}
	}

	async getTokens() {
		return await ZgsmAuthStorage.getInstance().getTokens()
	}
	async saveTokens(tokens: ZgsmAuthTokens) {
		return await ZgsmAuthStorage.getInstance().saveTokens(tokens)
	}

	/**
	 * Check login status on plugin startup
	 */
	async checkLoginStatusOnStartup(): Promise<boolean> {
		try {
			const tokens = await ZgsmAuthStorage.getInstance().getTokens()

			if (!tokens?.access_token || !tokens?.refresh_token) {
				return false
			}

			const jwt = jwtDecode(tokens?.refresh_token) as any

			return jwt.exp * 1000 > Date.now()
		} catch (error) {
			console.error("Failed to check login status on startup:", error)
			return false
		}
	}

	/**
	 * Get current token
	 */
	async getCurrentAccessToken(): Promise<string | null> {
		const tokens = await ZgsmAuthStorage.getInstance().getTokens()
		return tokens?.access_token || null
	}

	/**
	 * Logout
	 */
	async logout(auto = false): Promise<void> {
		// Stop all timers
		this.stopStartLoginTokenPoll()
		this.stopWaitLoginPolling()
		this.stopRefreshToken()

		if (!auto) {
			// Trigger logout event
			await this.onLogout()
		}
		// Clear stored login information
		await ZgsmAuthStorage.getInstance().clearAllLoginState()
		if (!auto) {
			sendZgsmLogout(generateNewSessionClientId())
		}
	}

	/**
	 * Generate login state parameters
	 */
	private generateLoginState(): ZgsmLoginState {
		return {
			state: this.generateRandomString(),
			machineId: this.getMachineId(),
		}
	}

	/**
	 * Build login URL
	 */
	private async buildLoginUrl(loginState: ZgsmLoginState): Promise<string> {
		const apiConfig = await this.getApiConfiguration()
		const baseUrl = this.getLoginBaseUrl(apiConfig)
		const params = getParams(loginState.state, [])

		return `${joinUrl(baseUrl, [ZgsmAuthApi.getInstance().loginUrl])}?${params.map((p) => p.join("=")).join("&")}`
	}

	/**
	 * Get login base URL
	 */
	private getLoginBaseUrl(apiConfig: ProviderSettings): string {
		// Prefer using baseUrl from apiConfiguration
		const baseUrl = apiConfig.zgsmBaseUrl?.trim()
		if (baseUrl) {
			return baseUrl
		}

		// Use default URL
		return ZgsmAuthConfig.getInstance().getDefaultLoginBaseUrl()
	}

	/**
	 * Generate random string
	 */
	private generateRandomString(): string {
		return Math.random().toString(36).substring(2) + Date.now().toString(36)
	}

	/**
	 * Get machine ID
	 */
	private getMachineId(): string {
		// Use VSCode's machine ID or generate a unique identifier
		return getClientId()
	}

	/**
	 * Login success callback
	 */
	protected onLoginSuccess(tokens: ZgsmAuthTokens): void {
		this.updateUserInfo(tokens.refresh_token)
		vscode.window.showInformationMessage(`${this.userInfo.name} user logged in successfully`)
		ZgsmAuthService.clineProvider?.postMessageToWebview?.({ type: "zgsmLogined" })
		CompletionStatusBar.complete()
		CompletionStatusBar.resetCommand()
	}

	updateUserInfo(token: string) {
		const jwt = jwtDecode(token) as any

		this.userInfo = {
			id: jwt.universal_id,
			name: jwt?.properties?.oauth_GitHub_username || jwt.id,
			picture: jwt.avatar,
			email: jwt.email,
			phone: jwt.phone,
		}
	}

	getUserInfo() {
		return this.userInfo
	}

	/**
	 * Logout callback
	 */
	protected async onLogout() {
		const state = await ZgsmAuthStorage.getInstance().getLoginState()
		const tokens = await ZgsmAuthStorage.getInstance().getTokens()
		// Can add post-logout logic here
		await retryWrapper(
			"onLogout",
			() => ZgsmAuthApi.getInstance().logoutUser(state?.state || tokens?.state, tokens?.access_token),
			undefined,
			1,
		)
	}

	static async openStatusBarLoginTip(
		opt: {
			cb?: () => void
			errorTitle?: string
			btnText?: string
		} = {},
	) {
		if (this.hasStatusBarLoginTip) return
		this.hasStatusBarLoginTip = true

		const reLoginText = opt?.btnText || "Login"

		vscode.window
			.showWarningMessage(opt?.errorTitle || t("common:window.error.login_for_full_features"), reLoginText)
			.then(async (selection) => {
				this.hasStatusBarLoginTip = false
				if (selection !== reLoginText) {
					opt?.cb?.()
					return
				}

				opt?.cb?.()
				ZgsmAuthService?.instance?.startLogin()
			})
	}

	/**
	 * Dispose service
	 */
	dispose(): void {
		this.disposed = true
		this.stopStartLoginTokenPoll()
		this.stopWaitLoginPolling()
		this.stopRefreshToken()
	}
}

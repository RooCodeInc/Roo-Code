import * as vscode from "vscode"
import { ZgsmAuthService } from "./authService"
import type { ClineProvider } from "../../webview/ClineProvider"
import { getCommand } from "../../../utils/commands"

export class ZgsmAuthCommands {
	private static instance: ZgsmAuthCommands
	private static clineProvider: ClineProvider

	public static setProvider(clineProvider: ClineProvider): void {
		ZgsmAuthCommands.clineProvider = clineProvider
	}

	public static getInstance(): ZgsmAuthCommands {
		if (!ZgsmAuthCommands.instance) {
			if (!ZgsmAuthCommands.clineProvider) {
				// In a real application, initialize should have been called.
				throw new Error("ZgsmAuthCommands not initialized")
			}
			// Initialize dependent services first
			ZgsmAuthCommands.instance = new ZgsmAuthCommands()
		}

		return ZgsmAuthCommands.instance!
	}

	/**
	 * Set ClineProvider instance
	 */
	setProvider(clineProvider: ClineProvider): void {
		ZgsmAuthCommands.clineProvider = clineProvider
	}

	/**
	 * Register all authentication-related commands
	 */
	registerCommands(context: vscode.ExtensionContext): void {
		// Login command
		const loginCommand = vscode.commands.registerCommand(getCommand("login"), async () => {
			await this.handleLogin()
		})

		// Logout command
		const logoutCommand = vscode.commands.registerCommand(getCommand("logout"), async () => {
			await this.handleLogout()
		})

		// Check login status command
		const checkStatusCommand = vscode.commands.registerCommand(getCommand("checkLoginStatus"), async () => {
			await this.handleCheckLoginStatus()
		})

		// Refresh token command
		const refreshTokenCommand = vscode.commands.registerCommand(getCommand("refreshToken"), async () => {
			await this.handleRefreshToken()
		})

		// Add commands to context
		context.subscriptions.push(loginCommand, logoutCommand, checkStatusCommand, refreshTokenCommand)
	}

	/**
	 * Handle login command
	 */
	public async handleLogin(): Promise<void> {
		try {
			const loginState = await ZgsmAuthService.getInstance()?.startLogin()
			console.info(
				`Login process has started, please complete login in the browser.\nState: ${loginState.state}\nMachineId: ${loginState.machineId}`,
			)
		} catch (error) {
			vscode.window.showErrorMessage(`${error}`)
		}
	}

	/**
	 * Handle logout command
	 */
	public async handleLogout(): Promise<void> {
		try {
			await ZgsmAuthService.getInstance()?.logout()
			vscode.window.showInformationMessage("Successfully logged out")
		} catch (error) {
			vscode.window.showErrorMessage(`Logout failed: ${error}`)
		}
	}

	/**
	 * Handle check login status command
	 */
	private async handleCheckLoginStatus(): Promise<void> {
		try {
			const token = await ZgsmAuthService.getInstance()?.getCurrentAccessToken()

			if (token) {
				vscode.window.showInformationMessage("Currently logged in")
			} else {
				vscode.window.showInformationMessage("Currently not logged in")
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to check login status: ${error}`)
		}
	}

	/**
	 * Handle refresh token command
	 */
	private async handleRefreshToken(): Promise<void> {
		try {
			vscode.window.showInformationMessage("Refreshing token...")

			// Need to get refresh_token and loginState from storage here
			// For simplicity, just show a message here
			vscode.window.showInformationMessage("Token refresh function has been triggered")
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to refresh token: ${error}`)
		}
	}

	/**
	 * Get authentication service instance
	 */
	// getAuthService(): ZgsmAuthService {
	getAuthService() {
		// return this.authService
	}

	/**
	 * Dispose command handler
	 */
	dispose(): void {
		// this.authService.dispose()
	}
}

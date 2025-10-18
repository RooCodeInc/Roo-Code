import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"

/**
 * Checks if the current environment is running inside a Dev Container
 * @returns true if running in a Dev Container, false otherwise
 */
export function isRunningInDevContainer(): boolean {
	// Check for common Dev Container environment variables
	if (process.env.REMOTE_CONTAINERS || process.env.CODESPACES || process.env.DEVCONTAINER) {
		return true
	}

	// Check if running in a container by looking for .dockerenv file
	try {
		const dockerEnvPath = "/.dockerenv"
		fsSync.accessSync(dockerEnvPath, fsSync.constants.F_OK)
		return true
	} catch {
		// File doesn't exist, not in Docker container
	}

	// Check VSCode's remote name for devcontainer
	const remoteName = vscode.env.remoteName
	if (remoteName && remoteName.toLowerCase().includes("container")) {
		return true
	}

	return false
}

/**
 * Gets the recommended persistent storage path for Dev Containers
 * This should be a path that persists across container rebuilds
 * @returns Recommended storage path or null if not applicable
 */
export async function getDevContainerPersistentPath(): Promise<string | null> {
	if (!isRunningInDevContainer()) {
		return null
	}

	// Check for workspace folder that might be mounted from host
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (workspaceFolders && workspaceFolders.length > 0) {
		const workspaceRoot = workspaceFolders[0].uri.fsPath

		// Try common persistent mount points in Dev Containers
		const possiblePaths = [
			path.join(workspaceRoot, ".roo-data"), // Within workspace (persists if workspace is mounted)
			"/workspaces/.roo-data", // Common devcontainer workspace mount
			"/home/vscode/.roo-data", // User home in standard devcontainer
			"/root/.roo-data", // Root user home
		]

		for (const testPath of possiblePaths) {
			try {
				// Test if we can create and access this directory
				await fs.mkdir(testPath, { recursive: true })
				await fs.access(testPath, fs.constants.R_OK | fs.constants.W_OK)
				return testPath
			} catch {
				// This path is not suitable, try next
				continue
			}
		}
	}

	return null
}

/**
 * Checks if the storage path will be lost on container rebuild
 * @param storagePath The current storage path
 * @returns true if the path is ephemeral (will be lost on rebuild)
 */
export function isEphemeralStoragePath(storagePath: string): boolean {
	if (!isRunningInDevContainer()) {
		return false
	}

	// Common ephemeral paths in containers
	const ephemeralPaths = [
		"/tmp",
		"/var/tmp",
		"/dev/shm",
		"/.vscode-server",
		"/.vscode-remote",
		"/.vscode-server-insiders",
	]

	const normalizedPath = path.normalize(storagePath).toLowerCase()

	return ephemeralPaths.some(
		(ephemeral) =>
			normalizedPath.startsWith(ephemeral.toLowerCase()) ||
			normalizedPath.includes("/.vscode") ||
			normalizedPath.includes("/vscode-") ||
			normalizedPath.includes("/tmp/") ||
			normalizedPath.includes("/temp/"),
	)
}

/**
 * Shows a notification to the user about Dev Container storage configuration
 * @param context The extension context
 */
export async function notifyDevContainerStorageSetup(context: vscode.ExtensionContext): Promise<void> {
	const currentStoragePath = context.globalStorageUri.fsPath

	if (!isRunningInDevContainer() || !isEphemeralStoragePath(currentStoragePath)) {
		return
	}

	const recommendedPath = await getDevContainerPersistentPath()
	if (!recommendedPath) {
		return
	}

	const message =
		"You're using Roo Code in a Dev Container. Your task history may be lost when the container is rebuilt. Would you like to configure a persistent storage path?"

	const choice = await vscode.window.showWarningMessage(
		message,
		"Configure Now",
		"Remind Me Later",
		"Don't Show Again",
	)

	if (choice === "Configure Now") {
		// Set the recommended path
		const config = vscode.workspace.getConfiguration("roo-code")
		await config.update("customStoragePath", recommendedPath, vscode.ConfigurationTarget.Global)

		vscode.window.showInformationMessage(
			`Storage path set to: ${recommendedPath}. Your task history will now persist across container rebuilds.`,
		)
	} else if (choice === "Don't Show Again") {
		// Store a flag to not show this again
		await context.globalState.update("devContainerStorageNotificationDismissed", true)
	}
}

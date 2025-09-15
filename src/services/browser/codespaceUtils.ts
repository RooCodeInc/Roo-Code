import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

/**
 * Detects if we're running in a GitHub Codespaces environment
 */
export function isCodespacesEnvironment(): boolean {
	return process.env.CODESPACES === "true" || process.env.GITHUB_CODESPACE_TOKEN !== undefined
}

/**
 * Attempts to fix missing browser dependencies in Codespaces
 * by running `sudo apt --fix-broken install`
 */
export async function fixCodespaceDependencies(): Promise<boolean> {
	if (!isCodespacesEnvironment()) {
		return false
	}

	console.log("Detected Codespaces environment. Attempting to fix missing browser dependencies...")

	try {
		// Run the fix command as suggested by the user
		const { stdout, stderr } = await execAsync("sudo apt --fix-broken install -y", {
			timeout: 60000, // 60 second timeout
		})

		if (stderr && !stderr.includes("0 upgraded, 0 newly installed")) {
			console.log("apt --fix-broken install stderr:", stderr)
		}

		console.log("Successfully ran apt --fix-broken install")

		// Also ensure chromium is installed
		const { stdout: chromiumCheck } = await execAsync(
			"which chromium-browser || which chromium || which google-chrome",
			{
				timeout: 5000,
			},
		).catch(() => ({ stdout: "" }))

		if (!chromiumCheck.trim()) {
			console.log("Chromium not found, attempting to install...")
			await execAsync("sudo apt-get update && sudo apt-get install -y chromium-browser", {
				timeout: 120000, // 2 minute timeout for installation
			})
			console.log("Chromium installation completed")
		}

		return true
	} catch (error) {
		console.error("Failed to fix Codespace dependencies:", error)
		return false
	}
}

/**
 * Checks if the error is related to missing browser dependencies
 */
export function isMissingDependencyError(error: any): boolean {
	const errorString = error?.toString() || ""
	const errorMessage = error?.message || ""

	const dependencyPatterns = [
		"libatk-1.0.so.0",
		"libatk-bridge",
		"libatspi",
		"libcups",
		"libdbus",
		"libdrm",
		"libgbm",
		"libgtk",
		"libnspr",
		"libnss",
		"libx11-xcb",
		"libxcomposite",
		"libxdamage",
		"libxfixes",
		"libxkbcommon",
		"libxrandr",
		"cannot open shared object file",
		"error while loading shared libraries",
		"Failed to launch the browser process",
		"No such file or directory",
	]

	const combinedError = `${errorString} ${errorMessage}`.toLowerCase()
	return dependencyPatterns.some((pattern) => combinedError.includes(pattern.toLowerCase()))
}

/**
 * Serve script for Roo Code extension development
 *
 * This script builds the extension as a vsix, installs it into code-server,
 * and launches code-server for web-based VS Code testing.
 *
 * Prerequisites:
 *   brew install code-server
 *
 * Usage:
 *   pnpm serve                    # Build, install, and start code-server on port 9080
 *   pnpm serve -- --port 8080     # Use a custom port
 *   pnpm serve:rebuild            # Only rebuild and reinstall the extension
 *
 * The script will:
 *   1. Check if code-server is installed
 *   2. Build the vsix (pnpm vsix)
 *   3. Install the vsix into code-server
 *   4. Configure user settings (disable welcome tab)
 *   5. Start code-server on http://127.0.0.1:9080 (unless --rebuild-only)
 *
 * Your password is stored in ~/.config/code-server/config.yaml
 */

const { execSync, spawn } = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const RED = "\x1b[31m"

// Build vsix to a fixed path in temp directory
const VSIX_PATH = path.join(os.tmpdir(), "roo-code-serve.vsix")

// Parse command line flags
const rebuildOnly = process.argv.includes("--rebuild-only")

// Parse --port argument (default: 9080)
const DEFAULT_PORT = 9080
function getPort() {
	const portIndex = process.argv.indexOf("--port")
	if (portIndex !== -1 && process.argv[portIndex + 1]) {
		const port = parseInt(process.argv[portIndex + 1], 10)
		if (!isNaN(port) && port > 0 && port < 65536) {
			return port
		}
	}
	return DEFAULT_PORT
}
const port = getPort()

function log(message) {
	console.log(`${CYAN}[serve]${RESET} ${message}`)
}

function logSuccess(message) {
	console.log(`${GREEN}✓${RESET} ${message}`)
}

function logWarning(message) {
	console.log(`${YELLOW}⚠${RESET} ${message}`)
}

function logError(message) {
	console.error(`${RED}✗${RESET} ${message}`)
}

function isCodeServerInstalled() {
	try {
		execSync("which code-server", { stdio: "pipe" })
		return true
	} catch {
		return false
	}
}

function ensureUserSettings() {
	// code-server stores user data in ~/.local/share/code-server
	const userDataDir = path.join(process.env.HOME || process.env.USERPROFILE, ".local", "share", "code-server", "User")
	const settingsFile = path.join(userDataDir, "settings.json")

	// Create directory if it doesn't exist
	if (!fs.existsSync(userDataDir)) {
		fs.mkdirSync(userDataDir, { recursive: true })
	}

	// Read existing settings or start fresh
	let settings = {}
	if (fs.existsSync(settingsFile)) {
		try {
			settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"))
		} catch {
			// If parsing fails, start fresh
		}
	}

	// Set the startup editor to none (disables welcome tab)
	settings["workbench.startupEditor"] = "none"

	// Hide the secondary sidebar (auxiliary bar)
	settings["workbench.auxiliaryBar.visible"] = false

	// Disable extension recommendations prompts
	settings["extensions.ignoreRecommendations"] = true

	fs.writeFileSync(settingsFile, JSON.stringify(settings, null, "\t"))
}

async function main() {
	const title = rebuildOnly ? "Roo Code - Rebuild Extension" : "Roo Code - code-server Development Server"
	console.log(`\n${BOLD}🚀 ${title}${RESET}\n`)

	// Step 1: Check if code-server is installed
	log("Checking for code-server...")
	if (!isCodeServerInstalled()) {
		logError("code-server is not installed")
		console.log("\nTo install code-server on macOS:")
		console.log(`  ${CYAN}brew install code-server${RESET}`)
		console.log("\nFor other platforms, see: https://coder.com/docs/code-server/install")
		process.exit(1)
	}
	logSuccess("code-server found")

	// Step 2: Build vsix to temp directory
	log(`Building vsix to ${VSIX_PATH}...`)
	try {
		execSync(`pnpm vsix -- --out "${VSIX_PATH}"`, { stdio: "inherit" })
		logSuccess("Build complete")
	} catch (error) {
		logError("Build failed")
		process.exit(1)
	}

	// Step 3: Install extension into code-server
	log("Installing extension into code-server...")
	try {
		execSync(`code-server --install-extension "${VSIX_PATH}"`, { stdio: "inherit" })
		logSuccess("Extension installed")
	} catch (error) {
		logWarning("Extension installation had warnings (this is usually fine)")
	}

	// Step 4: Configure user settings to disable welcome tab
	log("Configuring user settings...")
	ensureUserSettings()
	logSuccess("User settings configured (welcome tab disabled)")

	// If rebuild-only mode, exit here
	if (rebuildOnly) {
		console.log(`\n${GREEN}✓ Extension rebuilt and installed.${RESET}`)
		console.log(`  Reload the code-server window to pick up changes.`)
		console.log(`  (Cmd+Shift+P → "Developer: Reload Window")\n`)
		return
	}

	// Step 5: Start code-server
	const cwd = process.cwd()
	console.log(`\n${BOLD}Starting code-server...${RESET}`)
	console.log(`  Working directory: ${cwd}`)
	console.log(`  URL: ${CYAN}http://127.0.0.1:${port}${RESET}`)
	console.log(`  Password: ${YELLOW}~/.config/code-server/config.yaml${RESET}`)
	console.log(`\n  Press ${BOLD}Ctrl+C${RESET} to stop\n`)

	// Spawn code-server with:
	// --disable-workspace-trust: Skip workspace trust prompts
	// --disable-getting-started-override: Disable welcome/getting started page
	// -e: Ignore last opened directory (start fresh)
	const codeServer = spawn(
		"code-server",
		[
			"--bind-addr",
			`127.0.0.1:${port}`,
			"--disable-workspace-trust",
			"--disable-getting-started-override",
			"-e",
			cwd,
		],
		{
			stdio: "inherit",
			cwd: cwd,
		},
	)

	codeServer.on("error", (err) => {
		logError(`Failed to start code-server: ${err.message}`)
		process.exit(1)
	})

	codeServer.on("close", (code) => {
		if (code !== 0 && code !== null) {
			logError(`code-server exited with code ${code}`)
		}
	})

	// Handle Ctrl+C gracefully
	process.on("SIGINT", () => {
		console.log("\n")
		log("Shutting down code-server...")
		codeServer.kill("SIGTERM")
	})
}

main().catch((error) => {
	logError(error.message)
	process.exit(1)
})

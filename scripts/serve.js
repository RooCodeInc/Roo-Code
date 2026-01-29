/**
 * Serve script for Roo Code extension development
 *
 * Usage:
 *   pnpm serve:install            # Build and install the extension into code-server
 *   pnpm serve                    # Start code-server on port 9080
 *   pnpm serve -- --port 8080     # Use a custom port
 *   pnpm serve -- --host 0.0.0.0  # Bind to all interfaces (for Docker/remote access)
 *   pnpm serve -- --auth none     # Disable authentication (password|none)
 *
 * After making code changes, run `pnpm serve:install` again and reload the window
 * (Cmd+Shift+P → "Developer: Reload Window")
 */

const { execSync, spawn } = require("child_process")
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
const installOnly = process.argv.includes("--install-only")

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

// Parse --host argument (default: 127.0.0.1, use 0.0.0.0 for Docker/remote access)
const DEFAULT_HOST = "127.0.0.1"
function getHost() {
	const hostIndex = process.argv.indexOf("--host")
	if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
		return process.argv[hostIndex + 1]
	}
	return DEFAULT_HOST
}
const host = getHost()

// Parse --auth argument (optional, passed to code-server: "password" or "none")
function getAuth() {
	const authIndex = process.argv.indexOf("--auth")
	if (authIndex !== -1 && process.argv[authIndex + 1]) {
		return process.argv[authIndex + 1]
	}
	return null
}
const auth = getAuth()

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

async function main() {
	// If install-only mode, just build and install the extension
	if (installOnly) {
		console.log(`\n${BOLD}🔧 Roo Code - Install Extension${RESET}\n`)

		// Build vsix to temp directory
		log(`Building vsix to ${VSIX_PATH}...`)
		try {
			execSync(`pnpm vsix -- --out "${VSIX_PATH}"`, { stdio: "inherit" })
			logSuccess("Build complete")
		} catch (error) {
			logError("Build failed")
			process.exit(1)
		}

		// Install extension into code-server
		log("Installing extension into code-server...")
		try {
			execSync(`code-server --install-extension "${VSIX_PATH}"`, { stdio: "inherit" })
			logSuccess("Extension installed")
		} catch (error) {
			logWarning("Extension installation had warnings (this is usually fine)")
		}

		console.log(`\n${GREEN}✓ Extension built and installed.${RESET}`)
		console.log(`  If code-server is running, reload the window to pick up changes.`)
		console.log(`  (Cmd+Shift+P → "Developer: Reload Window")\n`)
		return
	}

	// Default: Start code-server
	log("Checking for code-server...")
	if (!isCodeServerInstalled()) {
		logError("code-server is not installed")
		console.log("\nTo install code-server on macOS:")
		console.log(`  ${CYAN}brew install code-server${RESET}`)
		console.log("\nFor other platforms, see: https://coder.com/docs/code-server/install")
		process.exit(1)
	}
	logSuccess("code-server found")

	console.log(`\n${BOLD}🚀 Roo Code - code-server Development Server${RESET}\n`)
	const cwd = process.cwd()
	console.log(`\n${BOLD}Starting code-server...${RESET}`)
	console.log(`  Working directory: ${cwd}`)
	console.log(`  URL: ${CYAN}http://${host}:${port}${RESET}`)
	if (auth === "none") {
		console.log(`  Auth: ${YELLOW}disabled${RESET}`)
	} else {
		console.log(`  Password: ${YELLOW}~/.config/code-server/config.yaml${RESET}`)
	}
	console.log(`\n  Press ${BOLD}Ctrl+C${RESET} to stop\n`)

	// Spawn code-server with:
	// --bind-addr: Address to bind to
	// --auth: Authentication type (password or none)
	// --disable-workspace-trust: Skip workspace trust prompts
	// --disable-getting-started-override: Disable welcome/getting started page
	// -e: Ignore last opened directory (start fresh)
	const args = ["--bind-addr", `${host}:${port}`]
	if (auth) {
		args.push("--auth", auth)
	}
	args.push("--disable-workspace-trust", "--disable-getting-started-override", "-e", cwd)

	const codeServer = spawn("code-server", args, {
		stdio: "inherit",
		cwd: cwd,
	})

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

import * as vscode from "vscode"
import { userInfo } from "os"
import { terminalUnsupportedSyntax } from "./shellConstants"
import fs from "fs"
import * as path from "path"
import { exec } from "child_process"
import { promisify } from "util"

// Security: Allowlist of approved shell executables to prevent arbitrary command execution
const SHELL_ALLOWLIST = new Set<string>([
	// Windows PowerShell variants
	"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
	"C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	"C:\\Program Files\\PowerShell\\6\\pwsh.exe",
	"C:\\Program Files\\PowerShell\\5\\pwsh.exe",

	// Windows Command Prompt
	"C:\\Windows\\System32\\cmd.exe",

	// Windows WSL
	"C:\\Windows\\System32\\wsl.exe",
	"wsl.exe",

	// Git Bash on Windows
	"C:\\Program Files\\Git\\bin\\bash.exe",
	"C:\\Program Files\\Git\\usr\\bin\\bash.exe",
	"C:\\Program Files (x86)\\Git\\bin\\bash.exe",
	"C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",

	// MSYS2/MinGW/Cygwin on Windows
	"C:\\msys64\\usr\\bin\\bash.exe",
	"C:\\msys32\\usr\\bin\\bash.exe",
	"C:\\MinGW\\msys\\1.0\\bin\\bash.exe",
	"C:\\cygwin64\\bin\\bash.exe",
	"C:\\cygwin\\bin\\bash.exe",

	// Unix/Linux/macOS - Bourne-compatible shells
	"/bin/sh",
	"/usr/bin/sh",
	"/bin/bash",
	"/usr/bin/bash",
	"/usr/local/bin/bash",
	"/opt/homebrew/bin/bash",
	"/opt/local/bin/bash",

	// Z Shell
	"/bin/zsh",
	"/usr/bin/zsh",
	"/usr/local/bin/zsh",
	"/opt/homebrew/bin/zsh",
	"/opt/local/bin/zsh",

	// Dash
	"/bin/dash",
	"/usr/bin/dash",

	// Ash
	"/bin/ash",
	"/usr/bin/ash",

	// C Shells
	"/bin/csh",
	"/usr/bin/csh",
	"/bin/tcsh",
	"/usr/bin/tcsh",
	"/usr/local/bin/tcsh",

	// Korn Shells
	"/bin/ksh",
	"/usr/bin/ksh",
	"/bin/ksh93",
	"/usr/bin/ksh93",
	"/bin/mksh",
	"/usr/bin/mksh",
	"/bin/pdksh",
	"/usr/bin/pdksh",

	// Fish Shell
	"/usr/bin/fish",
	"/usr/local/bin/fish",
	"/opt/homebrew/bin/fish",
	"/opt/local/bin/fish",

	// Modern shells
	"/usr/bin/elvish",
	"/usr/local/bin/elvish",
	"/usr/bin/xonsh",
	"/usr/local/bin/xonsh",
	"/usr/bin/nu",
	"/usr/local/bin/nu",
	"/usr/bin/nushell",
	"/usr/local/bin/nushell",
	"/usr/bin/ion",
	"/usr/local/bin/ion",

	// BusyBox
	"/bin/busybox",
	"/usr/bin/busybox",
])

export const SHELL_PATHS = {
	// Windows paths
	POWERSHELL_7: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
	POWERSHELL_LEGACY: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
	CMD: "C:\\Windows\\System32\\cmd.exe",
	GITBASH: "C:\\Program Files\\Git\\bin\\bash.exe",
	WSL_BASH: "/bin/bash",
	// Unix paths
	MAC_DEFAULT: "/bin/zsh",
	LINUX_DEFAULT: "/bin/bash",
	CSH: "/bin/csh",
	BASH: "/bin/bash",
	KSH: "/bin/ksh",
	SH: "/bin/sh",
	ZSH: "/bin/zsh",
	DASH: "/bin/dash",
	TCSH: "/bin/tcsh",
	FALLBACK: "/bin/sh",
} as const

interface MacTerminalProfile {
	path?: string | string[]
}

type MacTerminalProfiles = Record<string, MacTerminalProfile>

interface WindowsTerminalProfile {
	path?: string | string[]
	source?: "PowerShell" | "WSL"
}

type WindowsTerminalProfiles = Record<string, WindowsTerminalProfile>

interface LinuxTerminalProfile {
	path?: string | string[]
}

type LinuxTerminalProfiles = Record<string, LinuxTerminalProfile>

// -----------------------------------------------------
// 1) VS Code Terminal Configuration Helpers
// -----------------------------------------------------

function getWindowsTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.windows")
		const profiles = config.get<WindowsTerminalProfiles>("profiles.windows") || {}
		return {
			defaultProfileName,
			profiles,
		}
	} catch {
		return {
			defaultProfileName: null,
			profiles: {} as WindowsTerminalProfiles,
		}
	}
}

function getMacTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.osx")
		const profiles = config.get<MacTerminalProfiles>("profiles.osx") || {}
		return { defaultProfileName, profiles }
	} catch {
		return { defaultProfileName: null, profiles: {} as MacTerminalProfiles }
	}
}

function getLinuxTerminalConfig() {
	try {
		const config = vscode.workspace.getConfiguration("terminal.integrated")
		const defaultProfileName = config.get<string>("defaultProfile.linux")
		const profiles = config.get<LinuxTerminalProfiles>("profiles.linux") || {}
		return { defaultProfileName, profiles }
	} catch {
		return { defaultProfileName: null, profiles: {} as LinuxTerminalProfiles }
	}
}

// -----------------------------------------------------
// 2) Platform-Specific VS Code Shell Retrieval
// -----------------------------------------------------

/**
 * Normalizes a path that can be either a string or an array of strings.
 * If it's an array, returns the first element. Otherwise returns the string.
 */
function normalizeShellPath(path: string | string[] | undefined): string | null {
	if (!path) return null
	if (Array.isArray(path)) {
		return path.length > 0 ? path[0] : null
	}
	return path
}

/** Attempts to retrieve a shell path from VS Code config on Windows. */
function getWindowsShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getWindowsTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]

	// If the profile name indicates PowerShell, do version-based detection.
	// In testing it was found these typically do not have a path, and this
	// implementation manages to deductively get the correct version of PowerShell
	if (defaultProfileName.toLowerCase().includes("powershell")) {
		const normalizedPath = normalizeShellPath(profile?.path)
		if (normalizedPath) {
			// If there's an explicit PowerShell path, return that
			return normalizedPath
		} else if (profile?.source === "PowerShell" && profile?.path) {
			// If the profile is sourced from PowerShell, assume the newest
			return SHELL_PATHS.POWERSHELL_7
		}
		// For all other PowerShell cases, use intelligent detection
		return getPowerShellPathFromVSCodeAPI()
	}

	// If there's a specific path, return that immediately
	const normalizedPath = normalizeShellPath(profile?.path)
	if (normalizedPath) {
		return normalizedPath
	}

	// If the profile indicates WSL
	if (profile?.source === "WSL" || defaultProfileName.toLowerCase().includes("wsl")) {
		return SHELL_PATHS.WSL_BASH
	}

	// If the profile indicates Git Bash
	if (defaultProfileName.toLowerCase().includes("bash")) {
		return SHELL_PATHS.GITBASH
	}

	// If nothing special detected, we assume cmd
	return SHELL_PATHS.CMD
}

/**
 * Gets the actual PowerShell path using VS Code API and system detection.
 * This function attempts to detect the actual PowerShell version installed
 * on the system rather than making assumptions based on configuration.
 */
function getPowerShellPathFromVSCodeAPI(): string {
	try {
		// First, try to get shell information from VS Code's terminal service
		const terminals = vscode.window.terminals
		if (terminals && terminals.length > 0) {
			// Look for an existing PowerShell terminal to get its actual path
			for (const terminal of terminals) {
				if (terminal.name.toLowerCase().includes("powershell")) {
					// Try to get the actual shell path from the terminal's creation options
					// Note: This is a best-effort approach as VS Code API doesn't directly expose this
					const terminalOptions = (terminal as any).creationOptions
					if (terminalOptions && terminalOptions.shellPath) {
						return terminalOptions.shellPath
					}
				}
			}
		}

		// If no existing terminals found, fall back to system detection
		return detectActualPowerShellVersion()
	} catch (error) {
		console.warn("[getPowerShellPathFromVSCodeAPI] Failed to get PowerShell path from VS Code API:", error)
		// Fall back to conservative detection
		return detectActualPowerShellVersion()
	}
}

/**
 * Detects the actual PowerShell version installed on the system.
 * This function checks for PowerShell 7 first, then falls back to PowerShell 5.
 */
function detectActualPowerShellVersion(): string {
	// Check if PowerShell 7 is installed
	const ps7Path = SHELL_PATHS.POWERSHELL_7
	try {
		if (fs.existsSync(ps7Path)) {
			// Verify it's actually executable by checking if it's a file
			const stats = fs.statSync(ps7Path)
			if (stats.isFile()) {
				return ps7Path
			}
		}
	} catch (error) {
		// Ignore file system errors and continue to fallback
		console.debug("[detectActualPowerShellVersion] PowerShell 7 not accessible:", error)
	}

	// Fall back to PowerShell 5 (legacy) - always available on Windows 10/11
	const ps5Path = SHELL_PATHS.POWERSHELL_LEGACY
	try {
		if (fs.existsSync(ps5Path)) {
			const stats = fs.statSync(ps5Path)
			if (stats.isFile()) {
				return ps5Path
			}
		}
	} catch (error) {
		console.debug("[detectActualPowerShellVersion] PowerShell 5 not accessible:", error)
	}

	// Ultimate fallback - use COMSPEC (cmd.exe)
	console.warn("[detectActualPowerShellVersion] No PowerShell found, falling back to cmd.exe")
	return process.env.COMSPEC || SHELL_PATHS.CMD
}

/** Attempts to retrieve a shell path from VS Code config on macOS. */
function getMacShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getMacTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]
	return normalizeShellPath(profile?.path)
}

/** Attempts to retrieve a shell path from VS Code config on Linux. */
function getLinuxShellFromVSCode(): string | null {
	const { defaultProfileName, profiles } = getLinuxTerminalConfig()
	if (!defaultProfileName) {
		return null
	}

	const profile = profiles[defaultProfileName]
	return normalizeShellPath(profile?.path)
}

// -----------------------------------------------------
// 3) General Fallback Helpers
// -----------------------------------------------------

/**
 * Tries to get a user’s shell from os.userInfo() (works on Unix if the
 * underlying system call is supported). Returns null on error or if not found.
 */
function getShellFromUserInfo(): string | null {
	try {
		const { shell } = userInfo()
		return shell || null
	} catch {
		return null
	}
}

/** Returns the environment-based shell variable, or null if not set. */
function getShellFromEnv(): string | null {
	const { env } = process

	if (process.platform === "win32") {
		// On Windows, COMSPEC typically holds cmd.exe
		return env.COMSPEC || "C:\\Windows\\System32\\cmd.exe"
	}

	if (process.platform === "darwin") {
		// On macOS/Linux, SHELL is commonly the environment variable
		return env.SHELL || "/bin/zsh"
	}

	if (process.platform === "linux") {
		// On Linux, SHELL is commonly the environment variable
		return env.SHELL || "/bin/bash"
	}
	return null
}

// -----------------------------------------------------
// 4) Shell Validation Functions
// -----------------------------------------------------

/**
 * Validates if a shell path is in the allowlist to prevent arbitrary command execution
 */
function isShellAllowed(shellPath: string): boolean {
	if (!shellPath) return false

	const normalizedPath = path.normalize(shellPath)

	// Direct lookup first
	if (SHELL_ALLOWLIST.has(normalizedPath)) {
		return true
	}

	// On Windows, try case-insensitive comparison
	if (process.platform === "win32") {
		const lowerPath = normalizedPath.toLowerCase()
		for (const allowedPath of SHELL_ALLOWLIST) {
			if (allowedPath.toLowerCase() === lowerPath) {
				return true
			}
		}
	}

	return false
}

/**
 * Returns a safe fallback shell based on the platform
 */
function getSafeFallbackShell(): string {
	if (process.platform === "win32") {
		return SHELL_PATHS.CMD
	} else if (process.platform === "darwin") {
		return SHELL_PATHS.MAC_DEFAULT
	} else {
		return SHELL_PATHS.LINUX_DEFAULT
	}
}

// -----------------------------------------------------
// 5) Publicly Exposed Shell Getter
// -----------------------------------------------------

/**
 * Gets the system shell path
 *
 * Detects shell in the following priority order:
 * 1. VSCode configuration (platform-specific)
 * 2. os.userInfo()
 * 3. System detection (detectSystemAvailableShell)
 * 4. Environment variables (SHELL/COMSPEC)
 * 5. Platform default values
 *
 * @returns Detected shell executable path
 */
export function getShell(): string {
	let shell: string | null = null

	// 1. Check VS Code config first.
	if (process.platform === "win32") {
		// Special logic for Windows
		shell = getWindowsShellFromVSCode()
	} else if (process.platform === "darwin") {
		// macOS from VS Code
		shell = getMacShellFromVSCode()
	} else if (process.platform === "linux") {
		// Linux from VS Code
		shell = getLinuxShellFromVSCode()
	}

	// 2. If no shell from VS Code, try userInfo()
	if (!shell) {
		shell = getShellFromUserInfo()
	}

	if (!shell) {
		shell = detectSystemAvailableShell()
	}

	// 3. If still nothing, try environment variable
	if (!shell) {
		shell = getShellFromEnv()
	}

	// 4. Finally, fall back to a default
	if (!shell) {
		shell = getSafeFallbackShell()
	}

	// 5. Validate the shell against allowlist
	if (!isShellAllowed(shell)) {
		shell = getSafeFallbackShell()
	}

	return shell
}

/**
 * Detects the shell type that VSCode would choose when no default shell is configured.
 * Mimics VSCode's default shell selection logic.
 * @returns The shell path that VSCode would default to, or null if unable to detect
 */
function detectSystemAvailableShell(): string | null {
	if (process.platform === "win32") {
		return detectWindowsVSCodeDefaultShell()
	} else if (process.platform === "darwin") {
		return detectMacVSCodeDefaultShell()
	} else if (process.platform === "linux") {
		return detectLinuxVSCodeDefaultShell()
	}
	return null
}

/**
 * Detects VSCode's default shell on Windows platform.
 * VSCode priority on Windows: PowerShell > CMD
 */
function detectWindowsVSCodeDefaultShell(): string | null {
	// VSCode on Windows prefers PowerShell 7, then PowerShell 5, finally CMD
	try {
		if (fs.existsSync(SHELL_PATHS.POWERSHELL_7)) {
			const stats = fs.statSync(SHELL_PATHS.POWERSHELL_7)
			if (stats.isFile()) {
				return SHELL_PATHS.POWERSHELL_7
			}
		}
	} catch (error) {
		console.debug("[detectWindowsVSCodeDefaultShell] PowerShell 7 detection failed:", error)
	}

	try {
		if (fs.existsSync(SHELL_PATHS.POWERSHELL_LEGACY)) {
			const stats = fs.statSync(SHELL_PATHS.POWERSHELL_LEGACY)
			if (stats.isFile()) {
				return SHELL_PATHS.POWERSHELL_LEGACY
			}
		}
	} catch (error) {
		console.debug("[detectWindowsVSCodeDefaultShell] PowerShell 5 detection failed:", error)
	}

	// Final fallback to CMD (VSCode can always find CMD)
	return process.env.COMSPEC || SHELL_PATHS.CMD
}

/**
 * Detects VSCode's default shell on macOS platform.
 * VSCode on macOS uses the system default shell (usually zsh)
 */
function detectMacVSCodeDefaultShell(): string | null {
	// VSCode on macOS uses the system default shell
	// macOS Catalina (10.15) and later default to zsh
	try {
		if (fs.existsSync(SHELL_PATHS.ZSH)) {
			const stats = fs.statSync(SHELL_PATHS.ZSH)
			if (stats.isFile()) {
				return SHELL_PATHS.ZSH
			}
		}
	} catch (error) {
		console.debug("[detectMacVSCodeDefaultShell] zsh detection failed:", error)
	}

	// Fallback to bash (older macOS versions)
	try {
		if (fs.existsSync(SHELL_PATHS.BASH)) {
			const stats = fs.statSync(SHELL_PATHS.BASH)
			if (stats.isFile()) {
				return SHELL_PATHS.BASH
			}
		}
	} catch (error) {
		console.debug("[detectMacVSCodeDefaultShell] bash detection failed:", error)
	}

	// Use environment variable SHELL or default value
	return process.env.SHELL || SHELL_PATHS.MAC_DEFAULT
}

/**
 * Detects VSCode's default shell on Linux platform.
 * VSCode on Linux uses the system default shell (usually bash)
 */
function detectLinuxVSCodeDefaultShell(): string | null {
	// VSCode on Linux uses the system default shell
	// Most Linux distributions default to bash
	try {
		if (fs.existsSync(SHELL_PATHS.BASH)) {
			const stats = fs.statSync(SHELL_PATHS.BASH)
			if (stats.isFile()) {
				return SHELL_PATHS.BASH
			}
		}
	} catch (error) {
		console.debug("[detectLinuxVSCodeDefaultShell] bash detection failed:", error)
	}

	// Check other common bash locations
	try {
		const altBashPath = "/usr/bin/bash"
		if (fs.existsSync(altBashPath)) {
			const stats = fs.statSync(altBashPath)
			if (stats.isFile()) {
				return altBashPath
			}
		}
	} catch (error) {
		console.debug("[detectLinuxVSCodeDefaultShell] /usr/bin/bash detection failed:", error)
	}

	// Use environment variable SHELL or default value
	return process.env.SHELL || SHELL_PATHS.LINUX_DEFAULT
}

/**
 * Gets the available system shell type.
 * Simplified version that directly calls system detection.
 * @returns Detected shell path, or null if unable to detect
 */
export function getActiveTerminalShellType(): string | null {
	return detectSystemAvailableShell()
}

interface TerminalUnsupportedSyntax {
	unsupported?: string[]
	features?: string[]
}

export interface TerminalInfo {
	name: string
	version: string
	path: string
	unsupportSyntax?: string[]
	features?: string[]
}

const execAsync = promisify(exec)

/**
 * Get PowerShell version information by executing command
 * @param shellPath PowerShell path
 * @returns Version string or null
 */
async function getPowerShellVersion(shellPath: string): Promise<string | null> {
	try {
		// Execute PowerShell command to get version information
		const { stdout } = await execAsync(`"${shellPath}" -Command "$PSVersionTable"`)
		const getPSVersion = (str: string) => str.replace(/\\x1b\[[0-9;]*m/g, "").match(/PSVersion\s+([0-9.]+)/)
		const versionMatch = getPSVersion(stdout)
		if (versionMatch) {
			const major = versionMatch[1]
			// Try to get more detailed version information
			try {
				const { stdout: detailStdout } = await execAsync(
					`"${shellPath}" -Command "$PSVersionTable.PSVersion.ToString()"`,
				)
				return detailStdout.trim()
			} catch {
				return major
			}
		}
		return null
	} catch (error) {
		console.debug("[getPowerShellVersion] Failed to get PowerShell version:", error)
		return null
	}
}

/**
 * Get Git Bash version information by executing command
 */
export async function getGitBashVersion(): Promise<{ path: string; version: string } | { version: null }> {
	async function getBashPathsFromWhere(): Promise<string[]> {
		try {
			const { stdout } = await execAsync("where bash")
			return stdout
				.split(/\r?\n/)
				.map((p) => p.trim())
				.filter(Boolean)
		} catch {
			return []
		}
	}

	async function getBashPathFromRegistry(): Promise<string | null> {
		try {
			const { stdout } = await execAsync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\GitForWindows" /v InstallPath')
			const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/)
			if (match) {
				return `${match[1]}\\bin\\bash.exe`
			}
		} catch {}
		return null
	}

	const fallbackPaths = [
		"C:\\Program Files\\Git\\bin\\bash.exe",
		"C:\\Program Files (x86)\\Git\\bin\\bash.exe",
		"C:\\Program Files\\Git\\usr\\bin\\bash.exe",
	]

	const paths = new Set<string>()

	for (const p of await getBashPathsFromWhere()) paths.add(p)
	const regPath = await getBashPathFromRegistry()
	if (regPath) paths.add(regPath)
	for (const p of fallbackPaths) paths.add(p)

	const validCandidates: { path: string; version: string }[] = []

	for (const path of paths) {
		try {
			const { stdout } = await execAsync(`"${path}" --version`)
			const versionMatch = stdout.match(/version\s+([\d.]+)/i)
			if (versionMatch) {
				validCandidates.push({ path, version: versionMatch[1] })
			}
		} catch {
			continue
		}
	}

	if (validCandidates.length === 0) {
		console.debug("[getGitBashVersion] No valid Git Bash found.")
		return { version: null }
	}

	// Prioritize the "Git for Windows" version
	const preferred = validCandidates.find((c) => c.path.toLowerCase().includes("program files\\git"))
	return preferred || validCandidates[0]
}

/**
 * Get CMD version information by executing command
 * @param shellPath CMD path
 * @returns Version string or null
 */
async function getCMDVersion(shellPath: string): Promise<string | null> {
	try {
		// Execute ver command to get Windows version information
		const { stdout } = await execAsync(`cmd /c ver`)
		const versionMatch = stdout.match(/([\d.]+)/)
		if (versionMatch) {
			return versionMatch[1]
		}
		return null
	} catch (error) {
		console.debug("[getCMDVersion] Failed to get CMD version:", error)
		return null
	}
}

/**
 * Get terminal name and version information on Windows operating system
 * The retrieval logic is consistent with getShell, but returns terminal name and version information
 * Get accurate version information by executing commands
 *
 * @returns Terminal information object containing name, version and path
 */
export async function getWindowsTerminalInfo(): Promise<TerminalInfo | null> {
	if (process.platform !== "win32") {
		return null
	}

	const shellPath = getShell()

	// Determine terminal name and version based on path
	if (shellPath.toLowerCase().includes("pwsh.exe")) {
		// PowerShell 7+
		const version = await getPowerShellVersion(shellPath)
		return {
			name: "PowerShell",
			version: version || "Unknown",
			path: shellPath,
			unsupportSyntax: terminalUnsupportedSyntax.powershell7.unsupported,
			features: terminalUnsupportedSyntax.powershell7.features,
		}
	} else if (shellPath.toLowerCase().includes("powershell.exe")) {
		// Windows PowerShell (5.1 and earlier versions)
		const version = await getPowerShellVersion(shellPath)
		return {
			name: "Windows PowerShell",
			version: version || "5.1",
			path: shellPath,
			unsupportSyntax: terminalUnsupportedSyntax.powershell5.unsupported,
			features: terminalUnsupportedSyntax.powershell5.features,
		}
	} else if (shellPath.toLowerCase().includes("cmd.exe")) {
		// Command Prompt
		const version = await getCMDVersion(shellPath)
		return {
			name: "Command Prompt",
			version: version || "Built-in",
			path: shellPath,
			unsupportSyntax: terminalUnsupportedSyntax.cmd.unsupported,
		}
	} else if (shellPath.toLowerCase().includes("bash.exe")) {
		// Git Bash, MSYS2, MinGW, Cygwin, etc.
		if (shellPath.toLowerCase().includes("git")) {
			const { version } = await getGitBashVersion()
			return {
				name: "Git Bash",
				version: version || "Unknown",
				path: shellPath,
				unsupportSyntax: terminalUnsupportedSyntax.gitBash.unsupported,
				features: terminalUnsupportedSyntax.gitBash.features,
			}
		} else if (shellPath.toLowerCase().includes("msys64")) {
			const { version } = await getGitBashVersion()
			return {
				name: "MSYS2",
				version: version || "64-bit",
				path: shellPath,
			}
		} else if (shellPath.toLowerCase().includes("msys32")) {
			const { version } = await getGitBashVersion()
			return {
				name: "MSYS2",
				version: version || "32-bit",
				path: shellPath,
			}
		} else if (shellPath.toLowerCase().includes("mingw")) {
			const { version } = await getGitBashVersion()
			return {
				name: "MinGW",
				version: version || "Unknown",
				path: shellPath,
			}
		} else if (shellPath.toLowerCase().includes("cygwin")) {
			const { version } = await getGitBashVersion()
			return {
				name: "Cygwin",
				version: version || "Unknown",
				path: shellPath,
			}
		} else {
			const { version } = await getGitBashVersion()
			return {
				name: "Bash",
				version: version || "Unknown",
				path: shellPath,
			}
		}
	} else {
		// Unknown terminal
		return {
			name: "Unknown Terminal",
			version: "Unknown",
			path: shellPath,
		}
	}
}

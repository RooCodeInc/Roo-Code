import * as fs from "fs"
import * as os from "os"

/**
 * Detects if the current environment is running under Windows Subsystem for Linux (WSL)
 * @returns true if running in WSL, false otherwise
 */
export function isWSL(): boolean {
	// WSL is only possible on Linux platform
	if (os.platform() !== "linux") {
		return false
	}

	// Method 1: Check for WSL-specific environment variable
	if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
		return true
	}

	// Method 2: Check /proc/version for Microsoft or WSL keywords
	try {
		const procVersion = fs.readFileSync("/proc/version", "utf8").toLowerCase()
		if (procVersion.includes("microsoft") || procVersion.includes("wsl")) {
			return true
		}
	} catch (error) {
		// File doesn't exist or can't be read, continue to next check
	}

	// Method 3: Check /proc/sys/kernel/osrelease
	try {
		const osRelease = fs.readFileSync("/proc/sys/kernel/osrelease", "utf8").toLowerCase()
		if (osRelease.includes("microsoft") || osRelease.includes("wsl")) {
			return true
		}
	} catch (error) {
		// File doesn't exist or can't be read
	}

	return false
}

/**
 * Gets the WSL version (1 or 2) if running under WSL
 * @returns WSL version number, or null if not running in WSL
 */
export function getWSLVersion(): 1 | 2 | null {
	if (!isWSL()) {
		return null
	}

	// WSL2 uses a real Linux kernel with version info
	// WSL1 uses a compatibility layer
	try {
		const procVersion = fs.readFileSync("/proc/version", "utf8")
		// WSL2 typically shows "WSL2" in proc version or has a higher kernel version
		if (procVersion.includes("WSL2")) {
			return 2
		}
		// Check for kernel version - WSL2 uses 4.x or higher
		const kernelMatch = procVersion.match(/Linux version (\d+)\./)
		if (kernelMatch && parseInt(kernelMatch[1], 10) >= 4) {
			return 2
		}
		return 1
	} catch (error) {
		// If we can't determine version, assume WSL2 (more common)
		return 2
	}
}

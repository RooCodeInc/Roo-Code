import fs from "fs/promises"
import { constants as fsConstants } from "fs"
import path from "path"

export type TerminalShellValidationResult =
	| {
			valid: true
			shellPath: string
	  }
	| {
			valid: false
			reason: string
	  }

export async function validateTerminalShellPath(rawShellPath: string): Promise<TerminalShellValidationResult> {
	const shellPath = rawShellPath.trim()

	if (!shellPath) {
		return { valid: false, reason: "shell path cannot be empty" }
	}

	if (!path.isAbsolute(shellPath)) {
		return { valid: false, reason: "shell path must be absolute" }
	}

	try {
		const stats = await fs.stat(shellPath)

		if (!stats.isFile()) {
			return { valid: false, reason: "shell path must point to a file" }
		}

		if (process.platform !== "win32") {
			await fs.access(shellPath, fsConstants.X_OK)
		}
	} catch {
		return {
			valid: false,
			reason:
				process.platform === "win32"
					? "shell path does not exist or is not a file"
					: "shell path does not exist, is not a file, or is not executable",
		}
	}

	return { valid: true, shellPath }
}

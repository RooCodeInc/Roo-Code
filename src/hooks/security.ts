/**
 * Security middleware for command classification and HITL (Human-In-The-Loop).
 *
 * This module analyzes commands before execution and determines:
 * - Risk level (safe, medium, high, critical)
 * - Whether human approval is required
 * - Suggested mitigations or safer alternatives
 *
 * Use cases:
 * - Prevent accidental destructive commands
 * - Enforce security policies in production environments
 * - Audit command execution for compliance
 */

import type { CommandClassification } from "./types"

/**
 * Classifies a shell command by risk level.
 *
 * @param command - The shell command to classify
 * @param context - Additional context (cwd, environment, etc.)
 * @returns Classification with risk level and approval requirement
 *
 * @example
 * const classification = classifyCommand("rm -rf /", { cwd: "/" })
 * if (classification.requiresApproval) {
 *   const approved = await askUserApproval(classification)
 * }
 */
export function classifyCommand(
	command: string,
	context?: { cwd?: string; env?: Record<string, string> },
): CommandClassification {
	// TODO: Implementation for Phase 1
	// Risk patterns to detect:
	// - File deletion (rm, del, Remove-Item)
	// - System modification (sudo, chmod, chown)
	// - Network operations (curl, wget with -O)
	// - Package installation (npm install, pip install)
	// - Database operations (DROP, DELETE without WHERE)

	// For now, return a safe classification
	return {
		command,
		riskLevel: "safe",
		requiresApproval: false,
		reason: "Command classification not yet implemented",
	}
}

/**
 * Checks if a command matches a dangerous pattern.
 *
 * @param command - The command to check
 * @returns true if the command is potentially dangerous
 *
 * @example
 * if (isDangerousCommand("rm -rf /")) {
 *   console.warn("Dangerous command detected!")
 * }
 */
export function isDangerousCommand(command: string): boolean {
	// TODO: Implementation for Phase 1
	// Patterns to check:
	// - rm -rf (especially with /, /*, or no path)
	// - dd if=/dev/zero
	// - chmod 777
	// - eval() or exec() with user input
	// - curl | sh (pipe to shell)

	const dangerousPatterns = [
		/rm\s+-rf\s+(\/|\*|\.\.)/i,
		/dd\s+if=\/dev\/(zero|random)/i,
		/chmod\s+777/i,
		/>\s*\/dev\/sd[a-z]/i,
		/\|\s*sh$/i,
		/\|\s*bash$/i,
	]

	return dangerousPatterns.some((pattern) => pattern.test(command))
}

/**
 * Suggests a safer alternative for a risky command.
 *
 * @param command - The risky command
 * @returns Suggested safer alternative, or null if none available
 *
 * @example
 * const safer = suggestSaferAlternative("rm -rf /tmp/*")
 * // Returns: "rm -rf /tmp/specific-directory"
 */
export function suggestSaferAlternative(command: string): string | null {
	// TODO: Implementation for Phase 1
	// Suggestions:
	// - rm -rf → Suggest specific paths instead of wildcards
	// - chmod 777 → Suggest 755 or 644
	// - curl | sh → Suggest downloading first, then reviewing

	return null
}

/**
 * Checks if a file path operation is safe.
 *
 * @param path - File path to check
 * @param operation - Operation type (read, write, delete)
 * @param cwd - Current working directory
 * @returns Classification result
 *
 * @example
 * const classification = classifyFileOperation("/etc/passwd", "write", "/home/user")
 * if (classification.requiresApproval) {
 *   // Request user approval
 * }
 */
export function classifyFileOperation(
	path: string,
	operation: "read" | "write" | "delete",
	cwd: string,
): CommandClassification {
	// TODO: Implementation for Phase 1
	// Risk factors:
	// - System directories (/etc, /bin, /usr/bin, etc.)
	// - Hidden files (.git, .env, .ssh)
	// - Files outside workspace
	// - Known sensitive files (id_rsa, .aws/credentials)

	return {
		command: `${operation} ${path}`,
		riskLevel: "safe",
		requiresApproval: false,
		reason: "File operation classification not yet implemented",
	}
}

/**
 * Checks if a path is outside the workspace (potential security risk).
 *
 * @param path - Path to check
 * @param cwd - Workspace root directory
 * @returns true if the path is outside the workspace
 *
 * @example
 * if (isPathOutsideWorkspace("/etc/passwd", "/home/user/project")) {
 *   console.warn("Attempting to access file outside workspace!")
 * }
 */
export function isPathOutsideWorkspace(path: string, cwd: string): boolean {
	// TODO: Implementation for Phase 1
	// Normalize paths and check if resolved path starts with cwd

	return false
}

/**
 * Checks if a file path is sensitive (should require approval).
 *
 * @param path - File path to check
 * @returns true if the path is sensitive
 *
 * @example
 * if (isSensitiveFile(".env")) {
 *   console.warn("Accessing sensitive configuration file!")
 * }
 */
export function isSensitiveFile(path: string): boolean {
	// TODO: Implementation for Phase 1
	// Sensitive patterns:
	// - .env, .env.local, .env.production
	// - .aws/credentials, .ssh/id_rsa
	// - package-lock.json, pnpm-lock.yaml (for writes)
	// - .git/config

	const sensitivePatterns = [
		/\.env(\.|$)/i,
		/\.ssh\/(id_rsa|id_ed25519)/i,
		/\.aws\/credentials/i,
		/\.git\/config/i,
		/node_modules/i,
	]

	return sensitivePatterns.some((pattern) => pattern.test(path))
}

/**
 * Enforces security policy for a tool execution.
 *
 * @param toolName - Name of the tool being executed
 * @param params - Tool parameters
 * @returns true if execution should be allowed, false otherwise
 *
 * @example
 * if (!enforceSecurityPolicy("execute_command", { command: "rm -rf /" })) {
 *   throw new Error("Command blocked by security policy")
 * }
 */
export function enforceSecurityPolicy(toolName: string, params: Record<string, unknown>): boolean {
	// TODO: Implementation for Phase 1
	// Policy checks:
	// - Check if tool is allowed in current mode
	// - Check if params match security rules
	// - Check rate limits (prevent spam)

	return true
}

/**
 * Generates a human-readable explanation of why a command is risky.
 *
 * @param classification - Command classification result
 * @returns Explanation string
 *
 * @example
 * const classification = classifyCommand("rm -rf /")
 * const explanation = explainRisk(classification)
 * // Returns: "This command will recursively delete all files from root..."
 */
export function explainRisk(classification: CommandClassification): string {
	// TODO: Implementation for Phase 1

	switch (classification.riskLevel) {
		case "critical":
			return `⛔ CRITICAL: ${classification.reason}. This could cause data loss or system damage.`
		case "high":
			return `⚠️ HIGH RISK: ${classification.reason}. Proceed with caution.`
		case "medium":
			return `⚡ MEDIUM RISK: ${classification.reason}. Review before executing.`
		case "safe":
		default:
			return `✅ Safe: ${classification.reason}`
	}
}

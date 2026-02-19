/**
 * PostToolHook.ts — Phase 2: Post-Edit Automation
 *
 * Implements PostToolUse hooks that fire AFTER a tool has successfully
 * executed. The primary Phase 2 responsibility is:
 *
 *   Post-Edit Formatting: Automatically run Prettier/linter on any file
 *   modified by the agent, and feed errors back for self-correction.
 *
 * Architecture:
 *   Tool executes successfully → PostToolHook fires →
 *     1. Detect modified file path from tool params
 *     2. Run code formatter (Prettier) on the file
 *     3. Run linter (ESLint) on the file
 *     4. If errors → append to message context for self-correction
 *     5. If clean → log success
 *
 * The post-hook does NOT block execution. It runs after the tool has
 * already completed. However, if formatting/linting produces errors,
 * these are returned as supplementary context that the HookEngine
 * appends to the next tool_result.
 *
 * @see HookEngine.ts — orchestrates post-hook execution
 * @see TRP1 Challenge Week 1, Phase 2: Post-Edit Formatting
 * @see Research Paper, Phase 2: Post-Edit Formatting
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

// ── Post-Hook Result ─────────────────────────────────────────────────────

export interface PostHookResult {
	/** Whether the post-hook produced supplementary feedback */
	hasErrors: boolean

	/** Formatted feedback string to append to the tool_result context */
	feedback: string | null

	/** The file that was processed */
	filePath: string | null
}

// ── File-Modifying Tool Detection ────────────────────────────────────────

/** Tools that modify files and should trigger post-edit processing */
const FILE_MODIFYING_TOOLS: ReadonlySet<string> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
])

// ── PostToolHook ─────────────────────────────────────────────────────────

export class PostToolHook {
	/**
	 * Execute post-tool hooks after a tool has completed.
	 *
	 * Currently implements:
	 *   1. Post-edit formatting (Prettier + ESLint)
	 *
	 * Returns supplementary feedback if errors/warnings are detected.
	 *
	 * @param toolName - The tool that just executed
	 * @param params   - The tool parameters (to extract file path)
	 * @param cwd      - Workspace root path
	 * @returns PostHookResult with optional error feedback
	 */
	static async execute(toolName: string, params: Record<string, unknown>, cwd: string): Promise<PostHookResult> {
		// Only process file-modifying tools
		if (!FILE_MODIFYING_TOOLS.has(toolName)) {
			return { hasErrors: false, feedback: null, filePath: null }
		}

		// Extract the target file path
		const filePath = PostToolHook.extractFilePath(toolName, params)
		if (!filePath) {
			return { hasErrors: false, feedback: null, filePath: null }
		}

		// Resolve to absolute path
		const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)

		// Check if file exists (it should, since the tool just wrote to it)
		if (!fs.existsSync(absolutePath)) {
			return { hasErrors: false, feedback: null, filePath }
		}

		// Determine file extension for formatter/linter selection
		const ext = path.extname(absolutePath).toLowerCase()
		const isFormattable = [
			".ts",
			".tsx",
			".js",
			".jsx",
			".json",
			".css",
			".scss",
			".md",
			".html",
			".yaml",
			".yml",
		].includes(ext)

		if (!isFormattable) {
			return { hasErrors: false, feedback: null, filePath }
		}

		const feedbackParts: string[] = []
		let hasErrors = false

		// 1. Run Prettier (auto-format)
		const prettierResult = await PostToolHook.runPrettier(absolutePath, cwd)
		if (prettierResult.error) {
			hasErrors = true
			feedbackParts.push(`[Prettier Error] ${prettierResult.error}`)
		} else if (prettierResult.formatted) {
			feedbackParts.push(`[Prettier] File auto-formatted: ${filePath}`)
		}

		// 2. Run ESLint (for TS/JS files only)
		const isLintable = [".ts", ".tsx", ".js", ".jsx"].includes(ext)
		if (isLintable) {
			const lintResult = await PostToolHook.runLinter(absolutePath, cwd)
			if (lintResult.errors.length > 0) {
				hasErrors = true
				feedbackParts.push(
					`[ESLint Errors] ${lintResult.errors.length} issue(s) found in ${filePath}:\n` +
						lintResult.errors.map((e) => `  Line ${e.line}: ${e.message}`).join("\n"),
				)
			}
		}

		if (feedbackParts.length === 0) {
			return { hasErrors: false, feedback: null, filePath }
		}

		const feedback = `<post_edit_feedback>\n${feedbackParts.join("\n\n")}\n</post_edit_feedback>`

		return { hasErrors, feedback, filePath }
	}

	// ── Private Helpers ──────────────────────────────────────────────────

	/**
	 * Extract the target file path from tool parameters.
	 */
	private static extractFilePath(toolName: string, params: Record<string, unknown>): string | null {
		const pathKeys = ["path", "file_path", "filePath", "target_file", "file"]

		for (const key of pathKeys) {
			if (params[key] && typeof params[key] === "string") {
				return params[key]
			}
		}

		return null
	}

	/**
	 * Run Prettier on a file. Uses npx prettier --write to auto-format.
	 * Captures stderr for error reporting.
	 *
	 * @param filePath - Absolute path to the file
	 * @param cwd      - Workspace root (for resolving prettier config)
	 * @returns { formatted: boolean, error: string | null }
	 */
	private static async runPrettier(
		filePath: string,
		cwd: string,
	): Promise<{ formatted: boolean; error: string | null }> {
		try {
			// Check if prettier is available in the project
			const prettierPath = PostToolHook.findBinary("prettier", cwd)
			if (!prettierPath) {
				// Prettier not installed — skip silently
				return { formatted: false, error: null }
			}

			// Read file before formatting to detect changes
			const contentBefore = fs.readFileSync(filePath, "utf-8")

			// Run prettier --write
			await execAsync(`"${prettierPath}" --write "${filePath}"`, {
				cwd,
				timeout: 10000, // 10s timeout
			})

			// Check if content changed
			const contentAfter = fs.readFileSync(filePath, "utf-8")
			const formatted = contentBefore !== contentAfter

			return { formatted, error: null }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			// Don't treat "prettier not found" as an error
			if (message.includes("ENOENT") || message.includes("not found") || message.includes("not recognized")) {
				return { formatted: false, error: null }
			}
			return { formatted: false, error: message.substring(0, 500) }
		}
	}

	/**
	 * Parse ESLint JSON output into structured error objects.
	 * Extracts only severity >= 2 (error-level) messages.
	 */
	private static parseEslintOutput(jsonString: string): Array<{ line: number; message: string }> {
		const results = JSON.parse(jsonString)
		const errors: Array<{ line: number; message: string }> = []

		if (!Array.isArray(results) || results.length === 0) {
			return errors
		}

		const fileResult = results[0]
		if (!fileResult.messages || !Array.isArray(fileResult.messages)) {
			return errors
		}

		for (const msg of fileResult.messages) {
			if (msg.severity >= 2) {
				errors.push({
					line: msg.line ?? 0,
					message: `[${msg.ruleId ?? "unknown"}] ${msg.message}`,
				})
			}
		}

		return errors
	}

	/**
	 * Run ESLint on a file and capture any errors/warnings.
	 *
	 * @param filePath - Absolute path to the file
	 * @param cwd      - Workspace root
	 * @returns { errors: Array<{ line: number, message: string }> }
	 */
	private static async runLinter(
		filePath: string,
		cwd: string,
	): Promise<{ errors: Array<{ line: number; message: string }> }> {
		try {
			const eslintPath = PostToolHook.findBinary("eslint", cwd)
			if (!eslintPath) {
				return { errors: [] }
			}

			const { stdout } = await execAsync(`"${eslintPath}" --format json --no-color "${filePath}"`, {
				cwd,
				timeout: 30000,
			})

			return { errors: PostToolHook.parseEslintOutput(stdout) }
		} catch (error) {
			const execError = error as { stdout?: string; message?: string }

			// ESLint exits with code 1 when it finds errors — parse stdout anyway
			if (execError.stdout) {
				try {
					return { errors: PostToolHook.parseEslintOutput(execError.stdout) }
				} catch {
					// JSON parse failed — skip
				}
			}

			// Don't treat missing eslint as an error
			const message = execError.message ?? ""
			if (message.includes("ENOENT") || message.includes("not found") || message.includes("not recognized")) {
				return { errors: [] }
			}

			return {
				errors: [{ line: 0, message: `ESLint execution error: ${message.substring(0, 300)}` }],
			}
		}
	}

	/**
	 * Find a binary (prettier, eslint) in node_modules/.bin or globally.
	 *
	 * @param name - Binary name ("prettier" or "eslint")
	 * @param cwd  - Workspace root
	 * @returns Path to the binary, or null if not found
	 */
	private static findBinary(name: string, cwd: string): string | null {
		// Check local node_modules/.bin first
		const isWindows = process.platform === "win32"
		const binExt = isWindows ? ".cmd" : ""
		const localBin = path.join(cwd, "node_modules", ".bin", `${name}${binExt}`)

		if (fs.existsSync(localBin)) {
			return localBin
		}

		// Check if the binary is available globally via PATH
		// We'll just return the name and let the shell resolve it
		return name
	}
}

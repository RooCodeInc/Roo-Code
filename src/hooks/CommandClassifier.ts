/**
 * CommandClassifier.ts — Phase 2: Command Risk Classification
 *
 * Inspects every PreToolUse JSON payload and classifies tool calls into
 * risk tiers:
 *
 *   - SAFE:        Read-only operations (read_file, list_files, search_files)
 *   - DESTRUCTIVE: Write/delete operations (write_to_file, apply_diff, etc.)
 *   - CRITICAL:    High-risk terminal commands (rm -rf, git push --force, etc.)
 *   - META:        Conversation control (ask_followup_question, attempt_completion)
 *
 * The classifier uses:
 *   1. Static tool-name mapping for known tools
 *   2. Regex pattern matching for execute_command payloads
 *   3. Configurable patterns for extensibility
 *
 * @see HookEngine.ts — consumes classification results
 * @see TRP1 Challenge Week 1, Phase 2: Command Classification
 * @see Research Paper, Phase 2: Command Classification
 */

// ── Risk Tier Enum ───────────────────────────────────────────────────────

export enum RiskTier {
	/** Read-only operations — no filesystem mutation */
	SAFE = "SAFE",

	/** Write/modify operations — require intent but auto-approvable */
	DESTRUCTIVE = "DESTRUCTIVE",

	/** High-risk terminal commands — always require human approval */
	CRITICAL = "CRITICAL",

	/** Conversation/meta tools — always allowed */
	META = "META",
}

// ── Classification Result ────────────────────────────────────────────────

export interface ClassificationResult {
	/** The assigned risk tier */
	tier: RiskTier

	/** Human-readable reason for classification */
	reason: string

	/** The specific pattern that matched (for CRITICAL commands) */
	matchedPattern?: string
}

// ── Critical Command Patterns ────────────────────────────────────────────

/**
 * Regex patterns that identify high-risk terminal commands.
 * These ALWAYS require human authorization regardless of auto-approval settings.
 *
 * Each pattern includes a human-readable label for the warning dialog.
 */
const CRITICAL_COMMAND_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
	// Destructive filesystem operations
	{ pattern: /\brm\s+(-[a-z]*r[a-z]*f|--recursive|--force)\b/i, label: "Recursive/forced file deletion (rm -rf)" },
	{ pattern: /\brm\s+-[a-z]*f/i, label: "Forced file deletion (rm -f)" },
	{ pattern: /\brmdir\b/i, label: "Directory removal (rmdir)" },
	{ pattern: /\bdel\s+\/s/i, label: "Recursive deletion (Windows del /s)" },
	{ pattern: /\brd\s+\/s/i, label: "Recursive directory removal (Windows rd /s)" },

	// Git push/force operations
	{ pattern: /\bgit\s+push\s+.*--force\b/i, label: "Force push (git push --force)" },
	{ pattern: /\bgit\s+push\s+-f\b/i, label: "Force push (git push -f)" },
	{ pattern: /\bgit\s+reset\s+--hard\b/i, label: "Hard reset (git reset --hard)" },
	{ pattern: /\bgit\s+clean\s+-[a-z]*f/i, label: "Git clean (removes untracked files)" },
	{ pattern: /\bgit\s+checkout\s+--\s+\./i, label: "Discard all changes (git checkout -- .)" },

	// Dangerous system operations
	{ pattern: /\bchmod\s+777\b/i, label: "World-writable permissions (chmod 777)" },
	{ pattern: /\bchown\s+-R\b/i, label: "Recursive ownership change (chown -R)" },
	{ pattern: /\bcurl\s+.*\|\s*(bash|sh)\b/i, label: "Pipe remote script to shell (curl | bash)" },
	{ pattern: /\bwget\s+.*\|\s*(bash|sh)\b/i, label: "Pipe remote script to shell (wget | bash)" },
	{ pattern: /\beval\s*\(/i, label: "Dynamic code execution (eval)" },

	// Database destructive operations
	{ pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, label: "Database DROP operation" },
	{ pattern: /\bTRUNCATE\s+TABLE\b/i, label: "Database TRUNCATE operation" },
	{ pattern: /\bDELETE\s+FROM\b(?!.*\bWHERE\b)/i, label: "DELETE without WHERE clause" },

	// Package/dependency operations
	{ pattern: /\bnpm\s+publish\b/i, label: "Publish package (npm publish)" },
	{ pattern: /\bnpx?\s+.*--yes\b/i, label: "Auto-confirm npx execution" },

	// Environment/config destruction
	{ pattern: /\b>\s*\/dev\/null\b/i, label: "Redirect to /dev/null" },
	{ pattern: /\bformat\s+[a-z]:\b/i, label: "Format drive (Windows)" },
	{ pattern: /\bmkfs\b/i, label: "Format filesystem (mkfs)" },
]

// ── Static Tool Classification Map ───────────────────────────────────────

/** Tools classified as SAFE (read-only) */
const SAFE_TOOLS: ReadonlySet<string> = new Set([
	"read_file",
	"list_files",
	"search_files",
	"codebase_search",
	"read_command_output",
])

/** Tools classified as DESTRUCTIVE (write/modify operations) */
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

/** Tools classified as META (conversation control) */
const META_TOOLS: ReadonlySet<string> = new Set([
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"update_todo_list",
	"run_slash_command",
	"skill",
	"select_active_intent",
])

// ── Classifier ───────────────────────────────────────────────────────────

export class CommandClassifier {
	/**
	 * Classify a tool call into a risk tier.
	 *
	 * Classification logic:
	 * 1. Check META tools first (always allowed)
	 * 2. Check SAFE tools (read-only)
	 * 3. For execute_command: scan command string against CRITICAL patterns
	 * 4. Check DESTRUCTIVE tools (write operations)
	 * 5. Default: treat unknown tools as DESTRUCTIVE (fail-safe)
	 *
	 * @param toolName - The canonical name of the tool
	 * @param params   - The tool parameters (needed for execute_command inspection)
	 * @returns ClassificationResult with tier, reason, and optional matched pattern
	 */
	static classify(toolName: string, params: Record<string, unknown>): ClassificationResult {
		// 1. META tools — always allowed
		if (META_TOOLS.has(toolName)) {
			return {
				tier: RiskTier.META,
				reason: `Tool "${toolName}" is a conversation/meta operation.`,
			}
		}

		// 2. SAFE tools — read-only
		if (SAFE_TOOLS.has(toolName)) {
			return {
				tier: RiskTier.SAFE,
				reason: `Tool "${toolName}" is a read-only operation.`,
			}
		}

		// 3. execute_command — inspect the command string for critical patterns
		if (toolName === "execute_command") {
			const command = (params.command as string) ?? ""
			return CommandClassifier.classifyCommand(command)
		}

		// 4. DESTRUCTIVE tools — file write/modify
		if (DESTRUCTIVE_TOOLS.has(toolName)) {
			return {
				tier: RiskTier.DESTRUCTIVE,
				reason: `Tool "${toolName}" modifies the filesystem.`,
			}
		}

		// 5. MCP tools — treat as DESTRUCTIVE by default (principle of least privilege)
		if (toolName.startsWith("mcp_") || toolName === "use_mcp_tool") {
			return {
				tier: RiskTier.DESTRUCTIVE,
				reason: `MCP tool "${toolName}" — classified as destructive by default.`,
			}
		}

		// 6. Unknown tools — fail-safe: treat as DESTRUCTIVE
		return {
			tier: RiskTier.DESTRUCTIVE,
			reason: `Unknown tool "${toolName}" — classified as destructive by default (fail-safe).`,
		}
	}

	/**
	 * Inspect a shell command string against the critical command patterns.
	 * Returns CRITICAL if any pattern matches, otherwise DESTRUCTIVE
	 * (since execute_command is inherently a mutating operation).
	 *
	 * @param command - The shell command string to inspect
	 * @returns ClassificationResult
	 */
	private static classifyCommand(command: string): ClassificationResult {
		for (const { pattern, label } of CRITICAL_COMMAND_PATTERNS) {
			if (pattern.test(command)) {
				return {
					tier: RiskTier.CRITICAL,
					reason: `Terminal command matches critical pattern: ${label}`,
					matchedPattern: label,
				}
			}
		}

		// execute_command is always at least DESTRUCTIVE
		return {
			tier: RiskTier.DESTRUCTIVE,
			reason: "Terminal command execution — no critical patterns detected.",
		}
	}

	/**
	 * Quick check: does this tool name represent a file-writing operation?
	 * Used by scope enforcement to determine if path checking is needed.
	 */
	static isFileWriteOperation(toolName: string): boolean {
		return DESTRUCTIVE_TOOLS.has(toolName)
	}
}

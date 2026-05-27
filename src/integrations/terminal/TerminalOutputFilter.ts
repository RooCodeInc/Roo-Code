/**
 * TerminalOutputFilter - Command-aware output filtering/compression for LLM context.
 *
 * Applies semantic filters to terminal command output before it reaches the LLM,
 * reducing token usage by stripping noise (passing tests, progress bars, verbose logs)
 * while preserving actionable information (errors, failures, summaries).
 *
 * Inspired by RTK (https://github.com/rtk-ai/rtk) which demonstrated ~89% token savings.
 *
 * @see https://github.com/RooCodeInc/Roo-Code/issues/11459
 */

/**
 * A filter rule that matches a command and transforms its output.
 */
export interface OutputFilterRule {
	/** Human-readable name for this filter */
	name: string
	/** Regex pattern to match against the command string */
	commandPattern: RegExp
	/** Transform the output for the matched command */
	filter: (output: string, command: string) => FilterResult
}

/**
 * Result of applying an output filter.
 */
export interface FilterResult {
	/** The filtered output text */
	output: string
	/** The name of the filter that was applied */
	filterName: string
	/** Number of lines in original output */
	originalLineCount: number
	/** Number of lines in filtered output */
	filteredLineCount: number
}

// ─── Built-in filter implementations ────────────────────────────────────────

/**
 * Filter for test runner output (jest, vitest, mocha, pytest, cargo test, go test, etc.)
 *
 * Extracts pass/fail summary and failure details, strips passing test lines,
 * progress indicators, and verbose formatting.
 */
function filterTestOutput(output: string, _command: string): FilterResult {
	const lines = output.split("\n")
	const originalLineCount = lines.length

	const summaryLines: string[] = []
	const failureLines: string[] = []
	let inFailureBlock = false
	let failureIndent = 0

	for (const line of lines) {
		const trimmed = line.trim()

		// Capture summary/result lines
		if (isTestSummaryLine(trimmed)) {
			summaryLines.push(line)
			inFailureBlock = false
			continue
		}

		// Detect start of failure block
		if (isTestFailureLine(trimmed)) {
			inFailureBlock = true
			failureIndent = line.length - line.trimStart().length
			failureLines.push(line)
			continue
		}

		// Continue capturing failure block content (indented continuation)
		if (inFailureBlock) {
			const currentIndent = line.length - line.trimStart().length
			if (trimmed === "" || currentIndent > failureIndent) {
				failureLines.push(line)
				continue
			}
			// End of failure block
			inFailureBlock = false
		}

		// Capture error/warning lines outside failure blocks
		if (isErrorLine(trimmed)) {
			failureLines.push(line)
			continue
		}
	}

	// Build filtered output
	const resultParts: string[] = []

	if (failureLines.length > 0) {
		resultParts.push("Failures:")
		resultParts.push(...failureLines)
		resultParts.push("")
	}

	if (summaryLines.length > 0) {
		resultParts.push("Summary:")
		resultParts.push(...summaryLines)
	}

	// If we couldn't extract meaningful summary info, return original
	if (resultParts.length === 0) {
		return {
			output,
			filterName: "test-runner",
			originalLineCount,
			filteredLineCount: originalLineCount,
		}
	}

	const filtered = resultParts.join("\n")
	return {
		output: filtered,
		filterName: "test-runner",
		originalLineCount,
		filteredLineCount: filtered.split("\n").length,
	}
}

/**
 * Filter for git status output.
 * Produces a compact summary of changes.
 */
function filterGitStatusOutput(output: string, _command: string): FilterResult {
	const lines = output.split("\n")
	const originalLineCount = lines.length

	const staged: string[] = []
	const unstaged: string[] = []
	const untracked: string[] = []
	const branchInfo: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		// Branch info
		if (trimmed.startsWith("On branch ") || trimmed.startsWith("Your branch ")) {
			branchInfo.push(trimmed)
			continue
		}

		// Detect file status markers (short format: XY filename)
		const shortMatch = trimmed.match(/^([MADRCU?! ]{1,2})\s+(.+)$/)
		if (shortMatch) {
			const status = shortMatch[1]
			const file = shortMatch[2]
			if (status.startsWith("?")) {
				untracked.push(file)
			} else if (status[0] !== " ") {
				staged.push(`${status.trim()} ${file}`)
			} else {
				unstaged.push(`${status.trim()} ${file}`)
			}
			continue
		}

		// Long format patterns
		if (/^\s*(modified|new file|deleted|renamed|copied):\s+/.test(trimmed)) {
			// Determine context from previous section headers
			unstaged.push(trimmed)
		}
	}

	const parts: string[] = []
	if (branchInfo.length > 0) {
		parts.push(...branchInfo)
	}

	if (staged.length > 0) {
		parts.push(`Staged (${staged.length}): ${staged.join(", ")}`)
	}
	if (unstaged.length > 0) {
		parts.push(`Unstaged (${unstaged.length}): ${unstaged.join(", ")}`)
	}
	if (untracked.length > 0) {
		parts.push(`Untracked (${untracked.length}): ${untracked.join(", ")}`)
	}

	if (parts.length === 0) {
		// Clean working tree or unparseable - return as-is
		return {
			output,
			filterName: "git-status",
			originalLineCount,
			filteredLineCount: originalLineCount,
		}
	}

	const filtered = parts.join("\n")
	return {
		output: filtered,
		filterName: "git-status",
		originalLineCount,
		filteredLineCount: filtered.split("\n").length,
	}
}

/**
 * Filter for git log output.
 * Compacts to one-line-per-commit format.
 */
function filterGitLogOutput(output: string, _command: string): FilterResult {
	const lines = output.split("\n")
	const originalLineCount = lines.length

	const commits: string[] = []
	let currentCommit = ""
	let currentMessage = ""

	for (const line of lines) {
		const trimmed = line.trim()

		const commitMatch = trimmed.match(/^commit\s+([a-f0-9]{7,40})/)
		if (commitMatch) {
			if (currentCommit) {
				commits.push(`${currentCommit} ${currentMessage.trim()}`)
			}
			currentCommit = commitMatch[1].substring(0, 7)
			currentMessage = ""
			continue
		}

		// Skip Author/Date/Merge lines
		if (/^(Author|Date|Merge):\s/.test(trimmed)) {
			continue
		}

		// Collect commit message (non-empty, non-metadata lines)
		if (trimmed && currentCommit) {
			if (!currentMessage) {
				currentMessage = trimmed
			}
		}
	}

	// Don't forget the last commit
	if (currentCommit) {
		commits.push(`${currentCommit} ${currentMessage.trim()}`)
	}

	if (commits.length === 0) {
		return {
			output,
			filterName: "git-log",
			originalLineCount,
			filteredLineCount: originalLineCount,
		}
	}

	const filtered = commits.join("\n")
	return {
		output: filtered,
		filterName: "git-log",
		originalLineCount,
		filteredLineCount: filtered.split("\n").length,
	}
}

/**
 * Filter for package manager install output (npm, yarn, pnpm, pip).
 * Strips progress bars and verbose download info, keeping only warnings/errors and final summary.
 */
function filterPackageInstallOutput(output: string, _command: string): FilterResult {
	const lines = output.split("\n")
	const originalLineCount = lines.length

	const kept: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		// Skip progress bars and download indicators
		if (isProgressLine(trimmed)) {
			continue
		}

		// Skip npm timing/http lines
		if (/^(npm\s+)?(timing|http\s+(fetch|GET|POST))\s/i.test(trimmed)) {
			continue
		}

		// Skip yarn/pnpm fetch progress
		if (/^(Resolving|Fetching|Linking|Building)\s.*\d+\/\d+/.test(trimmed)) {
			continue
		}

		// Skip pip download progress
		if (/^(Downloading|Using cached|Collecting)\s/.test(trimmed) && !/error|warn/i.test(trimmed)) {
			continue
		}

		// Keep everything else (warnings, errors, summary, added packages)
		kept.push(line)
	}

	if (kept.length === 0 || kept.length >= originalLineCount) {
		return {
			output,
			filterName: "package-install",
			originalLineCount,
			filteredLineCount: originalLineCount,
		}
	}

	const filtered = kept.join("\n")
	return {
		output: filtered,
		filterName: "package-install",
		originalLineCount,
		filteredLineCount: filtered.split("\n").length,
	}
}

/**
 * Filter for build tool output (tsc, cargo build, webpack, etc.)
 * Strips progress lines, keeps errors/warnings and final status.
 */
function filterBuildOutput(output: string, _command: string): FilterResult {
	const lines = output.split("\n")
	const originalLineCount = lines.length

	const kept: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed) continue

		// Skip progress indicators
		if (isProgressLine(trimmed)) {
			continue
		}

		// Skip "Compiling X of Y" style progress
		if (/^(Compiling|Downloading|Checking)\s+.*\(\d+\s*(of|\/)\s*\d+\)/.test(trimmed)) {
			continue
		}

		// Keep errors, warnings, and summary lines
		kept.push(line)
	}

	if (kept.length === 0 || kept.length >= originalLineCount) {
		return {
			output,
			filterName: "build",
			originalLineCount,
			filteredLineCount: originalLineCount,
		}
	}

	const filtered = kept.join("\n")
	return {
		output: filtered,
		filterName: "build",
		originalLineCount,
		filteredLineCount: filtered.split("\n").length,
	}
}

// ─── Helper functions ───────────────────────────────────────────────────────

function isTestSummaryLine(line: string): boolean {
	// Jest/Vitest summary patterns
	if (/^(Tests?|Test Suites?):\s+\d+/.test(line)) return true
	if (/^(PASS|FAIL)\s/.test(line)) return true
	if (/^\d+\s+(passing|failing|pending|skipped)/i.test(line)) return true

	// Pytest summary
	if (/^=+\s*(PASSED|FAILED|ERROR|WARNING|short test summary|FAILURES)/.test(line)) return true
	if (/^=+\s+\d+\s+(failed|passed)/.test(line)) return true
	if (/^\d+\s+passed/.test(line)) return true

	// Cargo test summary
	if (/^test result:/.test(line)) return true
	if (/^(ok|FAILED)\.\s+\d+\s+passed/.test(line)) return true

	// Go test summary
	if (/^(ok|FAIL)\s+\S+\s+[\d.]+s/.test(line)) return true

	// General patterns
	if (/^(Ran|Running)\s+\d+\s+test/.test(line)) return true
	if (/^Time:\s+[\d.]+/.test(line)) return true

	return false
}

function isTestFailureLine(line: string): boolean {
	if (/^(FAIL|✕|✗|×|✘)\s/.test(line)) return true
	if (/^(\s+●\s)/.test(line)) return true // Jest failure indicator
	if (/^\s*(FAILED|Error|AssertionError|expect\()/.test(line)) return true
	if (/^[-]+\s*FAILED/.test(line)) return true // pytest FAILED separator
	if (/^failures:$/i.test(line)) return true // cargo test failures header
	if (/^---\s+FAIL:/.test(line)) return true // Go test failure

	return false
}

function isErrorLine(line: string): boolean {
	if (/^(error|Error|ERROR)\b/.test(line)) return true
	if (/^(warn|Warn|WARN|warning|Warning|WARNING)\b/.test(line)) return true
	if (/^\s*(at\s+)?\S+\.(ts|js|py|rs|go|java|rb):\d+/.test(line)) return true // Stack trace lines

	return false
}

function isProgressLine(line: string): boolean {
	// Common progress bar patterns
	if (/[█▓▒░■□●○◆◇⣿⣀⠀]/.test(line)) return true
	if (/\[[\s#=\->]+\]\s*\d+%/.test(line)) return true
	if (/^\s*\d+%\s/.test(line)) return true
	if (/\d+\/\d+\s*\[/.test(line)) return true
	// Spinner patterns
	if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏|/-\\]\s/.test(line)) return true

	return false
}

// ─── Built-in filter rules ──────────────────────────────────────────────────

/**
 * Built-in filter rules applied in order. First matching rule wins.
 */
export const BUILT_IN_FILTER_RULES: OutputFilterRule[] = [
	{
		name: "test-runner",
		commandPattern:
			/(?:^|\s)(jest|vitest|mocha|pytest|py\.test|cargo\s+test|go\s+test|npx\s+(jest|vitest|mocha)|npm\s+(test|run\s+test)|yarn\s+test|pnpm\s+test|dotnet\s+test|rspec|phpunit|mix\s+test)/i,
		filter: filterTestOutput,
	},
	{
		name: "git-status",
		commandPattern: /\bgit\s+status\b/,
		filter: filterGitStatusOutput,
	},
	{
		name: "git-log",
		commandPattern: /\bgit\s+log\b/,
		filter: filterGitLogOutput,
	},
	{
		name: "package-install",
		commandPattern:
			/(?:^|\s)(npm\s+install|npm\s+i\b|yarn\s+(install|add)|pnpm\s+(install|add)|pip\s+install|pip3\s+install|cargo\s+install|gem\s+install|composer\s+(install|require))/i,
		filter: filterPackageInstallOutput,
	},
	{
		name: "build",
		commandPattern:
			/(?:^|\s)(tsc|cargo\s+build|go\s+build|make\b|cmake\s+--build|webpack|vite\s+build|next\s+build|npm\s+run\s+build|yarn\s+build|pnpm\s+build|dotnet\s+build|gradle\s+build|mvn\s+(compile|package))/i,
		filter: filterBuildOutput,
	},
]

// ─── Main filter function ───────────────────────────────────────────────────

/**
 * Apply command-aware output filtering.
 *
 * Matches the command against built-in filter rules and applies the first
 * matching filter. If no filter matches or the filter doesn't reduce output
 * meaningfully, returns null (indicating no filtering was applied).
 *
 * @param command - The command that was executed
 * @param output - The raw terminal output
 * @returns FilterResult if a filter was applied and reduced output, null otherwise
 */
export function filterTerminalOutput(command: string, output: string): FilterResult | null {
	// Don't filter very small outputs (not worth it)
	const lines = output.split("\n")
	if (lines.length < 5) {
		return null
	}

	for (const rule of BUILT_IN_FILTER_RULES) {
		if (rule.commandPattern.test(command)) {
			const result = rule.filter(output, command)

			// Only return the result if filtering actually reduced the output meaningfully
			// (at least 20% reduction)
			const reductionRatio = 1 - result.filteredLineCount / result.originalLineCount
			if (reductionRatio >= 0.2) {
				return result
			}

			// Filter matched but didn't reduce enough - return null
			return null
		}
	}

	return null
}

/**
 * Format the filter indicator appended to filtered output.
 * This tells the LLM that filtering occurred and how to access full output.
 */
export function formatFilterIndicator(result: FilterResult, hasArtifact: boolean): string {
	const reduction = Math.round((1 - result.filteredLineCount / result.originalLineCount) * 100)
	const parts = [
		`[Output filtered by "${result.filterName}": ${result.originalLineCount} lines -> ${result.filteredLineCount} lines (${reduction}% reduction).`,
	]

	if (hasArtifact) {
		parts.push("Use read_command_output for full output.]")
	} else {
		parts.push("Full output was not persisted as it was within preview limits.]")
	}

	return parts.join(" ")
}

import { z } from "zod"

/**
 * TaskPermissions defines permission boundaries that a parent task can impose
 * on a subtask created via the `new_task` tool.
 *
 * When nested subtasks are created, permissions are merged using
 * "most-restrictive-wins" semantics: a child can never grant itself
 * more access than its parent.
 */

/** Maximum allowed length for a regex pattern to limit complexity. */
const MAX_REGEX_PATTERN_LENGTH = 200

/**
 * Heuristic check for ReDoS-vulnerable patterns.
 * Detects common dangerous constructs like nested quantifiers:
 *   (a+)+, (a*)+, (a+)*, (a*){2,}, etc.
 * These can cause catastrophic backtracking on crafted input.
 */
export function isSafeRegex(pattern: string): boolean {
	if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
		return false
	}

	// Detect nested quantifiers: a group with a quantifier inside, followed by an outer quantifier.
	// Examples: (a+)+, (a+)*, (a*){2,}, (?:a+)+
	// This regex looks for: group containing a quantifier, followed by another quantifier
	const nestedQuantifierPattern = /\([^)]*[+*][^)]*\)[+*{]/
	if (nestedQuantifierPattern.test(pattern)) {
		return false
	}

	// Detect overlapping alternations inside repeated groups: (a|a)+, (.|a)+
	// where both alternatives can match the same input
	const overlappingAlternationInGroup = /\([^)]*\|[^)]*\)[+*{]/
	if (overlappingAlternationInGroup.test(pattern)) {
		return false
	}

	return true
}

/**
 * Zod refinement that rejects strings which are not valid regular expressions,
 * and also rejects patterns that are vulnerable to ReDoS (catastrophic backtracking).
 */
const regexString = z
	.string()
	.max(MAX_REGEX_PATTERN_LENGTH, {
		message: `Regex pattern must be at most ${MAX_REGEX_PATTERN_LENGTH} characters`,
	})
	.refine(
		(val) => {
			try {
				new RegExp(val)
				return true
			} catch {
				return false
			}
		},
		{ message: "Invalid regular expression" },
	)
	.refine((val) => isSafeRegex(val), {
		message:
			"Regex pattern rejected: potentially vulnerable to ReDoS (catastrophic backtracking). Avoid nested quantifiers like (a+)+ or overlapping alternations in repeated groups.",
	})

export const taskPermissionsSchema = z.object({
	/**
	 * Regex patterns for allowed file paths.
	 * When set, file operations (read/write) are restricted to paths matching
	 * at least one of these patterns.  Patterns are automatically anchored
	 * (wrapped in `^(?:...)$`) at runtime so they match the full path.
	 */
	filePatterns: z.array(regexString).optional(),

	/**
	 * Regex patterns for allowed shell commands.
	 * When set, command execution is restricted to commands matching
	 * at least one of these patterns.  Patterns are automatically anchored.
	 */
	commandPatterns: z.array(regexString).optional(),

	/**
	 * Explicit tool allowlist. When set, only these tools may be used
	 * by the subtask (in addition to always-available tools like
	 * attempt_completion and ask_followup_question).
	 */
	allowedTools: z.array(z.string()).optional(),

	/**
	 * Explicit tool blocklist. These tools are denied regardless of
	 * mode configuration.
	 */
	deniedTools: z.array(z.string()).optional(),
})

/** The shape accepted as input from the model via the new_task tool. */
export type TaskPermissionsInput = z.infer<typeof taskPermissionsSchema>

/**
 * Internal representation of task permissions.  Extends the input shape with
 * layered pattern fields that accumulate across nested delegation so that
 * each ancestor's constraints are enforced independently (AND semantics
 * between layers, OR semantics within a layer).
 */
export interface TaskPermissions extends TaskPermissionsInput {
	/**
	 * Accumulated file-pattern layers from ancestor tasks.
	 * Each inner array is an OR-group; all layers must match (AND between layers).
	 * Populated only by `mergeTaskPermissions` -- never set from model input.
	 */
	_filePatternLayers?: string[][]
	/**
	 * Accumulated command-pattern layers from ancestor tasks.
	 * Same semantics as `_filePatternLayers`.
	 */
	_commandPatternLayers?: string[][]
}

/**
 * Convert a validated input object (flat arrays) into the internal
 * `TaskPermissions` representation, wrapping patterns into single layers.
 */
export function toTaskPermissions(input: TaskPermissionsInput): TaskPermissions {
	return {
		...input,
		_filePatternLayers: input.filePatterns ? [input.filePatterns] : undefined,
		_commandPatternLayers: input.commandPatterns ? [input.commandPatterns] : undefined,
	}
}

/**
 * Merge two TaskPermissions using most-restrictive-wins semantics.
 *
 * - filePatterns / commandPatterns: accumulated as independent layers so that
 *   a value must match at least one pattern from EACH ancestor's layer.
 * - allowedTools: intersection of both lists (if both defined).
 * - deniedTools: union of both lists (most restrictive).
 *
 * @returns merged permissions, or undefined if both inputs are undefined.
 */
export function mergeTaskPermissions(
	parent: TaskPermissions | undefined,
	child: TaskPermissions | undefined,
): TaskPermissions | undefined {
	if (!parent && !child) {
		return undefined
	}
	if (!parent) {
		return child
	}
	if (!child) {
		return parent
	}

	// Collect pattern layers from both sides.  Each side may already carry
	// accumulated layers from earlier merges (_*PatternLayers) as well as
	// its own top-level patterns (filePatterns / commandPatterns).
	const filePatternLayers = collectPatternLayers(
		parent._filePatternLayers,
		parent.filePatterns,
		child._filePatternLayers,
		child.filePatterns,
	)

	const commandPatternLayers = collectPatternLayers(
		parent._commandPatternLayers,
		parent.commandPatterns,
		child._commandPatternLayers,
		child.commandPatterns,
	)

	return {
		// The top-level field stores the child's own patterns (used for display /
		// serialization); runtime enforcement uses the layers.
		filePatterns: child.filePatterns ?? parent.filePatterns,
		commandPatterns: child.commandPatterns ?? parent.commandPatterns,
		_filePatternLayers: filePatternLayers.length > 0 ? filePatternLayers : undefined,
		_commandPatternLayers: commandPatternLayers.length > 0 ? commandPatternLayers : undefined,
		allowedTools: intersectOptionalArrays(parent.allowedTools, child.allowedTools),
		deniedTools: unionOptionalArrays(parent.deniedTools, child.deniedTools),
	}
}

/**
 * Collect pattern layers from parent and child, deduplicating identical layers.
 */
function collectPatternLayers(
	parentLayers: string[][] | undefined,
	parentPatterns: string[] | undefined,
	childLayers: string[][] | undefined,
	childPatterns: string[] | undefined,
): string[][] {
	const layers: string[][] = []
	const seen = new Set<string>()

	const addLayer = (layer: string[]) => {
		if (layer.length === 0) return
		const key = JSON.stringify(layer)
		if (!seen.has(key)) {
			seen.add(key)
			layers.push(layer)
		}
	}

	// Add accumulated parent layers
	if (parentLayers) {
		for (const layer of parentLayers) {
			addLayer(layer)
		}
	} else if (parentPatterns && parentPatterns.length > 0) {
		addLayer(parentPatterns)
	}

	// Add accumulated child layers
	if (childLayers) {
		for (const layer of childLayers) {
			addLayer(layer)
		}
	} else if (childPatterns && childPatterns.length > 0) {
		addLayer(childPatterns)
	}

	return layers
}

/**
 * Check if a value matches at least one pattern in a list of regex patterns.
 */
export function matchesAnyPattern(value: string, patterns: string[]): boolean {
	return patterns.some((pattern) => {
		try {
			// Anchor patterns so they must match the entire value, not a substring.
			// This prevents "src/.*" from matching "evil/src/foo".
			const anchored = pattern.startsWith("^") ? pattern : `^(?:${pattern})$`
			return new RegExp(anchored).test(value)
		} catch {
			// Invalid regex -- treat as non-match
			return false
		}
	})
}

/**
 * Check if a value matches ALL pattern layers (AND between layers, OR within each layer).
 * Returns true if there are no layers.
 */
export function matchesAllPatternLayers(value: string, layers: string[][] | undefined): boolean {
	if (!layers || layers.length === 0) {
		return true
	}
	return layers.every((layer) => matchesAnyPattern(value, layer))
}

/**
 * Intersect two optional arrays. If both are defined, return elements present
 * in both. If only one is defined, return that one. If neither, return undefined.
 */
function intersectOptionalArrays(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
	if (!a && !b) {
		return undefined
	}
	if (!a) {
		return b
	}
	if (!b) {
		return a
	}

	const setB = new Set(b)
	const result = a.filter((item) => setB.has(item))
	return result.length > 0 ? result : []
}

/**
 * Union two optional arrays, deduplicating entries.
 */
function unionOptionalArrays(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
	if (!a && !b) {
		return undefined
	}
	if (!a) {
		return b
	}
	if (!b) {
		return a
	}

	return [...new Set([...a, ...b])]
}

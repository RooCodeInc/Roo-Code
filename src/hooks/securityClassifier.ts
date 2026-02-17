export type SecurityClass = "SAFE" | "WRITE" | "DESTRUCTIVE"

const destructiveCommandPatterns: RegExp[] = [
	/\brm\s+-rf\b/i,
	/\bgit\s+reset\s+--hard\b/i,
	/\bgit\s+clean\s+-fdx\b/i,
	/\bmkfs\b/i,
	/\bdd\s+if=\/dev\/zero\b/i,
	/\bchmod\s+-R\s+000\b/i,
]

const writeToolNames = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

const commandToolNames = new Set(["execute_command"])

const failureCounterByTask = new Map<string, number>()
const CIRCUIT_BREAKER_THRESHOLD = 5

export function classifyTool(toolName: string, args: Record<string, unknown>): SecurityClass {
	if (commandToolNames.has(toolName)) {
		const command = String(args.command ?? "")
		if (destructiveCommandPatterns.some((rx) => rx.test(command))) {
			return "DESTRUCTIVE"
		}
		if (command.includes(">") || command.includes(">>")) {
			return "WRITE"
		}
		return "SAFE"
	}
	if (writeToolNames.has(toolName)) {
		return "WRITE"
	}
	return "SAFE"
}

export function assertCommandSafe(command: string): void {
	if (command.includes("\0") || command.includes("\n") || command.includes("\r")) {
		throw new Error("Command contains unsafe control characters.")
	}
}

export function escapeShellArg(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

export function canProceed(taskId: string): boolean {
	return (failureCounterByTask.get(taskId) ?? 0) < CIRCUIT_BREAKER_THRESHOLD
}

export function recordFailure(taskId: string): void {
	const current = failureCounterByTask.get(taskId) ?? 0
	failureCounterByTask.set(taskId, current + 1)
}

export function recordSuccess(taskId: string): void {
	failureCounterByTask.set(taskId, 0)
}

export function getFailureCount(taskId: string): number {
	return failureCounterByTask.get(taskId) ?? 0
}

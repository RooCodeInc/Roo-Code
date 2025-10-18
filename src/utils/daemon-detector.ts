/**
 * Utility for detecting and managing daemon/long-running processes
 */

/**
 * Common patterns for daemon/service commands
 * These are commands that typically start long-running processes
 */
const DAEMON_COMMAND_PATTERNS = [
	// Java/Spring Boot patterns
	/^mvn\s+spring-boot:run/i,
	/^gradle\s+bootRun/i,
	/^java\s+-jar.*\.jar/i,
	/^java\s+.*\.(jar|war)$/i,
	/^spring\s+boot:run/i,

	// Node.js patterns
	/^npm\s+(run\s+)?(start|dev|serve|watch)/i,
	/^yarn\s+(start|dev|serve|watch)/i,
	/^pnpm\s+(start|dev|serve|watch)/i,
	/^node\s+.*server/i,
	/^nodemon\s+/i,
	/^pm2\s+start/i,
	/^forever\s+start/i,

	// Python patterns
	/^python3?\s+-m\s+http\.server/i,
	/^python3?\s+.*manage\.py\s+runserver/i, // Django
	/^flask\s+run/i,
	/^uvicorn\s+/i, // FastAPI
	/^gunicorn\s+/i,
	/^python3?\s+.*app\.py$/i,

	// Ruby patterns
	/^rails\s+server/i,
	/^rails\s+s$/i,
	/^ruby\s+.*server/i,
	/^rackup\s+/i,

	// PHP patterns
	/^php\s+-S\s+/i, // PHP built-in server
	/^php\s+artisan\s+serve/i, // Laravel

	// .NET patterns
	/^dotnet\s+run/i,
	/^dotnet\s+watch/i,

	// Go patterns
	/^go\s+run\s+.*\.go$/i,

	// Docker patterns
	/^docker\s+run\s+(?!.*--rm)/i, // Docker run without --rm flag
	/^docker-compose\s+up(?!\s+.*-d)/i, // Docker compose up without -d flag

	// Generic server patterns
	/\b(server|serve|watch|dev|start)\b.*$/i,
	/^.*\s+(--watch|--serve|--server)/i,
]

/**
 * Additional patterns that can be configured by users
 */
let userDefinedPatterns: RegExp[] = []

/**
 * Check if a command is likely to start a daemon/long-running process
 * @param command The command to check
 * @returns true if the command is likely a daemon process
 */
export function isDaemonCommand(command: string): boolean {
	// Trim and normalize the command
	const normalizedCommand = command.trim()

	// Check against built-in patterns
	for (const pattern of DAEMON_COMMAND_PATTERNS) {
		if (pattern.test(normalizedCommand)) {
			return true
		}
	}

	// Check against user-defined patterns
	for (const pattern of userDefinedPatterns) {
		if (pattern.test(normalizedCommand)) {
			return true
		}
	}

	return false
}

/**
 * Add user-defined daemon patterns
 * @param patterns Array of regex patterns or strings to match
 */
export function addDaemonPatterns(patterns: (string | RegExp)[]): void {
	const compiledPatterns = patterns.map((p) => {
		if (p instanceof RegExp) {
			return p
		}
		// Convert string to regex, escaping special characters
		const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		return new RegExp(escaped, "i")
	})

	userDefinedPatterns = [...userDefinedPatterns, ...compiledPatterns]
}

/**
 * Clear user-defined daemon patterns
 */
export function clearUserDaemonPatterns(): void {
	userDefinedPatterns = []
}

/**
 * Get a user-friendly message for daemon processes
 * @param command The daemon command
 * @returns A message explaining the daemon process handling
 */
export function getDaemonMessage(command: string): string {
	const shortCommand = command.length > 50 ? command.substring(0, 50) + "..." : command

	return (
		`The command '${shortCommand}' appears to be starting a long-running service/daemon process. ` +
		`The process has been started in the background and will continue running. ` +
		`You can proceed with other tasks while this service runs. ` +
		`To stop the service, you may need to use Ctrl+C in the terminal or run the appropriate stop command.`
	)
}

/**
 * Extract service type from daemon command for better messaging
 * @param command The daemon command
 * @returns The type of service being started
 */
export function getServiceType(command: string): string {
	const normalizedCommand = command.toLowerCase()

	if (normalizedCommand.includes("spring-boot") || normalizedCommand.includes("bootrun")) {
		return "Spring Boot application"
	}
	if (normalizedCommand.includes("npm") || normalizedCommand.includes("yarn") || normalizedCommand.includes("pnpm")) {
		return "Node.js application"
	}
	if (
		normalizedCommand.includes("python") ||
		normalizedCommand.includes("flask") ||
		normalizedCommand.includes("django")
	) {
		return "Python application"
	}
	if (normalizedCommand.includes("rails")) {
		return "Rails application"
	}
	if (normalizedCommand.includes("dotnet")) {
		return ".NET application"
	}
	if (normalizedCommand.includes("docker")) {
		return "Docker container"
	}
	if (normalizedCommand.includes("php")) {
		return "PHP application"
	}

	return "application"
}

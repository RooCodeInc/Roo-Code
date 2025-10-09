/**
 * @file terminal-unsupport-syntax
 */
export const terminalUnsupportedSyntax = {
	cmd: {
		unsupported: [
			"Does not support piping (|) with complex expressions",
			"No support for && and || logical operators",
			"Does not support function definitions like PowerShell or Bash",
			"Limited variable usage — no $variable expansion",
			"No subshell syntax like $(...) or backticks",
		],
	},
	powershell5: {
		unsupported: [
			"No support for && and || operators",
			"No support for ternary operator (?:)",
			"No support for null-coalescing operator (??)",
			"Limited pipeline parallelism",
			"Not cross-platform (Windows only)",
		],
		features: [
			"Use semicolon (;) to separate multiple commands",
			"Use -eq, -ne, -gt, -lt for comparisons",
			"Use traditional pipeline syntax with |",
		],
	},
	powershell7: {
		unsupported: [
			"Still limited compared to Bash for inline command substitution",
			"Some Windows-specific modules are deprecated",
		],
		features: [
			"Support for && and || operators (like Bash)",
			"Support for ternary operator (?:)",
			"Support for null-coalescing operator (??)",
			"Improved pipeline performance",
			"Cross-platform support",
		],
	},
	gitBash: {
		unsupported: [
			"Does not support PowerShell cmdlets",
			"Limited access to Windows environment variables",
			"No native PowerShell object pipeline",
			"Limited Unicode and emoji rendering on Windows",
		],
		features: [
			"Support for && and || operators",
			"Support for $(...) command substitution",
			"Support for standard UNIX-style piping",
		],
	},
}

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
	powershell: {
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
	pwsh: {
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
	bash: {
		unsupported: [
			"Does not support PowerShell cmdlets",
			"Limited access to Windows environment variables",
			"No native PowerShell object pipeline",
			"Limited Unicode and emoji rendering on Windows",
			"Arguments beginning with a single slash (e.g., /F, /IM) may fail in POSIX-style shells due to automatic path conversion",
			"Using double slashes (e.g., //F, //IM) prevents the shell from rewriting the arguments",
			"Example: taskkill /F /IM notepad.exe fails, while taskkill //F //IM notepad.exe succeeds because no path conversion occurs",
		],
		features: [
			"Support for && and || operators",
			"Support for $(...) command substitution",
			"Support for standard UNIX-style piping",
		],
	},
}

import * as fs from "fs"
import * as yaml from "yaml"
import * as os from "os"
import * as path from "path"

export interface SecurityResult {
	blocked?: boolean
	requiresApproval?: boolean
	message: string
	pattern: string
	violationType?: "file" | "command" | "env_var"
	ruleType?: "block" | "ask"
	matchedRule?: string
	context?: string
}

interface SecurityConfiguration {
	block?: {
		files?: string[]
		env_vars?: string[]
		commands?: string[]
	}
	ask?: {
		files?: string[]
		env_vars?: string[]
		commands?: string[]
	}
}

/**
 * SecurityGuard - Controls AI access to confidential and sensitive files
 */
export class SecurityGuard {
	private cwd: string
	private isEnabled: boolean
	private customConfigPath?: string
	private confidentialFiles: string[] = []
	private sensitiveFiles: string[] = []
	private confidentialEnvVars: string[] = []
	private confidentialCommands: string[] = []
	private sensitiveCommands: string[] = []
	private ruleIndex: Map<string, string> = new Map()

	constructor(cwd: string, isEnabled: boolean = false, customConfigPath?: string) {
		this.cwd = cwd
		this.isEnabled = isEnabled
		this.customConfigPath = customConfigPath

		if (this.isEnabled) {
			this.loadConfiguration()
		}
	}

	/**
	 * Load security configuration from hierarchical YAML files
	 * Uses BLOCK-always-wins merging strategy
	 */
	private loadConfiguration(): void {
		try {
			const globalConfig = this.loadConfigFile(this.getGlobalConfigPath())
			const projectConfig = this.loadConfigFile(this.getProjectConfigPath())

			let customConfig = {}
			if (this.customConfigPath) {
				// Skip disabled custom configs
				if (this.customConfigPath.startsWith("DISABLED:")) {
					customConfig = {}
				} else {
					// Resolve custom config path to handle ~ and relative paths
					let resolvedCustomPath = this.customConfigPath

					// Expand ~ to home directory
					if (resolvedCustomPath.startsWith("~")) {
						resolvedCustomPath = resolvedCustomPath.replace("~", os.homedir())
					}

					// Resolve relative paths to absolute paths
					if (!path.isAbsolute(resolvedCustomPath)) {
						resolvedCustomPath = path.resolve(resolvedCustomPath)
					}

					customConfig = this.loadConfigFile(resolvedCustomPath)
				}
			}

			this.mergeConfigurations(globalConfig, projectConfig, customConfig)
			this.buildRuleIndex()
		} catch (error) {
			this.loadLegacyConfiguration()
		}
	}

	private getGlobalConfigPath(): string {
		return path.join(os.homedir(), ".roo", "security.yaml")
	}

	private getProjectConfigPath(): string {
		return path.join(this.cwd, ".roo", "security.yaml")
	}

	/**
	 * Get config file status for UI display
	 */
	public getConfigStatus(): {
		globalPath: string
		globalExists: boolean
		projectPath: string
		projectExists: boolean
		customPath?: string
		customExists?: boolean
	} {
		const globalPath = this.getGlobalConfigPath()
		const projectPath = this.getProjectConfigPath()

		return {
			globalPath,
			globalExists: fs.existsSync(globalPath),
			projectPath,
			projectExists: fs.existsSync(projectPath),
			customPath: this.customConfigPath,
			customExists: this.customConfigPath ? fs.existsSync(this.customConfigPath) : undefined,
		}
	}
	private loadConfigFile(configPath: string): SecurityConfiguration {
		try {
			if (!fs.existsSync(configPath)) {
				// No auto-creation - user must explicitly create config files via UI buttons
				return {}
			}

			const yamlContent = fs.readFileSync(configPath, "utf8")
			const config = yaml.parse(yamlContent) as SecurityConfiguration

			return config
		} catch (error) {
			console.error(`[SecurityGuard] Error loading config from ${configPath}:`, error)
			return {}
		}
	}

	private mergeConfigurations(
		global: SecurityConfiguration,
		project: SecurityConfiguration,
		custom: SecurityConfiguration = {},
	): void {
		// Handle null/undefined configs by converting to empty objects
		const safeGlobal = global || {}
		const safeProject = project || {}
		const safeCustom = custom || {}

		const allBlockFiles = [
			...(safeGlobal.block?.files || []),
			...(safeProject.block?.files || []),
			...(safeCustom.block?.files || []),
		]

		const allBlockCommands = [
			...(safeGlobal.block?.commands || []),
			...(safeProject.block?.commands || []),
			...(safeCustom.block?.commands || []),
		]

		const allBlockEnvVars = [
			...(safeGlobal.block?.env_vars || []),
			...(safeProject.block?.env_vars || []),
			...(safeCustom.block?.env_vars || []),
		]

		const allAskFiles = [
			...(safeGlobal.ask?.files || []),
			...(safeProject.ask?.files || []),
			...(safeCustom.ask?.files || []),
		]

		const allAskCommands = [
			...(safeGlobal.ask?.commands || []),
			...(safeProject.ask?.commands || []),
			...(safeCustom.ask?.commands || []),
		]

		this.confidentialFiles = [...new Set(allBlockFiles)]
		this.confidentialCommands = [...new Set(allBlockCommands)]
		this.confidentialEnvVars = [...new Set(allBlockEnvVars)]
		this.sensitiveFiles = [...new Set(allAskFiles)]
		this.sensitiveCommands = [...new Set(allAskCommands)]

		this.sensitiveFiles = this.sensitiveFiles.filter((pattern) => !this.confidentialFiles.includes(pattern))
		this.sensitiveCommands = this.sensitiveCommands.filter(
			(pattern) => !this.confidentialCommands.includes(pattern),
		)
	}
	public static createDefaultGlobalConfig(): string {
		const configPath = path.join(os.homedir(), ".roo", "security.yaml")
		const defaultGlobalConfig = `# Roo Security Middleware - Global Configuration
# This file applies to ALL projects.
# Per-project rules can be defined in [file://./.roo/security.yaml]
# 
# Syntax example:
# 
# block:
#   files:
#   - '.env*'
#   commands:
#   - env
#   env_vars:
#   - '*_SECRET_ACCESS_KEY'

override_global_config: true

block:
  files:
  # - 
  commands:
  # - 
  env_vars:
  # - 
# NOTE: there is a space after - so the user can uncomment current line and start typing a rule; no need for them to create a space first.

ask:
  files:
  # - 
  commands:
  # - 
  env_vars:
  # - `

		try {
			const dir = path.dirname(configPath)
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true })
			}

			fs.writeFileSync(configPath, defaultGlobalConfig)
			return configPath
		} catch (error) {
			console.error(`[SecurityGuard] Failed to create default global config at ${configPath}:`, error)
			return configPath
		}
	}

	public static createDefaultProjectConfig(workspacePath: string): string {
		const configPath = path.join(workspacePath, ".roo", "security.yaml")
		const defaultProjectConfig = `# Roo Security Middleware - Project Configuration
# This file applies to THIS PROJECT only.
# Global rules are defined in [file://~/.roo/security.yaml]
# 
# Syntax example:
# 
# ask:
#   files:
#   - 'config/*.json'
#   - 'staging.*'
#   commands:
#   - npm

override_global_config: false

block:
  files:
  # - 
  commands:
  # - 
  env_vars:
  # - 
# NOTE: there is a space after - so the user can uncomment current line and start typing a rule; no need for them to create a space first.

ask:
  files:
  # - 
  commands:
  # - 
  env_vars:
  # - `

		try {
			const dir = path.dirname(configPath)
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true })
			}

			fs.writeFileSync(configPath, defaultProjectConfig)
			return configPath
		} catch (error) {
			console.error(`[SecurityGuard] Failed to create default project config at ${configPath}:`, error)
			return configPath
		}
	}

	private loadLegacyConfiguration(): void {
		this.confidentialFiles = []
		this.sensitiveFiles = []
		this.confidentialEnvVars = []
		this.confidentialCommands = []
		this.sensitiveCommands = []
		this.buildRuleIndex()
	}

	/**
	 * Validate file access - returns security result if file needs protection
	 */
	validateFileAccess(filePath: string): SecurityResult | null {
		if (!this.isEnabled) return null // Early return when disabled

		const normalizedPath = this.normalizePath(filePath)
		const basename = this.getBasename(normalizedPath)

		// Check confidential files (complete block)
		for (const pattern of this.confidentialFiles) {
			if (this.matchesPattern(normalizedPath, pattern) || this.matchesPattern(basename, pattern)) {
				return this.createFileSecurityResult({
					blocked: true,
					message: `Access denied to confidential file: ${filePath}`,
					pattern,
					ruleType: "block",
					filePath,
					context: `Direct file access blocked: ${filePath}`,
				})
			}
		}

		// Check sensitive files (user approval required)
		for (const pattern of this.sensitiveFiles) {
			if (this.matchesPattern(normalizedPath, pattern) || this.matchesPattern(basename, pattern)) {
				return this.createFileSecurityResult({
					requiresApproval: true,
					message: `Allow access to sensitive file '${filePath}'? (Pattern: ${pattern})`,
					pattern,
					ruleType: "ask",
					filePath,
					context: `Direct file access requires approval: ${filePath}`,
				})
			}
		}

		return null
	}

	/**
	 * Validate command execution - returns security result if command needs protection
	 */
	validateCommand(command: string): SecurityResult | null {
		if (!this.isEnabled) return null // Early return when disabled

		const trimmedCommand = command.trim()
		const parts = trimmedCommand.split(/\s+/)
		const baseCommand = parts[0]?.toLowerCase() || ""

		// PRIORITY 1: Check confidential commands (complete block)
		for (const pattern of this.confidentialCommands) {
			if (baseCommand === pattern.toLowerCase()) {
				return this.createCommandSecurityResult({
					blocked: true,
					message: `Command blocked: Confidential command '${baseCommand}' not allowed`,
					pattern,
					ruleType: "block",
					command: trimmedCommand,
					context: `Confidential command blocked: ${baseCommand}`,
				})
			}
		}

		// PRIORITY 2: Scan entire command for BLOCKED file patterns FIRST (catches most bypasses)
		// This must come BEFORE sensitive command checking to ensure blocked files are never accessible
		const filePatternViolation = this.scanCommandForFilePatterns(trimmedCommand)
		if (filePatternViolation) {
			return filePatternViolation
		}

		// PRIORITY 3: Check sensitive commands (user approval required) - ONLY after file blocking
		for (const pattern of this.sensitiveCommands) {
			if (baseCommand === pattern.toLowerCase()) {
				return this.createCommandSecurityResult({
					requiresApproval: true,
					message: `Allow execution of sensitive command '${baseCommand}'? Command: ${trimmedCommand}`,
					pattern,
					ruleType: "ask",
					command: trimmedCommand,
					context: `Sensitive command requires approval: ${baseCommand}`,
				})
			}
		}

		// Check scripting languages with code execution
		const scriptingLanguages = ["python", "python3", "ruby", "perl", "node", "nodejs", "php"]
		if (scriptingLanguages.includes(baseCommand)) {
			const codeViolation = this.validateScriptingLanguageCommand(trimmedCommand, baseCommand)
			if (codeViolation) {
				return codeViolation
			}
		}

		// Check find command with -exec parameter
		if (baseCommand === "find") {
			const findViolation = this.validateFindCommandWithExecParameter(trimmedCommand)
			if (findViolation) {
				return findViolation
			}
		}

		// Check command chaining (&&, ||, ;, |)
		const chainingViolation = this.validateCommandChaining(trimmedCommand)
		if (chainingViolation) {
			return chainingViolation
		}

		// Check if command accesses sensitive files (original logic)
		const fileAccessingCommands = [
			"cat",
			"less",
			"more",
			"head",
			"tail",
			"grep",
			"awk",
			"sed",
			"get-content",
			"gc",
			"type",
			"select-string",
			"sls",
		]

		if (!fileAccessingCommands.includes(baseCommand)) return null

		// Check each argument that could be a file path
		for (let i = 1; i < parts.length; i++) {
			const arg = parts[i]

			// Skip command flags/options
			if (arg.startsWith("-") || arg.startsWith("/") || arg.includes(":")) {
				continue
			}

			// Check if this argument is a sensitive file
			const fileCheck = this.validateFileAccess(arg)
			if (fileCheck?.blocked) {
				return {
					blocked: true,
					message: `Command blocked: Access denied to confidential file '${arg}'`,
					pattern: fileCheck.pattern,
				}
			}

			if (fileCheck?.requiresApproval) {
				return {
					requiresApproval: true,
					message: `Allow command accessing sensitive file '${arg}'? Command: ${trimmedCommand}`,
					pattern: fileCheck.pattern,
				}
			}
		}

		return null
	}

	/**
	 * Scan command arguments for confidential file patterns
	 * Simple YAML-driven pattern matching only - follows the YAML, nothing else
	 */
	private scanCommandForFilePatterns(command: string): SecurityResult | null {
		// Parse command to separate command name from file arguments
		const parts = command.split(/\s+/)

		// Get potential file arguments (skip command name and flags)
		const fileArgs = parts.slice(1).filter((arg) => {
			// Skip flags and options
			if (arg.startsWith("-") || arg.startsWith("/")) {
				return false
			}
			// Skip arguments that look like URLs or contain colons (likely not file paths)
			if (arg.includes("://") || (arg.includes(":") && !arg.includes("/"))) {
				return false
			}
			return true
		})

		// Check for confidential file patterns in file arguments only
		for (const pattern of this.confidentialFiles) {
			for (const arg of fileArgs) {
				if (this.matchesPattern(arg, pattern)) {
					return this.createSecurityResult({
						blocked: true,
						message: `Command blocked: Access denied to confidential file pattern '${pattern}'`,
						pattern,
						violationType: "file",
						ruleType: "block",
						context: `File argument in command: ${arg}`,
					})
				}
			}
		}

		// Check for sensitive file patterns in file arguments only
		for (const pattern of this.sensitiveFiles) {
			for (const arg of fileArgs) {
				if (this.matchesPattern(arg, pattern)) {
					return {
						requiresApproval: true,
						message: `Allow command accessing sensitive file pattern '${pattern}'? Command: ${command}`,
						pattern,
					}
				}
			}
		}

		return null
	}

	/**
	 * Validate scripting language commands with code execution
	 */
	private validateScriptingLanguageCommand(command: string, language: string): SecurityResult | null {
		// First, check for file patterns anywhere in the command (catches most cases)
		const filePatternViolation = this.scanCommandForFilePatterns(command)
		if (filePatternViolation) {
			return filePatternViolation
		}

		// Parse command more carefully to handle quoted strings
		const parts = this.parseCommandWithQuotes(command)

		// Look for code execution parameters
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// Python: -c parameter
			if (
				(language.includes("python") && part === "-c") ||
				// Ruby: -e parameter
				(language === "ruby" && part === "-e") ||
				// Perl: -e or -ne parameters
				(language === "perl" && (part === "-e" || part === "-ne")) ||
				// Node: -e or --eval parameters
				((language === "node" || language === "nodejs") && (part === "-e" || part === "--eval")) ||
				// PHP: -r parameter
				(language === "php" && part === "-r")
			) {
				// Get the code string (next parameter)
				const codeString = parts[i + 1]
				if (codeString) {
					const codeViolation = this.validateCodeString(codeString, language)
					if (codeViolation) {
						return codeViolation
					}
				}
			}
		}

		// Special case for Perl: check all remaining arguments after script parameters
		if (language !== "perl") return null

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]
			if (part !== "-ne" && part !== "-e") continue

			// Check all arguments after the script parameter
			for (let j = i + 2; j < parts.length; j++) {
				const arg = parts[j]
				if (arg.startsWith("-")) continue

				const fileCheck = this.validateFileAccess(arg)
				if (fileCheck?.blocked) {
					return {
						blocked: true,
						message: `Perl command blocked: Access denied to confidential file '${arg}'`,
						pattern: fileCheck.pattern,
					}
				}

				if (fileCheck?.requiresApproval) {
					return {
						requiresApproval: true,
						message: `Allow Perl command accessing sensitive file '${arg}'?`,
						pattern: fileCheck.pattern,
					}
				}
			}
		}

		return null
	}

	/**
	 * Validate find command with -exec parameter
	 */
	private validateFindCommandWithExecParameter(command: string): SecurityResult | null {
		const parts = command.split(/\s+/)

		// Check -name parameter against YAML-configured patterns only
		for (let i = 0; i < parts.length; i++) {
			if (parts[i] !== "-name" || i + 1 >= parts.length) continue

			const namePattern = parts[i + 1].replace(/['"]/g, "") // Remove quotes

			// Check against confidential file patterns from YAML
			for (const pattern of this.confidentialFiles) {
				if (this.matchesPattern(namePattern, pattern)) {
					return this.createSecurityResult({
						blocked: true,
						message: `Find command blocked: Searching for confidential files '${namePattern}'`,
						pattern,
						violationType: "file",
						ruleType: "block",
						context: `Find command -name parameter: ${namePattern}`,
					})
				}
			}

			// Check against sensitive file patterns from YAML
			for (const pattern of this.sensitiveFiles) {
				if (this.matchesPattern(namePattern, pattern)) {
					return this.createSecurityResult({
						requiresApproval: true,
						message: `Allow find command searching for sensitive files '${namePattern}'?`,
						pattern,
						violationType: "file",
						ruleType: "ask",
						context: `Find command -name parameter: ${namePattern}`,
					})
				}
			}
		}

		// Look for -exec parameter
		for (let i = 0; i < parts.length; i++) {
			if (parts[i] !== "-exec") continue

			// Get the command after -exec
			const execCommand = parts
				.slice(i + 1)
				.join(" ")
				.replace(/\s*\\\;\s*$/, "")

			// Check for file patterns in the exec command (avoid infinite recursion)
			const filePatternViolation = this.scanCommandForFilePatterns(execCommand)
			if (filePatternViolation) {
				return {
					blocked: filePatternViolation.blocked,
					requiresApproval: filePatternViolation.requiresApproval,
					message: `Find command blocked: ${filePatternViolation.message}`,
					pattern: filePatternViolation.pattern,
				}
			}
		}

		return null
	}

	/**
	 * Validate command chaining (&&, ||, ;, |)
	 */
	private validateCommandChaining(command: string): SecurityResult | null {
		// Only check for chaining if command contains separators
		const chainSeparators = /(\s*&&\s*|\s*\|\|\s*|\s*;\s*|\s*\|\s*)/
		if (!chainSeparators.test(command)) {
			return null
		}

		const commands = command.split(chainSeparators)

		// Validate each command in the chain (but avoid infinite recursion)
		for (const cmd of commands) {
			const trimmed = cmd.trim()

			// Skip separators and empty strings
			if (!trimmed || chainSeparators.test(trimmed)) {
				continue
			}

			// Check for file patterns in chained commands (avoid full recursive validation)
			const filePatternViolation = this.scanCommandForFilePatterns(trimmed)
			if (filePatternViolation) {
				return {
					blocked: filePatternViolation.blocked,
					requiresApproval: filePatternViolation.requiresApproval,
					message: `Command chain blocked: ${filePatternViolation.message}`,
					pattern: filePatternViolation.pattern,
				}
			}
		}

		return null
	}

	/**
	 * Validate code strings for file operations
	 */
	private validateCodeString(code: string, language: string): SecurityResult | null {
		const lowerCode = code.toLowerCase()

		// Check for file operations in different languages
		const fileOperations = [
			"open",
			"file.read",
			"file_get_contents",
			"file",
			"readfile",
			"readfilesync",
			"with open",
			"file.open",
			"io.read",
			"fs.read",
		]

		for (const operation of fileOperations) {
			if (!lowerCode.includes(operation.toLowerCase())) continue

			// Check for all confidential file patterns using YAML-driven patterns only
			for (const pattern of this.confidentialFiles) {
				const regex = this.patternToRegex(pattern)
				if (regex.test(lowerCode)) {
					return {
						blocked: true,
						message: `Code execution blocked: Access denied to confidential file pattern '${pattern}' in ${language} code`,
						pattern,
					}
				}
			}

			// Check for sensitive file patterns using YAML-driven patterns only
			for (const pattern of this.sensitiveFiles) {
				const regex = this.patternToRegex(pattern)
				if (regex.test(lowerCode)) {
					return {
						requiresApproval: true,
						message: `Allow ${language} code accessing sensitive file pattern '${pattern}'?`,
						pattern,
					}
				}
			}
		}

		return null
	}

	/**
	 * Parse command string handling quoted arguments properly
	 */
	private parseCommandWithQuotes(command: string): string[] {
		const parts: string[] = []
		let current = ""
		let inQuotes = false
		let quoteChar = ""

		for (let i = 0; i < command.length; i++) {
			const char = command[i]

			// Handle quote start
			if (!inQuotes && (char === '"' || char === "'")) {
				inQuotes = true
				quoteChar = char
				current += char
				continue
			}

			// Handle quote end
			if (inQuotes && char === quoteChar) {
				inQuotes = false
				current += char
				quoteChar = ""
				continue
			}

			// Handle space outside quotes
			if (!inQuotes && char === " ") {
				if (current.trim()) {
					parts.push(current.trim())
					current = ""
				}
				continue
			}

			// Default: add character to current part
			current += char
		}

		if (current.trim()) {
			parts.push(current.trim())
		}

		return parts
	}

	/**
	 * Convert glob pattern to regex for string searching
	 */
	private patternToRegex(pattern: string): RegExp {
		const escaped = pattern
			.replace(/\./g, "\\.") // Escape dots
			.replace(/\*/g, ".*") // Convert * to .*

		return new RegExp(escaped, "i") // Case insensitive
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		// No resources to clean up currently
	}

	/**
	 * Check if security is enabled
	 */
	isSecurityEnabled(): boolean {
		return this.isEnabled
	}

	/**
	 * Update enabled state (for runtime toggling)
	 */
	setEnabled(enabled: boolean): void {
		this.isEnabled = enabled
		if (enabled && this.confidentialFiles.length === 0 && this.sensitiveFiles.length === 0) {
			this.loadConfiguration()
		}
	}

	/**
	 * Get basename of a file path (filename without directory)
	 */
	private getBasename(filePath: string): string {
		if (!filePath) {
			return ""
		}
		const parts = filePath.split("/")
		return parts[parts.length - 1] || ""
	}

	/**
	 * Normalize file path for consistent matching
	 */
	private normalizePath(filePath: string): string {
		if (!filePath) {
			return ""
		}

		// Convert backslashes to forward slashes for consistent matching
		let normalized = filePath.replace(/\\/g, "/")

		// Remove leading slash for relative path matching
		if (normalized.startsWith("/")) {
			normalized = normalized.substring(1)
		}

		return normalized
	}

	/**
	 * Check if a path matches a pattern using simple glob matching
	 */
	private matchesPattern(filePath: string, pattern: string): boolean {
		try {
			// Normalize both for case-insensitive matching
			const normalizedFile = filePath.toLowerCase()
			const normalizedPattern = pattern.toLowerCase()

			// Handle directory patterns like "confidential/**/*"
			if (normalizedPattern.includes("**")) {
				const dirPart = normalizedPattern.split("/**")[0]
				if (normalizedFile.startsWith(dirPart + "/") || normalizedFile === dirPart) {
					return true
				}
			}

			// Handle wildcard patterns like "*.env", "*token", ".env*"
			if (normalizedPattern.includes("*")) {
				// Convert glob pattern to regex
				const regexPattern = normalizedPattern
					.replace(/\./g, "\\.") // Escape dots
					.replace(/\*/g, ".*") // Convert * to .*

				const regex = new RegExp(`^${regexPattern}$`)
				return regex.test(normalizedFile)
			}

			// Exact match
			return normalizedFile === normalizedPattern
		} catch (error) {
			return false
		}
	}

	/**
	 * Get standardized error message for security violations (PHASE 1 SECURITY FIX)
	 * This reduces information leakage by providing consistent, minimal error messages
	 * that don't reveal system architecture details to AI reconnaissance
	 */
	getStandardizedErrorMessage(pattern?: string): string {
		// Standardized message that doesn't reveal specific security patterns or system details
		return "Access denied to confidential file"
	}

	/**
	 * Get standardized error message for command violations (PHASE 1 SECURITY FIX)
	 * This reduces information leakage for command-based security violations
	 */
	getStandardizedCommandErrorMessage(): string {
		// Standardized message that doesn't reveal specific command patterns or system details
		return "Command blocked: Confidential command not allowed"
	}

	/**
	 * Build rule index for enhanced SecurityResult reporting (Phase 2)
	 * Maps patterns to their rule definitions for better debugging
	 */
	private buildRuleIndex(): void {
		this.ruleIndex.clear()

		// Index confidential file patterns
		this.confidentialFiles.forEach((pattern, index) => {
			this.ruleIndex.set(pattern, `block.files[${index}]`)
		})

		// Index sensitive file patterns
		this.sensitiveFiles.forEach((pattern, index) => {
			this.ruleIndex.set(pattern, `ask.files[${index}]`)
		})

		// Index confidential command patterns
		this.confidentialCommands.forEach((pattern, index) => {
			this.ruleIndex.set(pattern, `block.commands[${index}]`)
		})

		// Index sensitive command patterns
		this.sensitiveCommands.forEach((pattern, index) => {
			this.ruleIndex.set(pattern, `ask.commands[${index}]`)
		})

		// Index confidential environment variable patterns
		this.confidentialEnvVars.forEach((pattern, index) => {
			this.ruleIndex.set(pattern, `block.env_vars[${index}]`)
		})
	}

	/**
	 * Create enhanced SecurityResult with detailed violation information (Phase 2)
	 */
	private createSecurityResult(params: {
		blocked?: boolean
		requiresApproval?: boolean
		message: string
		pattern: string
		violationType: "file" | "command" | "env_var"
		ruleType: "block" | "ask"
		context?: string
	}): SecurityResult {
		const matchedRule = this.ruleIndex.get(params.pattern) || `unknown_rule(${params.pattern})`

		return {
			blocked: params.blocked,
			requiresApproval: params.requiresApproval,
			message: params.message,
			pattern: params.pattern,
			violationType: params.violationType,
			ruleType: params.ruleType,
			matchedRule,
			context: params.context,
		}
	}

	/**
	 * Create enhanced file SecurityResult (Phase 2)
	 */
	private createFileSecurityResult(params: {
		blocked?: boolean
		requiresApproval?: boolean
		message: string
		pattern: string
		ruleType: "block" | "ask"
		filePath: string
		context?: string
	}): SecurityResult {
		return this.createSecurityResult({
			blocked: params.blocked,
			requiresApproval: params.requiresApproval,
			message: params.message,
			pattern: params.pattern,
			violationType: "file",
			ruleType: params.ruleType,
			context: params.context || `File access: ${params.filePath}`,
		})
	}

	/**
	 * Create enhanced command SecurityResult (Phase 2)
	 */
	private createCommandSecurityResult(params: {
		blocked?: boolean
		requiresApproval?: boolean
		message: string
		pattern: string
		ruleType: "block" | "ask"
		command: string
		context?: string
	}): SecurityResult {
		return this.createSecurityResult({
			blocked: params.blocked,
			requiresApproval: params.requiresApproval,
			message: params.message,
			pattern: params.pattern,
			violationType: "command",
			ruleType: params.ruleType,
			context: params.context || `Command execution: ${params.command}`,
		})
	}
}

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { SecurityGuard, SecurityResult } from "../SecurityGuard"
import { createHierarchicalTestGuard } from "./helpers/test-utils"
import fs from "fs"
import yaml from "yaml"

// Mock fs and yaml modules
vi.mock("fs", () => ({
	default: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
}))
vi.mock("yaml", () => ({
	default: {
		parse: vi.fn(),
	},
	parse: vi.fn(),
}))

describe("SecurityGuard", () => {
	let originalConsoleLog: typeof console.log
	let originalConsoleError: typeof console.error
	let originalConsoleWarn: typeof console.warn

	beforeEach(() => {
		// Suppress console output during tests
		originalConsoleLog = console.log
		originalConsoleError = console.error
		originalConsoleWarn = console.warn
		console.log = vi.fn()
		console.error = vi.fn()
		console.warn = vi.fn()
	})

	afterEach(() => {
		// Restore console output
		console.log = originalConsoleLog
		console.error = originalConsoleError
		console.warn = originalConsoleWarn

		vi.restoreAllMocks()
	})

	function createTestSecurityGuard(config: any): SecurityGuard {
		// Clear any existing mocks
		vi.clearAllMocks()

		// Create SecurityGuard with security disabled to avoid file system calls
		const guard = new SecurityGuard("/test/cwd", false)

		// Access private properties to inject our test data
		const guardAny = guard as any

		// Enable security after construction to avoid loadConfiguration() call
		guardAny.isEnabled = true

		// Directly inject test configuration data using new format only
		guardAny.confidentialFiles = config.block?.files || []
		guardAny.sensitiveFiles = config.ask?.files || []
		guardAny.confidentialCommands = config.block?.commands || []
		guardAny.sensitiveCommands = config.ask?.commands || []
		guardAny.confidentialEnvVars = config.block?.env_vars || []

		// Build rule index for enhanced SecurityResult reporting
		guardAny.buildRuleIndex()

		return guard
	}

	describe("Configuration Loading", () => {
		describe("New Format (block/ask)", () => {
			it("should load block-only configuration correctly", () => {
				const config = {
					override_global_config: true,
					block: {
						files: ["*secret*", "*password*"],
						env_vars: ["*_KEY", "*_TOKEN"],
						commands: ["env"],
					},
					ask: {
						files: [],
						env_vars: [],
						commands: [],
					},
				}

				const guard = createTestSecurityGuard(config)

				// Test that blocked files are properly blocked
				const result = guard.validateFileAccess("secret.txt")
				expect(result?.blocked).toBe(true)
				expect(result?.requiresApproval).toBeUndefined()
			})

			it("should load ask-only configuration correctly", () => {
				const config = {
					override_global_config: true,
					block: {
						files: [],
						env_vars: [],
						commands: [],
					},
					ask: {
						files: [".env*", "*token*"],
						env_vars: ["*_API_KEY"],
						commands: ["cat"],
					},
				}

				const guard = createTestSecurityGuard(config)

				// Test that sensitive files require approval
				const result = guard.validateFileAccess(".env")
				expect(result?.requiresApproval).toBe(true)
				expect(result?.blocked).toBeUndefined()
			})

			it("should load mixed configuration correctly", () => {
				const config = {
					override_global_config: true,
					block: {
						files: ["*secret*", "*password*"],
						env_vars: ["*_KEY"],
						commands: ["env"],
					},
					ask: {
						files: [".env*", "*token*"],
						env_vars: [],
						commands: ["blah"],
					},
				}

				const guard = createTestSecurityGuard(config)

				// Test blocked file
				const blockedResult = guard.validateFileAccess("secret.txt")
				expect(blockedResult?.blocked).toBe(true)

				// Test sensitive file
				const sensitiveResult = guard.validateFileAccess(".env")
				expect(sensitiveResult?.requiresApproval).toBe(true)
			})
		})
	})

	describe("File Access Validation", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: [
						"confidential/**/*",
						"*secret*",
						"*password*",
						"*key*",
						"*credential*",
						"*cert*",
						"*salary*",
						"*salaries*",
						"*wage*",
						"*wages*",
						"*payroll*",
						"*financial*",
						"*finance*",
						"*.bak",
						"*.backup",
						"*.old",
					],
					env_vars: ["*_KEY", "*_TOKEN", "*_SECRET"],
					commands: ["env"],
				},
				ask: {
					files: [".env*", "env*", "*token*", "id_rsa", "id_ed25519"],
					env_vars: [],
					commands: ["blah"],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		describe("Block Rules", () => {
			it("should block files matching confidential patterns", () => {
				const testCases = [
					"secret.txt",
					"password.dat",
					"api-key.json",
					"credentials.yml",
					"certificate.pem",
					"salary-data.csv",
					"employee-wages.txt",
					"payroll.xlsx",
					"financial-report.pdf",
					"backup.bak",
					"config.backup",
					"settings.old",
				]

				testCases.forEach((file) => {
					const result = guard.validateFileAccess(file)
					expect(result?.blocked).toBe(true)
					expect(result?.violationType).toBe("file")
					expect(result?.ruleType).toBe("block")
				})
			})

			it("should block confidential directory files", () => {
				const testFiles = [
					"confidential/secret.txt",
					"confidential/passwords/admin.txt",
					"confidential/keys/private.key",
				]

				testFiles.forEach((file) => {
					const result = guard.validateFileAccess(file)
					expect(result?.blocked).toBe(true)
					expect(result?.violationType).toBe("file")
					expect(result?.ruleType).toBe("block")
					expect(result?.pattern).toBe("confidential/**/*")
				})
			})
		})

		describe("Ask Rules", () => {
			it("should require approval for sensitive files", () => {
				const testCases = [
					".env",
					".env.local",
					"env.production",
					"api-token.txt",
					"access-token.json",
					"id_rsa",
					"id_ed25519",
				]

				testCases.forEach((file) => {
					const result = guard.validateFileAccess(file)
					expect(result?.requiresApproval).toBe(true)
					expect(result?.violationType).toBe("file")
					expect(result?.ruleType).toBe("ask")
				})
			})
		})

		describe("No Match Cases", () => {
			it("should return null for files that do not match any pattern", () => {
				const safeFiles = ["README.md", "package.json", "src/index.ts", "docs/guide.txt", "public/image.png"]

				safeFiles.forEach((file) => {
					const result = guard.validateFileAccess(file)
					expect(result).toBeNull()
				})
			})
		})

		describe("Case Sensitivity", () => {
			it("should handle case-insensitive pattern matching", () => {
				const testCases = [
					{ file: "SECRET.txt", shouldMatch: true },
					{ file: "Secret.txt", shouldMatch: true },
					{ file: "secret.TXT", shouldMatch: true },
					{ file: "PASSWORD.dat", shouldMatch: true },
					{ file: "MyPassword.txt", shouldMatch: true },
				]

				testCases.forEach(({ file, shouldMatch }) => {
					const result = guard.validateFileAccess(file)
					if (shouldMatch) {
						expect(result?.blocked).toBe(true)
					} else {
						expect(result).toBeNull()
					}
				})
			})
		})
	})

	describe("Command Validation", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: ["*secret*", "*password*", "*key*"],
					env_vars: ["*_KEY", "*_TOKEN"],
					commands: ["env"],
				},
				ask: {
					files: [".env*", "*token*"],
					env_vars: [],
					commands: ["blah"],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		describe("Phase 1 Fix Verification - Command Names vs File Arguments", () => {
			it("should NOT match command names against file patterns", () => {
				// These command names should NOT trigger file pattern matches
				const commandNames = [
					"xenvx", // Should not match env* file pattern
					"secretcommand", // Should not match *secret* file pattern
					"passwordgen", // Should not match *password* file pattern
					"keylogger", // Should not match *key* file pattern
					"tokenizer", // Should not match *token* file pattern
				]

				commandNames.forEach((command) => {
					const result = guard.validateCommand(command)
					expect(result).toBeNull() // Should pass without security check
				})
			})

			it("should match file arguments against file patterns", () => {
				// These commands with file arguments SHOULD trigger pattern matches
				const commandsWithFiles = [
					{ command: "cat .env", expectedType: "ask" },
					{ command: "head secret.txt", expectedType: "block" },
					{ command: "tail password.dat", expectedType: "block" },
					{ command: "less mytoken.json", expectedType: "ask" },
				]

				commandsWithFiles.forEach(({ command, expectedType }) => {
					const result = guard.validateCommand(command)
					expect(result).not.toBeNull()

					if (expectedType === "block") {
						expect(result?.blocked).toBe(true)
					} else if (expectedType === "ask") {
						expect(result?.requiresApproval).toBe(true)
					}
				})
			})
		})

		describe("Command Blocking", () => {
			it("should block confidential commands", () => {
				const result = guard.validateCommand("env")
				expect(result?.blocked).toBe(true)
				expect(result?.violationType).toBe("command")
				expect(result?.ruleType).toBe("block")
			})

			it("should require approval for sensitive commands", () => {
				const result = guard.validateCommand("blah")
				expect(result?.requiresApproval).toBe(true)
				expect(result?.violationType).toBe("command")
				expect(result?.ruleType).toBe("ask")
			})
		})

		describe("File-Accessing Commands", () => {
			const fileAccessingCommands = ["cat", "head", "tail", "less", "more", "grep", "awk", "sed"]

			fileAccessingCommands.forEach((baseCommand) => {
				it(`should validate file arguments for ${baseCommand} command`, () => {
					// Test with blocked file
					const blockedResult = guard.validateCommand(`${baseCommand} secret.txt`)
					expect(blockedResult?.blocked).toBe(true)

					// Test with sensitive file
					const sensitiveResult = guard.validateCommand(`${baseCommand} .env`)
					expect(sensitiveResult?.requiresApproval).toBe(true)

					// Test with safe file
					const safeResult = guard.validateCommand(`${baseCommand} README.md`)
					expect(safeResult).toBeNull()
				})
			})
		})

		describe("Scripting Language Commands", () => {
			const scriptingLanguages = [
				{ lang: "python", flag: "-c" },
				{ lang: "python3", flag: "-c" },
				{ lang: "ruby", flag: "-e" },
				{ lang: "perl", flag: "-e" },
				{ lang: "node", flag: "-e" },
				{ lang: "nodejs", flag: "-e" },
			]

			scriptingLanguages.forEach(({ lang, flag }) => {
				it(`should validate ${lang} code execution with file access`, () => {
					// Test code that accesses blocked files
					const blockedCode = `${lang} ${flag} "open('secret.txt').read()"`
					const blockedResult = guard.validateCommand(blockedCode)
					expect(blockedResult?.blocked).toBe(true)

					// Test code that accesses sensitive files
					const sensitiveCode = `${lang} ${flag} "open('.env').read()"`
					const sensitiveResult = guard.validateCommand(sensitiveCode)
					expect(sensitiveResult?.requiresApproval).toBe(true)
				})
			})
		})

		describe("Command Chaining", () => {
			const chainOperators = ["&&", "||", ";", "|"]

			chainOperators.forEach((operator) => {
				it(`should validate chained commands with ${operator}`, () => {
					const chainedCommand = `ls ${operator} cat secret.txt`
					const result = guard.validateCommand(chainedCommand)
					expect(result?.blocked).toBe(true)
				})
			})
		})
	})

	describe("Enhanced Interface (Phase 2)", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: ["*secret*", "*wage*"],
					commands: ["env"],
				},
				ask: {
					files: [".env*"],
					commands: ["blah"],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		it("should include all enhanced fields in SecurityResult", () => {
			const result = guard.validateFileAccess("secret.txt")

			expect(result).toHaveProperty("violationType")
			expect(result).toHaveProperty("ruleType")
			expect(result).toHaveProperty("matchedRule")
			expect(result).toHaveProperty("context")

			expect(result?.violationType).toBe("file")
			expect(result?.ruleType).toBe("block")
			expect(result?.matchedRule).toMatch(/^block\.files\[\d+\]$/)
		})

		it("should provide accurate rule index mapping", () => {
			// Test specific pattern index mapping
			const wageResult = guard.validateFileAccess("employee-wages.txt")
			expect(wageResult?.matchedRule).toBe("block.files[1]") // *wage* is at index 1

			const envResult = guard.validateFileAccess(".env")
			expect(envResult?.matchedRule).toBe("ask.files[0]") // .env* is at index 0
		})

		it("should categorize violation types correctly", () => {
			// File violation
			const fileResult = guard.validateFileAccess("secret.txt")
			expect(fileResult?.violationType).toBe("file")

			// Command violation
			const commandResult = guard.validateCommand("env")
			expect(commandResult?.violationType).toBe("command")

			// YAML-driven command with file arguments
			const fileInCommandResult = guard.validateCommand("cat secret.txt")
			expect(fileInCommandResult?.violationType).toBe("file")
		})
	})

	describe("Pattern Matching", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: ["confidential/**/*", "*secret*", "*.backup"],
					commands: [],
				},
				ask: {
					files: ["id_rsa", "id_ed25519"],
					commands: [],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		describe("Wildcard Patterns", () => {
			it("should match prefix wildcards correctly", () => {
				const result = guard.validateFileAccess("mysecret.txt")
				expect(result?.blocked).toBe(true)
				expect(result?.pattern).toBe("*secret*")
			})

			it("should match suffix wildcards correctly", () => {
				const result = guard.validateFileAccess("data.backup")
				expect(result?.blocked).toBe(true)
				expect(result?.pattern).toBe("*.backup")
			})

			it("should match middle wildcards correctly", () => {
				const result = guard.validateFileAccess("secretdata")
				expect(result?.blocked).toBe(true)
				expect(result?.pattern).toBe("*secret*")
			})
		})

		describe("Directory Patterns", () => {
			it("should match directory patterns with **/*", () => {
				const testPaths = [
					"confidential/file.txt",
					"confidential/subdir/file.txt",
					"confidential/deep/nested/path/file.txt",
				]

				testPaths.forEach((path) => {
					const result = guard.validateFileAccess(path)
					expect(result?.blocked).toBe(true)
					expect(result?.pattern).toBe("confidential/**/*")
				})
			})
		})

		describe("Exact Matches", () => {
			it("should match exact filenames", () => {
				const exactFiles = ["id_rsa", "id_ed25519"]

				exactFiles.forEach((file) => {
					const result = guard.validateFileAccess(file)
					expect(result?.requiresApproval).toBe(true)
					expect(result?.pattern).toBe(file)
				})
			})
		})
	})

	describe("Performance", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: ["confidential/**/*", "*secret*", "*.backup"],
					commands: [],
				},
				ask: {
					files: ["id_rsa", "id_ed25519"],
					commands: [],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		it("should validate file access within reasonable time", () => {
			const start = performance.now()
			guard.validateFileAccess("secret.txt")
			const duration = performance.now() - start

			expect(duration).toBeLessThan(10) // Should complete within 10ms
		})

		it("should validate command within reasonable time", () => {
			const start = performance.now()
			guard.validateCommand("cat secret.txt")
			const duration = performance.now() - start

			expect(duration).toBeLessThan(10) // Should complete within 10ms
		})

		it("should handle multiple validations efficiently", () => {
			const testFiles = Array.from({ length: 100 }, (_, i) => `test-file-${i}.txt`)

			const start = performance.now()
			testFiles.forEach((file) => guard.validateFileAccess(file))
			const duration = performance.now() - start

			expect(duration).toBeLessThan(100) // Should complete 100 validations within 100ms
		})
	})

	describe("Error Handling", () => {
		it("should handle empty file paths gracefully", () => {
			const config = {
				override_global_config: true,
				block: { files: ["*secret*"] },
				ask: { files: [".env*"] },
			}
			const guard = createTestSecurityGuard(config)

			expect(() => guard.validateFileAccess("")).not.toThrow()
			expect(guard.validateFileAccess("")).toBeNull()
		})

		it("should handle empty commands gracefully", () => {
			const config = {
				override_global_config: true,
				block: { commands: ["env"] },
				ask: { commands: ["blah"] },
			}
			const guard = createTestSecurityGuard(config)

			expect(() => guard.validateCommand("")).not.toThrow()
			expect(guard.validateCommand("")).toBeNull()
		})
	})

	describe("Integration Scenarios", () => {
		let guard: SecurityGuard

		beforeEach(() => {
			const config = {
				override_global_config: true,
				block: {
					files: ["*secret*"],
					commands: ["env"],
				},
				ask: {
					files: [".env*"],
					commands: ["blah"],
				},
			}
			guard = createTestSecurityGuard(config)
		})

		it("should handle real-world command scenarios", () => {
			const realWorldCommands = [
				{ command: "git status", shouldPass: true },
				{ command: "npm install", shouldPass: true },
				{ command: "docker run -v .env:/app/.env myapp", shouldPass: false },
				{ command: 'find . -name "*.secret" -exec cat {} \\;', shouldPass: false },
			]

			realWorldCommands.forEach(({ command, shouldPass }) => {
				const result = guard.validateCommand(command)
				if (shouldPass) {
					expect(result).toBeNull()
				} else {
					expect(result).not.toBeNull()
				}
			})
		})

		it("should prioritize file blocking over command sensitivity", () => {
			// Command that would normally require approval, but accesses blocked file
			const result = guard.validateCommand("blah secret.txt")

			// Should be blocked due to file, not just require approval due to command
			expect(result?.blocked).toBe(true)
			expect(result?.violationType).toBe("file")
			expect(result?.pattern).toBe("*secret*")
		})
	})

	describe("Hierarchical Configuration Merging", () => {
		describe("BLOCK Always Wins Principle", () => {
			it("should prioritize BLOCK over ASK regardless of source", () => {
				const global = { block: { files: [".env"] } }
				const project = { ask: { files: [".env"] } }

				const guard = createHierarchicalTestGuard(global, project)

				const result = guard.validateFileAccess(".env")
				expect(result?.blocked).toBe(true)
				expect(result?.requiresApproval).toBeUndefined()
				expect(result?.ruleType).toBe("block")
			})

			it("should prioritize project BLOCK over global ASK", () => {
				const global = { ask: { files: ["*.key"] } }
				const project = { block: { files: ["*.key"] } }

				const guard = createHierarchicalTestGuard(global, project)

				const result = guard.validateFileAccess("private.key")
				expect(result?.blocked).toBe(true)
				expect(result?.requiresApproval).toBeUndefined()
				expect(result?.ruleType).toBe("block")
			})

			it("should prioritize global BLOCK over project ASK", () => {
				const global = { block: { files: ["*secret*"] } }
				const project = { ask: { files: ["*secret*"] } }

				const guard = createHierarchicalTestGuard(global, project)

				const result = guard.validateFileAccess("secret.txt")
				expect(result?.blocked).toBe(true)
				expect(result?.requiresApproval).toBeUndefined()
				expect(result?.ruleType).toBe("block")
			})
		})

		describe("Configuration Combining", () => {
			it("should combine BLOCK rules from both sources", () => {
				const global = { block: { files: ["*secret*"] } }
				const project = { block: { files: ["*.key"] } }

				const guard = createHierarchicalTestGuard(global, project)

				// Both patterns should be blocked
				expect(guard.validateFileAccess("secret.txt")?.blocked).toBe(true)
				expect(guard.validateFileAccess("private.key")?.blocked).toBe(true)
			})

			it("should combine ASK rules from both sources when no conflicts", () => {
				const global = { ask: { files: [".env*"] } }
				const project = { ask: { files: ["*.json"] } }

				const guard = createHierarchicalTestGuard(global, project)

				// Both patterns should require approval
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBe(true)
				expect(guard.validateFileAccess("config.json")?.requiresApproval).toBe(true)
			})

			it("should combine commands from both sources", () => {
				const global = {
					block: { commands: ["env"] },
					ask: { commands: ["cat"] },
				}
				const project = {
					block: { commands: ["docker"] },
					ask: { commands: ["npm"] },
				}

				const guard = createHierarchicalTestGuard(global, project)

				// All commands should be handled according to their rules
				expect(guard.validateCommand("env")?.blocked).toBe(true)
				expect(guard.validateCommand("docker")?.blocked).toBe(true)
				expect(guard.validateCommand("cat")?.requiresApproval).toBe(true)
				expect(guard.validateCommand("npm")?.requiresApproval).toBe(true)
			})
		})

		describe("Missing Configuration Handling", () => {
			it("should handle missing global config gracefully", () => {
				const global = {} // Empty global config
				const project = { block: { files: ["*.key"] } }

				const guard = createHierarchicalTestGuard(global, project)

				expect(guard.validateFileAccess("private.key")?.blocked).toBe(true)
			})

			it("should handle missing project config gracefully", () => {
				const global = { block: { files: ["*secret*"] } }
				const project = {} // Empty project config

				const guard = createHierarchicalTestGuard(global, project)

				expect(guard.validateFileAccess("secret.txt")?.blocked).toBe(true)
			})

			it("should handle both configs missing gracefully", () => {
				const global = {} // Empty global config
				const project = {} // Empty project config

				const guard = createHierarchicalTestGuard(global, project)

				// Should not block anything when no rules are defined
				expect(guard.validateFileAccess("any-file.txt")).toBeNull()
				expect(guard.validateCommand("any-command")).toBeNull()
			})
		})

		describe("Three-Tier Configuration System", () => {
			it("should merge global → project → custom configurations correctly", () => {
				const global = {
					block: { files: ["*secret*"], commands: ["env"] },
					ask: { files: [".env*"], commands: ["cat"] },
				}

				const project = {
					block: { files: ["*.key"], commands: ["docker"] },
					ask: { files: ["*.json"], commands: ["npm"] },
				}

				const custom = {
					block: { files: ["*password*"], commands: ["kubectl"] },
					ask: { files: ["*.yaml"], commands: ["helm"] },
				}

				const guard = createHierarchicalTestGuard(global, project, custom)

				// All three levels should contribute to BLOCK rules
				expect(guard.validateFileAccess("secret.txt")?.blocked).toBe(true) // global
				expect(guard.validateFileAccess("private.key")?.blocked).toBe(true) // project
				expect(guard.validateFileAccess("password.dat")?.blocked).toBe(true) // custom
				expect(guard.validateCommand("env")?.blocked).toBe(true) // global
				expect(guard.validateCommand("docker")?.blocked).toBe(true) // project
				expect(guard.validateCommand("kubectl")?.blocked).toBe(true) // custom

				// All three levels should contribute to ASK rules (when not blocked)
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBe(true) // global
				expect(guard.validateFileAccess("config.json")?.requiresApproval).toBe(true) // project
				expect(guard.validateFileAccess("settings.yaml")?.requiresApproval).toBe(true) // custom
				expect(guard.validateCommand("cat")?.requiresApproval).toBe(true) // global
				expect(guard.validateCommand("npm")?.requiresApproval).toBe(true) // project
				expect(guard.validateCommand("helm")?.requiresApproval).toBe(true) // custom
			})

			it("should prioritize custom BLOCK over global/project ASK", () => {
				const global = { ask: { files: ["*.key"] } }
				const project = { ask: { files: ["*.key"] } }
				const custom = { block: { files: ["*.key"] } }

				const guard = createHierarchicalTestGuard(global, project, custom)

				const result = guard.validateFileAccess("private.key")
				expect(result?.blocked).toBe(true)
				expect(result?.requiresApproval).toBeUndefined()
				expect(result?.ruleType).toBe("block")
			})

			it("should handle custom config with empty values", () => {
				const global = { block: { files: ["*secret*"] } }
				const project = { ask: { files: [".env*"] } }
				const custom = { block: { files: [] }, ask: { files: [] } }

				const guard = createHierarchicalTestGuard(global, project, custom)

				// Global and project rules should still work
				expect(guard.validateFileAccess("secret.txt")?.blocked).toBe(true)
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBe(true)
			})

			it("should handle missing custom config gracefully", () => {
				const global = { block: { files: ["*secret*"] } }
				const project = { ask: { files: [".env*"] } }
				// No custom config provided (undefined)

				const guard = createHierarchicalTestGuard(global, project)

				// Should work exactly like before
				expect(guard.validateFileAccess("secret.txt")?.blocked).toBe(true)
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBe(true)
			})
		})

		describe("Complex Hierarchical Scenarios", () => {
			it("should handle complex real-world configuration merging", () => {
				const global = {
					block: {
						files: ["confidential/**/*", "*secret*", "*password*"],
						env_vars: ["*_KEY", "*_TOKEN"],
						commands: ["env"],
					},
					ask: {
						files: [".env*", "*token*"],
						commands: ["cat"],
					},
				}

				const project = {
					block: {
						files: ["*.key", "*credential*"], // Additional project restrictions
						commands: ["docker"], // Project-specific command restriction
					},
					ask: {
						files: ["*.json", "*.yaml"], // Project wants to review config files
						commands: ["npm", "yarn"], // Project wants approval for package managers
					},
				}

				const guard = createHierarchicalTestGuard(global, project)

				// Global BLOCK rules should work
				expect(guard.validateFileAccess("confidential/secret.txt")?.blocked).toBe(true)
				expect(guard.validateFileAccess("password.txt")?.blocked).toBe(true)
				expect(guard.validateCommand("env")?.blocked).toBe(true)

				// Project BLOCK rules should work
				expect(guard.validateFileAccess("private.key")?.blocked).toBe(true)
				expect(guard.validateFileAccess("credentials.json")?.blocked).toBe(true)
				expect(guard.validateCommand("docker")?.blocked).toBe(true)

				// Global ASK rules should work (when not overridden by BLOCK)
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBe(true)
				expect(guard.validateFileAccess("api-token.txt")?.requiresApproval).toBe(true)
				expect(guard.validateCommand("cat")?.requiresApproval).toBe(true)

				// Project ASK rules should work (when not overridden by BLOCK)
				expect(guard.validateFileAccess("config.yaml")?.requiresApproval).toBe(true)
				expect(guard.validateCommand("npm")?.requiresApproval).toBe(true)

				// BLOCK should override ASK for same patterns
				// Note: credentials.json is blocked by project BLOCK, not asked by project ASK
				expect(guard.validateFileAccess("credentials.json")?.blocked).toBe(true)
				expect(guard.validateFileAccess("credentials.json")?.requiresApproval).toBeUndefined()
			})

			it("should remove ASK patterns that are also in BLOCK", () => {
				const global = {
					block: { files: [".env"] },
					ask: { files: [".env", "*.json"] }, // .env appears in both
				}
				const project = {
					block: { files: ["*.key"] },
					ask: { files: ["*.key", "*.yaml"] }, // *.key appears in both
				}

				const guard = createHierarchicalTestGuard(global, project)

				// Files that appear in BLOCK should be blocked, not asked
				expect(guard.validateFileAccess(".env")?.blocked).toBe(true)
				expect(guard.validateFileAccess(".env")?.requiresApproval).toBeUndefined()

				expect(guard.validateFileAccess("private.key")?.blocked).toBe(true)
				expect(guard.validateFileAccess("private.key")?.requiresApproval).toBeUndefined()

				// Files that only appear in ASK should require approval
				expect(guard.validateFileAccess("config.json")?.requiresApproval).toBe(true)
				expect(guard.validateFileAccess("config.yaml")?.requiresApproval).toBe(true)
			})
		})
	})
})

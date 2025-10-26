import { getBuiltInCommands, getBuiltInCommand, getBuiltInCommandNames } from "../built-in-commands"

describe("Built-in Commands", () => {
	describe("getBuiltInCommands", () => {
		it("should return all built-in commands", async () => {
			const commands = await getBuiltInCommands()

			expect(commands).toHaveLength(3)
			expect(commands.map((cmd) => cmd.name)).toEqual(expect.arrayContaining(["init", "profiles", "models"]))

			// Verify all commands have required properties
			commands.forEach((command) => {
				expect(command.name).toBeDefined()
				expect(typeof command.name).toBe("string")
				expect(command.content).toBeDefined()
				expect(typeof command.content).toBe("string")
				expect(command.source).toBe("built-in")
				expect(command.filePath).toMatch(/^<built-in:.+>$/)
				expect(command.description).toBeDefined()
				expect(typeof command.description).toBe("string")
			})
		})

		it("should return commands with proper content", async () => {
			const commands = await getBuiltInCommands()

			const initCommand = commands.find((cmd) => cmd.name === "init")
			expect(initCommand).toBeDefined()
			expect(initCommand!.content).toContain("AGENTS.md")
			expect(initCommand!.content).toContain(".roo/rules-")
			expect(initCommand!.description).toBe(
				"Analyze codebase and create concise AGENTS.md files for AI assistants",
			)

			const profilesCommand = commands.find((cmd) => cmd.name === "profiles")
			expect(profilesCommand).toBeDefined()
			expect(profilesCommand!.content).toContain("/profiles")
			expect(profilesCommand!.description).toBe("Open the API configuration profile selector in the chat input")

			const modelsCommand = commands.find((cmd) => cmd.name === "models")
			expect(modelsCommand).toBeDefined()
			expect(modelsCommand!.content).toContain("/models")
			expect(modelsCommand!.description).toBe("Open the model picker for the active API configuration profile")
		})
	})

	describe("getBuiltInCommand", () => {
		it("should return specific built-in command by name", async () => {
			const initCommand = await getBuiltInCommand("init")

			expect(initCommand).toBeDefined()
			expect(initCommand!.name).toBe("init")
			expect(initCommand!.source).toBe("built-in")
			expect(initCommand!.filePath).toBe("<built-in:init>")
			expect(initCommand!.content).toContain("AGENTS.md")
			expect(initCommand!.description).toBe(
				"Analyze codebase and create concise AGENTS.md files for AI assistants",
			)
		})

		it("should return profiles and models commands", async () => {
			const profilesCommand = await getBuiltInCommand("profiles")
			expect(profilesCommand).toBeDefined()
			expect(profilesCommand!.filePath).toBe("<built-in:profiles>")
			expect(profilesCommand!.description).toBe("Open the API configuration profile selector in the chat input")

			const modelsCommand = await getBuiltInCommand("models")
			expect(modelsCommand).toBeDefined()
			expect(modelsCommand!.filePath).toBe("<built-in:models>")
			expect(modelsCommand!.description).toBe("Open the model picker for the active API configuration profile")
		})

		it("should return undefined for non-existent command", async () => {
			const nonExistentCommand = await getBuiltInCommand("non-existent")
			expect(nonExistentCommand).toBeUndefined()
		})

		it("should handle empty string command name", async () => {
			const emptyCommand = await getBuiltInCommand("")
			expect(emptyCommand).toBeUndefined()
		})
	})

	describe("getBuiltInCommandNames", () => {
		it("should return all built-in command names", async () => {
			const names = await getBuiltInCommandNames()

			expect(names).toHaveLength(3)
			expect(names).toEqual(expect.arrayContaining(["init", "profiles", "models"]))
			// Order doesn't matter since it's based on filesystem order
			expect(names.sort()).toEqual(["init", "models", "profiles"])
		})

		it("should return array of strings", async () => {
			const names = await getBuiltInCommandNames()

			names.forEach((name) => {
				expect(typeof name).toBe("string")
				expect(name.length).toBeGreaterThan(0)
			})
		})
	})

	describe("Command Content Validation", () => {
		it("init command should have comprehensive content", async () => {
			const command = await getBuiltInCommand("init")
			const content = command!.content

			// Should contain key sections
			expect(content).toContain("Please analyze this codebase")
			expect(content).toContain("Build/lint/test commands")
			expect(content).toContain("Code style guidelines")
			expect(content).toContain("non-obvious")
			expect(content).toContain("discovered by reading files")

			// Should mention important concepts
			expect(content).toContain("AGENTS.md")
			expect(content).toContain(".roo/rules-")
			expect(content).toContain("rules-code")
			expect(content).toContain("rules-debug")
			expect(content).toContain("rules-ask")
			expect(content).toContain("rules-architect")
		})

		it("profiles command should describe UI interaction", async () => {
			const command = await getBuiltInCommand("profiles")
			expect(command!.content).toContain("open the API configuration profile selector")
			expect(command!.content).toContain("/profiles")
		})

		it("models command should mention alias and profile scope", async () => {
			const command = await getBuiltInCommand("models")
			const content = command!.content
			expect(content).toContain("/models")
			expect(content).toContain("active API configuration profile")
		})
	})
})

import { getBuiltInCommands, getBuiltInCommand, getBuiltInCommandNames } from "../built-in-commands"

describe("Built-in Commands", () => {
	describe("getBuiltInCommands", () => {
		it("should return all built-in commands", async () => {
			const commands = await getBuiltInCommands()

			expect(commands).toHaveLength(9)
			expect(commands.map((cmd) => cmd.name)).toEqual(
				expect.arrayContaining([
					"init",
					"project-wiki",
					"tdd",
					"dotest",
					"generate-rules",
					"vibeplus-propsal",
					"vibeplus-apply",
					"vibeplus-archive",
				]),
			)

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

			expect(names).toHaveLength(9)
			expect(names).toEqual(
				expect.arrayContaining([
					"dotest",
					"generate-rules",
					"init",
					"openspec-init",
					"project-wiki",
					"tdd",
					"vibeplus-propsal",
					"vibeplus-apply",
					"vibeplus-archive",
				]),
			)
			// Order doesn't matter since it's based on filesystem order
			expect(names.sort()).toEqual([
				"dotest",
				"generate-rules",
				"init",
				"openspec-init",
				"project-wiki",
				"tdd",
				"vibeplus-apply",
				"vibeplus-archive",
				"vibeplus-propsal",
			])
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

		it("vibeplus-propsal command should have proper content", async () => {
			const command = await getBuiltInCommand("vibeplus-propsal")
			const content = command!.content

			expect(command!.description).toBe("构建新的VibePlus变更。")
			expect(command!.argumentHint).toBe("功能描述或请求")
			expect(content).toContain("VIBEPLUS:START")
			expect(content).toContain("VIBEPLUS:END")
			expect(content).toContain("%command-vibeplus-propsal%")
		})

		it("vibeplus-apply command should have proper content", async () => {
			const command = await getBuiltInCommand("vibeplus-apply")
			const content = command!.content

			expect(command!.description).toBe("实施已批准的VibePlus变更并保持任务同步。")
			expect(command!.argumentHint).toBe("change-id")
			expect(content).toContain("VIBEPLUS:START")
			expect(content).toContain("VIBEPLUS:END")
			expect(content).toContain("%command-vibeplus-apply%")
		})

		it("vibeplus-archive command should have proper content", async () => {
			const command = await getBuiltInCommand("vibeplus-archive")
			const content = command!.content

			expect(command!.description).toBe("归档已部署的VibePlus变更并更新规格。")
			expect(command!.argumentHint).toBe("change-id")
			expect(content).toContain("VIBEPLUS:START")
			expect(content).toContain("VIBEPLUS:END")
			expect(content).toContain("%command-vibeplus-archive%")
		})
	})
})

// npx vitest run src/utils/__tests__/slashCommandDetection.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { detectSlashCommands, getFirstSlashCommand } from "../slashCommandDetection"

// Mock the modes module
vi.mock("../../shared/modes", () => ({
	modes: [
		{ slug: "code", name: "Code" },
		{ slug: "architect", name: "Architect" },
		{ slug: "debug", name: "Debug" },
		{ slug: "ask", name: "Ask" },
	],
	getModeBySlug: vi.fn((slug: string) => {
		const modeMap: Record<string, any> = {
			code: { slug: "code", name: "Code" },
			architect: { slug: "architect", name: "Architect" },
			debug: { slug: "debug", name: "Debug" },
			ask: { slug: "ask", name: "Ask" },
		}
		return modeMap[slug]
	}),
}))

describe("slashCommandDetection", () => {
	describe("detectSlashCommands", () => {
		it("should detect mode switch commands", () => {
			const text = "Let me switch to /code mode to implement this"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(1)
			expect(commands[0]).toEqual({
				fullCommand: "/code",
				commandName: "code",
				type: "mode_switch",
			})
		})

		it("should detect custom commands", () => {
			const text = "I'll use /deploy to deploy this application"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(1)
			expect(commands[0]).toEqual({
				fullCommand: "/deploy",
				commandName: "deploy",
				type: "custom",
			})
		})

		it("should detect multiple commands in one text", () => {
			const text = "First /architect the solution, then /code it, and finally /deploy"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(3)
			expect(commands[0]).toEqual({
				fullCommand: "/architect",
				commandName: "architect",
				type: "mode_switch",
			})
			expect(commands[1]).toEqual({
				fullCommand: "/code",
				commandName: "code",
				type: "mode_switch",
			})
			expect(commands[2]).toEqual({
				fullCommand: "/deploy",
				commandName: "deploy",
				type: "custom",
			})
		})

		it("should detect commands at the beginning of text", () => {
			const text = "/debug this issue please"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(1)
			expect(commands[0]).toEqual({
				fullCommand: "/debug",
				commandName: "debug",
				type: "mode_switch",
			})
		})

		it("should detect commands at the beginning of new lines", () => {
			const text = "First do this:\n/architect the solution\nThen:\n/code the implementation"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(2)
			expect(commands[0]).toEqual({
				fullCommand: "/architect",
				commandName: "architect",
				type: "mode_switch",
			})
			expect(commands[1]).toEqual({
				fullCommand: "/code",
				commandName: "code",
				type: "mode_switch",
			})
		})

		it("should handle commands with hyphens and underscores", () => {
			const text = "Use /my-custom_command to do this"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(1)
			expect(commands[0]).toEqual({
				fullCommand: "/my-custom_command",
				commandName: "my-custom_command",
				type: "custom",
			})
		})

		it("should not detect invalid slash patterns", () => {
			const text = "This is a file path /home/user/file.txt and a URL https://example.com/path"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(0)
		})

		it("should not detect slash commands in the middle of words", () => {
			const text = "The file://path and http://example.com don't contain commands"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(0)
		})

		it("should handle empty or null input", () => {
			expect(detectSlashCommands("")).toEqual([])
			expect(detectSlashCommands(null as any)).toEqual([])
			expect(detectSlashCommands(undefined as any)).toEqual([])
		})

		it("should handle text with no commands", () => {
			const text = "This is just regular text with no slash commands"
			const commands = detectSlashCommands(text)

			expect(commands).toEqual([])
		})

		it("should detect commands that start with numbers after the slash", () => {
			const text = "Use /2fa to enable two-factor authentication"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(0) // Should not match as it starts with a number
		})

		it("should detect commands that contain numbers", () => {
			const text = "Use /deploy2prod to deploy to production"
			const commands = detectSlashCommands(text)

			expect(commands).toHaveLength(1)
			expect(commands[0]).toEqual({
				fullCommand: "/deploy2prod",
				commandName: "deploy2prod",
				type: "custom",
			})
		})
	})

	describe("getFirstSlashCommand", () => {
		it("should return the first command when multiple exist", () => {
			const text = "First /architect then /code then /deploy"
			const command = getFirstSlashCommand(text)

			expect(command).toEqual({
				fullCommand: "/architect",
				commandName: "architect",
				type: "mode_switch",
			})
		})

		it("should return null when no commands exist", () => {
			const text = "No commands here"
			const command = getFirstSlashCommand(text)

			expect(command).toBeNull()
		})

		it("should return the single command when only one exists", () => {
			const text = "Please /debug this issue"
			const command = getFirstSlashCommand(text)

			expect(command).toEqual({
				fullCommand: "/debug",
				commandName: "debug",
				type: "mode_switch",
			})
		})
	})
})

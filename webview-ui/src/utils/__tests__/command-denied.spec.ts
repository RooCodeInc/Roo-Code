// pnpm --filter @roo-code/vscode-webview test src/utils/__tests__/command-denied.spec.ts

import { getDeniedSubcommands } from "../command-denied"

vi.mock("@roo/parse-command", () => ({
	parseCommand: (command: string) => {
		if (!command?.trim()) return []
		// Simple split by &&, ||, ;, | for testing
		return command
			.split(/\s*(?:&&|\|\||;|\|)\s*/)
			.map((c) => c.trim())
			.filter(Boolean)
	},
}))

describe("getDeniedSubcommands", () => {
	it("should return empty array when command is empty", () => {
		expect(getDeniedSubcommands("", ["npm"], ["rm"])).toEqual([])
	})

	it("should return empty array when deniedCommands is empty", () => {
		expect(getDeniedSubcommands("rm -rf /", ["npm"], [])).toEqual([])
	})

	it("should return empty array when no sub-commands are denied", () => {
		expect(getDeniedSubcommands("npm install", ["npm"], ["rm"])).toEqual([])
	})

	it("should identify a single denied command", () => {
		expect(getDeniedSubcommands("rm -rf /", ["npm"], ["rm"])).toEqual(["rm -rf /"])
	})

	it("should identify denied commands in chained commands", () => {
		const result = getDeniedSubcommands("npm install && rm -rf /", ["npm"], ["rm"])
		expect(result).toEqual(["rm -rf /"])
	})

	it("should identify multiple denied commands", () => {
		const result = getDeniedSubcommands("rm file.txt && npm install && rm -rf /tmp", ["npm"], ["rm"])
		expect(result).toEqual(["rm file.txt", "rm -rf /tmp"])
	})

	it("should respect longest prefix match - allow wins when more specific", () => {
		// "rm -i" is allowed and more specific than denied "rm"
		const result = getDeniedSubcommands("rm -i file.txt", ["rm -i"], ["rm"])
		expect(result).toEqual([])
	})

	it("should respect longest prefix match - deny wins when more specific", () => {
		// "git push" is denied and more specific than allowed "git"
		const result = getDeniedSubcommands("git push origin main", ["git"], ["git push"])
		expect(result).toEqual(["git push origin main"])
	})

	it("should respect longest prefix match - deny wins when equal length", () => {
		const result = getDeniedSubcommands("rm file.txt", ["rm"], ["rm"])
		expect(result).toEqual(["rm file.txt"])
	})

	it("should handle commands with no allowed list matches", () => {
		const result = getDeniedSubcommands("rm -rf /", [], ["rm"])
		expect(result).toEqual(["rm -rf /"])
	})

	it("should be case-insensitive", () => {
		const result = getDeniedSubcommands("RM -rf /", ["npm"], ["rm"])
		expect(result).toEqual(["RM -rf /"])
	})

	it("should handle mixed allowed and denied in chain", () => {
		const result = getDeniedSubcommands("git status && rm file && npm test", ["git", "npm"], ["rm"])
		expect(result).toEqual(["rm file"])
	})
})

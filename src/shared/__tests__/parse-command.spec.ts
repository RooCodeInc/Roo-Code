import { parseCommand } from "../parse-command"

describe("parseCommand", () => {
	describe("basic command parsing", () => {
		it("should return empty array for empty command", () => {
			expect(parseCommand("")).toEqual([])
			expect(parseCommand("   ")).toEqual([])
			expect(parseCommand(null as any)).toEqual([])
			expect(parseCommand(undefined as any)).toEqual([])
		})

		it("should parse simple commands", () => {
			expect(parseCommand("echo hello")).toEqual(["echo hello"])
			expect(parseCommand("git status")).toEqual(["git status"])
		})

		it("should split commands by chain operators", () => {
			expect(parseCommand("echo hello && echo world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello || echo world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello; echo world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello | grep h")).toEqual(["echo hello", "grep h"])
		})

		it("should split commands by newlines", () => {
			expect(parseCommand("echo hello\necho world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello\r\necho world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello\recho world")).toEqual(["echo hello", "echo world"])
		})

		it("should skip empty lines", () => {
			expect(parseCommand("echo hello\n\necho world")).toEqual(["echo hello", "echo world"])
			expect(parseCommand("echo hello\n   \necho world")).toEqual(["echo hello", "echo world"])
		})
	})

	describe("quoted string handling", () => {
		it("should preserve double-quoted strings", () => {
			expect(parseCommand('echo "hello world"')).toEqual(['echo "hello world"'])
		})

		it("should preserve double-quoted strings with special characters", () => {
			expect(parseCommand('echo "hello && world"')).toEqual(['echo "hello && world"'])
		})

		// Note: shell-quote strips single quotes but preserves their content
		it("should handle single-quoted strings (quotes stripped by shell-quote)", () => {
			expect(parseCommand("echo 'hello world'")).toEqual(["echo hello world"])
		})
	})

	describe("multiline quoted string handling", () => {
		it("should preserve multiline double-quoted strings", () => {
			const command = 'bd create "This is a\nmultiline description"'
			const result = parseCommand(command)
			expect(result).toEqual(['bd create "This is a\nmultiline description"'])
		})

		it("should preserve multiline single-quoted strings", () => {
			const command = "bd create 'This is a\nmultiline description'"
			const result = parseCommand(command)
			expect(result).toEqual(["bd create 'This is a\nmultiline description'"])
		})

		it("should handle Windows-style line endings in multiline quotes", () => {
			const command = 'bd create "This is a\r\nmultiline description"'
			const result = parseCommand(command)
			expect(result).toEqual(['bd create "This is a\r\nmultiline description"'])
		})

		it("should handle old Mac-style line endings in multiline quotes", () => {
			const command = 'bd create "This is a\rmultiline description"'
			const result = parseCommand(command)
			expect(result).toEqual(['bd create "This is a\rmultiline description"'])
		})

		it("should preserve multiline strings with multiple newlines", () => {
			const command = 'echo "line1\nline2\nline3"'
			const result = parseCommand(command)
			expect(result).toEqual(['echo "line1\nline2\nline3"'])
		})

		it("should handle multiple multiline quoted strings in one command", () => {
			const command = 'echo "first\nmultiline" && echo "second\nmultiline"'
			const result = parseCommand(command)
			expect(result).toEqual(['echo "first\nmultiline"', 'echo "second\nmultiline"'])
		})

		it("should handle mixed single and double multiline quotes", () => {
			const command = "echo \"double\nquote\" && echo 'single\nquote'"
			const result = parseCommand(command)
			expect(result).toEqual(['echo "double\nquote"', "echo 'single\nquote'"])
		})

		it("should handle regular newlines between commands with multiline strings", () => {
			const command = 'bd create "This is a\nmultiline description"\necho done'
			const result = parseCommand(command)
			expect(result).toEqual(['bd create "This is a\nmultiline description"', "echo done"])
		})

		it("should handle escaped quotes within multiline double-quoted strings", () => {
			const command = 'echo "line1\nline2 with \\"escaped\\" quotes"'
			const result = parseCommand(command)
			expect(result).toEqual(['echo "line1\nline2 with \\"escaped\\" quotes"'])
		})

		it("should handle beads create command with multiline description", () => {
			// This is the exact use case from the bug report
			const command = `bd create "A tool that helps users manage their tasks.
It supports multiple features:
- Adding tasks
- Removing tasks
- Listing tasks"`
			const result = parseCommand(command)
			expect(result).toHaveLength(1)
			expect(result[0]).toContain("bd create")
			expect(result[0]).toContain("A tool that helps users manage their tasks.")
			expect(result[0]).toContain("- Adding tasks")
		})
	})

	describe("subshell handling", () => {
		// Note: The parser extracts subshell commands as separate entries
		it("should extract subshell commands", () => {
			expect(parseCommand("echo $(date)")).toEqual(["echo", "date"])
		})

		it("should extract backtick commands", () => {
			expect(parseCommand("echo `date`")).toEqual(["echo", "date"])
		})
	})

	describe("variable handling", () => {
		it("should preserve variable references", () => {
			expect(parseCommand("echo $HOME")).toEqual(["echo $HOME"])
		})

		it("should preserve parameter expansions", () => {
			expect(parseCommand("echo ${HOME}")).toEqual(["echo ${HOME}"])
		})
	})

	describe("redirection handling", () => {
		it("should preserve redirections", () => {
			expect(parseCommand("echo hello > output.txt")).toEqual(["echo hello > output.txt"])
		})

		it("should preserve PowerShell-style redirections", () => {
			expect(parseCommand("command 2>&1")).toEqual(["command 2>&1"])
		})
	})
})

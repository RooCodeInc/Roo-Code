import { parseCommand, joinQuotedLines } from "../parse-command"

describe("joinQuotedLines", () => {
	it("should return empty array for empty input", () => {
		expect(joinQuotedLines("")).toEqual([])
		expect(joinQuotedLines(null as any)).toEqual([])
		expect(joinQuotedLines(undefined as any)).toEqual([])
	})

	it("should handle single line commands without quotes", () => {
		expect(joinQuotedLines("echo hello")).toEqual(["echo hello"])
		expect(joinQuotedLines("git status")).toEqual(["git status"])
	})

	it("should split multiple lines without quotes", () => {
		expect(joinQuotedLines("echo hello\necho world")).toEqual(["echo hello", "echo world"])
		expect(joinQuotedLines("git status\ngit log")).toEqual(["git status", "git log"])
	})

	it("should keep multiline double-quoted strings together", () => {
		const input = 'bd create "This is a\nmultiline description"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should keep multiline single-quoted strings together", () => {
		const input = "bd create 'This is a\nmultiline description'"
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle Windows line endings (CRLF) within quotes", () => {
		const input = 'bd create "This is a\r\nmultiline description"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle Windows line endings (CRLF) between commands", () => {
		const input = "echo hello\r\necho world"
		expect(joinQuotedLines(input)).toEqual(["echo hello", "echo world"])
	})

	it("should handle old Mac line endings (CR) within quotes", () => {
		const input = 'bd create "This is a\rmultiline description"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle multiple newlines within quotes", () => {
		const input = 'bd create "Line 1\nLine 2\nLine 3"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle quoted strings followed by newline and another command", () => {
		const input = 'bd create "multiline\ndesc"\necho done'
		expect(joinQuotedLines(input)).toEqual(['bd create "multiline\ndesc"', "echo done"])
	})

	it("should handle escaped quotes within double-quoted strings", () => {
		const input = 'echo "hello \\"world\\"\nline 2"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle single quotes within double quotes", () => {
		const input = 'echo "it\'s\na test"'
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should handle double quotes within single quotes", () => {
		// Single quotes preserve everything literally
		const input = "echo 'He said \"hello\"\nworld'"
		expect(joinQuotedLines(input)).toEqual([input])
	})

	it("should skip empty lines between commands", () => {
		expect(joinQuotedLines("echo hello\n\necho world")).toEqual(["echo hello", "echo world"])
		expect(joinQuotedLines("echo hello\n   \necho world")).toEqual(["echo hello", "echo world"])
	})

	it("should handle complex multiline commands with command chaining", () => {
		const input = 'bd create "desc\nmore" && npm install\necho done'
		expect(joinQuotedLines(input)).toEqual(['bd create "desc\nmore" && npm install', "echo done"])
	})
})

describe("parseCommand", () => {
	it("should return empty array for empty input", () => {
		expect(parseCommand("")).toEqual([])
		expect(parseCommand("   ")).toEqual([])
		expect(parseCommand(null as any)).toEqual([])
		expect(parseCommand(undefined as any)).toEqual([])
	})

	it("should parse simple single command", () => {
		expect(parseCommand("echo hello")).toEqual(["echo hello"])
		expect(parseCommand("git status")).toEqual(["git status"])
	})

	it("should parse command chain with &&", () => {
		expect(parseCommand("npm install && npm test")).toEqual(["npm install", "npm test"])
	})

	it("should parse command chain with ||", () => {
		expect(parseCommand("npm test || echo failed")).toEqual(["npm test", "echo failed"])
	})

	it("should parse command chain with ;", () => {
		expect(parseCommand("echo hello; echo world")).toEqual(["echo hello", "echo world"])
	})

	it("should parse commands on separate lines", () => {
		expect(parseCommand("echo hello\necho world")).toEqual(["echo hello", "echo world"])
	})

	it("should handle multiline double-quoted strings as single command", () => {
		const input = 'bd create "This is a\nmultiline description"'
		const result = parseCommand(input)
		expect(result).toEqual(['bd create "This is a\nmultiline description"'])
	})

	it("should handle multiline single-quoted strings as single command", () => {
		const input = "bd create 'This is a\nmultiline description'"
		const result = parseCommand(input)
		// Note: shell-quote strips single quotes, but the multiline content stays together
		expect(result.length).toBe(1)
		expect(result[0]).toContain("bd create")
		expect(result[0]).toContain("This is a")
		expect(result[0]).toContain("multiline description")
	})

	it("should handle multiline quoted string with command chain on same line", () => {
		const input = 'bd create "desc\nmore" && echo done'
		const result = parseCommand(input)
		expect(result).toEqual(['bd create "desc\nmore"', "echo done"])
	})

	it("should handle multiline quoted string followed by newline command", () => {
		const input = 'bd create "desc\nmore"\necho done'
		const result = parseCommand(input)
		expect(result).toEqual(['bd create "desc\nmore"', "echo done"])
	})

	it("should handle real-world beads create command", () => {
		const input = `bd create "This is the first line.
This is the second line.
This is the third line."`
		const result = parseCommand(input)
		expect(result.length).toBe(1)
		expect(result[0]).toContain("bd create")
		expect(result[0]).toContain("first line")
		expect(result[0]).toContain("third line")
	})

	it("should handle beads command followed by another command", () => {
		const input = `bd create "Multiline
description" && npm install`
		const result = parseCommand(input)
		expect(result).toEqual(['bd create "Multiline\ndescription"', "npm install"])
	})

	it("should handle multiple multiline quoted strings in sequence", () => {
		const input = 'echo "Line 1\nLine 2" && echo "Line 3\nLine 4"'
		const result = parseCommand(input)
		expect(result).toEqual(['echo "Line 1\nLine 2"', 'echo "Line 3\nLine 4"'])
	})

	it("should handle Windows line endings in multiline quotes", () => {
		const input = 'bd create "Line 1\r\nLine 2"'
		const result = parseCommand(input)
		expect(result).toEqual(['bd create "Line 1\r\nLine 2"'])
	})

	it("should preserve variable references", () => {
		const input = 'echo $HOME && echo "path: $PATH"'
		const result = parseCommand(input)
		expect(result.length).toBe(2)
		expect(result[0]).toContain("$HOME")
		expect(result[1]).toContain("$PATH")
	})

	it("should handle empty lines in the input", () => {
		const input = "echo hello\n\necho world"
		const result = parseCommand(input)
		expect(result).toEqual(["echo hello", "echo world"])
	})
})

describe("parseCommand - auto-approval validation scenarios", () => {
	// These tests verify the fix for issue #10226:
	// Multiline commands with quoted strings should be correctly parsed
	// for auto-approval validation

	it("should correctly identify bd command prefix with multiline description", () => {
		const input = 'bd create "This is a\nmultiline\ndescription"'
		const result = parseCommand(input)

		// Should be a single command that starts with "bd"
		expect(result.length).toBe(1)
		expect(result[0].startsWith("bd ")).toBe(true)
	})

	it("should correctly split bd command from other commands", () => {
		const input = 'bd create "desc\nmore" && npm install'
		const result = parseCommand(input)

		expect(result.length).toBe(2)
		expect(result[0].startsWith("bd ")).toBe(true)
		expect(result[1].startsWith("npm ")).toBe(true)
	})

	it("should handle multiline command on separate lines from other commands", () => {
		const input = `bd create "multiline
description"
echo done`
		const result = parseCommand(input)

		expect(result.length).toBe(2)
		expect(result[0].startsWith("bd ")).toBe(true)
		expect(result[1]).toBe("echo done")
	})
})

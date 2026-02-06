/**
 * Tests for trigger detection logic.
 */

import { detectTrigger, formatRelativeTime, truncateText, getReplacementText } from "../triggers.js"

describe("detectTrigger", () => {
	it("returns null for empty input", () => {
		expect(detectTrigger("")).toBeNull()
	})

	it("returns null for normal text", () => {
		expect(detectTrigger("hello world")).toBeNull()
	})

	// ? — help trigger
	describe("help trigger (?)", () => {
		it("detects ? at line start", () => {
			const result = detectTrigger("?")
			expect(result).toEqual({ type: "help", query: "", triggerIndex: 0 })
		})

		it("detects ? with query", () => {
			const result = detectTrigger("?mod")
			expect(result).toEqual({ type: "help", query: "mod", triggerIndex: 0 })
		})

		it("returns null when ? has space in query", () => {
			expect(detectTrigger("? something")).toBeNull()
		})

		it("detects ? with leading whitespace", () => {
			const result = detectTrigger("  ?")
			expect(result).toEqual({ type: "help", query: "", triggerIndex: 2 })
		})
	})

	// / — slash command trigger
	describe("slash command trigger (/)", () => {
		it("detects / at line start", () => {
			const result = detectTrigger("/")
			expect(result).toEqual({ type: "slash", query: "", triggerIndex: 0 })
		})

		it("detects /new", () => {
			const result = detectTrigger("/new")
			expect(result).toEqual({ type: "slash", query: "new", triggerIndex: 0 })
		})

		it("returns null when slash command has space", () => {
			expect(detectTrigger("/command arg")).toBeNull()
		})
	})

	// ! — mode trigger
	describe("mode trigger (!)", () => {
		it("detects ! at line start", () => {
			const result = detectTrigger("!")
			expect(result).toEqual({ type: "mode", query: "", triggerIndex: 0 })
		})

		it("detects !code", () => {
			const result = detectTrigger("!code")
			expect(result).toEqual({ type: "mode", query: "code", triggerIndex: 0 })
		})

		it("returns null when mode has space", () => {
			expect(detectTrigger("!code stuff")).toBeNull()
		})
	})

	// # — history trigger
	describe("history trigger (#)", () => {
		it("detects # at line start", () => {
			const result = detectTrigger("#")
			expect(result).toEqual({ type: "history", query: "", triggerIndex: 0 })
		})

		it("detects # with query including spaces", () => {
			const result = detectTrigger("#fix bug")
			expect(result).toEqual({ type: "history", query: "fix bug", triggerIndex: 0 })
		})
	})

	// @ — file trigger
	describe("file trigger (@)", () => {
		it("detects @ anywhere in line", () => {
			const result = detectTrigger("check @")
			expect(result).toEqual({ type: "file", query: "", triggerIndex: 6 })
		})

		it("detects @src", () => {
			const result = detectTrigger("@src")
			expect(result).toEqual({ type: "file", query: "src", triggerIndex: 0 })
		})

		it("detects @ with text before", () => {
			const result = detectTrigger("look at @file")
			expect(result).toEqual({ type: "file", query: "file", triggerIndex: 8 })
		})

		it("returns null when @ query has space", () => {
			expect(detectTrigger("@some file")).toBeNull()
		})

		it("detects last @ in line with multiple @", () => {
			const result = detectTrigger("@first @second")
			expect(result).toEqual({ type: "file", query: "second", triggerIndex: 7 })
		})
	})

	// Multi-line
	describe("multi-line input", () => {
		it("only examines last line", () => {
			const result = detectTrigger("first line\n/cmd")
			expect(result).toEqual({ type: "slash", query: "cmd", triggerIndex: 0 })
		})

		it("returns null if last line has no trigger", () => {
			const result = detectTrigger("/cmd\nnormal text")
			expect(result).toBeNull()
		})
	})
})

describe("formatRelativeTime", () => {
	it("returns 'just now' for recent times", () => {
		expect(formatRelativeTime(Date.now() - 5000)).toBe("just now")
	})

	it("returns minutes for times within the hour", () => {
		expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe("5 mins ago")
	})

	it("returns '1 min ago' for single minute", () => {
		expect(formatRelativeTime(Date.now() - 90 * 1000)).toBe("1 min ago")
	})

	it("returns hours for times within the day", () => {
		expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe("3 hours ago")
	})

	it("returns days for older times", () => {
		expect(formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe("2 days ago")
	})
})

describe("truncateText", () => {
	it("returns text unchanged if within limit", () => {
		expect(truncateText("hello", 10)).toBe("hello")
	})

	it("truncates with ellipsis when too long", () => {
		expect(truncateText("hello world", 6)).toBe("hello…")
	})

	it("returns exact length text unchanged", () => {
		expect(truncateText("hello", 5)).toBe("hello")
	})
})

describe("getReplacementText", () => {
	it("replaces slash command text", () => {
		expect(getReplacementText("slash", "new", "/ne", 0)).toBe("/new ")
	})

	it("replaces file trigger text", () => {
		expect(getReplacementText("file", "src/app.ts", "check @src", 6)).toBe("check @/src/app.ts ")
	})

	it("clears input for mode selection", () => {
		expect(getReplacementText("mode", "code", "!co", 0)).toBe("")
	})

	it("clears input for history selection", () => {
		expect(getReplacementText("history", "task-id", "#fix", 0)).toBe("")
	})

	it("returns value for help selection", () => {
		expect(getReplacementText("help", "?modes", "?mo", 0)).toBe("?modes")
	})

	it("preserves text before trigger for file replacement", () => {
		expect(getReplacementText("file", "components/App.tsx", "look at @comp", 8)).toBe(
			"look at @/components/App.tsx ",
		)
	})

	it("handles unknown type by returning currentLine", () => {
		// Cast to any to pass an unknown type
		expect(getReplacementText("unknown" as any, "val", "current", 0)).toBe("current")
	})
})

// ================================================================
// Additional edge case tests
// ================================================================

describe("detectTrigger — edge cases", () => {
	it("returns null for only whitespace", () => {
		expect(detectTrigger("   ")).toBeNull()
	})

	it("handles tab characters in leading whitespace", () => {
		const result = detectTrigger("\t/cmd")
		expect(result).toEqual({ type: "slash", query: "cmd", triggerIndex: 1 })
	})

	it("handles multiple empty lines before trigger", () => {
		const result = detectTrigger("\n\n\n/test")
		expect(result).toEqual({ type: "slash", query: "test", triggerIndex: 0 })
	})

	it("does not detect trigger mid-word (e.g., email addresses with @)", () => {
		const result = detectTrigger("user@domain.com")
		// This should detect @ but query has a dot which is fine, no space
		expect(result).toEqual({ type: "file", query: "domain.com", triggerIndex: 4 })
	})

	it("handles @ trigger preceded by newline", () => {
		const result = detectTrigger("some text\n@file")
		expect(result).toEqual({ type: "file", query: "file", triggerIndex: 0 })
	})

	it("handles trigger at very end after space — no trigger", () => {
		// "/ " has a space after the slash so query includes " " → no trigger
		expect(detectTrigger("/ ")).toBeNull()
	})

	it("handles empty last line in multi-line input", () => {
		expect(detectTrigger("first\n")).toBeNull()
	})

	it("prioritizes help (?) over other triggers on same line", () => {
		const result = detectTrigger("?")
		expect(result?.type).toBe("help")
	})

	it("does not detect @ when query has space", () => {
		expect(detectTrigger("look at @some file")).toBeNull()
	})

	it("handles # trigger with empty query", () => {
		const result = detectTrigger("#")
		expect(result).toEqual({ type: "history", query: "", triggerIndex: 0 })
	})

	it("handles # trigger with leading whitespace and query", () => {
		const result = detectTrigger("  #search term")
		expect(result).toEqual({ type: "history", query: "search term", triggerIndex: 2 })
	})
})

describe("formatRelativeTime — edge cases", () => {
	it("returns '1 hour ago' for exactly 1 hour", () => {
		expect(formatRelativeTime(Date.now() - 60 * 60 * 1000)).toBe("1 hour ago")
	})

	it("returns '1 day ago' for exactly 1 day", () => {
		expect(formatRelativeTime(Date.now() - 24 * 60 * 60 * 1000)).toBe("1 day ago")
	})

	it("returns 'just now' for timestamps in the future", () => {
		// Future timestamps result in negative diff, Math.floor yields 0 or negative
		expect(formatRelativeTime(Date.now() + 10000)).toBe("just now")
	})

	it("returns 'just now' for exactly now", () => {
		expect(formatRelativeTime(Date.now())).toBe("just now")
	})
})

describe("truncateText — edge cases", () => {
	it("handles maxLength of 1", () => {
		expect(truncateText("hello", 1)).toBe("…")
	})

	it("handles maxLength of 0", () => {
		// Edge case: maxLength 0 means text.length (5) > 0, substring(0, -1) = ""
		expect(truncateText("hello", 0)).toBe("…")
	})

	it("handles empty text", () => {
		expect(truncateText("", 5)).toBe("")
	})

	it("handles text exactly maxLength - 1", () => {
		expect(truncateText("hell", 5)).toBe("hell")
	})
})

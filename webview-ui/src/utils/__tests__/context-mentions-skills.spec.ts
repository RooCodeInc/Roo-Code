import { describe, it, expect } from "vitest"
import {
	shouldShowContextMenu,
	getContextMenuOptions,
	insertSkill,
	ContextMenuOptionType,
	Skill,
} from "../context-mentions"

describe("Skill Autocomplete", () => {
	describe("shouldShowContextMenu", () => {
		it("should show menu when typing $ at start", () => {
			expect(shouldShowContextMenu("$", 1)).toBe(true)
		})

		it("should show menu when typing $ after whitespace", () => {
			expect(shouldShowContextMenu("hello $", 7)).toBe(true)
			expect(shouldShowContextMenu("hello world $", 13)).toBe(true)
		})

		it("should show menu when typing $ after newline", () => {
			expect(shouldShowContextMenu("hello\n$", 7)).toBe(true)
		})

		it("should show menu while typing skill name", () => {
			expect(shouldShowContextMenu("$pdf", 4)).toBe(true)
			expect(shouldShowContextMenu("$pdf-proc", 9)).toBe(true)
		})

		it("should not show menu when $ is in middle of word", () => {
			expect(shouldShowContextMenu("hello$world", 6)).toBe(false)
		})

		it("should not show menu after space following $skill-name", () => {
			expect(shouldShowContextMenu("$skill ", 7)).toBe(false)
		})
	})

	describe("getContextMenuOptions for skills", () => {
		const mockSkills: Skill[] = [
			{ name: "pdf-processing", description: "Extract text and tables from PDF files" },
			{ name: "code-review", description: "Review code for best practices" },
			{ name: "refactoring", description: "Refactor code for better maintainability" },
		]

		it("should return all skills when query is just $", () => {
			const options = getContextMenuOptions("$", null, [], [], undefined, undefined, mockSkills)

			expect(options).toHaveLength(4) // Section header + 3 skills
			expect(options[0]).toEqual({
				type: ContextMenuOptionType.SectionHeader,
				label: "Skills",
			})
			expect(options[1].type).toBe(ContextMenuOptionType.Skill)
			expect(options[1].value).toBe("pdf-processing")
			expect(options[1].label).toBe("$pdf-processing")
		})

		it("should filter skills by name", () => {
			const options = getContextMenuOptions("$pdf", null, [], [], undefined, undefined, mockSkills)

			expect(options).toHaveLength(2) // Section header + 1 skill
			expect(options[1].value).toBe("pdf-processing")
		})

		it("should filter skills using fuzzy matching", () => {
			const options = getContextMenuOptions("$code", null, [], [], undefined, undefined, mockSkills)

			expect(options.some((opt) => opt.value === "code-review")).toBe(true)
		})

		it("should return NoResults when no skills match", () => {
			const options = getContextMenuOptions("$nonexistent", null, [], [], undefined, undefined, mockSkills)

			expect(options).toEqual([{ type: ContextMenuOptionType.NoResults }])
		})

		it("should return NoResults when no skills are available", () => {
			const options = getContextMenuOptions("$", null, [], [], undefined, undefined, [])

			expect(options).toEqual([{ type: ContextMenuOptionType.NoResults }])
		})
	})

	describe("insertSkill", () => {
		it("should insert skill at cursor position", () => {
			const result = insertSkill("hello world", 5, "pdf-processing")

			expect(result.newValue).toBe("hello$pdf-processing  world")
			expect(result.skillIndex).toBe(5)
		})

		it("should replace $ when present before cursor", () => {
			const result = insertSkill("hello $", 7, "pdf-processing")

			expect(result.newValue).toBe("hello $pdf-processing ")
			expect(result.skillIndex).toBe(6)
		})

		it("should replace partial skill name when present", () => {
			const result = insertSkill("hello $pdf", 10, "pdf-processing")

			expect(result.newValue).toBe("hello $pdf-processing ")
			expect(result.skillIndex).toBe(6)
		})

		it("should add trailing space after skill", () => {
			const result = insertSkill("$", 1, "code-review")

			expect(result.newValue).toBe("$code-review ")
		})

		it("should work in middle of text", () => {
			const result = insertSkill("start $ end", 7, "refactoring")

			expect(result.newValue).toBe("start $refactoring  end")
			expect(result.skillIndex).toBe(6)
		})
	})
})

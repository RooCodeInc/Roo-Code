import { describe, it, expect, vi, beforeEach } from "vitest"
import { parseMentions } from "../index"
import type { SkillsManager } from "../../../services/skills/SkillsManager"

describe("parseMentions - Skill Resolution", () => {
	let mockSkillsManager: Partial<SkillsManager>
	let mockUrlContentFetcher: any

	beforeEach(() => {
		mockUrlContentFetcher = {
			launchBrowser: vi.fn(),
			urlToMarkdown: vi.fn(),
			closeBrowser: vi.fn(),
		}

		mockSkillsManager = {
			getSkillContent: vi.fn(),
		}
	})

	it("should replace $skill-name tokens with placeholders", async () => {
		vi.mocked(mockSkillsManager.getSkillContent!).mockResolvedValue({
			name: "pdf-processing",
			description: "Extract text from PDFs",
			path: "/path/to/skill/SKILL.md",
			source: "global",
			instructions: "# PDF Processing\n\nInstructions here",
		})

		const result = await parseMentions(
			"Please help with $pdf-processing task",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			mockSkillsManager as SkillsManager,
			"code",
		)

		expect(result.text).toContain("Skill '$pdf-processing' (see below for skill content)")
		expect(result.text).toContain('<skill name="pdf-processing">')
		expect(result.text).toContain("# PDF Processing")
		expect(result.text).toContain("Instructions here")
		expect(result.text).toContain("</skill>")
	})

	it("should handle multiple skills in one message", async () => {
		vi.mocked(mockSkillsManager.getSkillContent!).mockImplementation(async (name: string) => {
			const skills: Record<string, any> = {
				"pdf-processing": {
					name: "pdf-processing",
					description: "Extract text from PDFs",
					path: "/path/to/pdf/SKILL.md",
					source: "global",
					instructions: "# PDF Processing",
				},
				"code-review": {
					name: "code-review",
					description: "Review code",
					path: "/path/to/review/SKILL.md",
					source: "global",
					instructions: "# Code Review",
				},
			}
			return skills[name] || null
		})

		const result = await parseMentions(
			"Use $pdf-processing and $code-review",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			mockSkillsManager as SkillsManager,
			"code",
		)

		expect(result.text).toContain("Skill '$pdf-processing'")
		expect(result.text).toContain("Skill '$code-review'")
		expect(result.text).toContain('<skill name="pdf-processing">')
		expect(result.text).toContain('<skill name="code-review">')
	})

	it("should handle invalid skill names gracefully", async () => {
		vi.mocked(mockSkillsManager.getSkillContent!).mockResolvedValue(null)

		const result = await parseMentions(
			"Use $nonexistent skill",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			mockSkillsManager as SkillsManager,
			"code",
		)

		// Should not replace invalid skills
		expect(result.text).toBe("Use $nonexistent skill")
		expect(result.text).not.toContain("<skill")
	})

	it("should work without skillsManager", async () => {
		const result = await parseMentions(
			"Use $pdf-processing",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			undefined,
			"code",
		)

		// Should not process skills without manager
		expect(result.text).toBe("Use $pdf-processing")
		expect(result.text).not.toContain("<skill")
	})

	it("should handle skills with @ mentions and / commands", async () => {
		vi.mocked(mockSkillsManager.getSkillContent!).mockResolvedValue({
			name: "pdf-processing",
			description: "Extract text from PDFs",
			path: "/path/to/skill/SKILL.md",
			source: "global",
			instructions: "# PDF Processing",
		})

		const result = await parseMentions(
			"Use $pdf-processing on @/test.pdf",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			mockSkillsManager as SkillsManager,
			"code",
		)

		// Both should be processed
		expect(result.text).toContain("Skill '$pdf-processing'")
		expect(result.text).toContain("'test.pdf' (see below for file content)")
	})

	it("should handle skill names with hyphens and underscores", async () => {
		vi.mocked(mockSkillsManager.getSkillContent!).mockResolvedValue({
			name: "my-special_skill",
			description: "A test skill",
			path: "/path/to/skill/SKILL.md",
			source: "global",
			instructions: "# My Skill",
		})

		const result = await parseMentions(
			"Use $my-special_skill",
			"/workspace",
			mockUrlContentFetcher,
			undefined,
			undefined,
			false,
			true,
			50,
			undefined,
			mockSkillsManager as SkillsManager,
			"code",
		)

		expect(result.text).toContain("Skill '$my-special_skill'")
	})
})

import { resolveSkillContentForMode, buildSkillApprovalMessage, buildSkillResult } from "../skillInvocation"
import type { SkillLookup } from "../skillInvocation"
import type { SkillContent } from "../../../shared/skills"

describe("skillInvocation", () => {
	const mockSkillContent: SkillContent = {
		name: "test-skill",
		description: "A test skill",
		path: "/mock/.jabberwock/skills/test-skill/SKILL.md",
		source: "project",
		instructions: "Do the thing",
	}

	describe("resolveSkillContentForMode", () => {
		it("returns null when skillsManager is undefined", async () => {
			const result = await resolveSkillContentForMode(undefined, "test-skill", "code")
			expect(result).toBeNull()
		})

		it("delegates to skillsManager.getSkillContent with correct arguments", async () => {
			const skillsManager: SkillLookup = {
				getSkillContent: vi.fn().mockResolvedValue(mockSkillContent),
			}

			const result = await resolveSkillContentForMode(skillsManager, "test-skill", "architect")
			expect(skillsManager.getSkillContent).toHaveBeenCalledWith("test-skill", "architect")
			expect(result).toBe(mockSkillContent)
		})

		it("returns null when skillsManager returns null", async () => {
			const skillsManager: SkillLookup = {
				getSkillContent: vi.fn().mockResolvedValue(null),
			}

			const result = await resolveSkillContentForMode(skillsManager, "nonexistent", "code")
			expect(result).toBeNull()
		})
	})

	describe("buildSkillApprovalMessage", () => {
		it("produces valid JSON with skill, args, source, and description", () => {
			const message = buildSkillApprovalMessage("deploy", "staging", {
				source: "project",
				description: "Deploy to env",
			})

			expect(JSON.parse(message)).toEqual({
				tool: "skill",
				skill: "deploy",
				args: "staging",
				source: "project",
				description: "Deploy to env",
			})
		})

		it("includes undefined args when no args provided", () => {
			const message = buildSkillApprovalMessage("build", undefined, {
				source: "global",
				description: "Build project",
			})

			const parsed = JSON.parse(message)
			expect(parsed.args).toBeUndefined()
			expect(parsed.skill).toBe("build")
		})
	})

	describe("buildSkillResult", () => {
		it("builds full result with description, args, source, and instructions", () => {
			const result = buildSkillResult("deploy", "production", mockSkillContent)

			expect(result).toBe(
				`Skill: deploy\nDescription: A test skill\nProvided arguments: production\nSource: project\n\n--- Skill Instructions ---\n\nDo the thing`,
			)
		})

		it("omits description line when description is empty", () => {
			const skillContent = { ...mockSkillContent, description: "" }
			const result = buildSkillResult("deploy", "staging", skillContent)

			expect(result).not.toContain("Description:")
			expect(result).toContain("Skill: deploy")
			expect(result).toContain("Provided arguments: staging")
		})

		it("omits arguments line when args is undefined", () => {
			const result = buildSkillResult("deploy", undefined, mockSkillContent)

			expect(result).not.toContain("Provided arguments:")
			expect(result).toContain("Skill: deploy")
			expect(result).toContain("Description: A test skill")
		})

		it("includes source and instructions in all cases", () => {
			const result = buildSkillResult("minimal", undefined, {
				source: "global",
				description: "",
				instructions: "Step 1: do stuff",
			})

			expect(result).toContain("Source: global")
			expect(result).toContain("--- Skill Instructions ---")
			expect(result).toContain("Step 1: do stuff")
		})
	})
})

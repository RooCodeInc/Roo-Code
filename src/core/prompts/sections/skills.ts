import type { SkillsManager } from "../../../services/skills/SkillsManager"

type SkillsManagerLike = Pick<SkillsManager, "getSkillsForMode">

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&apos;")
}

/**
 * Generate the skills section for the system prompt.
 * Only includes skills relevant to the current mode.
 * Format matches the modes section style.
 *
 * @param skillsManager - The SkillsManager instance
 * @param currentMode - The current mode slug (e.g., 'code', 'architect')
 */
export async function getSkillsSection(
	skillsManager: SkillsManagerLike | undefined,
	currentMode: string | undefined,
): Promise<string> {
	if (!skillsManager || !currentMode) return ""

	// Get skills filtered by current mode (with override resolution)
	const skills = skillsManager.getSkillsForMode(currentMode)
	if (skills.length === 0) return ""

	const skillsXml = skills
		.map((skill) => {
			const name = escapeXml(skill.name)
			const description = escapeXml(skill.description)
			// Per the Agent Skills integration guidance for filesystem-based agents,
			// location should be an absolute path to the SKILL.md file.
			const location = escapeXml(skill.path)
			return `  <skill>\n    <name>${name}</name>\n    <description>${description}</description>\n    <location>${location}</location>\n  </skill>`
		})
		.join("\n")

	return `====

AVAILABLE SKILLS

<available_skills>
${skillsXml}
</available_skills>

How to use skills:
- This list is already filtered for the current mode ("${currentMode}") and includes any mode-specific skills from skills-${currentMode}/ (with project overriding global).
- Select a skill ONLY when the user's request clearly matches the skill's <description>.
- If multiple skills match, prefer the most specific one for the current task.
- Do NOT load every SKILL.md up front. Load the full SKILL.md only after you've decided to use that skill.

Activate a skill:
1. Load the full SKILL.md content into context.
   - Use execute_command to read it (e.g., cat "<location>").
2. Follow the skill instructions precisely.
3. Only load additional bundled files (scripts/, references/, assets/) if the SKILL.md instructions require them.
`
}

/**
 * Skill metadata for discovery (loaded at startup)
 * Only name and description are required for now
 */
export interface SkillMetadata {
	name: string // Required: skill identifier
	description: string // Required: when to use this skill
	path: string // Absolute path to SKILL.md
	source: "global" | "project" // Where the skill was discovered
	mode?: string // If set, skill is only available in this mode
}

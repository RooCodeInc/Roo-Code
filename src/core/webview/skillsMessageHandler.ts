import * as vscode from "vscode"

import type { SkillMetadata, WebviewMessage } from "@roo-code/types"

import type { ClineProvider } from "./ClineProvider"
import { openFile } from "../../integrations/misc/open-file"

/**
 * Handles the requestSkills message - returns all skills metadata
 */
export async function handleRequestSkills(provider: ClineProvider): Promise<SkillMetadata[]> {
	try {
		const skillsManager = provider.getSkillsManager()
		if (skillsManager) {
			const skills = skillsManager.getSkillsMetadata()
			await provider.postMessageToWebview({ type: "skills", skills })
			return skills
		} else {
			await provider.postMessageToWebview({ type: "skills", skills: [] })
			return []
		}
	} catch (error) {
		provider.log(`Error fetching skills: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
		await provider.postMessageToWebview({ type: "skills", skills: [] })
		return []
	}
}

/**
 * Handles the createSkill message - creates a new skill
 */
export async function handleCreateSkill(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source
		const skillDescription = message.skillDescription
		const skillMode = message.skillMode

		if (!skillName || !source || !skillDescription) {
			throw new Error("Missing required fields: skillName, source, or skillDescription")
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error("Skills manager not available")
		}

		const createdPath = await skillsManager.createSkill(skillName, source, skillDescription, skillMode)

		// Open the created file in the editor
		openFile(createdPath)

		// Send updated skills list
		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error creating skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to create skill: ${errorMessage}`)
		return undefined
	}
}

/**
 * Handles the deleteSkill message - deletes a skill
 */
export async function handleDeleteSkill(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source
		const skillMode = message.skillMode

		if (!skillName || !source) {
			throw new Error("Missing required fields: skillName or source")
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error("Skills manager not available")
		}

		await skillsManager.deleteSkill(skillName, source, skillMode)

		// Send updated skills list
		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error deleting skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to delete skill: ${errorMessage}`)
		return undefined
	}
}

/**
 * Handles the openSkillFile message - opens a skill file in the editor
 */
export async function handleOpenSkillFile(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const skillName = message.skillName
		const source = message.source
		const skillMode = message.skillMode

		if (!skillName || !source) {
			throw new Error("Missing required fields: skillName or source")
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error("Skills manager not available")
		}

		const skill = skillsManager.getSkill(skillName, source, skillMode)
		if (!skill) {
			throw new Error(`Skill "${skillName}" not found`)
		}

		openFile(skill.path)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error opening skill file: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to open skill file: ${errorMessage}`)
	}
}

import * as vscode from "vscode"

import type { SkillMetadata, WebviewMessage } from "@roo-code/types"

import type { ClineProvider } from "./ClineProvider"
import { openFile } from "../../integrations/misc/open-file"
import { t } from "../../i18n"

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
			throw new Error(t("skills:errors.missing_create_fields"))
		}

		// Built-in skills cannot be created
		if (source === "built-in") {
			throw new Error(t("skills:errors.cannot_modify_builtin"))
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
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
			throw new Error(t("skills:errors.missing_delete_fields"))
		}

		// Built-in skills cannot be deleted
		if (source === "built-in") {
			throw new Error(t("skills:errors.cannot_modify_builtin"))
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
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
 * Handles the moveSkill message - moves a skill to a different mode
 */
export async function handleMoveSkill(
	provider: ClineProvider,
	message: WebviewMessage,
): Promise<SkillMetadata[] | undefined> {
	try {
		const skillName = message.skillName
		const source = message.source
		const currentMode = message.skillMode
		const newMode = message.newSkillMode

		if (!skillName || !source) {
			throw new Error(t("skills:errors.missing_move_fields"))
		}

		// Built-in skills cannot be moved
		if (source === "built-in") {
			throw new Error(t("skills:errors.cannot_modify_builtin"))
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		await skillsManager.moveSkill(skillName, source, currentMode, newMode)

		// Send updated skills list
		const skills = skillsManager.getSkillsMetadata()
		await provider.postMessageToWebview({ type: "skills", skills })
		return skills
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error moving skill: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to move skill: ${errorMessage}`)
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
			throw new Error(t("skills:errors.missing_delete_fields"))
		}

		// Built-in skills cannot be opened as files (they have no file path)
		if (source === "built-in") {
			throw new Error(t("skills:errors.cannot_open_builtin"))
		}

		const skillsManager = provider.getSkillsManager()
		if (!skillsManager) {
			throw new Error(t("skills:errors.manager_unavailable"))
		}

		const skill = skillsManager.getSkill(skillName, source, skillMode)
		if (!skill) {
			throw new Error(t("skills:errors.skill_not_found", { name: skillName }))
		}

		openFile(skill.path)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`Error opening skill file: ${errorMessage}`)
		vscode.window.showErrorMessage(`Failed to open skill file: ${errorMessage}`)
	}
}

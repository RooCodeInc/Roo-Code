import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../utils/fs"

/**
 * Manages planning files for complex tasks
 * Located at: .siid-code/planning/[descriptive-name].md
 */
export class PlanningFileManager {
	/**
	 * Create a planning file for a complex task
	 */
	async createPlanningFile(
		cwd: string,
		taskDescription: string,
		filename: string,
		planContent: string,
	): Promise<string> {
		const planningDir = path.join(cwd, ".siid-code", "planning")

		try {
			// Create directory if it doesn't exist
			await fs.mkdir(planningDir, { recursive: true })

			// Use the AI-generated filename
			const fileName = `${filename}-plan.md`
			const filePath = path.join(planningDir, fileName)

			// Use AI-generated content or fallback to basic template
			const content = planContent || this.generateBasicTemplate(taskDescription)
			await fs.writeFile(filePath, content, "utf-8")

			// Return relative path for display
			return `.siid-code/planning/${fileName}`
		} catch (error) {
			console.error("Failed to create planning file:", error)
			throw error
		}
	}

	/**
	 * Check if planning file exists for a task
	 */
	async getPlanningFilePath(cwd: string, taskId: string): Promise<string | null> {
		try {
			const planningDir = path.join(cwd, ".siid-code", "planning")
			const filePath = path.join(planningDir, `${taskId}-plan.md`)

			const exists = await fileExistsAtPath(filePath)
			return exists ? `.siid-code/planning/${taskId}-plan.md` : null
		} catch {
			return null
		}
	}

	/**
	 * Update planning file content
	 */
	async updatePlanningFile(cwd: string, taskId: string, content: string): Promise<void> {
		try {
			const planningDir = path.join(cwd, ".siid-code", "planning")
			const filePath = path.join(planningDir, `${taskId}-plan.md`)

			await fs.writeFile(filePath, content, "utf-8")
		} catch (error) {
			console.error("Failed to update planning file:", error)
			throw error
		}
	}

	/**
	 * Delete planning file (optional, called on task completion)
	 * @param cwd - Current working directory
	 * @param filePath - Relative path to the planning file (e.g., .siid-code/planning/task-name-abc12345.md)
	 */
	async deletePlanningFile(cwd: string, filePath: string): Promise<void> {
		try {
			const fullPath = path.join(cwd, filePath)

			if (await fileExistsAtPath(fullPath)) {
				await fs.unlink(fullPath)
			}
		} catch (error) {
			console.warn("Failed to delete planning file:", error)
		}
	}

	/**
	 * Generate a basic planning template as fallback
	 */
	private generateBasicTemplate(taskDescription: string): string {
		return `# Task Plan

**Created:** ${new Date().toISOString()}
**Status:** 🔄 In Progress

---

## Original Request

"${taskDescription}"

---

## Phase Plan

### Phase 1: Analysis & Setup
- [ ] Understand requirements
- [ ] Identify components needed
- [ ] Plan implementation approach

### Phase 2: Implementation
- [ ] Create primary components
- [ ] Add dependencies
- [ ] Implement business logic

### Phase 3: Testing & Validation
- [ ] Write tests
- [ ] Validate functionality
- [ ] Review against requirements

---

## Execution Log

**Status:** In Progress

[Execution notes will be added here as work progresses]
`
	}
}

// Singleton instance
export const planningFileManager = new PlanningFileManager()

/**
 * Documentation and lesson recording for shared brain (CLAUDE.md)
 *
 * This module manages the shared knowledge base that persists lessons learned
 * across agent sessions. When an agent encounters a failure and discovers a
 * resolution, it records the lesson for future agents to learn from.
 */

import * as vscode from "vscode"
import * as path from "path"

/**
 * Appends a lesson learned to CLAUDE.md
 *
 * @param intentId - The intent ID related to this lesson
 * @param failure - Description of what went wrong
 * @param resolution - How the problem was solved
 *
 * @example
 * await appendLesson("INT-001", "JWT token expired prematurely", "Increased token TTL to 15 minutes")
 */
export async function appendLesson(intentId: string, failure: string, resolution: string): Promise<void> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
	if (!workspaceRoot) {
		console.warn("[appendLesson] No workspace folder found")
		return
	}

	const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md")
	const claudeMdUri = vscode.Uri.file(claudeMdPath)

	const lesson = `## Lessons Learned - ${new Date().toISOString()}
- Intent: ${intentId}
- Failure: ${failure}
- Resolution: ${resolution}

`

	try {
		// Try to read existing content
		let existingContent: Uint8Array
		try {
			existingContent = await vscode.workspace.fs.readFile(claudeMdUri)
		} catch (error) {
			// File doesn't exist, create it with header
			const header = `# CLAUDE.md - Shared Brain for AI Agents

This file contains lessons learned across agent sessions. When an agent encounters
a failure and discovers a resolution, it records the lesson here for future agents.

---

`
			existingContent = Buffer.from(header)
		}

		// Append new lesson
		const newContent = Buffer.concat([existingContent, Buffer.from(lesson)])
		await vscode.workspace.fs.writeFile(claudeMdUri, newContent)

		console.log(`[appendLesson] Recorded lesson for ${intentId}`)
	} catch (error) {
		console.error("[appendLesson] Failed to append lesson:", error)
	}
}

/**
 * Creates CLAUDE.md if it doesn't exist
 *
 * @param workspaceRoot - Workspace root directory
 */
export async function createClaudeMd(workspaceRoot: string): Promise<void> {
	const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md")
	const claudeMdUri = vscode.Uri.file(claudeMdPath)

	try {
		// Check if file exists
		await vscode.workspace.fs.stat(claudeMdUri)
		// File exists, do nothing
	} catch (error) {
		// File doesn't exist, create it
		const initialContent = `# CLAUDE.md - Shared Brain for AI Agents

This file contains lessons learned across agent sessions. When an agent encounters
a failure and discovers a resolution, it records the lesson here for future agents.

## How This Works

1. **Agent A** attempts a task and encounters an error
2. **Agent A** discovers a resolution and calls \`appendLesson(intentId, failure, resolution)\`
3. **Agent B** (in a future session) reads this file and learns from the lesson
4. **Agent B** avoids the same mistake

## Guidelines

- Record failures that took significant time to resolve
- Include the intent ID for traceability
- Keep descriptions concise but actionable
- Focus on solutions, not just problems

---

`
		await vscode.workspace.fs.writeFile(claudeMdUri, Buffer.from(initialContent))
		console.log("[createClaudeMd] Created CLAUDE.md")
	}
}

/**
 * Reads all lessons from CLAUDE.md
 *
 * @param workspaceRoot - Workspace root directory
 * @returns Array of lesson objects
 */
export async function readLessons(workspaceRoot: string): Promise<
	Array<{
		timestamp: string
		intentId: string
		failure: string
		resolution: string
	}>
> {
	const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md")
	const claudeMdUri = vscode.Uri.file(claudeMdPath)

	try {
		const content = await vscode.workspace.fs.readFile(claudeMdUri)
		const text = Buffer.from(content).toString("utf-8")

		// Simple parser for lesson entries
		const lessons: Array<{
			timestamp: string
			intentId: string
			failure: string
			resolution: string
		}> = []

		const lessonRegex = /## Lessons Learned - (.+?)\n- Intent: (.+?)\n- Failure: (.+?)\n- Resolution: (.+?)\n/g
		let match

		while ((match = lessonRegex.exec(text)) !== null) {
			lessons.push({
				timestamp: match[1],
				intentId: match[2],
				failure: match[3],
				resolution: match[4],
			})
		}

		return lessons
	} catch (error) {
		console.warn("[readLessons] Failed to read CLAUDE.md:", error)
		return []
	}
}

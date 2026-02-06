/**
 * External editor support for opening $EDITOR.
 */

import { execSync } from "child_process"
import { writeFileSync, readFileSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

/**
 * Open the user's $EDITOR with optional initial content.
 * Returns the edited text, or null if the editor was closed without saving.
 */
export function openEditor(initialContent = ""): string | null {
	const editor = process.env.EDITOR || process.env.VISUAL || "vi"
	const tmpFile = join(tmpdir(), `roo-edit-${Date.now()}.md`)

	try {
		writeFileSync(tmpFile, initialContent, "utf-8")
		execSync(`${editor} ${tmpFile}`, { stdio: "inherit" })
		const result = readFileSync(tmpFile, "utf-8")
		return result
	} catch {
		return null
	} finally {
		try {
			unlinkSync(tmpFile)
		} catch {
			// Ignore cleanup errors
		}
	}
}

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

let lastWorkspaceRoot: string | null = null

/**
 * Create a temporary workspace directory for Phase 2 integration tests.
 * Creates .orchestration/active_intents.yaml with a test intent.
 */
export async function setupTestWorkspace(): Promise<string> {
	const workspaceRoot = path.join(
		os.tmpdir(),
		`roo-phase2-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
	)
	await fs.mkdir(workspaceRoot, { recursive: true })

	const orchestrationDir = path.join(workspaceRoot, ".orchestration")
	await fs.mkdir(orchestrationDir, { recursive: true })

	const activeIntentsYaml = `
active_intents:
  - id: INT-001
    name: Test Intent
    status: IN_PROGRESS
    owned_scope:
      - "src/**"
      - "tests/**"
      - "!**/*.test.ts"
    constraints: []
    acceptance_criteria: []
`.trim()

	await fs.writeFile(path.join(orchestrationDir, "active_intents.yaml"), activeIntentsYaml, "utf-8")

	lastWorkspaceRoot = workspaceRoot
	return workspaceRoot
}

/**
 * Remove the temporary workspace directory.
 */
export async function cleanupTestWorkspace(workspaceRoot?: string): Promise<void> {
	const toRemove = workspaceRoot ?? lastWorkspaceRoot
	if (!toRemove) return
	try {
		await fs.rm(toRemove, { recursive: true, force: true })
	} catch {
		// Ignore if already removed or missing
	}
	if (toRemove === lastWorkspaceRoot) {
		lastWorkspaceRoot = null
	}
}

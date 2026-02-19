import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it } from "vitest"

import { OrchestrationStore } from "../OrchestrationStore"

describe("OrchestrationStore", () => {
	it("creates default sidecar policy and governance ledger", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orch-store-"))
		const store = new OrchestrationStore(workspacePath)

		await store.ensureInitialized()
		const sidecar = await store.loadSidecarPolicy()
		const governanceLedger = await fs.readFile(
			path.join(workspacePath, ".orchestration", "governance_ledger.md"),
			"utf8",
		)

		expect(sidecar.version).toBe(1)
		expect(sidecar.architectural_constraints.length).toBeGreaterThan(0)
		expect(sidecar.deny_mutations.some((rule) => rule.path_glob === ".orchestration/**")).toBe(true)
		expect(governanceLedger).toContain("# Governance Ledger")
	})

	it("appends governance entries with attribution details", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orch-governance-"))
		const store = new OrchestrationStore(workspacePath)

		await store.appendGovernanceEntry({
			intent_id: "intent-123",
			tool_name: "write_to_file",
			status: "OK",
			task_id: "task-1",
			model_identifier: "gpt-test",
			revision_id: "rev-abc",
			touched_paths: ["src/a.ts"],
			sidecar_constraints: ["No cross-module writes"],
		})

		const ledger = await fs.readFile(path.join(workspacePath, ".orchestration", "governance_ledger.md"), "utf8")
		expect(ledger).toContain("status=OK")
		expect(ledger).toContain("intent=intent-123")
		expect(ledger).toContain("tool=write_to_file")
		expect(ledger).toContain("`src/a.ts`")
		expect(ledger).toContain("No cross-module writes")
	})

	it("reports orchestration directory contract drift", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orch-contract-"))
		const store = new OrchestrationStore(workspacePath)
		await store.ensureInitialized()

		const orchestrationDir = path.join(workspacePath, ".orchestration")
		await fs.rm(path.join(orchestrationDir, "intent_map.md"))
		await fs.mkdir(path.join(orchestrationDir, "intent_map.md"))
		await fs.writeFile(path.join(orchestrationDir, "rogue.txt"), "rogue", "utf8")
		await fs.mkdir(path.join(orchestrationDir, "nested"), { recursive: true })

		const status = await store.getDirectoryContractStatus()
		expect(status.isCompliant).toBe(false)
		expect(status.missingRequiredFiles).toContain("intent_map.md")
		expect(status.unexpectedEntries).toContain("rogue.txt")
		expect(status.unexpectedEntries).toContain("nested")
	})
})

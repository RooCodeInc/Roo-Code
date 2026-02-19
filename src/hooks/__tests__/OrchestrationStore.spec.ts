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

	it("enforces trace schema and appends integrity hash chain", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orch-trace-"))
		const store = new OrchestrationStore(workspacePath)

		const baseRecord = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			timestamp: new Date().toISOString(),
			vcs: { revision_id: "abc123" },
			files: [
				{
					relative_path: "src/auth/middleware.ts",
					conversations: [
						{
							url: "session-1",
							contributor: { entity_type: "AI" as const, model_identifier: "claude-3-5-sonnet" },
							ranges: [
								{
									start_line: 15,
									end_line: 45,
									content_hash:
										"sha256:a8f5f167f44f4964e6c998dee827110ca8f5f167f44f4964e6c998dee827110c",
								},
							],
							related: [{ type: "specification" as const, value: "REQ-001" }],
						},
					],
				},
			],
		}

		await store.appendTraceRecord(baseRecord)
		await store.appendTraceRecord({
			...baseRecord,
			id: "550e8400-e29b-41d4-a716-446655440001",
			timestamp: new Date(Date.now() + 1000).toISOString(),
		})

		const lines = (await fs.readFile(path.join(workspacePath, ".orchestration", "agent_trace.jsonl"), "utf8"))
			.split(/\r?\n/)
			.filter(Boolean)
		expect(lines).toHaveLength(2)
		const first = JSON.parse(lines[0])
		const second = JSON.parse(lines[1])
		expect(first.integrity.chain).toBe("sha256")
		expect(first.integrity.prev_record_hash).toBeNull()
		expect(first.integrity.record_hash).toMatch(/^sha256:[a-f0-9]{64}$/)
		expect(second.integrity.prev_record_hash).toBe(first.integrity.record_hash)
		expect(second.integrity.record_hash).toMatch(/^sha256:[a-f0-9]{64}$/)
	})

	it("rejects trace records that violate strict schema", async () => {
		const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "roo-orch-trace-invalid-"))
		const store = new OrchestrationStore(workspacePath)

		const invalidRecord = {
			id: "not-a-uuid",
			timestamp: "invalid-timestamp",
			vcs: { revision_id: "" },
			files: [],
		} as any

		await expect(store.appendTraceRecord(invalidRecord)).rejects.toThrow("Invalid AgentTraceRecord schema")
	})
})

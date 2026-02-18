// npx vitest run src/core/tools/__tests__/selectActiveIntentTool.spec.ts

import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import { selectActiveIntentTool } from "../SelectActiveIntentTool"
import type { ToolUse } from "../../../shared/tools"
import type { AgentTraceEntry } from "../../orchestration/OrchestrationDataModel"

describe("SelectActiveIntentTool - Phase 1 End-to-End Test", () => {
	let testWorkspaceDir: string
	let mockTask: any
	let mockPushToolResult: ReturnType<typeof vi.fn>
	let mockHandleError: ReturnType<typeof vi.fn>
	let mockSayAndCreateMissingParamError: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		// Create a temporary directory for testing
		testWorkspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-"))

		// Setup mock task
		mockTask = {
			cwd: testWorkspaceDir,
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
		}

		mockPushToolResult = vi.fn()
		mockHandleError = vi.fn()
		mockSayAndCreateMissingParamError = vi.fn().mockResolvedValue("Missing parameter error")
		mockTask.sayAndCreateMissingParamError = mockSayAndCreateMissingParamError

		// Initialize .orchestration directory
		const orchestrationDir = path.join(testWorkspaceDir, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })
	})

	afterEach(async () => {
		// Clean up temporary directory
		try {
			await fs.rm(testWorkspaceDir, { recursive: true, force: true })
		} catch (error) {
			// Ignore cleanup errors
		}
	})

	describe("Phase 1: Context Loader with Trace Entries", () => {
		it("should load intent and include trace entries in context XML", async () => {
			// Setup: Create active_intents.yaml
			const intentsYaml = `active_intents:
  - id: INT-001
    name: Test Intent
    status: IN_PROGRESS
    owned_scope:
      - src/test/**
    constraints:
      - Must follow test patterns
    acceptance_criteria:
      - All tests pass
`

			const intentsPath = path.join(testWorkspaceDir, ".orchestration", "active_intents.yaml")
			await fs.writeFile(intentsPath, intentsYaml, "utf-8")

			// Setup: Create agent_trace.jsonl with entries for INT-001
			const traceEntry1: AgentTraceEntry = {
				id: "trace-1",
				timestamp: "2026-02-18T10:00:00Z",
				vcs: { revision_id: "abc123" },
				files: [
					{
						relative_path: "src/test/file1.ts",
						conversations: [
							{
								url: "task-1",
								contributor: { entity_type: "AI", model_identifier: "claude-3-5-sonnet" },
								ranges: [{ start_line: 10, end_line: 20, content_hash: "sha256:hash1" }],
								related: [{ type: "intent", value: "INT-001" }],
							},
						],
					},
				],
			}

			const traceEntry2: AgentTraceEntry = {
				id: "trace-2",
				timestamp: "2026-02-18T11:00:00Z",
				vcs: { revision_id: "def456" },
				files: [
					{
						relative_path: "src/test/file2.ts",
						conversations: [
							{
								url: "task-2",
								contributor: { entity_type: "AI", model_identifier: "claude-3-5-sonnet" },
								ranges: [{ start_line: 5, end_line: 15, content_hash: "sha256:hash2" }],
								related: [{ type: "intent", value: "INT-001" }],
							},
						],
					},
				],
			}

			const tracePath = path.join(testWorkspaceDir, ".orchestration", "agent_trace.jsonl")
			await fs.writeFile(
				tracePath,
				JSON.stringify(traceEntry1) + "\n" + JSON.stringify(traceEntry2) + "\n",
				"utf-8",
			)

			// Execute: Call select_active_intent
			await selectActiveIntentTool.execute({ intent_id: "INT-001" }, mockTask, {
				askApproval: vi.fn(),
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			// Verify: pushToolResult was called with XML context
			expect(mockPushToolResult).toHaveBeenCalledTimes(1)
			const contextXml = mockPushToolResult.mock.calls[0][0]

			// Verify: XML contains intent information
			expect(contextXml).toContain("<intent_id>INT-001</intent_id>")
			expect(contextXml).toContain("<intent_name>Test Intent</intent_name>")
			expect(contextXml).toContain("<status>IN_PROGRESS</status>")
			expect(contextXml).toContain("src/test/**")
			expect(contextXml).toContain("Must follow test patterns")
			expect(contextXml).toContain("All tests pass")

			// Verify: XML contains recent history from trace entries
			expect(contextXml).toContain("<recent_history>")
			expect(contextXml).toContain("src/test/file1.ts")
			expect(contextXml).toContain("src/test/file2.ts")
			expect(contextXml).toContain("lines 10-20")
			expect(contextXml).toContain("lines 5-15")
			expect(contextXml).toContain("2026-02-18")

			// Verify: Task has active intent stored
			expect((mockTask as any).activeIntentId).toBe("INT-001")
			expect((mockTask as any).activeIntent).toBeDefined()
			expect((mockTask as any).activeIntent.id).toBe("INT-001")

			// Verify: No errors occurred
			expect(mockHandleError).not.toHaveBeenCalled()
			expect(mockTask.consecutiveMistakeCount).toBe(0)
		})

		it("should handle intent with no trace entries", async () => {
			// Setup: Create active_intents.yaml
			const intentsYaml = `active_intents:
  - id: INT-002
    name: New Intent
    status: TODO
    owned_scope:
      - src/new/**
    constraints: []
    acceptance_criteria: []
`

			const intentsPath = path.join(testWorkspaceDir, ".orchestration", "active_intents.yaml")
			await fs.writeFile(intentsPath, intentsYaml, "utf-8")

			// Setup: Create empty agent_trace.jsonl
			const tracePath = path.join(testWorkspaceDir, ".orchestration", "agent_trace.jsonl")
			await fs.writeFile(tracePath, "", "utf-8")

			// Execute
			await selectActiveIntentTool.execute({ intent_id: "INT-002" }, mockTask, {
				askApproval: vi.fn(),
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			// Verify: XML contains "No recent changes" message
			const contextXml = mockPushToolResult.mock.calls[0][0]
			expect(contextXml).toContain("<recent_history>")
			expect(contextXml).toContain("No recent changes found for this intent")
		})

		it("should filter trace entries by intent ID", async () => {
			// Setup: Create active_intents.yaml
			const intentsYaml = `active_intents:
  - id: INT-001
    name: Intent One
    status: IN_PROGRESS
    owned_scope: []
    constraints: []
    acceptance_criteria: []
  - id: INT-002
    name: Intent Two
    status: IN_PROGRESS
    owned_scope: []
    constraints: []
    acceptance_criteria: []
`

			const intentsPath = path.join(testWorkspaceDir, ".orchestration", "active_intents.yaml")
			await fs.writeFile(intentsPath, intentsYaml, "utf-8")

			// Setup: Create trace entries for different intents
			const traceEntry1: AgentTraceEntry = {
				id: "trace-1",
				timestamp: "2026-02-18T10:00:00Z",
				vcs: { revision_id: "abc123" },
				files: [
					{
						relative_path: "src/file1.ts",
						conversations: [
							{
								url: "task-1",
								contributor: { entity_type: "AI" },
								ranges: [{ start_line: 1, end_line: 10, content_hash: "sha256:hash1" }],
								related: [{ type: "intent", value: "INT-001" }],
							},
						],
					},
				],
			}

			const traceEntry2: AgentTraceEntry = {
				id: "trace-2",
				timestamp: "2026-02-18T11:00:00Z",
				vcs: { revision_id: "def456" },
				files: [
					{
						relative_path: "src/file2.ts",
						conversations: [
							{
								url: "task-2",
								contributor: { entity_type: "AI" },
								ranges: [{ start_line: 1, end_line: 10, content_hash: "sha256:hash2" }],
								related: [{ type: "intent", value: "INT-002" }],
							},
						],
					},
				],
			}

			const tracePath = path.join(testWorkspaceDir, ".orchestration", "agent_trace.jsonl")
			await fs.writeFile(
				tracePath,
				JSON.stringify(traceEntry1) + "\n" + JSON.stringify(traceEntry2) + "\n",
				"utf-8",
			)

			// Execute: Select INT-001
			await selectActiveIntentTool.execute({ intent_id: "INT-001" }, mockTask, {
				askApproval: vi.fn(),
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			// Verify: Only INT-001 trace entry is included
			const contextXml = mockPushToolResult.mock.calls[0][0]
			expect(contextXml).toContain("src/file1.ts")
			expect(contextXml).not.toContain("src/file2.ts")
		})

		it("should return error for non-existent intent", async () => {
			// Setup: Create empty active_intents.yaml
			const intentsYaml = `active_intents: []`

			const intentsPath = path.join(testWorkspaceDir, ".orchestration", "active_intents.yaml")
			await fs.writeFile(intentsPath, intentsYaml, "utf-8")

			// Execute
			await selectActiveIntentTool.execute({ intent_id: "INT-999" }, mockTask, {
				askApproval: vi.fn(),
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			// Verify: Error was returned
			expect(mockPushToolResult).toHaveBeenCalled()
			const errorMessage = mockPushToolResult.mock.calls[0][0]
			expect(errorMessage).toContain("not found in active_intents.yaml")
			expect(mockTask.consecutiveMistakeCount).toBeGreaterThan(0)
		})

		it("should handle missing intent_id parameter", async () => {
			// Execute without intent_id
			await selectActiveIntentTool.execute({ intent_id: "" }, mockTask, {
				askApproval: vi.fn(),
				handleError: mockHandleError,
				pushToolResult: mockPushToolResult,
			})

			// Verify: Missing parameter error
			expect(mockSayAndCreateMissingParamError).toHaveBeenCalledWith("select_active_intent", "intent_id")
			expect(mockTask.consecutiveMistakeCount).toBeGreaterThan(0)
		})
	})
})

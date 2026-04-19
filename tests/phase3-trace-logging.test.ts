import fs from "fs"
import path from "path"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { TraceLogger, type MutationClass } from "../src/core/intent/TraceLogger"

const orchestrationDir = path.join(process.cwd(), ".orchestration")
const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

beforeEach(() => {
	if (fs.existsSync(orchestrationDir)) {
		fs.rmSync(orchestrationDir, { recursive: true, force: true })
	}
})

afterEach(() => {
	if (fs.existsSync(orchestrationDir)) {
		fs.rmSync(orchestrationDir, { recursive: true, force: true })
	}
})

describe("Phase 3: AI-Native Git Layer - Semantic Tracking", () => {
	it("generates SHA-256 hashes for content", () => {
		const content = "export const foo = () => {}"
		const hash = TraceLogger.hashContent(content)

		// Verify hash is a valid SHA-256 (64 hex characters)
		expect(hash).toMatch(/^[a-f0-9]{64}$/)

		// Verify same content produces same hash
		const hash2 = TraceLogger.hashContent(content)
		expect(hash).toBe(hash2)

		// Verify different content produces different hash
		const hash3 = TraceLogger.hashContent("different content")
		expect(hash).not.toBe(hash3)
	})

	it("classifies mutations as AST_REFACTOR for syntax-only changes", () => {
		const original = "function hello() {\n  console.log('hello');\n}\n"
		// Minor formatting change: add semicolon (< 20% change)
		const updated = "function hello() {\n  console.log('hello');\n};\n"

		const classification = TraceLogger.classifyMutation(updated, original, false)
		expect(classification).toBe("AST_REFACTOR")
	})

	it("classifies mutations as INTENT_EVOLUTION for new files", () => {
		const content = "export const newFeature = () => {}"

		const classification = TraceLogger.classifyMutation(content, undefined, true)
		expect(classification).toBe("INTENT_EVOLUTION")
	})

	it("classifies mutations as INTENT_EVOLUTION for significant changes (>20%)", () => {
		const original = "function original() {\n  return 'hello';\n}"
		// Much longer content
		const updated = `function refactored() {
  // New implementation with additional features
  return 'hello world with new features';
}

export const newExport = () => {}
export const anotherExport = () => {}`

		const classification = TraceLogger.classifyMutation(updated, original, false)
		expect(classification).toBe("INTENT_EVOLUTION")
	})

	it("logs trace entries to agent_trace.jsonl with intent_id and content_hash", () => {
		const logger = new TraceLogger()
		const content = "console.log('test')"
		const intentId = "INT-001"
		const filePath = "src/test.ts"

		logger.logTrace(intentId, filePath, content, "AST_REFACTOR")

		// Verify file was created
		expect(fs.existsSync(tracePath)).toBe(true)

		// Verify entry was logged
		const traces = logger.readTraces()
		expect(traces).toHaveLength(1)

		const entry = traces[0]
		expect(entry.intent_id).toBe(intentId)
		expect(entry.path).toBe(filePath)
		expect(entry.mutation_class).toBe("AST_REFACTOR")
		expect(entry.content_hash).toBe(TraceLogger.hashContent(content))
		expect(entry.timestamp).toBeDefined()
	})

	it("logs trace entries with req_id when provided", () => {
		const logger = new TraceLogger()
		const content = "new feature code"
		const intentId = "INT-001"
		const reqId = "REQ-12345"

		logger.logTrace(intentId, "src/feature.ts", content, "INTENT_EVOLUTION", reqId)

		const traces = logger.readTraces()
		expect(traces).toHaveLength(1)

		const entry = traces[0]
		expect(entry.req_id).toBe(reqId)
		expect(entry.mutation_class).toBe("INTENT_EVOLUTION")
	})

	it("appends multiple trace entries to agent_trace.jsonl", () => {
		const logger = new TraceLogger()

		// Log first entry
		logger.logTrace("INT-001", "src/auth.ts", "auth code", "AST_REFACTOR")

		// Log second entry
		logger.logTrace("INT-002", "src/feature.ts", "feature code", "INTENT_EVOLUTION", "REQ-789")

		const traces = logger.readTraces()
		expect(traces).toHaveLength(2)

		// Verify first entry
		expect(traces[0].intent_id).toBe("INT-001")
		expect(traces[0].path).toBe("src/auth.ts")
		expect(traces[0].mutation_class).toBe("AST_REFACTOR")

		// Verify second entry
		expect(traces[1].intent_id).toBe("INT-002")
		expect(traces[1].path).toBe("src/feature.ts")
		expect(traces[1].mutation_class).toBe("INTENT_EVOLUTION")
		expect(traces[1].req_id).toBe("REQ-789")
	})

	it("queries traces by intent_id", () => {
		const logger = new TraceLogger()

		// Log traces for different intents
		logger.logTrace("INT-001", "src/auth.ts", "auth code", "AST_REFACTOR")
		logger.logTrace("INT-001", "src/auth-utils.ts", "utils code", "AST_REFACTOR")
		logger.logTrace("INT-002", "src/feature.ts", "feature code", "INTENT_EVOLUTION")

		const int001Traces = logger.getTracesByIntent("INT-001")
		expect(int001Traces).toHaveLength(2)
		expect(int001Traces.every((e) => e.intent_id === "INT-001")).toBe(true)

		const int002Traces = logger.getTracesByIntent("INT-002")
		expect(int002Traces).toHaveLength(1)
		expect(int002Traces[0].path).toBe("src/feature.ts")
	})

	it("handles missing intent_id (null) in traces", () => {
		const logger = new TraceLogger()

		// Log without intent_id (pre-intent phase)
		logger.logTrace(null, "src/setup.ts", "setup code", "INTENT_EVOLUTION")

		const traces = logger.readTraces()
		expect(traces).toHaveLength(1)
		expect(traces[0].intent_id).toBeNull()
	})

	it("serializes trace entries as valid JSON lines format", () => {
		const logger = new TraceLogger()
		logger.logTrace("INT-001", "src/file.ts", "code", "AST_REFACTOR", "REQ-123")

		const rawContent = fs.readFileSync(tracePath, "utf8")
		const lines = rawContent.trim().split("\n")

		expect(lines).toHaveLength(1)

		// Verify each line is valid JSON
		const parsed = JSON.parse(lines[0])
		expect(parsed).toHaveProperty("intent_id")
		expect(parsed).toHaveProperty("mutation_class")
		expect(parsed).toHaveProperty("content_hash")
		expect(parsed).toHaveProperty("timestamp")
		expect(parsed).toHaveProperty("req_id")
	})
})

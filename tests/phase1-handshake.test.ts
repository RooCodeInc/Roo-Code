import fs from "fs"
import path from "path"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import yaml from "js-yaml"
import { IntentHookEngine } from "../src/core/intent/IntentHookEngine"

const orchestrationDir = path.join(process.cwd(), ".orchestration")
const intentsPath = path.join(orchestrationDir, "active_intents.yaml")
const tracePath = path.join(orchestrationDir, "agent_trace.jsonl")

beforeEach(() => {
	// cleanup
	if (fs.existsSync(orchestrationDir)) {
		fs.rmSync(orchestrationDir, { recursive: true, force: true })
	}
})

afterEach(() => {
	if (fs.existsSync(orchestrationDir)) {
		fs.rmSync(orchestrationDir, { recursive: true, force: true })
	}
})

describe("Phase 1 Handshake Enforcement", () => {
	it("enforces intent handshake and gatekeeper", () => {
		// 1. Create orchestration and active_intents.yaml
		fs.mkdirSync(orchestrationDir)
		const yamlContent = {
			active_intents: [
				{
					id: "INT-001",
					name: "Refactor Auth Middleware",
					status: "active",
					owned_scope: ["src/auth/middleware.ts", "src/services/auth/"],
					constraints: ["Use JWT instead of Session", "Preserve backward compatibility"],
					acceptance_criteria: ["All tests pass", "Token validation works end-to-end"],
				},
			],
		}
		fs.writeFileSync(intentsPath, yaml.dump(yamlContent), "utf8")
		expect(fs.existsSync(intentsPath)).toBe(true)

		// Instantiate engine after intents file exists
		const engine = new IntentHookEngine()

		// 2. Initial mutation blocked
		const blocked = engine.gatekeeper("write_file")
		expect(blocked.allowed).toBe(false)
		expect(blocked.message).toContain("You must cite a valid active Intent ID")

		// 3. select_active_intent returns XML block
		const xml = engine.preHook("select_active_intent", { intent_id: "INT-001" })
		expect(typeof xml).toBe("string")
		expect(xml as string).toContain("<intent_context>")
		expect(xml as string).toContain("<intent_id>INT-001</intent_id>")

		// 4. Mutation succeeds after selecting intent
		const allowed = engine.gatekeeper("write_file")
		expect(allowed.allowed).toBe(true)

		// perform write and trace
		const content = 'console.log("refactor")\n'
		const target = "src/auth/middleware.ts"
		// ensure orchestration dir exists
		if (!fs.existsSync(orchestrationDir)) fs.mkdirSync(orchestrationDir)
		engine.logTrace(target, content)

		expect(fs.existsSync(tracePath)).toBe(true)
		const trace = fs.readFileSync(tracePath, "utf8")
		expect(trace).toContain("INT-001")
		expect(trace).toContain("sha256")

		// 5. Clear session and ensure blocked
		engine.clearSessionIntent()
		const postClear = engine.gatekeeper("write_file")
		expect(postClear.allowed).toBe(false)
	})
})

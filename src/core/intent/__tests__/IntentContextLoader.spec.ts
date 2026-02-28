import fs from "fs/promises"
import os from "os"
import path from "path"

import { loadIntentContext, renderIntentContextXml } from "../IntentContextLoader"

describe("IntentContextLoader", () => {
	it("loads matching intent from active_intents.yaml and extracts constraints/scope", async () => {
		const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "intent-loader-"))
		const orchestrationDir = path.join(tempRoot, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })

		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			`active_intents:
  - intent_id: INTENT-TEST
    constraints:
      must_not:
        - direct-db-write
    scope:
      files:
        - src/**
`,
			"utf8",
		)

		await fs.writeFile(
			path.join(tempRoot, ".roo-tool-trace.log"),
			`[2026-02-21T00:00:00.000Z] TOOL EXECUTED: select_active_intent [intent:INTENT-TEST] intent_id=INTENT-TEST\n`,
			"utf8",
		)

		const result = await loadIntentContext(tempRoot, "INTENT-TEST")

		expect(result).not.toBeNull()
		expect(result?.intent_id).toBe("INTENT-TEST")
		expect(result?.constraints).toEqual({ must_not: ["direct-db-write"] })
		expect(result?.scope).toEqual({ files: ["src/**"] })
		expect(result?.relatedTraceEntries.length).toBe(1)

		await fs.rm(tempRoot, { recursive: true, force: true })
	})

	it("returns XML with constraints and scope only", () => {
		const xml = renderIntentContextXml({
			constraints: { must: ["x"] },
			scope: { files: ["src/**"] },
		})

		expect(xml).toContain("<intent_context>")
		expect(xml).toContain("<constraints>")
		expect(xml).toContain("<scope>")
		expect(xml).not.toContain("<intent_id>")
	})
})

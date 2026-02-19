import fs from "fs/promises"
import os from "os"
import path from "path"
import { describe, expect, it, vi } from "vitest"

import { generateSystemPrompt } from "../generateSystemPrompt"
import { SYSTEM_PROMPT } from "../../prompts/system"

vi.mock("../../prompts/system", () => ({
	SYSTEM_PROMPT: vi.fn().mockResolvedValue("mocked system prompt"),
}))

vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({ info: {} }),
	})),
}))

vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn((key: string, fallback: unknown) => fallback),
		}),
	},
}))

describe("generateSystemPrompt governance context injection", () => {
	it("injects sidecar constraints, active intent and shared brain excerpt into custom instructions", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "roo-generate-prompt-"))
		const orchestrationDir = path.join(cwd, ".orchestration")
		await fs.mkdir(orchestrationDir, { recursive: true })

		await fs.writeFile(
			path.join(orchestrationDir, "active_intents.yaml"),
			[
				"active_intents:",
				"  - id: INT-42",
				"    status: IN_PROGRESS",
				'    owned_scope: ["src/**"]',
				'    constraints: ["No direct infra changes"]',
				'    acceptance_criteria: ["tests pass"]',
				"    recent_history: []",
				"    related_files: []",
				"",
			].join("\n"),
			"utf8",
		)

		await fs.writeFile(
			path.join(orchestrationDir, "constraints.sidecar.yaml"),
			[
				"sidecar:",
				"  version: 2",
				"  architectural_constraints:",
				"    - Keep module boundaries explicit.",
				"  blocked_tools: []",
				"  deny_mutations: []",
				"",
			].join("\n"),
			"utf8",
		)

		await fs.writeFile(path.join(cwd, "AGENT.md"), "# AGENT\n- prior architectural decision", "utf8")

		const provider = {
			cwd,
			context: {},
			getState: vi.fn().mockResolvedValue({
				apiConfiguration: { todoListEnabled: true },
				customModePrompts: undefined,
				customInstructions: "user custom instructions",
				mcpEnabled: false,
				experiments: undefined,
				language: "en",
				enableSubfolderRules: false,
			}),
			customModesManager: {
				getCustomModes: vi.fn().mockResolvedValue([]),
			},
			getCurrentTask: vi.fn().mockReturnValue({
				activeIntentId: "INT-42",
				rooIgnoreController: undefined,
			}),
			getMcpHub: vi.fn(),
			getSkillsManager: vi.fn().mockReturnValue(undefined),
		} as any

		const result = await generateSystemPrompt(provider, { mode: "code" } as any)

		expect(result).toBe("mocked system prompt")
		expect(SYSTEM_PROMPT).toHaveBeenCalledTimes(1)
		const callArgs = vi.mocked(SYSTEM_PROMPT).mock.calls[0]
		const mergedCustomInstructions = callArgs[8] as string

		expect(mergedCustomInstructions).toContain("user custom instructions")
		expect(mergedCustomInstructions).toContain("Governance Sidecar Context")
		expect(mergedCustomInstructions).toContain("sidecar_version: 2")
		expect(mergedCustomInstructions).toContain("INT-42")
		expect(mergedCustomInstructions).toContain("Keep module boundaries explicit.")
		expect(mergedCustomInstructions).toContain("prior architectural decision")
	})
})

import fs from "fs/promises"
import os from "os"
import path from "path"
import { afterEach, describe, expect, it } from "vitest"

import { classifyRpiToolRisk, loadRpiPolicyBundle } from "../RpiPolicy"

describe("RpiPolicy", () => {
	const createdDirs: string[] = []

	afterEach(async () => {
		await Promise.all(
			createdDirs.splice(0).map(async (dir) => {
				await fs.rm(dir, { recursive: true, force: true })
			}),
		)
	})

	it("loads sane defaults when policy files are missing", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "rpi-policy-defaults-"))
		createdDirs.push(cwd)

		const bundle = await loadRpiPolicyBundle(cwd)

		expect(bundle.riskMatrix.toolRisk.default).toBe("R1")
		expect(bundle.qualityGates.verification.requireImplementationEvidence).toBe(true)
		expect(bundle.qualityGates.finalization.requiredPreCompletionArtifacts).toContain("execution_trace.jsonl")
		expect(bundle.qualityGates.performance.costGuardrails.maxTaskCostUsd).toBeGreaterThan(0)
		expect(bundle.qualityGates.rollout.canary.enabled).toBe(false)
		expect(bundle.qualityGates.memory.freshnessTtlHours).toBeGreaterThan(0)
	})

	it("loads custom policy files and classifies MCP tool risk", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "rpi-policy-custom-"))
		createdDirs.push(cwd)
		const policyDir = path.join(cwd, "policy")
		await fs.mkdir(policyDir, { recursive: true })

		await fs.writeFile(
			path.join(policyDir, "risk-matrix.yaml"),
			[
				"riskClasses:",
				"  R0: { approval: auto, sandbox: read-only, network: restricted }",
				"  R1: { approval: auto, sandbox: workspace-write, network: restricted }",
				"  R2: { approval: manual-first, sandbox: workspace-write, network: restricted }",
				"  R3: { approval: manual, sandbox: restricted-isolated, network: none }",
				"toolRisk:",
				"  default: R1",
				"  byTool:",
				"    use_mcp_tool: R2",
				"  byMcpTool:",
				"    rename_file: R3",
			].join("\n"),
			"utf-8",
		)

		await fs.writeFile(
			path.join(policyDir, "quality-gates.yaml"),
			[
				"verification:",
				"  requireImplementationEvidence: false",
				"  enforceLastCommandSuccessOn: [strict]",
				"  enforceNoUnresolvedWriteErrorsOn: [strict]",
				"  enforceTaskKeywordMatchingOn: [strict]",
				"  commandKeywords: [test, spec, benchmark]",
				"finalization:",
				"  requiredPreCompletionArtifacts: [state.json, execution_trace.jsonl]",
				"  requiredPostCompletionArtifacts: [final_summary.md]",
				"replay:",
				"  includeRecentObservations: 5",
				"  includeRecentTraceEvents: 12",
				"performance:",
				"  adaptiveConcurrency:",
				"    enabled: true",
				"    evaluationWindow: 10",
				"    failureRateThreshold: 0.25",
				"    p95LatencyMsThreshold: 8000",
				"    fallbackFailureRateThreshold: 0.5",
				"    fallbackP95LatencyMsThreshold: 15000",
				"  costGuardrails:",
				"    enabled: true",
				"    maxTaskCostUsd: 2.5",
				"    warnAtRatio: 0.7",
				"    throttleAtRatio: 0.9",
				"    fallbackAtRatio: 1.1",
				"rollout:",
				"  canary:",
				"    enabled: true",
				"    sampleSize: 4",
				"    maxFailureRate: 0.25",
				"    maxP95LatencyMs: 12000",
				"    minCodeReviewScore: 5",
				"memory:",
				"  freshnessTtlHours: 72",
				"  maxStaleResults: 2",
			].join("\n"),
			"utf-8",
		)

		const bundle = await loadRpiPolicyBundle(cwd)
		const risk = classifyRpiToolRisk(bundle.riskMatrix, { toolName: "use_mcp_tool", mcpToolName: "rename_file" })

		expect(risk).toBe("R3")
		expect(bundle.qualityGates.verification.requireImplementationEvidence).toBe(false)
		expect(bundle.qualityGates.verification.commandKeywords).toContain("benchmark")
		expect(bundle.qualityGates.replay.includeRecentTraceEvents).toBe(12)
		expect(bundle.qualityGates.performance.adaptiveConcurrency.evaluationWindow).toBe(10)
		expect(bundle.qualityGates.performance.costGuardrails.maxTaskCostUsd).toBe(2.5)
		expect(bundle.qualityGates.rollout.canary.sampleSize).toBe(4)
		expect(bundle.qualityGates.memory.freshnessTtlHours).toBe(72)
	})
})

import fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { z } from "zod"

export type RpiRiskClass = "R0" | "R1" | "R2" | "R3"
export type RpiVerificationStrictness = "lenient" | "standard" | "strict"

const riskClassSchema = z.enum(["R0", "R1", "R2", "R3"])
const strictnessSchema = z.enum(["lenient", "standard", "strict"])

const riskMatrixSchema = z.object({
	riskClasses: z.record(
		riskClassSchema,
		z.object({
			approval: z.string().min(1),
			sandbox: z.string().min(1),
			network: z.string().min(1),
			notes: z.string().optional(),
		}),
	),
	toolRisk: z.object({
		default: riskClassSchema,
		byTool: z.record(z.string(), riskClassSchema).default({}),
		byMcpTool: z.record(z.string(), riskClassSchema).default({}),
	}),
})

const qualityGatesSchema = z.object({
	verification: z.object({
		requireImplementationEvidence: z.boolean().default(true),
		enforceLastCommandSuccessOn: z.array(strictnessSchema).default(["standard", "strict"]),
		enforceNoUnresolvedWriteErrorsOn: z.array(strictnessSchema).default(["standard", "strict"]),
		enforceTaskKeywordMatchingOn: z.array(strictnessSchema).default(["strict"]),
		commandKeywords: z.array(z.string().min(1)).default(["test", "spec"]),
	}),
	finalization: z.object({
		requiredPreCompletionArtifacts: z
			.array(z.string().min(1))
			.default(["state.json", "task_plan.md", "findings.md", "progress.md", "execution_trace.jsonl"]),
		requiredPostCompletionArtifacts: z.array(z.string().min(1)).default(["final_summary.md"]),
	}),
	replay: z.object({
		includeRecentObservations: z.number().int().min(1).max(100).default(10),
		includeRecentTraceEvents: z.number().int().min(1).max(200).default(25),
	}),
	performance: z
		.object({
			adaptiveConcurrency: z.object({
				enabled: z.boolean().default(true),
				evaluationWindow: z.number().int().min(3).max(50).default(8),
				failureRateThreshold: z.number().min(0).max(1).default(0.35),
				p95LatencyMsThreshold: z.number().int().min(100).max(600_000).default(15_000),
				fallbackFailureRateThreshold: z.number().min(0).max(1).default(0.6),
				fallbackP95LatencyMsThreshold: z.number().int().min(100).max(600_000).default(30_000),
			}),
			costGuardrails: z.object({
				enabled: z.boolean().default(true),
				maxTaskCostUsd: z.number().min(0).default(3),
				warnAtRatio: z.number().min(0).default(0.8),
				throttleAtRatio: z.number().min(0).default(1),
				fallbackAtRatio: z.number().min(0).default(1.2),
			}),
		})
		.default({
			adaptiveConcurrency: {
				enabled: true,
				evaluationWindow: 8,
				failureRateThreshold: 0.35,
				p95LatencyMsThreshold: 15_000,
				fallbackFailureRateThreshold: 0.6,
				fallbackP95LatencyMsThreshold: 30_000,
			},
			costGuardrails: {
				enabled: true,
				maxTaskCostUsd: 3,
				warnAtRatio: 0.8,
				throttleAtRatio: 1,
				fallbackAtRatio: 1.2,
			},
		}),
	rollout: z
		.object({
			canary: z.object({
				// Default OFF: Canary is a rollout/quality control gate and should be explicitly enabled by a workspace policy.
				// Enabling by default can stall completion loops in repos without tuned thresholds (see .roo/rpi canary_state.json).
				enabled: z.boolean().default(false),
				sampleSize: z.number().int().min(1).max(50).default(3),
				maxFailureRate: z.number().min(0).max(1).default(0.34),
				maxP95LatencyMs: z.number().int().min(100).max(600_000).default(25_000),
				minCodeReviewScore: z.number().int().min(1).max(10).default(4),
			}),
		})
		.default({
			canary: {
				enabled: false,
				sampleSize: 3,
				maxFailureRate: 0.34,
				maxP95LatencyMs: 25_000,
				minCodeReviewScore: 4,
			},
		}),
	memory: z
		.object({
			freshnessTtlHours: z
				.number()
				.int()
				.min(1)
				.max(24 * 365)
				.default(24 * 14),
			maxStaleResults: z.number().int().min(0).max(20).default(1),
		})
		.default({
			freshnessTtlHours: 24 * 14,
			maxStaleResults: 1,
		}),
})

export type RpiRiskMatrixPolicy = z.infer<typeof riskMatrixSchema>
export type RpiQualityGatesPolicy = z.infer<typeof qualityGatesSchema>

export interface RpiPolicyBundle {
	riskMatrix: RpiRiskMatrixPolicy
	qualityGates: RpiQualityGatesPolicy
	metadata: {
		policyDir: string
		riskMatrixPath: string
		qualityGatesPath: string
	}
	loadWarnings: string[]
}

const DEFAULT_RISK_MATRIX: RpiRiskMatrixPolicy = {
	riskClasses: {
		R0: { approval: "auto", sandbox: "read-only", network: "restricted", notes: "Read-only actions." },
		R1: { approval: "auto", sandbox: "workspace-write", network: "restricted", notes: "Workspace edits." },
		R2: { approval: "manual-first", sandbox: "workspace-write", network: "restricted", notes: "Commands/actions." },
		R3: { approval: "manual", sandbox: "restricted-isolated", network: "none", notes: "Sensitive operations." },
	},
	toolRisk: {
		default: "R1",
		byTool: {
			read_file: "R0",
			list_files: "R0",
			search_files: "R0",
			codebase_search: "R0",
			access_mcp_resource: "R0",
			write_to_file: "R1",
			apply_diff: "R1",
			search_and_replace: "R1",
			edit_file: "R1",
			execute_command: "R2",
			read_command_output: "R2",
			use_mcp_tool: "R2",
			browser_action: "R3",
		},
		byMcpTool: {
			read_file: "R0",
			list_files: "R0",
			search_files: "R0",
			codebase_search: "R0",
			edit_file: "R1",
			write_file: "R1",
			write_to_file: "R1",
			apply_diff: "R1",
			apply_patch: "R1",
			search_and_replace: "R1",
			execute_command: "R2",
			run_command: "R2",
			delete_file: "R3",
			move_file: "R3",
			rename_file: "R3",
		},
	},
}

const DEFAULT_QUALITY_GATES: RpiQualityGatesPolicy = {
	verification: {
		requireImplementationEvidence: true,
		enforceLastCommandSuccessOn: ["standard", "strict"],
		enforceNoUnresolvedWriteErrorsOn: ["standard", "strict"],
		enforceTaskKeywordMatchingOn: ["strict"],
		commandKeywords: ["test", "spec"],
	},
	finalization: {
		requiredPreCompletionArtifacts: [
			"state.json",
			"task_plan.md",
			"findings.md",
			"progress.md",
			"execution_trace.jsonl",
		],
		requiredPostCompletionArtifacts: ["final_summary.md"],
	},
	replay: {
		includeRecentObservations: 10,
		includeRecentTraceEvents: 25,
	},
	performance: {
		adaptiveConcurrency: {
			enabled: true,
			evaluationWindow: 8,
			failureRateThreshold: 0.35,
			p95LatencyMsThreshold: 15_000,
			fallbackFailureRateThreshold: 0.6,
			fallbackP95LatencyMsThreshold: 30_000,
		},
		costGuardrails: {
			enabled: true,
			maxTaskCostUsd: 3,
			warnAtRatio: 0.8,
			throttleAtRatio: 1,
			fallbackAtRatio: 1.2,
		},
	},
	rollout: {
		canary: {
			enabled: false,
			sampleSize: 3,
			maxFailureRate: 0.34,
			maxP95LatencyMs: 25_000,
			minCodeReviewScore: 4,
		},
	},
	memory: {
		freshnessTtlHours: 24 * 14,
		maxStaleResults: 1,
	},
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const readYamlPolicy = async (filePath: string): Promise<unknown | undefined> => {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return yaml.parse(content)
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			return undefined
		}
		throw error
	}
}

export async function loadRpiPolicyBundle(cwd: string): Promise<RpiPolicyBundle> {
	const policyDir = path.join(cwd, "policy")
	const riskMatrixPath = path.join(policyDir, "risk-matrix.yaml")
	const qualityGatesPath = path.join(policyDir, "quality-gates.yaml")
	const loadWarnings: string[] = []

	const [riskRaw, qualityRaw] = await Promise.all([readYamlPolicy(riskMatrixPath), readYamlPolicy(qualityGatesPath)])

	let riskMatrix = clone(DEFAULT_RISK_MATRIX)
	let qualityGates = clone(DEFAULT_QUALITY_GATES)

	if (riskRaw !== undefined) {
		const parsed = riskMatrixSchema.safeParse(riskRaw)
		if (parsed.success) {
			riskMatrix = parsed.data
		} else {
			loadWarnings.push(`Invalid risk matrix policy at ${riskMatrixPath}. Falling back to defaults.`)
		}
	}

	if (qualityRaw !== undefined) {
		const parsed = qualityGatesSchema.safeParse(qualityRaw)
		if (parsed.success) {
			qualityGates = parsed.data
		} else {
			loadWarnings.push(`Invalid quality gates policy at ${qualityGatesPath}. Falling back to defaults.`)
		}
	}

	return {
		riskMatrix,
		qualityGates,
		metadata: {
			policyDir,
			riskMatrixPath,
			qualityGatesPath,
		},
		loadWarnings,
	}
}

export function classifyRpiToolRisk(
	policy: RpiRiskMatrixPolicy,
	input: { toolName: string; mcpToolName?: string },
): RpiRiskClass {
	const normalizedTool = input.toolName.trim().toLowerCase()
	const normalizedMcpTool = input.mcpToolName?.trim().toLowerCase()

	if (normalizedTool === "use_mcp_tool" && normalizedMcpTool) {
		return (
			policy.toolRisk.byMcpTool[normalizedMcpTool] ??
			policy.toolRisk.byTool[normalizedTool] ??
			policy.toolRisk.default
		)
	}

	return policy.toolRisk.byTool[normalizedTool] ?? policy.toolRisk.default
}

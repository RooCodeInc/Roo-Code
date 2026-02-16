export type RpiVerificationStrictness = "lenient" | "standard" | "strict"
export type SandboxNetworkAccess = "full" | "restricted" | "none"
export type SandboxMemoryLimit = "256m" | "512m" | "1g" | "2g" | "4g" | "8g" | "16g"

export const DEFAULT_RPI_AUTOPILOT_ENABLED = true
export const DEFAULT_RPI_COUNCIL_ENGINE_ENABLED = true
export const DEFAULT_RPI_VERIFICATION_STRICTNESS: RpiVerificationStrictness = "lenient"
export const DEFAULT_RPI_CODE_REVIEW_ENABLED = true
export const DEFAULT_RPI_CODE_REVIEW_SCORE_THRESHOLD = 4
export const DEFAULT_RPI_CONTEXT_DISTILLATION_BUDGET = 8000
export const DEFAULT_RPI_COUNCIL_TIMEOUT_SECONDS = 90

export const DEFAULT_SANDBOX_IMAGE = "node:20"
export const DEFAULT_SANDBOX_NETWORK_ACCESS: SandboxNetworkAccess = "restricted"
export const DEFAULT_SANDBOX_MEMORY_LIMIT: SandboxMemoryLimit = "4g"
export const DEFAULT_SANDBOX_MAX_EXECUTION_TIME = 120

const STRICTNESS_VALUES = new Set<RpiVerificationStrictness>(["lenient", "standard", "strict"])
const SANDBOX_NETWORK_VALUES = new Set<SandboxNetworkAccess>(["full", "restricted", "none"])
const SANDBOX_MEMORY_VALUES = new Set<SandboxMemoryLimit>(["256m", "512m", "1g", "2g", "4g", "8g", "16g"])

export const normalizeBooleanSetting = (value: unknown, fallback: boolean): boolean => {
	if (typeof value === "boolean") {
		return value
	}
	if (typeof value === "number") {
		if (value === 1) {
			return true
		}
		if (value === 0) {
			return false
		}
		return fallback
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase()
		if (normalized === "true" || normalized === "1") {
			return true
		}
		if (normalized === "false" || normalized === "0") {
			return false
		}
	}
	return fallback
}

export const normalizeNumberSetting = (
	value: unknown,
	fallback: number,
	options?: { min?: number; max?: number; integer?: boolean },
): number => {
	const min = options?.min
	const max = options?.max
	const integer = options?.integer ?? false

	let numeric: number | undefined
	if (typeof value === "number") {
		numeric = value
	} else if (typeof value === "string") {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) {
			numeric = parsed
		}
	}

	if (numeric === undefined || !Number.isFinite(numeric)) {
		return fallback
	}

	if (integer) {
		numeric = Math.trunc(numeric)
	}
	if (min !== undefined) {
		numeric = Math.max(min, numeric)
	}
	if (max !== undefined) {
		numeric = Math.min(max, numeric)
	}
	return numeric
}

export const normalizeVerificationStrictness = (
	value: unknown,
	fallback: RpiVerificationStrictness = DEFAULT_RPI_VERIFICATION_STRICTNESS,
): RpiVerificationStrictness => {
	if (typeof value !== "string") {
		return fallback
	}
	const normalized = value.trim().toLowerCase() as RpiVerificationStrictness
	return STRICTNESS_VALUES.has(normalized) ? normalized : fallback
}

export const normalizeSandboxImage = (value: unknown, fallback: string = DEFAULT_SANDBOX_IMAGE): string => {
	if (typeof value !== "string") {
		return fallback
	}
	const normalized = value.trim()
	return normalized.length > 0 ? normalized : fallback
}

export const normalizeSandboxNetworkAccess = (
	value: unknown,
	fallback: SandboxNetworkAccess = DEFAULT_SANDBOX_NETWORK_ACCESS,
): SandboxNetworkAccess => {
	if (typeof value !== "string") {
		return fallback
	}
	const normalized = value.trim().toLowerCase() as SandboxNetworkAccess
	return SANDBOX_NETWORK_VALUES.has(normalized) ? normalized : fallback
}

export const normalizeSandboxMemoryLimit = (
	value: unknown,
	fallback: SandboxMemoryLimit = DEFAULT_SANDBOX_MEMORY_LIMIT,
): SandboxMemoryLimit => {
	if (typeof value !== "string") {
		return fallback
	}
	const normalized = value.trim().toLowerCase() as SandboxMemoryLimit
	return SANDBOX_MEMORY_VALUES.has(normalized) ? normalized : fallback
}

export const normalizeRpiCouncilApiConfigId = (value: unknown): string => {
	return typeof value === "string" ? value : ""
}

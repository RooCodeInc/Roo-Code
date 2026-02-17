export interface SandboxConfig {
	enabled: boolean
	image: string
	mountWorkspace: boolean
	workspaceMountMode: "ro" | "rw"
	networkAccess: "full" | "restricted" | "none"
	maxExecutionTime: number
	memoryLimit: string
	allowedMounts: string[]
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
	enabled: false,
	image: "node:20",
	mountWorkspace: true,
	workspaceMountMode: "ro",
	networkAccess: "restricted",
	maxExecutionTime: 120_000,
	memoryLimit: "4g",
	allowedMounts: [],
}

export function resolveSandboxConfig(overrides?: Partial<SandboxConfig>): SandboxConfig {
	return {
		...DEFAULT_SANDBOX_CONFIG,
		...overrides,
	}
}

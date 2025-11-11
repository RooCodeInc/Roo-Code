import * as vscode from "vscode"

export type CodeIndexMode = "auto" | "normal" | "lowResource"

export interface CodeIndexConfig {
	mode: CodeIndexMode
	maxParallelFileReads: number
	maxParallelEmbeddings: number
	chunkSizeTokens: number
	enableBuiltInIgnore: boolean
	builtInIgnorePatterns: string[]
}

/**
 * Centralized, minimal config layer for the code indexer.
 * All low-resource tuning is expressed here to avoid scattering conditionals.
 */
function detectEnvironmentProfile(): CodeIndexMode {
	try {
		const cpus = require("os").cpus?.() ?? []
		const totalMem = require("os").totalmem?.() ?? 0

		const cpuCount = cpus.length || 1
		const memGb = totalMem > 0 ? totalMem / (1024 * 1024 * 1024) : 0

		// Very conservative profiler:
		// - <= 4 cores and <= 8GB RAM considered a weak machine
		if (cpuCount <= 4 || (memGb > 0 && memGb <= 8)) {
			return "lowResource"
		}

		return "normal"
	} catch {
		// In case of weird environment, play it safe and leave normal
		return "normal"
	}
}

export function getCodeIndexConfig(): CodeIndexConfig {
	const config = vscode.workspace.getConfiguration("rooCode.codeIndex")

	const mode = config.get<CodeIndexMode>("mode") ?? "auto"

	const userMaxFileReads = config.get<number>("maxParallelFileReads") ?? 16
	const userMaxEmbeddings = config.get<number>("maxParallelEmbeddings") ?? 4
	const userChunkSize = config.get<number>("chunkSizeTokens") ?? 2048
	const enableBuiltInIgnore = config.get<boolean>("enableBuiltInIgnore") ?? false

	// Determine actual profile considering auto/normal/lowResource
	const resolvedMode: CodeIndexMode = mode === "auto" ? detectEnvironmentProfile() : mode

	const isLow = resolvedMode === "lowResource"

	const maxParallelFileReads = isLow ? Math.max(1, Math.min(4, userMaxFileReads)) : Math.max(1, userMaxFileReads)

	const maxParallelEmbeddings = isLow ? Math.max(1, Math.min(2, userMaxEmbeddings)) : Math.max(1, userMaxEmbeddings)

	const chunkSizeTokens = isLow ? Math.max(128, Math.min(768, userChunkSize)) : Math.max(128, userChunkSize)

	const builtInIgnorePatterns = enableBuiltInIgnore
		? [
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/build/**",
				"**/.next/**",
				"**/.turbo/**",
				"**/coverage/**",
				"**/logs/**",
				"**/*.log",
				"**/*.png",
				"**/*.jpg",
				"**/*.jpeg",
				"**/*.gif",
				"**/*.webp",
				"**/*.svg",
				"**/*.mp4",
				"**/*.mkv",
				"**/*.avi",
				"**/*.mov",
				"**/*.zip",
				"**/*.tar",
				"**/*.7z",
			]
		: []

	return {
		mode: resolvedMode,
		maxParallelFileReads,
		maxParallelEmbeddings,
		chunkSizeTokens,
		enableBuiltInIgnore,
		builtInIgnorePatterns,
	}
}

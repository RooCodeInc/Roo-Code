/**
 * Architecture Patterns
 * Pattern definitions and matching logic for architecture detection
 */

import { ArchitecturePatternType, PatternScore } from "./interfaces"

/**
 * File structure analysis result
 */
export interface FileStructureAnalysis {
	directories: string[]
	files: string[]
	patterns: Map<string, string[]> // pattern name -> matching files
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
	internalDependencies: Map<string, string[]>
	externalDependencies: string[]
}

/**
 * Base interface for architecture patterns
 */
export interface ArchitecturePattern {
	readonly name: ArchitecturePatternType
	readonly description: string
	readonly indicators: PatternIndicator[]

	/**
	 * Match the pattern against file structure and dependencies
	 * @returns Score between 0-1
	 */
	match(fileStructure: FileStructureAnalysis, dependencies: DependencyAnalysis): Promise<number>

	/**
	 * Get evidence of pattern match
	 */
	getEvidence(fileStructure: FileStructureAnalysis): string[]
}

export interface PatternIndicator {
	type: "directory" | "file" | "naming" | "dependency"
	pattern: RegExp | string
	weight: number // 0-1
}

// ============================================================================
// MVC Pattern
// ============================================================================

export class MVCPattern implements ArchitecturePattern {
	readonly name: ArchitecturePatternType = "mvc"
	readonly description = "Model-View-Controller pattern"
	readonly indicators: PatternIndicator[] = [
		{ type: "directory", pattern: /models?$/i, weight: 0.3 },
		{ type: "directory", pattern: /views?$/i, weight: 0.3 },
		{ type: "directory", pattern: /controllers?$/i, weight: 0.3 },
		{ type: "naming", pattern: /Controller\.(ts|js|py|java)$/i, weight: 0.2 },
		{ type: "naming", pattern: /Model\.(ts|js|py|java)$/i, weight: 0.2 },
		{ type: "naming", pattern: /View\.(ts|js|py|java)$/i, weight: 0.2 },
	]

	async match(fileStructure: FileStructureAnalysis, dependencies: DependencyAnalysis): Promise<number> {
		let score = 0
		let maxScore = 0

		for (const indicator of this.indicators) {
			maxScore += indicator.weight
			const items = indicator.type === "directory" ? fileStructure.directories : fileStructure.files

			for (const item of items) {
				if (typeof indicator.pattern === "string") {
					if (item.toLowerCase().includes(indicator.pattern.toLowerCase())) {
						score += indicator.weight
						break
					}
				} else if (indicator.pattern.test(item)) {
					score += indicator.weight
					break
				}
			}
		}

		return maxScore > 0 ? score / maxScore : 0
	}

	getEvidence(fileStructure: FileStructureAnalysis): string[] {
		const evidence: string[] = []

		const hasModels = fileStructure.directories.some((d) => /models?$/i.test(d))
		const hasViews = fileStructure.directories.some((d) => /views?$/i.test(d))
		const hasControllers = fileStructure.directories.some((d) => /controllers?$/i.test(d))

		if (hasModels) evidence.push("Found 'models' directory")
		if (hasViews) evidence.push("Found 'views' directory")
		if (hasControllers) evidence.push("Found 'controllers' directory")

		return evidence
	}
}

// ============================================================================
// Clean Architecture Pattern
// ============================================================================

export class CleanArchitecturePattern implements ArchitecturePattern {
	readonly name: ArchitecturePatternType = "clean-architecture"
	readonly description = "Clean Architecture (Onion Architecture)"
	readonly indicators: PatternIndicator[] = [
		{ type: "directory", pattern: /domain$/i, weight: 0.25 },
		{ type: "directory", pattern: /entities?$/i, weight: 0.2 },
		{ type: "directory", pattern: /usecases?$/i, weight: 0.25 },
		{ type: "directory", pattern: /use_cases?$/i, weight: 0.25 },
		{ type: "directory", pattern: /application$/i, weight: 0.2 },
		{ type: "directory", pattern: /infrastructure$/i, weight: 0.2 },
		{ type: "directory", pattern: /adapters?$/i, weight: 0.2 },
		{ type: "directory", pattern: /interfaces?$/i, weight: 0.15 },
		{ type: "directory", pattern: /repositories?$/i, weight: 0.15 },
	]

	async match(fileStructure: FileStructureAnalysis, dependencies: DependencyAnalysis): Promise<number> {
		let score = 0
		let maxScore = 0

		for (const indicator of this.indicators) {
			maxScore += indicator.weight

			for (const dir of fileStructure.directories) {
				if (typeof indicator.pattern === "string") {
					if (dir.toLowerCase().includes(indicator.pattern.toLowerCase())) {
						score += indicator.weight
						break
					}
				} else if (indicator.pattern.test(dir)) {
					score += indicator.weight
					break
				}
			}
		}

		return maxScore > 0 ? score / maxScore : 0
	}

	getEvidence(fileStructure: FileStructureAnalysis): string[] {
		const evidence: string[] = []

		const hasDomain = fileStructure.directories.some((d) => /domain$/i.test(d))
		const hasUseCases = fileStructure.directories.some((d) => /use_?cases?$/i.test(d))
		const hasInfrastructure = fileStructure.directories.some((d) => /infrastructure$/i.test(d))
		const hasAdapters = fileStructure.directories.some((d) => /adapters?$/i.test(d))

		if (hasDomain) evidence.push("Found 'domain' layer")
		if (hasUseCases) evidence.push("Found 'use cases' layer")
		if (hasInfrastructure) evidence.push("Found 'infrastructure' layer")
		if (hasAdapters) evidence.push("Found 'adapters' layer")

		return evidence
	}
}

// ============================================================================
// Hexagonal Pattern
// ============================================================================

export class HexagonalPattern implements ArchitecturePattern {
	readonly name: ArchitecturePatternType = "hexagonal"
	readonly description = "Hexagonal Architecture (Ports and Adapters)"
	readonly indicators: PatternIndicator[] = [
		{ type: "directory", pattern: /ports?$/i, weight: 0.3 },
		{ type: "directory", pattern: /adapters?$/i, weight: 0.3 },
		{ type: "directory", pattern: /core$/i, weight: 0.2 },
		{ type: "directory", pattern: /driven$/i, weight: 0.2 },
		{ type: "directory", pattern: /driving$/i, weight: 0.2 },
		{ type: "naming", pattern: /Port\.(ts|js|py|java)$/i, weight: 0.2 },
		{ type: "naming", pattern: /Adapter\.(ts|js|py|java)$/i, weight: 0.2 },
	]

	async match(fileStructure: FileStructureAnalysis, dependencies: DependencyAnalysis): Promise<number> {
		let score = 0
		let maxScore = 0

		for (const indicator of this.indicators) {
			maxScore += indicator.weight
			const items = indicator.type === "directory" ? fileStructure.directories : fileStructure.files

			for (const item of items) {
				if (typeof indicator.pattern === "string") {
					if (item.toLowerCase().includes(indicator.pattern.toLowerCase())) {
						score += indicator.weight
						break
					}
				} else if (indicator.pattern.test(item)) {
					score += indicator.weight
					break
				}
			}
		}

		return maxScore > 0 ? score / maxScore : 0
	}

	getEvidence(fileStructure: FileStructureAnalysis): string[] {
		const evidence: string[] = []

		const hasPorts = fileStructure.directories.some((d) => /ports?$/i.test(d))
		const hasAdapters = fileStructure.directories.some((d) => /adapters?$/i.test(d))
		const hasCore = fileStructure.directories.some((d) => /core$/i.test(d))

		if (hasPorts) evidence.push("Found 'ports' layer")
		if (hasAdapters) evidence.push("Found 'adapters' layer")
		if (hasCore) evidence.push("Found 'core' layer")

		return evidence
	}
}

// ============================================================================
// Microservices Pattern
// ============================================================================

export class MicroservicesPattern implements ArchitecturePattern {
	readonly name: ArchitecturePatternType = "microservices"
	readonly description = "Microservices Architecture"
	readonly indicators: PatternIndicator[] = [
		{ type: "directory", pattern: /services?$/i, weight: 0.25 },
		{ type: "directory", pattern: /api-gateway$/i, weight: 0.3 },
		{ type: "directory", pattern: /gateway$/i, weight: 0.2 },
		{ type: "file", pattern: /docker-compose\.(yml|yaml)$/i, weight: 0.25 },
		{ type: "file", pattern: /kubernetes/i, weight: 0.2 },
		{ type: "file", pattern: /k8s/i, weight: 0.2 },
		{ type: "directory", pattern: /microservices?$/i, weight: 0.3 },
	]

	async match(fileStructure: FileStructureAnalysis, dependencies: DependencyAnalysis): Promise<number> {
		let score = 0
		let maxScore = 0

		for (const indicator of this.indicators) {
			maxScore += indicator.weight
			const items = indicator.type === "directory" ? fileStructure.directories : fileStructure.files

			for (const item of items) {
				if (typeof indicator.pattern === "string") {
					if (item.toLowerCase().includes(indicator.pattern.toLowerCase())) {
						score += indicator.weight
						break
					}
				} else if (indicator.pattern.test(item)) {
					score += indicator.weight
					break
				}
			}
		}

		// Check for multiple package.json or setup.py files (indicating separate services)
		const packageFiles = fileStructure.files.filter(
			(f) => f.endsWith("package.json") || f.endsWith("setup.py") || f.endsWith("go.mod"),
		)
		if (packageFiles.length > 2) {
			score += 0.3
			maxScore += 0.3
		}

		return maxScore > 0 ? score / maxScore : 0
	}

	getEvidence(fileStructure: FileStructureAnalysis): string[] {
		const evidence: string[] = []

		const hasServices = fileStructure.directories.some((d) => /services?$/i.test(d))
		const hasGateway = fileStructure.directories.some((d) => /gateway$/i.test(d))
		const hasDocker = fileStructure.files.some((f) => /docker-compose/i.test(f))

		if (hasServices) evidence.push("Found 'services' directory")
		if (hasGateway) evidence.push("Found API gateway")
		if (hasDocker) evidence.push("Found docker-compose configuration")

		return evidence
	}
}

// ============================================================================
// Framework Detectors
// ============================================================================

export interface FrameworkDetector {
	name: string
	type: "web" | "orm" | "testing" | "build" | "erp" | "other"
	detect(files: string[], packageDeps?: string[]): { detected: boolean; confidence: number; configFiles: string[] }
}

export const OdooFrameworkDetector: FrameworkDetector = {
	name: "Odoo",
	type: "erp",
	detect(files: string[], packageDeps?: string[]) {
		const configFiles: string[] = []
		let confidence = 0

		// Check for __manifest__.py files
		const manifestFiles = files.filter((f) => f.endsWith("__manifest__.py"))
		if (manifestFiles.length > 0) {
			confidence += 0.5
			configFiles.push(...manifestFiles)
		}

		// Check for __openerp__.py files (older Odoo)
		const openerpFiles = files.filter((f) => f.endsWith("__openerp__.py"))
		if (openerpFiles.length > 0) {
			confidence += 0.3
			configFiles.push(...openerpFiles)
		}

		// Check for models directory with specific patterns
		const hasModels = files.some((f) => /models\/__init__\.py$/.test(f))
		if (hasModels) {
			confidence += 0.1
		}

		// Check for views directory with XML files
		const hasViews = files.some((f) => /views\/.*\.xml$/.test(f))
		if (hasViews) {
			confidence += 0.1
		}

		return {
			detected: confidence > 0.3,
			confidence: Math.min(confidence, 1),
			configFiles,
		}
	},
}

export const DjangoFrameworkDetector: FrameworkDetector = {
	name: "Django",
	type: "web",
	detect(files: string[], packageDeps?: string[]) {
		const configFiles: string[] = []
		let confidence = 0

		// Check for settings.py
		const settingsFiles = files.filter((f) => f.endsWith("settings.py"))
		if (settingsFiles.length > 0) {
			confidence += 0.3
			configFiles.push(...settingsFiles)
		}

		// Check for manage.py
		const manageFiles = files.filter((f) => f.endsWith("manage.py"))
		if (manageFiles.length > 0) {
			confidence += 0.4
			configFiles.push(...manageFiles)
		}

		// Check for urls.py
		const urlsFiles = files.filter((f) => f.endsWith("urls.py"))
		if (urlsFiles.length > 0) {
			confidence += 0.2
		}

		// Check package dependencies
		if (packageDeps?.includes("django")) {
			confidence += 0.2
		}

		return {
			detected: confidence > 0.4,
			confidence: Math.min(confidence, 1),
			configFiles,
		}
	},
}

export const ExpressFrameworkDetector: FrameworkDetector = {
	name: "Express",
	type: "web",
	detect(files: string[], packageDeps?: string[]) {
		const configFiles: string[] = []
		let confidence = 0

		// Check package dependencies
		if (packageDeps?.includes("express")) {
			confidence += 0.6
		}

		// Check for routes directory
		const hasRoutes = files.some((f) => /routes?\//i.test(f))
		if (hasRoutes) {
			confidence += 0.2
		}

		// Check for middleware directory
		const hasMiddleware = files.some((f) => /middleware\//i.test(f))
		if (hasMiddleware) {
			confidence += 0.1
		}

		// Check for app.js or server.js
		const appFiles = files.filter((f) => /(app|server)\.(js|ts)$/.test(f))
		if (appFiles.length > 0) {
			confidence += 0.1
			configFiles.push(...appFiles)
		}

		return {
			detected: confidence > 0.4,
			confidence: Math.min(confidence, 1),
			configFiles,
		}
	},
}

export const ReactFrameworkDetector: FrameworkDetector = {
	name: "React",
	type: "web",
	detect(files: string[], packageDeps?: string[]) {
		const configFiles: string[] = []
		let confidence = 0

		// Check package dependencies
		if (packageDeps?.includes("react")) {
			confidence += 0.5
		}

		// Check for JSX/TSX files
		const jsxFiles = files.filter((f) => /\.(jsx|tsx)$/.test(f))
		if (jsxFiles.length > 0) {
			confidence += 0.3
		}

		// Check for components directory
		const hasComponents = files.some((f) => /components?\//i.test(f))
		if (hasComponents) {
			confidence += 0.2
		}

		return {
			detected: confidence > 0.4,
			confidence: Math.min(confidence, 1),
			configFiles,
		}
	},
}

// Export all pattern classes and detectors
export const ALL_PATTERNS: ArchitecturePattern[] = [
	new MVCPattern(),
	new CleanArchitecturePattern(),
	new HexagonalPattern(),
	new MicroservicesPattern(),
]

export const ALL_FRAMEWORK_DETECTORS: FrameworkDetector[] = [
	OdooFrameworkDetector,
	DjangoFrameworkDetector,
	ExpressFrameworkDetector,
	ReactFrameworkDetector,
]

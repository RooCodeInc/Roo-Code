/**
 * Architecture Detector
 * Detects architectural patterns and frameworks in a project
 */

import * as fs from "fs/promises"
import * as path from "path"
import {
	IArchitectureDetector,
	DetectedArchitecture,
	LayerDefinition,
	DetectedFramework,
	ArchitecturePatternType,
	PatternScore,
} from "./interfaces"
import {
	ALL_PATTERNS,
	ALL_FRAMEWORK_DETECTORS,
	FileStructureAnalysis,
	DependencyAnalysis,
	ArchitecturePattern,
} from "./patterns"

export class ArchitectureDetector implements IArchitectureDetector {
	private patterns: ArchitecturePattern[]
	private maxDepth: number

	constructor(maxDepth: number = 5) {
		this.patterns = ALL_PATTERNS
		this.maxDepth = maxDepth
	}

	/**
	 * Detect the architectural pattern of a project
	 */
	async detectPattern(projectPath: string): Promise<DetectedArchitecture> {
		const fileStructure = await this.analyzeFileStructure(projectPath)
		const dependencies = await this.analyzeDependencies(projectPath)

		const patternScores: PatternScore[] = []

		for (const pattern of this.patterns) {
			const score = await pattern.match(fileStructure, dependencies)
			const evidence = pattern.getEvidence(fileStructure)

			patternScores.push({
				pattern: pattern.name,
				score,
				evidence,
			})
		}

		// Sort by score descending
		patternScores.sort((a, b) => b.score - a.score)

		const primaryPattern = patternScores[0]?.score > 0.3 ? patternScores[0].pattern : "unknown"

		const layers = await this.identifyLayers(projectPath)
		const customFrameworks = await this.detectCustomFrameworks(projectPath)

		return {
			primaryPattern,
			confidence: patternScores[0]?.score ?? 0,
			allPatterns: patternScores,
			layers,
			customFrameworks,
		}
	}

	/**
	 * Identify architectural layers in the project
	 */
	async identifyLayers(projectPath: string): Promise<LayerDefinition[]> {
		const layers: LayerDefinition[] = []
		const fileStructure = await this.analyzeFileStructure(projectPath)

		// Define layer patterns
		const layerPatterns: {
			type: LayerDefinition["type"]
			patterns: RegExp[]
		}[] = [
			{
				type: "presentation",
				patterns: [/views?$/i, /pages?$/i, /components?$/i, /ui$/i, /frontend$/i, /client$/i],
			},
			{
				type: "application",
				patterns: [/usecases?$/i, /use_cases?$/i, /application$/i, /handlers?$/i, /controllers?$/i],
			},
			{
				type: "domain",
				patterns: [/domain$/i, /entities?$/i, /models?$/i, /core$/i],
			},
			{
				type: "data",
				patterns: [/data$/i, /repositories?$/i, /database$/i, /db$/i, /dal$/i],
			},
			{
				type: "infrastructure",
				patterns: [/infrastructure$/i, /infra$/i, /adapters?$/i, /external$/i, /integrations?$/i],
			},
		]

		for (const layerDef of layerPatterns) {
			const matchingDirs: string[] = []
			const matchingFiles: string[] = []

			for (const dir of fileStructure.directories) {
				for (const pattern of layerDef.patterns) {
					if (pattern.test(dir)) {
						matchingDirs.push(dir)
						break
					}
				}
			}

			if (matchingDirs.length > 0) {
				// Find files in these directories
				for (const file of fileStructure.files) {
					for (const dir of matchingDirs) {
						if (file.includes(dir)) {
							matchingFiles.push(file)
							break
						}
					}
				}

				layers.push({
					name: layerDef.type.charAt(0).toUpperCase() + layerDef.type.slice(1),
					type: layerDef.type,
					directories: matchingDirs,
					files: matchingFiles.slice(0, 20), // Limit to first 20 files
				})
			}
		}

		return layers
	}

	/**
	 * Detect custom frameworks used in the project
	 */
	async detectCustomFrameworks(projectPath: string): Promise<DetectedFramework[]> {
		const frameworks: DetectedFramework[] = []
		const fileStructure = await this.analyzeFileStructure(projectPath)

		// Get package dependencies
		const packageDeps = await this.getPackageDependencies(projectPath)

		for (const detector of ALL_FRAMEWORK_DETECTORS) {
			const result = detector.detect(fileStructure.files, packageDeps)

			if (result.detected) {
				frameworks.push({
					name: detector.name,
					type: detector.type,
					configFiles: result.configFiles,
					confidence: result.confidence,
				})
			}
		}

		// Sort by confidence
		frameworks.sort((a, b) => b.confidence - a.confidence)

		return frameworks
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	/**
	 * Analyze file structure of the project
	 */
	private async analyzeFileStructure(projectPath: string): Promise<FileStructureAnalysis> {
		const directories: string[] = []
		const files: string[] = []

		await this.walkDirectory(projectPath, 0, (itemPath, isDirectory) => {
			const relativePath = path.relative(projectPath, itemPath)

			// Skip node_modules, .git, etc.
			if (this.shouldSkip(relativePath)) {
				return false // Don't descend into this directory
			}

			if (isDirectory) {
				directories.push(relativePath)
			} else {
				files.push(relativePath)
			}

			return true // Continue walking
		})

		return {
			directories,
			files,
			patterns: new Map(),
		}
	}

	/**
	 * Analyze dependencies of the project
	 */
	private async analyzeDependencies(projectPath: string): Promise<DependencyAnalysis> {
		const internalDependencies = new Map<string, string[]>()
		const externalDependencies: string[] = []

		// Try to read package.json for external dependencies
		try {
			const packageJsonPath = path.join(projectPath, "package.json")
			const content = await fs.readFile(packageJsonPath, "utf-8")
			const pkg = JSON.parse(content)

			if (pkg.dependencies) {
				externalDependencies.push(...Object.keys(pkg.dependencies))
			}
			if (pkg.devDependencies) {
				externalDependencies.push(...Object.keys(pkg.devDependencies))
			}
		} catch {
			// No package.json
		}

		// Try to read requirements.txt for Python dependencies
		try {
			const requirementsPath = path.join(projectPath, "requirements.txt")
			const content = await fs.readFile(requirementsPath, "utf-8")
			const lines = content.split("\n")

			for (const line of lines) {
				const trimmed = line.trim()
				if (trimmed && !trimmed.startsWith("#")) {
					// Extract package name (before any version specifier)
					const match = trimmed.match(/^([a-zA-Z0-9_-]+)/)
					if (match) {
						externalDependencies.push(match[1].toLowerCase())
					}
				}
			}
		} catch {
			// No requirements.txt
		}

		return {
			internalDependencies,
			externalDependencies,
		}
	}

	/**
	 * Get package dependencies from package.json
	 */
	private async getPackageDependencies(projectPath: string): Promise<string[]> {
		const deps: string[] = []

		try {
			const packageJsonPath = path.join(projectPath, "package.json")
			const content = await fs.readFile(packageJsonPath, "utf-8")
			const pkg = JSON.parse(content)

			if (pkg.dependencies) {
				deps.push(...Object.keys(pkg.dependencies))
			}
			if (pkg.devDependencies) {
				deps.push(...Object.keys(pkg.devDependencies))
			}
		} catch {
			// Ignore errors
		}

		return deps
	}

	/**
	 * Walk directory recursively
	 */
	private async walkDirectory(
		dirPath: string,
		depth: number,
		callback: (itemPath: string, isDirectory: boolean) => boolean,
	): Promise<void> {
		if (depth > this.maxDepth) {
			return
		}

		try {
			const items = await fs.readdir(dirPath, { withFileTypes: true })

			for (const item of items) {
				const itemPath = path.join(dirPath, item.name)
				const shouldContinue = callback(itemPath, item.isDirectory())

				if (item.isDirectory() && shouldContinue) {
					await this.walkDirectory(itemPath, depth + 1, callback)
				}
			}
		} catch {
			// Ignore errors (permission denied, etc.)
		}
	}

	/**
	 * Check if a path should be skipped
	 */
	private shouldSkip(relativePath: string): boolean {
		const skipPatterns = [
			/^node_modules/,
			/^\.git/,
			/^\.vscode/,
			/^\.idea/,
			/^__pycache__/,
			/^\.pytest_cache/,
			/^\.mypy_cache/,
			/^dist/,
			/^build/,
			/^coverage/,
			/^\.next/,
			/^\.nuxt/,
		]

		return skipPatterns.some((pattern) => pattern.test(relativePath))
	}
}

/**
 * Impact Analyzer
 * Analyzes the impact of code changes on the codebase
 */

import { IGraphStore } from "./interfaces"
import { GraphNode, DependencyEdge, DependencyType } from "./types"

/**
 * Represents a file change
 */
export interface FileChange {
	filePath: string
	changeType: "added" | "modified" | "deleted"
	/** Optional: specific symbols changed (for fine-grained analysis) */
	changedSymbols?: string[]
}

/**
 * Impact level for affected files
 */
export enum ImpactLevel {
	/** Directly affected (imports the changed file) */
	DIRECT = "direct",
	/** Transitively affected (imports a file that imports the changed file) */
	TRANSITIVE = "transitive",
	/** Potentially affected (shares common dependencies) */
	POTENTIAL = "potential",
}

/**
 * Affected file information
 */
export interface AffectedFile {
	filePath: string
	impactLevel: ImpactLevel
	/** Distance from the changed file (1 = direct import) */
	distance: number
	/** Reason for being affected */
	reason: string
	/** Relationship type */
	dependencyType: DependencyType
}

/**
 * Complete impact analysis result
 */
export interface ImpactAnalysis {
	/** Original changes analyzed */
	changes: FileChange[]
	/** All affected files */
	affectedFiles: AffectedFile[]
	/** Summary counts by impact level */
	summary: {
		directCount: number
		transitiveCount: number
		potentialCount: number
		totalCount: number
	}
	/** Risk assessment */
	riskLevel: RiskLevel
	/** Recommendations */
	recommendations: string[]
	/** Analysis duration in ms */
	duration: number
}

/**
 * Risk levels for changes
 */
export enum RiskLevel {
	CRITICAL = "critical",
	HIGH = "high",
	MEDIUM = "medium",
	LOW = "low",
	MINIMAL = "minimal",
}

/**
 * ImpactAnalyzer - Analyzes the impact of code changes
 */
export class ImpactAnalyzer {
	private graphStore: IGraphStore

	constructor(graphStore: IGraphStore) {
		this.graphStore = graphStore
	}

	/**
	 * Analyze the impact of a set of changes
	 */
	async analyzeChanges(changes: FileChange[]): Promise<ImpactAnalysis> {
		const startTime = Date.now()
		const affectedFiles: AffectedFile[] = []
		const seenFiles = new Set<string>()

		for (const change of changes) {
			// Add the changed file to seen set
			seenFiles.add(change.filePath)

			// Get direct dependents
			const directDependents = await this.graphStore.getDependents(change.filePath)
			for (const dep of directDependents) {
				if (!seenFiles.has(dep)) {
					seenFiles.add(dep)
					affectedFiles.push({
						filePath: dep,
						impactLevel: ImpactLevel.DIRECT,
						distance: 1,
						reason: `Directly imports ${this.getShortName(change.filePath)}`,
						dependencyType: DependencyType.IMPORT,
					})
				}
			}

			// Get transitive dependents
			const transitiveDependents = await this.graphStore.getTransitiveDependents(change.filePath, 5)
			for (const dep of transitiveDependents) {
				if (!seenFiles.has(dep)) {
					seenFiles.add(dep)
					affectedFiles.push({
						filePath: dep,
						impactLevel: ImpactLevel.TRANSITIVE,
						distance: this.calculateDistance(dep, change.filePath, directDependents),
						reason: `Transitively depends on ${this.getShortName(change.filePath)}`,
						dependencyType: DependencyType.IMPORT,
					})
				}
			}
		}

		// Calculate summary
		const directCount = affectedFiles.filter((f) => f.impactLevel === ImpactLevel.DIRECT).length
		const transitiveCount = affectedFiles.filter((f) => f.impactLevel === ImpactLevel.TRANSITIVE).length
		const potentialCount = affectedFiles.filter((f) => f.impactLevel === ImpactLevel.POTENTIAL).length

		// Assess risk
		const riskLevel = this.assessRisk(changes, affectedFiles)

		// Generate recommendations
		const recommendations = this.generateRecommendations(changes, affectedFiles, riskLevel)

		return {
			changes,
			affectedFiles: affectedFiles.sort((a, b) => a.distance - b.distance),
			summary: {
				directCount,
				transitiveCount,
				potentialCount,
				totalCount: affectedFiles.length,
			},
			riskLevel,
			recommendations,
			duration: Date.now() - startTime,
		}
	}

	/**
	 * Analyze impact of a single file
	 */
	async analyzeFile(filePath: string): Promise<{
		directDependents: string[]
		transitiveDependents: string[]
		dependencies: string[]
		impactScore: number
	}> {
		const directDependents = await this.graphStore.getDependents(filePath)
		const transitiveDependents = await this.graphStore.getTransitiveDependents(filePath)
		const dependencies = await this.graphStore.getDependencies(filePath)

		// Calculate impact score based on how many files depend on this file
		const impactScore = this.calculateImpactScore(directDependents.length, transitiveDependents.size)

		return {
			directDependents,
			transitiveDependents: Array.from(transitiveDependents),
			dependencies: dependencies.map((d) => d.target),
			impactScore,
		}
	}

	/**
	 * Get files that would be affected by deleting a file
	 */
	async getDeleteImpact(filePath: string): Promise<{
		breakingChanges: AffectedFile[]
		canSafelyDelete: boolean
		blockers: string[]
	}> {
		const dependents = await this.graphStore.getDependents(filePath)
		const breakingChanges: AffectedFile[] = []
		const blockers: string[] = []

		for (const dep of dependents) {
			breakingChanges.push({
				filePath: dep,
				impactLevel: ImpactLevel.DIRECT,
				distance: 1,
				reason: `Will break: imports ${this.getShortName(filePath)}`,
				dependencyType: DependencyType.IMPORT,
			})
			blockers.push(dep)
		}

		return {
			breakingChanges,
			canSafelyDelete: dependents.length === 0,
			blockers,
		}
	}

	/**
	 * Find safe refactoring targets (files with no dependents)
	 */
	async findSafeRefactoringTargets(): Promise<string[]> {
		const stats = this.graphStore.getStats()
		const safeTargets: string[] = []

		// This would need access to all nodes - simplified version
		// In practice, you'd iterate through all nodes and check getDepends

		return safeTargets
	}

	/**
	 * Get the blast radius for a file (visualization data)
	 */
	async getBlastRadius(
		filePath: string,
		maxDepth: number = 3,
	): Promise<{
		center: string
		layers: Array<{ depth: number; files: string[] }>
		totalAffected: number
	}> {
		const layers: Array<{ depth: number; files: string[] }> = []
		const visited = new Set<string>()
		visited.add(filePath)

		let currentLayer = [filePath]

		for (let depth = 1; depth <= maxDepth; depth++) {
			const nextLayer: string[] = []

			for (const file of currentLayer) {
				const dependents = await this.graphStore.getDependents(file)
				for (const dep of dependents) {
					if (!visited.has(dep)) {
						visited.add(dep)
						nextLayer.push(dep)
					}
				}
			}

			if (nextLayer.length > 0) {
				layers.push({ depth, files: nextLayer })
			}

			currentLayer = nextLayer
		}

		return {
			center: filePath,
			layers,
			totalAffected: visited.size - 1, // Exclude the center file
		}
	}

	private calculateDistance(file: string, changedFile: string, directDependents: string[]): number {
		if (directDependents.includes(file)) return 1

		// Simplified distance calculation
		return 2 // Could be improved with BFS to find actual distance
	}

	private calculateImpactScore(directCount: number, transitiveCount: number): number {
		// Impact score from 0-100
		const directWeight = 10
		const transitiveWeight = 2

		const score = directCount * directWeight + transitiveCount * transitiveWeight
		return Math.min(100, score)
	}

	private assessRisk(changes: FileChange[], affectedFiles: AffectedFile[]): RiskLevel {
		const totalAffected = affectedFiles.length
		const hasDeletedFiles = changes.some((c) => c.changeType === "deleted")
		const directlyAffected = affectedFiles.filter((f) => f.impactLevel === ImpactLevel.DIRECT).length

		if (hasDeletedFiles && directlyAffected > 0) {
			return RiskLevel.CRITICAL
		}

		if (totalAffected > 50) {
			return RiskLevel.HIGH
		}

		if (totalAffected > 20 || directlyAffected > 10) {
			return RiskLevel.MEDIUM
		}

		if (totalAffected > 5) {
			return RiskLevel.LOW
		}

		return RiskLevel.MINIMAL
	}

	private generateRecommendations(
		changes: FileChange[],
		affectedFiles: AffectedFile[],
		riskLevel: RiskLevel,
	): string[] {
		const recommendations: string[] = []

		if (riskLevel === RiskLevel.CRITICAL) {
			recommendations.push("⚠️ Critical: Some files are being deleted that have dependents")
			recommendations.push("Review all breaking changes before proceeding")
		}

		if (affectedFiles.length > 20) {
			recommendations.push("Consider incremental rollout for this change")
		}

		const directlyAffected = affectedFiles.filter((f) => f.impactLevel === ImpactLevel.DIRECT)
		if (directlyAffected.length > 0) {
			recommendations.push(`Run tests for ${directlyAffected.length} directly affected file(s)`)
		}

		if (changes.some((c) => c.changeType === "deleted")) {
			recommendations.push("Update import statements in dependent files")
		}

		if (recommendations.length === 0) {
			recommendations.push("✅ This change has minimal impact and should be safe to proceed")
		}

		return recommendations
	}

	private getShortName(filePath: string): string {
		return filePath.split("/").pop() || filePath
	}
}

/**
 * Quick impact check without full analysis
 */
export async function quickImpactCheck(
	graphStore: IGraphStore,
	filePath: string,
): Promise<{
	hasDependents: boolean
	dependentCount: number
	riskLevel: RiskLevel
}> {
	const dependents = await graphStore.getDependents(filePath)
	const count = dependents.length

	let riskLevel: RiskLevel
	if (count > 20) {
		riskLevel = RiskLevel.HIGH
	} else if (count > 10) {
		riskLevel = RiskLevel.MEDIUM
	} else if (count > 0) {
		riskLevel = RiskLevel.LOW
	} else {
		riskLevel = RiskLevel.MINIMAL
	}

	return {
		hasDependents: count > 0,
		dependentCount: count,
		riskLevel,
	}
}

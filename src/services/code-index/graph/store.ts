/**
 * GraphStore Implementation
 * Enterprise-grade in-memory graph with persistence
 */

import * as fs from "fs/promises"
import * as path from "path"
import { IGraphStore } from "./interfaces"
import {
	CurrentContext,
	DependencyEdge,
	ExportSymbol,
	FileChange,
	GraphNode,
	GraphSnapshot,
	GraphStats,
	GRAPH_VERSION,
	ImpactReport,
	LoadResult,
	SaveResult,
	Suggestion,
} from "./types"

const GRAPH_FILENAME = "knowledge-graph.json"

export class GraphStore implements IGraphStore {
	private nodes: Map<string, GraphNode> = new Map()
	private dependentsIndex: Map<string, Set<string>> = new Map()
	private workspaceRoot: string
	private graphPath: string
	private dirtyNodes: Set<string> = new Set()

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot
		this.graphPath = path.join(workspaceRoot, ".roo", GRAPH_FILENAME)
	}

	async updateNode(
		filePath: string,
		contentHash: string,
		imports: DependencyEdge[],
		exports: ExportSymbol[],
	): Promise<void> {
		const startTime = Date.now()

		try {
			// Get existing node for dependents cleanup
			const existingNode = this.nodes.get(filePath)

			// Clean up old dependents index
			if (existingNode?.imports) {
				for (const imp of existingNode.imports) {
					const dependents = this.dependentsIndex.get(imp.target)
					if (dependents) {
						dependents.delete(filePath)
						if (dependents.size === 0) {
							this.dependentsIndex.delete(imp.target)
						}
					}
				}
			}

			// Create new node
			const node: GraphNode = {
				id: filePath,
				contentHash,
				lastUpdated: Date.now(),
				imports,
				exports,
				metadata: {
					fileSize: 0,
					lineCount: 0,
					parseDuration: Date.now() - startTime,
					parseAttempts: (existingNode?.metadata.parseAttempts || 0) + 1,
				},
			}

			this.nodes.set(filePath, node)

			// Update dependents index
			for (const imp of imports) {
				if (!this.dependentsIndex.has(imp.target)) {
					this.dependentsIndex.set(imp.target, new Set())
				}
				this.dependentsIndex.get(imp.target)!.add(filePath)
			}

			this.dirtyNodes.add(filePath)
		} catch (error) {
			console.error(`[GraphStore] Error updating node for ${filePath}:`, error)
			throw error
		}
	}

	async removeNode(filePath: string): Promise<void> {
		const node = this.nodes.get(filePath)
		if (!node) return

		// Clean up dependents index
		for (const imp of node.imports) {
			const dependents = this.dependentsIndex.get(imp.target)
			if (dependents) {
				dependents.delete(filePath)
				if (dependents.size === 0) {
					this.dependentsIndex.delete(imp.target)
				}
			}
		}

		this.nodes.delete(filePath)
		this.dirtyNodes.add(filePath)
	}

	async batchUpdate(
		nodes: Array<{
			filePath: string
			contentHash: string
			imports: DependencyEdge[]
			exports: ExportSymbol[]
		}>,
	): Promise<void> {
		// Use batching for performance
		const batchSize = 100
		for (let i = 0; i < nodes.length; i += batchSize) {
			const batch = nodes.slice(i, i + batchSize)
			await Promise.all(batch.map((n) => this.updateNode(n.filePath, n.contentHash, n.imports, n.exports)))
		}
	}

	async getDependencies(filePath: string): Promise<DependencyEdge[]> {
		const node = this.nodes.get(filePath)
		return node?.imports || []
	}

	async getDependents(filePath: string): Promise<string[]> {
		const dependents = this.dependentsIndex.get(filePath)
		return dependents ? Array.from(dependents) : []
	}

	async getTransitiveDependencies(filePath: string, maxDepth: number = 10): Promise<Set<string>> {
		const visited = new Set<string>()
		const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }]

		while (queue.length > 0) {
			const current = queue.shift()!

			if (visited.has(current.path) || current.depth >= maxDepth) continue
			visited.add(current.path)

			const node = this.nodes.get(current.path)
			if (node) {
				for (const imp of node.imports) {
					if (!visited.has(imp.target)) {
						queue.push({ path: imp.target, depth: current.depth + 1 })
					}
				}
			}
		}

		// Remove the starting file from the result
		visited.delete(filePath)
		return visited
	}

	async getTransitiveDependents(filePath: string, maxDepth: number = 10): Promise<Set<string>> {
		const visited = new Set<string>()
		const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }]

		while (queue.length > 0) {
			const current = queue.shift()!

			if (visited.has(current.path) || current.depth >= maxDepth) continue
			visited.add(current.path)

			const dependents = this.dependentsIndex.get(current.path)
			if (dependents) {
				for (const dep of dependents) {
					if (!visited.has(dep)) {
						queue.push({ path: dep, depth: current.depth + 1 })
					}
				}
			}
		}

		// Remove the starting file from the result
		visited.delete(filePath)
		return visited
	}

	async findCommonDependencies(filePathA: string, filePathB: string): Promise<string[]> {
		const depsA = await this.getTransitiveDependencies(filePathA)
		const depsB = await this.getTransitiveDependencies(filePathB)

		const common: string[] = []
		for (const dep of depsA) {
			if (depsB.has(dep)) {
				common.push(dep)
			}
		}

		return common
	}

	async save(): Promise<SaveResult> {
		const startTime = Date.now()
		const nodeCount = this.nodes.size

		if (nodeCount === 0) {
			return { success: true, duration: 0, nodeCount: 0, edgeCount: 0 }
		}

		try {
			// Ensure .roo directory exists
			const rooDir = path.dirname(this.graphPath)
			await fs.mkdir(rooDir, { recursive: true })

			// Count total edges
			let edgeCount = 0
			for (const node of this.nodes.values()) {
				edgeCount += node.imports.length
			}

			// Convert Maps to serializable objects
			const nodesObj: Record<string, GraphNode> = {}
			for (const [key, value] of this.nodes) {
				nodesObj[key] = value
			}

			const dependentsObj: Record<string, string[]> = {}
			for (const [key, value] of this.dependentsIndex) {
				dependentsObj[key] = Array.from(value)
			}

			// Create snapshot
			const snapshot: GraphSnapshot = {
				version: GRAPH_VERSION,
				schemaVersion: "1.0.0",
				builtAt: Date.now(),
				nodeCount,
				edgeCount,
				workspaceRoot: this.workspaceRoot,
				nodes: nodesObj,
				dependentsIndex: dependentsObj,
				buildInfo: {
					duration: Date.now() - startTime,
					successCount: nodeCount,
					failureCount: 0,
					peakMemoryUsage: process.memoryUsage().heapUsed,
					changes: [],
				},
			}

			// Atomic write using temp file
			const tempPath = `${this.graphPath}.tmp.${Date.now()}`
			try {
				await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2))
				await fs.rename(tempPath, this.graphPath)
			} finally {
				// Clean up temp file if it still exists
				try {
					await fs.unlink(tempPath)
				} catch {
					// Ignore cleanup errors - file may not exist or already renamed
				}
			}

			this.dirtyNodes.clear()

			return {
				success: true,
				duration: Date.now() - startTime,
				nodeCount,
				edgeCount,
			}
		} catch (error) {
			console.error("[GraphStore] Save failed:", error)
			return {
				success: false,
				duration: Date.now() - startTime,
				nodeCount: this.nodes.size,
				edgeCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	async load(): Promise<LoadResult> {
		const startTime = Date.now()

		try {
			// Check if file exists
			const exists = await fs
				.access(this.graphPath)
				.then(() => true)
				.catch(() => false)
			if (!exists) {
				return { success: true, loadedFromDisk: false, nodeCount: 0, duration: 0 }
			}

			// Read and parse
			const content = await fs.readFile(this.graphPath, "utf-8")
			const snapshot: GraphSnapshot = JSON.parse(content)

			// Validate version
			if (snapshot.version !== GRAPH_VERSION) {
				console.warn(`[GraphStore] Graph version mismatch: expected ${GRAPH_VERSION}, got ${snapshot.version}`)
				// Clear and rebuild on version mismatch
				return { success: true, loadedFromDisk: false, nodeCount: 0, duration: Date.now() - startTime }
			}

			// Restore nodes
			this.nodes = new Map(Object.entries(snapshot.nodes))

			// Restore dependents index
			this.dependentsIndex = new Map()
			for (const [key, value] of Object.entries(snapshot.dependentsIndex)) {
				this.dependentsIndex.set(key, new Set(value))
			}

			return {
				success: true,
				loadedFromDisk: true,
				nodeCount: snapshot.nodeCount,
				duration: Date.now() - startTime,
				previousVersion: snapshot.version,
			}
		} catch (error) {
			console.error("[GraphStore] Load failed:", error)
			// On error, start fresh
			this.nodes.clear()
			this.dependentsIndex.clear()
			return {
				success: false,
				loadedFromDisk: false,
				nodeCount: 0,
				duration: Date.now() - startTime,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	async snapshot(): Promise<GraphSnapshot> {
		let edgeCount = 0
		for (const node of this.nodes.values()) {
			edgeCount += node.imports.length
		}

		const nodesObj: Record<string, GraphNode> = {}
		for (const [key, value] of this.nodes) {
			nodesObj[key] = value
		}

		const dependentsObj: Record<string, string[]> = {}
		for (const [key, value] of this.dependentsIndex) {
			dependentsObj[key] = Array.from(value)
		}

		return {
			version: GRAPH_VERSION,
			schemaVersion: "1.0.0",
			builtAt: Date.now(),
			nodeCount: this.nodes.size,
			edgeCount,
			workspaceRoot: this.workspaceRoot,
			nodes: nodesObj,
			dependentsIndex: dependentsObj,
			buildInfo: {
				duration: 0,
				successCount: this.nodes.size,
				failureCount: 0,
				peakMemoryUsage: process.memoryUsage().heapUsed,
				changes: [],
			},
		}
	}

	async clear(): Promise<void> {
		this.nodes.clear()
		this.dependentsIndex.clear()
		this.dirtyNodes.clear()

		// Try to delete the persisted file
		try {
			await fs.unlink(this.graphPath)
		} catch {
			// File may not exist, ignore
		}
	}

	async needsUpdate(filePath: string, contentHash: string): Promise<boolean> {
		const node = this.nodes.get(filePath)
		return !node || node.contentHash !== contentHash
	}

	getStats(): GraphStats {
		let totalEdges = 0
		let maxDegree = 0

		for (const node of this.nodes.values()) {
			totalEdges += node.imports.length
			maxDegree = Math.max(maxDegree, node.imports.length)
		}

		return {
			nodeCount: this.nodes.size,
			edgeCount: totalEdges,
			averageDegree: this.nodes.size > 0 ? totalEdges / this.nodes.size : 0,
			maxDegree,
			connectedComponents: this.countConnectedComponents(),
			cyclicDependencies: 0, // Computed on demand by CycleDetector
			memoryUsage: process.memoryUsage().heapUsed,
			lastUpdated: Date.now(),
		}
	}

	private countConnectedComponents(): number {
		const visited = new Set<string>()
		let components = 0

		for (const [filePath] of this.nodes) {
			if (!visited.has(filePath)) {
				components++
				this.bfsMark(filePath, visited)
			}
		}

		return components
	}

	private bfsMark(filePath: string, visited: Set<string>): void {
		const queue = [filePath]

		while (queue.length > 0) {
			const current = queue.shift()!
			if (visited.has(current)) continue

			visited.add(current)

			const node = this.nodes.get(current)
			if (node) {
				for (const imp of node.imports) {
					if (!visited.has(imp.target)) {
						queue.push(imp.target)
					}
				}
			}

			const dependents = this.dependentsIndex.get(current)
			if (dependents) {
				for (const dep of dependents) {
					if (!visited.has(dep)) {
						queue.push(dep)
					}
				}
			}
		}
	}

	/**
	 * Check if the graph has any data
	 */
	hasData(): boolean {
		return this.nodes.size > 0
	}

	/**
	 * Get a node by file path
	 */
	getNode(filePath: string): GraphNode | undefined {
		return this.nodes.get(filePath)
	}

	// ============================================================================
	// Enhanced Graph Operations
	// ============================================================================

	/**
	 * Update graph relations in real-time based on file changes
	 */
	async updateRelationsRealtime(change: FileChange): Promise<void> {
		const startTime = Date.now()

		try {
			switch (change.type) {
				case "created":
				case "modified":
					// For modified/created files, we need to refresh the node's imports/exports
					// This requires parsing the file, which should be done by the parser
					// For now, we mark the node as needing update
					if (change.contentHash) {
						const needsUpdate = await this.needsUpdate(change.filePath, change.contentHash)
						if (needsUpdate) {
							this.dirtyNodes.add(change.filePath)
						}
					}
					break

				case "deleted":
					// Remove the node from the graph
					await this.removeNode(change.filePath)
					break
			}

			console.log(`[GraphStore] Real-time update completed in ${Date.now() - startTime}ms`)
		} catch (error) {
			console.error(`[GraphStore] Real-time update failed for ${change.filePath}:`, error)
			throw error
		}
	}

	/**
	 * Perform quick impact analysis for a file change
	 */
	async quickImpactAnalysis(filePath: string): Promise<ImpactReport> {
		const startTime = Date.now()

		try {
			// Get direct dependents
			const directImpact = await this.getDependents(filePath)

			// Get transitive dependents (limited depth for speed)
			const transitiveSet = await this.getTransitiveDependents(filePath, 3)
			const transitiveImpact = Array.from(transitiveSet).filter((f) => !directImpact.includes(f))

			// Calculate risk level
			const totalImpact = directImpact.length + transitiveImpact.length
			let riskLevel: "low" | "medium" | "high" | "critical"
			if (totalImpact === 0) {
				riskLevel = "low"
			} else if (totalImpact < 5) {
				riskLevel = "low"
			} else if (totalImpact < 20) {
				riskLevel = "medium"
			} else if (totalImpact < 50) {
				riskLevel = "high"
			} else {
				riskLevel = "critical"
			}

			// Generate suggestions
			const suggestions: string[] = []
			if (totalImpact > 0) {
				suggestions.push(`This change affects ${totalImpact} file(s)`)

				if (directImpact.length > 0) {
					suggestions.push(`Review ${directImpact.length} direct dependent(s)`)
				}

				if (totalImpact > 10) {
					suggestions.push("Consider running full test suite")
				} else if (totalImpact > 0) {
					suggestions.push("Run tests for affected files")
				}

				if (riskLevel === "critical") {
					suggestions.push("⚠️ High-risk change - consider breaking into smaller changes")
				}
			} else {
				suggestions.push("No dependencies affected - safe to change")
			}

			console.log(`[GraphStore] Impact analysis completed in ${Date.now() - startTime}ms`)

			return {
				directImpact,
				transitiveImpact,
				riskLevel,
				suggestions,
				estimatedTestCount: Math.min(totalImpact * 2, 100), // Rough estimate
			}
		} catch (error) {
			console.error(`[GraphStore] Impact analysis failed for ${filePath}:`, error)
			// Return safe defaults on error
			return {
				directImpact: [],
				transitiveImpact: [],
				riskLevel: "low",
				suggestions: ["Error performing impact analysis"],
			}
		}
	}

	/**
	 * Get smart suggestions based on current context
	 */
	async getSmartSuggestions(context: CurrentContext): Promise<Suggestion[]> {
		const suggestions: Suggestion[] = []

		try {
			const currentNode = this.nodes.get(context.currentFile)
			if (!currentNode) {
				return suggestions
			}

			// 1. Suggest related files based on imports
			for (const imp of currentNode.imports.slice(0, 5)) {
				suggestions.push({
					type: "dependency",
					target: imp.target,
					reason: `Imported by ${context.currentFile}`,
					confidence: imp.confidence,
					priority: 70,
				})
			}

			// 2. Suggest files that import this file
			const dependents = await this.getDependents(context.currentFile)
			for (const dep of dependents.slice(0, 3)) {
				suggestions.push({
					type: "related_file",
					target: dep,
					reason: `Depends on ${context.currentFile}`,
					confidence: 0.8,
					priority: 60,
				})
			}

			// 3. Suggest common dependencies (files that share imports)
			if (context.recentFiles && context.recentFiles.length > 0) {
				for (const recentFile of context.recentFiles.slice(0, 2)) {
					const commonDeps = await this.findCommonDependencies(context.currentFile, recentFile)
					for (const common of commonDeps.slice(0, 2)) {
						suggestions.push({
							type: "related_file",
							target: common,
							reason: `Common dependency with ${recentFile}`,
							confidence: 0.7,
							priority: 50,
						})
					}
				}
			}

			// 4. Suggest test files (heuristic: files ending with .test.* or .spec.*)
			const testPatterns = [".test.", ".spec."]
			for (const [filePath] of this.nodes) {
				if (testPatterns.some((pattern) => filePath.includes(pattern))) {
					// Check if this test file imports the current file
					const testNode = this.nodes.get(filePath)
					if (testNode?.imports.some((imp) => imp.target === context.currentFile)) {
						suggestions.push({
							type: "test_file",
							target: filePath,
							reason: `Test file for ${context.currentFile}`,
							confidence: 0.9,
							priority: 80,
						})
						break // Only suggest one test file
					}
				}
			}

			// Sort by priority and confidence
			suggestions.sort((a, b) => {
				const scoreA = a.priority * a.confidence
				const scoreB = b.priority * b.confidence
				return scoreB - scoreA
			})

			// Return top 10 suggestions
			 return suggestions.slice(0, 10)
		} catch (error) {
			console.error(`[GraphStore] Error generating suggestions:`, error)
			return suggestions
		}
	}
}

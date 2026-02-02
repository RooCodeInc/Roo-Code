/**
 * Cycle Detector
 * Detects cyclic dependencies in the knowledge graph
 */

import { GraphNode, DependencyEdge } from "./types"

/**
 * Information about a detected cycle
 */
export interface CycleInfo {
	/** Files involved in the cycle (in order) */
	path: string[]
	/** Total cycle length */
	length: number
	/** Severity based on cycle characteristics */
	severity: CycleSeverity
	/** Human-readable description */
	description: string
}

/**
 * Cycle severity levels
 */
export enum CycleSeverity {
	/** Self-reference - file imports itself */
	CRITICAL = "critical",
	/** Two files reference each other */
	HIGH = "high",
	/** Cycle involving 3-5 files */
	MEDIUM = "medium",
	/** Cycle involving more than 5 files */
	LOW = "low",
}

/**
 * Complete cycle detection result
 */
export interface CycleDetectionResult {
	/** Whether cycles were found */
	hasCycles: boolean
	/** Total number of cycles detected */
	cycleCount: number
	/** Details of each cycle */
	cycles: CycleInfo[]
	/** Detection duration in ms */
	duration: number
	/** Files analyzed */
	filesAnalyzed: number
}

/**
 * CycleDetector - Detects and analyzes cyclic dependencies
 */
export class CycleDetector {
	/**
	 * Detect all cycles in the graph
	 */
	detect(nodes: Map<string, GraphNode>): CycleDetectionResult {
		const startTime = Date.now()
		const cycles: CycleInfo[] = []

		// Use Tarjan's algorithm for strongly connected components
		const sccs = this.findStronglyConnectedComponents(nodes)

		// Find cycles within SCCs
		for (const scc of sccs) {
			if (scc.length === 1) {
				// Check for self-cycle
				const node = nodes.get(scc[0])
				if (node && node.imports.some((imp) => imp.target === scc[0])) {
					cycles.push(this.createCycleInfo([scc[0], scc[0]]))
				}
			} else {
				// Find actual cycle path within SCC
				const cyclePath = this.findCyclePath(scc, nodes)
				if (cyclePath.length > 0) {
					cycles.push(this.createCycleInfo(cyclePath))
				}
			}
		}

		return {
			hasCycles: cycles.length > 0,
			cycleCount: cycles.length,
			cycles: cycles.sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity)),
			duration: Date.now() - startTime,
			filesAnalyzed: nodes.size,
		}
	}

	/**
	 * Check if adding a dependency would create a cycle
	 */
	wouldCreateCycle(nodes: Map<string, GraphNode>, fromFile: string, toFile: string): boolean {
		// If toFile depends (transitively) on fromFile, adding fromFile -> toFile creates a cycle
		const visited = new Set<string>()
		const queue = [toFile]

		while (queue.length > 0) {
			const current = queue.shift()!

			if (current === fromFile) {
				return true
			}

			if (visited.has(current)) continue
			visited.add(current)

			const node = nodes.get(current)
			if (node) {
				for (const imp of node.imports) {
					if (!visited.has(imp.target)) {
						queue.push(imp.target)
					}
				}
			}
		}

		return false
	}

	/**
	 * Get all files involved in cycles
	 */
	getFilesInCycles(nodes: Map<string, GraphNode>): Set<string> {
		const result = this.detect(nodes)
		const filesInCycles = new Set<string>()

		for (const cycle of result.cycles) {
			for (const file of cycle.path) {
				filesInCycles.add(file)
			}
		}

		return filesInCycles
	}

	/**
	 * Find strongly connected components using Tarjan's algorithm
	 */
	private findStronglyConnectedComponents(nodes: Map<string, GraphNode>): string[][] {
		const index = new Map<string, number>()
		const lowlink = new Map<string, number>()
		const onStack = new Set<string>()
		const stack: string[] = []
		const sccs: string[][] = []
		let currentIndex = 0

		const strongConnect = (v: string) => {
			index.set(v, currentIndex)
			lowlink.set(v, currentIndex)
			currentIndex++
			stack.push(v)
			onStack.add(v)

			const node = nodes.get(v)
			if (node) {
				for (const imp of node.imports) {
					const w = imp.target
					if (!index.has(w)) {
						// w has not been visited
						if (nodes.has(w)) {
							strongConnect(w)
							lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
						}
					} else if (onStack.has(w)) {
						// w is on stack and hence in current SCC
						lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!))
					}
				}
			}

			// If v is a root node, pop the stack and generate an SCC
			if (lowlink.get(v) === index.get(v)) {
				const scc: string[] = []
				let w: string
				do {
					w = stack.pop()!
					onStack.delete(w)
					scc.push(w)
				} while (w !== v)

				if (scc.length > 1) {
					sccs.push(scc)
				} else if (scc.length === 1) {
					// Check for self-loop
					const node = nodes.get(scc[0])
					if (node && node.imports.some((imp) => imp.target === scc[0])) {
						sccs.push(scc)
					}
				}
			}
		}

		for (const v of nodes.keys()) {
			if (!index.has(v)) {
				strongConnect(v)
			}
		}

		return sccs
	}

	/**
	 * Find the actual cycle path within an SCC
	 */
	private findCyclePath(scc: string[], nodes: Map<string, GraphNode>): string[] {
		if (scc.length === 0) return []
		if (scc.length === 1) return [scc[0], scc[0]]

		const sccSet = new Set(scc)
		const start = scc[0]
		const visited = new Set<string>()
		const parent = new Map<string, string>()

		// BFS to find cycle
		const queue = [start]
		visited.add(start)

		while (queue.length > 0) {
			const current = queue.shift()!
			const node = nodes.get(current)

			if (node) {
				for (const imp of node.imports) {
					const target = imp.target
					if (!sccSet.has(target)) continue

					if (target === start && parent.has(current)) {
						// Found cycle back to start
						const path = [start]
						let trace = current
						while (trace !== start) {
							path.unshift(trace)
							trace = parent.get(trace)!
						}
						path.push(start) // Complete the cycle
						return path
					}

					if (!visited.has(target)) {
						visited.add(target)
						parent.set(target, current)
						queue.push(target)
					}
				}
			}
		}

		// If we couldn't find exact path, return SCC as cycle
		return [...scc, scc[0]]
	}

	private createCycleInfo(path: string[]): CycleInfo {
		const length = path.length - 1 // Don't count the return to start

		let severity: CycleSeverity
		if (length === 1) {
			severity = CycleSeverity.CRITICAL // Self-reference
		} else if (length === 2) {
			severity = CycleSeverity.HIGH // Mutual reference
		} else if (length <= 5) {
			severity = CycleSeverity.MEDIUM
		} else {
			severity = CycleSeverity.LOW
		}

		const description = this.generateDescription(path, severity)

		return { path, length, severity, description }
	}

	private generateDescription(path: string[], severity: CycleSeverity): string {
		const shortNames = path.map((p) => p.split("/").pop() || p)

		switch (severity) {
			case CycleSeverity.CRITICAL:
				return `Self-reference: ${shortNames[0]} imports itself`
			case CycleSeverity.HIGH:
				return `Mutual dependency: ${shortNames[0]} ↔ ${shortNames[1]}`
			default:
				return `Cycle detected: ${shortNames.slice(0, -1).join(" → ")} → ${shortNames[shortNames.length - 1]}`
		}
	}

	private severityOrder(severity: CycleSeverity): number {
		switch (severity) {
			case CycleSeverity.CRITICAL:
				return 0
			case CycleSeverity.HIGH:
				return 1
			case CycleSeverity.MEDIUM:
				return 2
			case CycleSeverity.LOW:
				return 3
		}
	}
}

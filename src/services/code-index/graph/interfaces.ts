/**
 * Knowledge Graph Interfaces
 * Enterprise-grade interfaces for graph operations
 */

import { DependencyEdge, ExportSymbol, GraphSnapshot, GraphStats, LoadResult, ParseResult, SaveResult } from "./types"

/**
 * Enterprise-grade graph store interface
 * Provides comprehensive operations for graph management
 */
export interface IGraphStore {
	// Core CRUD Operations

	/**
	 * Updates or creates a node in the graph
	 * @param filePath - Absolute path to the file
	 * @param contentHash - SHA-256 hash of content
	 * @param imports - Array of dependency edges
	 * @param exports - Array of exported symbols
	 */
	updateNode(filePath: string, contentHash: string, imports: DependencyEdge[], exports: ExportSymbol[]): Promise<void>

	/**
	 * Removes a node and all its edges from the graph
	 * @param filePath - Absolute path to the file
	 */
	removeNode(filePath: string): Promise<void>

	/**
	 * Batch update multiple nodes efficiently
	 * @param nodes - Array of node updates
	 */
	batchUpdate(
		nodes: Array<{
			filePath: string
			contentHash: string
			imports: DependencyEdge[]
			exports: ExportSymbol[]
		}>,
	): Promise<void>

	// Query Operations

	/**
	 * Get all direct dependencies of a file
	 * @param filePath - Absolute path to the file
	 * @returns Array of dependency edges
	 */
	getDependencies(filePath: string): Promise<DependencyEdge[]>

	/**
	 * Get all files that depend on the given file
	 * @param filePath - Absolute path to the file
	 * @returns Array of file paths
	 */
	getDependents(filePath: string): Promise<string[]>

	/**
	 * Get transitive closure of dependencies
	 * @param filePath - Absolute path to the file
	 * @param maxDepth - Maximum depth to traverse
	 * @returns Set of all transitive dependencies
	 */
	getTransitiveDependencies(filePath: string, maxDepth?: number): Promise<Set<string>>

	/**
	 * Get transitive closure of dependents
	 * @param filePath - Absolute path to the file
	 * @param maxDepth - Maximum depth to traverse
	 * @returns Set of all transitive dependents
	 */
	getTransitiveDependents(filePath: string, maxDepth?: number): Promise<Set<string>>

	/**
	 * Find common dependencies between two files
	 * @param filePathA - First file path
	 * @param filePathB - Second file path
	 * @returns Array of common dependency paths
	 */
	findCommonDependencies(filePathA: string, filePathB: string): Promise<string[]>

	// Lifecycle Operations

	/**
	 * Persist graph to disk with atomic write
	 */
	save(): Promise<SaveResult>

	/**
	 * Load graph from disk with validation
	 * @returns LoadResult with status and metadata
	 */
	load(): Promise<LoadResult>

	/**
	 * Get a snapshot of current graph state
	 */
	snapshot(): Promise<GraphSnapshot>

	/**
	 * Clear all graph data
	 */
	clear(): Promise<void>

	// Utility Operations

	/**
	 * Check if a file needs update
	 * @param filePath - Absolute path to the file
	 * @param contentHash - Current content hash
	 * @returns True if update is needed
	 */
	needsUpdate(filePath: string, contentHash: string): Promise<boolean>

	/**
	 * Get statistics about the graph
	 */
	getStats(): GraphStats
}

/**
 * Graph parser interface for extracting dependencies from source code
 */
export interface IGraphParser {
	/**
	 * Parse a file and extract imports/exports
	 * @param filePath - Path to the file
	 * @param content - File content
	 * @returns Parse result with imports and exports
	 */
	parseFile(filePath: string, content: string): Promise<ParseResult>
}

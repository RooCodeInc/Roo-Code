/**
 * Context Compression Service
 *
 * Provides intelligent compression of code content while preserving
 * essential information and semantics for reduced token usage.
 *
 * @module context-compression
 */

import type { CompressionConfig, CompressionStrategy } from "./interfaces"

import { ContextCompressor as ContextCompressorClass, createCompressorWithStrategy } from "./context-compressor"

// Interfaces
export type {
	CompressionConfig,
	CompressionStrategy,
	CompressionStats,
	CompressedContext,
	CompressionMetadata,
	LanguageCompressionSettings,
	FunctionInfo,
	ClassInfo,
	PropertyInfo,
	ParameterInfo,
	ImportInfo,
	ExportInfo,
	SummarizedFile,
	SummarizedClass,
	SummarizedFunction,
	ContextCompressor as IContextCompressor,
} from "./interfaces"

// Main Compressor
export {
	ContextCompressor,
	createDefaultCompressor,
	createCompressorWithStrategy,
	createAggressiveCompressor,
	createPreservativeCompressor,
} from "./context-compressor"

// Code Structure Analyzer
export { CodeStructureAnalyzer, analyzeCodeStructure } from "./code-structure-analyzer"

// Smart Summarizer
export { SmartSummarizer, summarizeSection } from "./smart-summarizer"

// Compression Strategies
export { CompressionStrategyFactory, createCompressionStrategy, compressWithStrategy } from "./compression-strategies"

/**
 * Create a context compressor with default settings
 */
export function createContextCompressor(config?: Partial<CompressionConfig>): ContextCompressorClass {
	return new ContextCompressorClass(config)
}

/**
 * Quick compress function for simple use cases
 */
export async function quickCompress(
	content: string,
	maxTokens: number,
	strategy: CompressionStrategy = "balanced",
): Promise<string> {
	const compressor = createCompressorWithStrategy(strategy)
	const result = await compressor.compress(content, maxTokens)
	return result.content
}

/**
 * Get compression ratio for content
 */
export async function getCompressionRatio(
	content: string,
	maxTokens: number,
	strategy: CompressionStrategy = "balanced",
): Promise<number> {
	const compressor = createCompressorWithStrategy(strategy)
	const result = await compressor.compress(content, maxTokens)
	return result.compressionRatio
}

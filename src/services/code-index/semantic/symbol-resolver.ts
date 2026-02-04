/**
 * Symbol Resolver
 * Cross-file symbol resolution with caching support
 */

import * as path from "path"
import {
	ISymbolResolver,
	ResolvedSymbol,
	FileContext,
	Reference,
	SymbolInfo,
	Position,
	Range,
	ImportAnalysis,
} from "./interfaces"
import { SymbolCache } from "./symbol-cache"
import { SemanticAnalyzer } from "./semantic-analyzer"

interface SymbolEntry {
	symbol: SymbolInfo
	filePath: string
	isExported: boolean
}

export class SymbolResolver implements ISymbolResolver {
	private symbolIndex: Map<string, SymbolEntry[]> = new Map()
	private fileSymbols: Map<string, SymbolInfo[]> = new Map()
	private fileImports: Map<string, ImportAnalysis[]> = new Map()
	private cache: SymbolCache
	private analyzer: SemanticAnalyzer

	constructor(analyzer?: SemanticAnalyzer, cacheSize: number = 10000) {
		this.cache = new SymbolCache(cacheSize)
		this.analyzer = analyzer || new SemanticAnalyzer()
	}

	/**
	 * Resolve a symbol to its definition
	 */
	async resolveSymbol(symbol: string, context: FileContext): Promise<ResolvedSymbol | null> {
		// 1. Check cache first
		const cached = this.cache.get(symbol, context.filePath)
		if (cached) {
			return cached
		}

		// 2. Check local scope
		const localMatch = this.findInLocalScope(symbol, context)
		if (localMatch) {
			this.cache.set(symbol, context.filePath, localMatch)
			return localMatch
		}

		// 3. Check imports
		const importMatch = await this.findInImports(symbol, context)
		if (importMatch) {
			this.cache.set(symbol, context.filePath, importMatch)
			return importMatch
		}

		// 4. Check global symbols
		const globalMatch = this.findGlobalSymbol(symbol)
		if (globalMatch) {
			this.cache.set(symbol, context.filePath, globalMatch)
			return globalMatch
		}

		return null
	}

	/**
	 * Index symbols from a file
	 */
	async indexFile(filePath: string, content: string): Promise<void> {
		try {
			const analysis = await this.analyzer.analyzeDeep(filePath, content)

			// Store symbols for this file
			this.fileSymbols.set(filePath, analysis.symbols)
			this.fileImports.set(filePath, analysis.imports)

			// Add to global index
			for (const symbol of analysis.symbols) {
				this.addToIndex(symbol, filePath, this.isExported(symbol, analysis.exports))
			}

			// Invalidate cache for this file
			this.cache.invalidateFile(filePath)
			this.cache.invalidateReferencesTo(filePath)
		} catch (error) {
			// File couldn't be parsed, skip it
			console.warn(`Failed to index file ${filePath}:`, error)
		}
	}

	/**
	 * Get all references to a symbol
	 */
	async getReferences(symbol: string, filePath: string): Promise<Reference[]> {
		const references: Reference[] = []

		// Search all indexed files for usage of this symbol
		for (const [path, symbols] of this.fileSymbols.entries()) {
			for (const sym of symbols) {
				if (sym.references) {
					for (const ref of sym.references) {
						if (ref.type === "call" || ref.type === "read" || ref.type === "write") {
							// Check if the reference is to the symbol we're looking for
							// This is a simplified check - real implementation would need more context
							references.push(ref)
						}
					}
				}
			}
		}

		return references
	}

	/**
	 * Invalidate cache for a file (e.g., when file is modified)
	 */
	invalidateFile(filePath: string): void {
		this.cache.invalidateFile(filePath)
		this.cache.invalidateReferencesTo(filePath)

		// Remove from indexes
		this.fileSymbols.delete(filePath)
		this.fileImports.delete(filePath)

		// Remove from symbol index
		for (const [symbolName, entries] of this.symbolIndex.entries()) {
			const filtered = entries.filter((e) => e.filePath !== filePath)
			if (filtered.length === 0) {
				this.symbolIndex.delete(symbolName)
			} else {
				this.symbolIndex.set(symbolName, filtered)
			}
		}
	}

	/**
	 * Clear all indexed data
	 */
	clear(): void {
		this.symbolIndex.clear()
		this.fileSymbols.clear()
		this.fileImports.clear()
		this.cache.clear()
	}

	/**
	 * Get statistics about the symbol index
	 */
	getStats(): { totalSymbols: number; totalFiles: number; cacheStats: ReturnType<SymbolCache["getStats"]> } {
		let totalSymbols = 0
		for (const entries of this.symbolIndex.values()) {
			totalSymbols += entries.length
		}

		return {
			totalSymbols,
			totalFiles: this.fileSymbols.size,
			cacheStats: this.cache.getStats(),
		}
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	/**
	 * Find symbol in local scope
	 */
	private findInLocalScope(symbol: string, context: FileContext): ResolvedSymbol | null {
		// Check local symbols first
		for (const localSymbol of context.localSymbols) {
			if (localSymbol.name === symbol) {
				return this.symbolToResolved(localSymbol, context.filePath, false)
			}
		}

		// Check file-level symbols
		const fileSymbols = this.fileSymbols.get(context.filePath)
		if (fileSymbols) {
			for (const sym of fileSymbols) {
				if (sym.name === symbol && sym.scope === "module") {
					return this.symbolToResolved(sym, context.filePath, false)
				}
			}
		}

		return null
	}

	/**
	 * Find symbol in imports
	 */
	private async findInImports(symbol: string, context: FileContext): Promise<ResolvedSymbol | null> {
		// Check context imports
		for (const imp of context.imports) {
			for (const imported of imp.importedSymbols) {
				const effectiveName = imported.alias || imported.name
				if (effectiveName === symbol) {
					// Resolve the module path
					const resolvedPath = this.resolveModulePath(imp.modulePath, context.filePath)
					if (resolvedPath) {
						// Look up the symbol in the imported file
						const entries = this.symbolIndex.get(imported.name)
						if (entries) {
							const match = entries.find((e) => e.filePath === resolvedPath && e.isExported)
							if (match) {
								return this.symbolToResolved(match.symbol, match.filePath, match.isExported)
							}
						}
					}
				}
			}
		}

		// Check cached file imports
		const fileImports = this.fileImports.get(context.filePath)
		if (fileImports) {
			for (const imp of fileImports) {
				for (const imported of imp.importedSymbols) {
					const effectiveName = imported.alias || imported.name
					if (effectiveName === symbol) {
						const resolvedPath = this.resolveModulePath(imp.modulePath, context.filePath)
						if (resolvedPath) {
							const entries = this.symbolIndex.get(imported.name)
							if (entries) {
								const match = entries.find((e) => e.filePath === resolvedPath && e.isExported)
								if (match) {
									return this.symbolToResolved(match.symbol, match.filePath, match.isExported)
								}
							}
						}
					}
				}
			}
		}

		return null
	}

	/**
	 * Find symbol in global index
	 */
	private findGlobalSymbol(symbol: string): ResolvedSymbol | null {
		const entries = this.symbolIndex.get(symbol)
		if (!entries || entries.length === 0) {
			return null
		}

		// Prioritize exported symbols
		const exported = entries.find((e) => e.isExported)
		if (exported) {
			return this.symbolToResolved(exported.symbol, exported.filePath, true)
		}

		// Fall back to first match
		const first = entries[0]
		return this.symbolToResolved(first.symbol, first.filePath, first.isExported)
	}

	/**
	 * Add symbol to global index
	 */
	private addToIndex(symbol: SymbolInfo, filePath: string, isExported: boolean): void {
		const existing = this.symbolIndex.get(symbol.name) || []
		existing.push({ symbol, filePath, isExported })
		this.symbolIndex.set(symbol.name, existing)
	}

	/**
	 * Check if a symbol is exported
	 */
	private isExported(symbol: SymbolInfo, exports: { name: string }[]): boolean {
		return exports.some((e) => e.name === symbol.name || e.name === "default")
	}

	/**
	 * Convert SymbolInfo to ResolvedSymbol
	 */
	private symbolToResolved(symbol: SymbolInfo, filePath: string, isExported: boolean): ResolvedSymbol {
		const range: Range = symbol.range || {
			start: symbol.position,
			end: { line: symbol.position.line, column: symbol.position.column + symbol.name.length },
		}

		return {
			...symbol,
			filePath,
			definitionRange: range,
			isExported,
		}
	}

	/**
	 * Resolve a module path to an absolute file path
	 */
	private resolveModulePath(modulePath: string, fromFile: string): string | null {
		if (!modulePath.startsWith(".") && !modulePath.startsWith("/")) {
			// External module, can't resolve
			return null
		}

		const dir = path.dirname(fromFile)
		let resolved = path.resolve(dir, modulePath)

		// Add .ts or .js extension if needed
		if (!path.extname(resolved)) {
			// Try common extensions
			const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]
			for (const ext of extensions) {
				const withExt = resolved + ext
				if (this.fileSymbols.has(withExt)) {
					return withExt
				}
			}
		}

		return this.fileSymbols.has(resolved) ? resolved : null
	}
}

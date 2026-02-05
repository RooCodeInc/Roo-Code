/**
 * GraphBuilder Implementation
 * Extracts dependency relationships from source code using regex patterns
 */

import * as path from "path"
import { IGraphParser } from "./interfaces"
import { Accessibility, DependencyEdge, DependencyType, ExportSymbol, ParseResult, SymbolType } from "./types"

/**
 * Enterprise-grade graph builder with comprehensive language support
 */
export class GraphBuilder implements IGraphParser {
	private readonly languageAnalyzers: Map<string, LanguageAnalyzer> = new Map()

	constructor() {
		// Register language analyzers
		this.registerAnalyzer(".ts", new TypeScriptAnalyzer())
		this.registerAnalyzer(".tsx", new TypeScriptAnalyzer())
		this.registerAnalyzer(".js", new JavaScriptAnalyzer())
		this.registerAnalyzer(".jsx", new JavaScriptAnalyzer())
		this.registerAnalyzer(".py", new OdooPythonAnalyzer()) // Enhanced for Odoo
		this.registerAnalyzer(".go", new GoAnalyzer())
		this.registerAnalyzer(".java", new JavaAnalyzer())
		this.registerAnalyzer(".rs", new RustAnalyzer())
		this.registerAnalyzer(".cpp", new CppAnalyzer())
		this.registerAnalyzer(".c", new CppAnalyzer())
		this.registerAnalyzer(".cs", new CSharpAnalyzer())
		// Odoo-specific file types
		this.registerAnalyzer(".xml", new OdooXmlAnalyzer())
		this.registerAnalyzer(".scss", new ScssAnalyzer())
		this.registerAnalyzer(".css", new CssAnalyzer())
	}

	registerAnalyzer(extension: string, analyzer: LanguageAnalyzer): void {
		this.languageAnalyzers.set(extension, analyzer)
	}

	async parseFile(filePath: string, content: string): Promise<ParseResult> {
		const ext = path.extname(filePath).toLowerCase()
		const analyzer = this.languageAnalyzers.get(ext)

		const startTime = Date.now()

		try {
			if (!analyzer) {
				return {
					filePath,
					imports: [],
					exports: [],
					parseDuration: Date.now() - startTime,
					success: true,
				}
			}

			return await analyzer.analyze(filePath, content)
		} catch (error) {
			return {
				filePath,
				imports: [],
				exports: [],
				parseDuration: Date.now() - startTime,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	/**
	 * Get supported file extensions
	 */
	getSupportedExtensions(): string[] {
		return Array.from(this.languageAnalyzers.keys())
	}
}

/**
 * Interface for language-specific analyzers
 */
export interface LanguageAnalyzer {
	analyze(filePath: string, content: string): Promise<ParseResult>
}

/**
 * Base class for common functionality
 */
abstract class BaseAnalyzer implements LanguageAnalyzer {
	protected abstract getImportPatterns(): RegExp[]
	protected abstract getExportPatterns(): RegExp[]

	async analyze(filePath: string, content: string): Promise<ParseResult> {
		const startTime = Date.now()
		const imports: DependencyEdge[] = []
		const exports: ExportSymbol[] = []

		const lines = content.split("\n")

		// Extract imports
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			for (const pattern of this.getImportPatterns()) {
				// Reset regex lastIndex for global patterns
				pattern.lastIndex = 0

				const match = pattern.exec(line)
				if (match?.groups?.path) {
					imports.push({
						target: match.groups.path,
						type: this.getDependencyType(match.groups.type),
						lineNumber: i + 1,
						isTransitive: false,
						confidence: 1.0,
					})
				}
			}
		}

		// Extract exports
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			for (const pattern of this.getExportPatterns()) {
				pattern.lastIndex = 0

				const match = pattern.exec(line)
				if (match?.groups?.name) {
					exports.push({
						name: match.groups.name,
						type: this.parseSymbolType(match.groups.symbolType),
						lineNumber: i + 1,
						accessibility: Accessibility.PUBLIC,
						isDeprecated: /@deprecated/i.test(line),
					})
				}
			}
		}

		return {
			filePath,
			imports,
			exports,
			parseDuration: Date.now() - startTime,
			success: true,
		}
	}

	protected getDependencyType(type?: string): DependencyType {
		switch (type?.toLowerCase()) {
			case "require":
				return DependencyType.REQUIRE
			case "export":
				return DependencyType.EXPORT
			case "extends":
				return DependencyType.EXTENDS
			case "implements":
				return DependencyType.IMPLEMENTS
			case "type":
				return DependencyType.TYPE_REFERENCE
			default:
				return DependencyType.IMPORT
		}
	}

	protected parseSymbolType(type?: string): SymbolType {
		switch (type?.toLowerCase()) {
			case "function":
			case "async":
			case "fn":
			case "def":
			case "func":
				return SymbolType.FUNCTION
			case "class":
				return SymbolType.CLASS
			case "interface":
				return SymbolType.INTERFACE
			case "type":
				return SymbolType.TYPE_ALIAS
			case "enum":
				return SymbolType.ENUM
			case "const":
			case "let":
			case "var":
				return SymbolType.CONSTANT
			case "module":
			case "mod":
				return SymbolType.MODULE
			case "namespace":
				return SymbolType.NAMESPACE
			default:
				return SymbolType.FUNCTION
		}
	}
}

/**
 * TypeScript/TSX analyzer
 */
class TypeScriptAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// import { x } from 'path' or import x from 'path' (with path length limit to prevent ReDoS)
			/import\s+(?:(?:\{[^}]{1,500}\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"](?<path>[^'"]{1,500})['"]/g,
			// Dynamic import: import('path') (with path length limit)
			/import\s*\(\s*['"](?<path>[^'"]{1,500})['"]\s*\)/g,
			// require('path') (with path length limit)
			/require\s*\(\s*['"](?<path>[^'"]{1,500})['"]\s*\)/g,
			// export { x } from 'path' (with path length limit)
			/export\s+(?:\{[^}]{1,500}\}\s+)?from\s+['"](?<path>[^'"]{1,500})['"]/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// export function/class/interface/type/enum/const
			/export\s+(?:declare\s+)?(?:async\s+)?(?<symbolType>function|class|interface|type|enum|const|let)\s+(?<name>\w+)/g,
			// export default function/class
			/export\s+default\s+(?:async\s+)?(?<symbolType>function|class)?\s*(?<name>\w+)?/g,
			// export namespace/module
			/export\s+(?<symbolType>namespace|module)\s+(?<name>\w+)/g,
		]
	}
}

/**
 * JavaScript/JSX analyzer - inherits from TypeScript
 */
class JavaScriptAnalyzer extends TypeScriptAnalyzer {
	// JavaScript uses same patterns, minus type-specific ones
}

/**
 * Python analyzer
 */
class PythonAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// from x import y or import x
			/^(?:from\s+(?<path>[\w.]+)\s+import|import\s+(?<path>[\w.]+))/gm,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// def function_name
			/^(?<symbolType>def)\s+(?<name>\w+)\s*\(/gm,
			// class ClassName
			/^(?<symbolType>class)\s+(?<name>\w+)/gm,
		]
	}
}

/**
 * Go analyzer
 */
class GoAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// import "path" or import alias "path"
			/^\s*(?:import\s+)?\s*(?:\w+\s+)?["'](?<path>[^"']+)["']/gm,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// func FunctionName (exported if starts with uppercase)
			/^(?<symbolType>func)\s+(?:\([^)]*\)\s+)?(?<name>[A-Z]\w*)/gm,
			// type TypeName struct/interface
			/^type\s+(?<name>[A-Z]\w*)\s+(?<symbolType>struct|interface)/gm,
		]
	}
}

/**
 * Java analyzer
 */
class JavaAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// import x.y.z;
			/import\s+(?:static\s+)?(?<path>[\w.]+);/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// public class/interface/enum ClassName
			/(?:public\s+)?(?<symbolType>class|interface|enum)\s+(?<name>\w+)/g,
		]
	}
}

/**
 * Rust analyzer
 */
class RustAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// use path::to::module;
			/use\s+(?<path>[^;{]+)/g,
			// extern crate name;
			/extern\s+crate\s+(?<path>\w+)/g,
			// mod name;
			/mod\s+(?<path>\w+);/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// pub fn function_name
			/pub\s+(?:async\s+)?(?<symbolType>fn)\s+(?<name>\w+)/g,
			// pub struct/enum/trait Name
			/pub\s+(?<symbolType>struct|enum|trait|mod)\s+(?<name>\w+)/g,
			// pub const NAME
			/pub\s+(?<symbolType>const)\s+(?<name>\w+)/g,
		]
	}
}

/**
 * C/C++ analyzer
 */
class CppAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// #include <path> or #include "path"
			/#include\s+[<"](?<path>[^>"]+)[>"]/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// class ClassName
			/(?<symbolType>class|struct)\s+(?<name>\w+)/g,
			// Return type function_name(
			/(?:[\w:*&<>]+\s+)+(?<name>\w+)\s*\(/g,
		]
	}
}

/**
 * C# analyzer
 */
class CSharpAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// using Namespace.Path;
			/using\s+(?:static\s+)?(?<path>[\w.]+);/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// public class/interface/struct/enum Name
			/(?:public\s+)?(?:partial\s+)?(?<symbolType>class|interface|struct|enum)\s+(?<name>\w+)/g,
		]
	}
}

// ========================================
// ODOO ERP SPECIFIC ANALYZERS
// ========================================

/**
 * Enhanced Python analyzer for Odoo ERP
 * Handles Odoo-specific patterns: models, fields, API decorators, etc.
 */
class OdooPythonAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// from odoo import models, fields, api
			/^(?:from\s+(?<path>[\w.]+)\s+import|import\s+(?<path>[\w.]+))/gm,
			// from odoo.addons.module_name import
			/from\s+odoo\.addons\.(?<path>[\w_]+)/g,
			// from . import models (relative imports)
			/from\s+\.(?<path>[\w_.]*)\s+import/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// class ClassName(models.Model) - Odoo models
			/^(?<symbolType>class)\s+(?<name>\w+)\s*\((?:models\.)?(?:Model|TransientModel|AbstractModel)\)/gm,
			// class ClassName: or class ClassName(Parent): - Regular Python classes
			/^(?<symbolType>class)\s+(?<name>\w+)\s*[:(]/gm,
			// def function_name (with indentation)
			/^\s*(?<symbolType>def)\s+(?<name>\w+)\s*\(/gm,
			// _name = 'module.model'
			/_name\s*=\s*['"](?<name>[\w.]+)['"]/g,
			// _inherit = 'module.model'
			/_inherit\s*=\s*['"](?<name>[\w.]+)['"]/g,
			// @api.model, @api.depends, @api.constrains, etc.
			/@api\.(?<name>model|depends|constrains|onchange|returns|multi|one)/g,
			// fields definitions: field_name = fields.Char(...)
			/^\s*(?<name>\w+)\s*=\s*fields\.(?:Char|Text|Integer|Float|Boolean|Date|Datetime|Binary|Selection|Many2one|One2many|Many2many|Html|Monetary|Reference)/gm,
		]
	}

	override async analyze(filePath: string, content: string): Promise<ParseResult> {
		const baseResult = await super.analyze(filePath, content)

		// Check if this is an Odoo __manifest__.py or __openerp__.py
		if (filePath.endsWith("__manifest__.py") || filePath.endsWith("__openerp__.py")) {
			const manifestDeps = this.extractManifestDependencies(content)
			manifestDeps.forEach((dep) => {
				baseResult.imports.push({
					target: dep,
					type: DependencyType.IMPORT,
					lineNumber: 0,
					isTransitive: false,
					confidence: 1.0,
				})
			})
		}

		return baseResult
	}

	private extractManifestDependencies(content: string): string[] {
		const deps: string[] = []

		// Extract 'depends': [...] from manifest
		const dependsMatch = content.match(/'depends'\s*:\s*\[([\s\S]*?)\]/m)
		if (dependsMatch) {
			const depsStr = dependsMatch[1]
			const depMatches = depsStr.matchAll(/['"](\w+)['"]/g)
			for (const match of depMatches) {
				deps.push(match[1])
			}
		}

		return deps
	}
}

/**
 * Odoo XML analyzer for views, data files, QWeb templates, reports
 */
class OdooXmlAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return []
	}

	protected getExportPatterns(): RegExp[] {
		return []
	}

	override async analyze(filePath: string, content: string): Promise<ParseResult> {
		const startTime = Date.now()
		const imports: DependencyEdge[] = []
		const exports: ExportSymbol[] = []

		// Extract record ids (external identifiers)
		const recordMatches = content.matchAll(/<record\s[^>]*id=["']([^"']+)["'][^>]*>/g)
		for (const match of recordMatches) {
			exports.push({
				name: match[1],
				type: SymbolType.CONSTANT,
				lineNumber: this.getLineNumber(content, match.index || 0),
				accessibility: Accessibility.PUBLIC,
				isDeprecated: false,
			})
		}

		// Extract template ids (QWeb) - handle both attribute orders
		const templateMatches = content.matchAll(/<template\s[^>]*?id=["']([^"']+)["'][^>]*>/g)
		for (const match of templateMatches) {
			exports.push({
				name: match[1],
				type: SymbolType.FUNCTION, // Templates are like functions
				lineNumber: this.getLineNumber(content, match.index || 0),
				accessibility: Accessibility.PUBLIC,
				isDeprecated: false,
			})
		}

		// Extract view inheritance (inherit_id)
		const inheritMatches = content.matchAll(/<field\s+name=["']inherit_id["']\s+ref=["']([^"']+)["']/g)
		for (const match of inheritMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.EXTENDS,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 1.0,
			})
		}

		// Extract model references
		const modelMatches = content.matchAll(/<field\s+name=["']model["'][^>]*>([^<]+)<\/field>/g)
		for (const match of modelMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.TYPE_REFERENCE,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 0.8,
			})
		}

		// Extract ref() calls (references to other records)
		const refMatches = content.matchAll(/ref=["']([^"']+)["']/g)
		for (const match of refMatches) {
			if (!match[1].includes("inherit_id")) {
				// Already handled above
				imports.push({
					target: match[1],
					type: DependencyType.IMPORT,
					lineNumber: this.getLineNumber(content, match.index || 0),
					isTransitive: false,
					confidence: 0.9,
				})
			}
		}

		// Extract t-call template references (QWeb)
		const tCallMatches = content.matchAll(/t-call=["']([^"']+)["']/g)
		for (const match of tCallMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.IMPORT,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 1.0,
			})
		}

		// Extract t-inherit (QWeb template inheritance)
		const tInheritMatches = content.matchAll(/t-inherit=["']([^"']+)["']/g)
		for (const match of tInheritMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.EXTENDS,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 1.0,
			})
		}

		// Extract menu parent references
		const menuParentMatches = content.matchAll(/parent=["']([^"']+)["']/g)
		for (const match of menuParentMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.IMPORT,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 0.9,
			})
		}

		// Extract action references
		const actionMatches = content.matchAll(/action=["']([^"']+)["']/g)
		for (const match of actionMatches) {
			imports.push({
				target: match[1],
				type: DependencyType.IMPORT,
				lineNumber: this.getLineNumber(content, match.index || 0),
				isTransitive: false,
				confidence: 0.9,
			})
		}

		return {
			filePath,
			imports,
			exports,
			parseDuration: Date.now() - startTime,
			success: true,
		}
	}

	private getLineNumber(content: string, index: number): number {
		if (index < 0 || index > content.length) {
			return 1
		}
		return content.substring(0, Math.min(index, content.length)).split("\n").length
	}
}

/**
 * SCSS analyzer (used in Odoo for styling)
 */
class ScssAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// @import 'path' or @import "path"
			/@import\s+['"](?<path>[^'"]+)['"]/g,
			// @use 'path'
			/@use\s+['"](?<path>[^'"]+)['"]/g,
			// @forward 'path'
			/@forward\s+['"](?<path>[^'"]+)['"]/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// $variable-name:
			/^\$(?<name>[\w-]+)\s*:/gm,
			// @mixin mixin-name
			/@mixin\s+(?<name>[\w-]+)/g,
			// %placeholder-name
			/%(?<name>[\w-]+)/g,
		]
	}
}

/**
 * CSS analyzer
 */
class CssAnalyzer extends BaseAnalyzer {
	protected getImportPatterns(): RegExp[] {
		return [
			// @import url('path') or @import 'path'
			/@import\s+(?:url\s*\(\s*)?['"](?<path>[^'"]+)['"]/g,
		]
	}

	protected getExportPatterns(): RegExp[] {
		return [
			// .class-name
			/^\s*\.(?<name>[\w-]+)\s*[{,]/gm,
			// #id-name
			/^\s*#(?<name>[\w-]+)\s*[{,]/gm,
			// CSS custom properties: --variable-name:
			/--(?<name>[\w-]+)\s*:/g,
		]
	}
}

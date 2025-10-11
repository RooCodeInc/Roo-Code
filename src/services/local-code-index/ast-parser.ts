import Parser from "web-tree-sitter"
import { loadRequiredLanguageParsers, type LanguageParser } from "../tree-sitter/languageParser"
import * as path from "path"
import * as fs from "fs/promises"
import type { CodeBlockType, ParsedCodeBlock, ParsedImport, FileParseResult } from "./types"

/**
 * AST 解析器 - 用于本地代码索引
 * 基于现有的 Tree-sitter 基础设施,扩展以提取更详细的代码信息
 */
export class LocalASTParser {
	private languageParsers: LanguageParser | null = null

	/**
	 * 初始化解析器
	 */
	async initialize(filePaths: string[]): Promise<void> {
		this.languageParsers = await loadRequiredLanguageParsers(filePaths)
	}

	/**
	 * 解析单个文件
	 */
	async parseFile(filePath: string): Promise<FileParseResult | null> {
		if (!this.languageParsers) {
			throw new Error("Parser not initialized. Call initialize() first.")
		}

		const content = await fs.readFile(filePath, "utf8")
		const ext = path.extname(filePath).toLowerCase().slice(1)

		const { parser, query } = this.languageParsers[ext] || {}
		if (!parser || !query) {
			return null // 不支持的文件类型
		}

		try {
			const tree = parser.parse(content)
			const lines = content.split("\n")

			return {
				filePath,
				language: ext,
				lineCount: lines.length,
				codeBlocks: this.extractCodeBlocks(tree, query, lines, content),
				imports: this.extractImports(tree, ext, lines),
			}
		} catch (error) {
			console.error(`Failed to parse ${filePath}:`, error)
			return null
		}
	}

	/**
	 * 提取代码块
	 */
	private extractCodeBlocks(
		tree: Parser.Tree,
		query: Parser.Query,
		lines: string[],
		content: string,
	): ParsedCodeBlock[] {
		const captures = query.captures(tree.rootNode)
		const blocks: ParsedCodeBlock[] = []
		const processedRanges = new Set<string>()

		for (const capture of captures) {
			const { node, name } = capture

			// 只处理定义节点
			if (!name.includes("definition") && !name.includes("name")) {
				continue
			}

			const definitionNode = name.includes("name") ? node.parent : node
			if (!definitionNode) continue

			const rangeKey = `${definitionNode.startPosition.row}-${definitionNode.endPosition.row}`
			if (processedRanges.has(rangeKey)) {
				continue
			}
			processedRanges.add(rangeKey)

			const block = this.parseCodeBlock(definitionNode, lines, content)
			if (block) {
				blocks.push(block)
			}
		}

		// 建立父子关系
		return this.establishHierarchy(blocks)
	}

	/**
	 * 建立代码块的层次关系
	 */
	private establishHierarchy(blocks: ParsedCodeBlock[]): ParsedCodeBlock[] {
		const result: ParsedCodeBlock[] = []
		const blockMap = new Map<string, ParsedCodeBlock>()

		// 第一遍：收集所有块
		for (const block of blocks) {
			const key = `${block.startLine}-${block.endLine}`
			blockMap.set(key, block)
		}

		// 第二遍：建立父子关系和完全限定名
		for (const block of blocks) {
			// 查找父块（包含当前块的最小块）
			let parent: ParsedCodeBlock | null = null
			let minSize = Infinity

			for (const [, potentialParent] of blockMap) {
				if (
					potentialParent !== block &&
					potentialParent.startLine <= block.startLine &&
					potentialParent.endLine >= block.endLine
				) {
					const size = potentialParent.endLine - potentialParent.startLine
					if (size < minSize) {
						minSize = size
						parent = potentialParent
					}
				}
			}

			// 设置完全限定名
			if (parent) {
				block.fullName = `${parent.fullName || parent.name}.${block.name}`
			} else {
				block.fullName = block.name
			}

			result.push(block)
		}

		return result
	}

	/**
	 * 解析单个代码块
	 */
	private parseCodeBlock(node: Parser.SyntaxNode, lines: string[], content: string): ParsedCodeBlock | null {
		const startLine = node.startPosition.row
		const endLine = node.endPosition.row

		// 提取代码块类型
		const type = this.inferBlockType(node)
		if (!type) return null

		// 提取名称
		const name = this.extractName(node)
		if (!name) return null

		// 提取内容
		const blockContent = content.substring(node.startIndex, node.endIndex)

		// 提取文档注释
		const docComment = this.extractDocComment(node, lines)

		// 提取签名（对于函数/方法）
		const signature = this.extractSignature(node, lines)

		// 提取修饰符
		const modifiers = this.extractModifiers(node)

		// 提取参数（对于函数/方法）
		const parameters = this.extractParameters(node)

		// 提取返回类型
		const returnType = this.extractReturnType(node)

		return {
			type,
			name,
			startLine,
			endLine,
			startColumn: node.startPosition.column,
			endColumn: node.endPosition.column,
			content: blockContent,
			signature,
			docComment,
			modifiers,
			parameters,
			returnType,
		}
	}

	/**
	 * 推断代码块类型
	 */
	private inferBlockType(node: Parser.SyntaxNode): CodeBlockType | null {
		const typeMap: Record<string, CodeBlockType> = {
			class_declaration: "class",
			interface_declaration: "interface",
			type_alias_declaration: "type",
			function_declaration: "function",
			method_definition: "method",
			property_definition: "property",
			property_declaration: "property",
			field_declaration: "property",
			public_field_definition: "property",
			enum_declaration: "enum",
			variable_declaration: "variable",
			lexical_declaration: "variable",
			const_declaration: "constant",
		}

		return typeMap[node.type] || null
	}

	/**
	 * 提取名称
	 */
	private extractName(node: Parser.SyntaxNode): string | null {
		// 查找 identifier 或 name 节点
		const nameNode = node.childForFieldName("name") || node.descendantsOfType("identifier")[0]

		return nameNode ? nameNode.text : null
	}

	/**
	 * 提取文档注释
	 */
	private extractDocComment(node: Parser.SyntaxNode, lines: string[]): string | null {
		const startLine = node.startPosition.row

		// 向上查找注释
		const commentLines: string[] = []
		for (let i = startLine - 1; i >= 0 && i >= startLine - 20; i--) {
			// 最多向上查找20行
			const line = lines[i].trim()

			if (line.startsWith("*") || line.startsWith("/**") || line.startsWith("*/")) {
				commentLines.unshift(line)
			} else if (line.startsWith("//")) {
				commentLines.unshift(line)
			} else if (line === "") {
				continue // 允许空行
			} else {
				break // 遇到非注释行，停止
			}
		}

		return commentLines.length > 0 ? commentLines.join("\n") : null
	}

	/**
	 * 提取函数签名
	 */
	private extractSignature(node: Parser.SyntaxNode, lines: string[]): string | null {
		const startLine = node.startPosition.row
		const line = lines[startLine]

		// 对于函数/方法，提取第一行作为签名
		if (node.type.includes("function") || node.type.includes("method")) {
			// 提取到第一个 { 或 => 之前
			const match = line.match(/^[^{=>]+/) || [line]
			return match[0].trim()
		}

		return null
	}

	/**
	 * 提取修饰符
	 */
	private extractModifiers(node: Parser.SyntaxNode): string[] {
		const modifiers: string[] = []

		// 检查常见修饰符
		const modifierTypes = [
			"export",
			"default",
			"async",
			"static",
			"public",
			"private",
			"protected",
			"readonly",
			"abstract",
			"const",
		]

		for (const child of node.children) {
			if (modifierTypes.includes(child.type) || modifierTypes.includes(child.text)) {
				modifiers.push(child.text)
			}
		}

		return modifiers
	}

	/**
	 * 提取参数列表
	 */
	private extractParameters(node: Parser.SyntaxNode): ParsedCodeBlock["parameters"] {
		const paramsNode = node.childForFieldName("parameters")
		if (!paramsNode) return undefined

		const parameters: NonNullable<ParsedCodeBlock["parameters"]> = []

		for (const param of paramsNode.children) {
			if (
				param.type === "required_parameter" ||
				param.type === "optional_parameter" ||
				param.type.includes("parameter")
			) {
				const name = param.childForFieldName("pattern")?.text || param.text
				const typeNode = param.childForFieldName("type")
				const type = typeNode ? typeNode.text : undefined

				parameters.push({ name, type })
			}
		}

		return parameters.length > 0 ? parameters : undefined
	}

	/**
	 * 提取返回类型
	 */
	private extractReturnType(node: Parser.SyntaxNode): string | null {
		const returnTypeNode = node.childForFieldName("return_type")
		return returnTypeNode ? returnTypeNode.text : null
	}

	/**
	 * 提取导入信息
	 */
	private extractImports(tree: Parser.Tree, language: string, lines: string[]): ParsedImport[] {
		const imports: ParsedImport[] = []

		// 根据语言类型查找导入节点
		const importNodeTypes = this.getImportNodeTypes(language)

		for (const nodeType of importNodeTypes) {
			const importNodes = tree.rootNode.descendantsOfType(nodeType)

			for (const node of importNodes) {
				const importInfo = this.parseImportNode(node, lines)
				if (importInfo) {
					imports.push(importInfo)
				}
			}
		}

		return imports
	}

	/**
	 * 获取导入节点类型
	 */
	private getImportNodeTypes(language: string): string[] {
		const typeMap: Record<string, string[]> = {
			ts: ["import_statement"],
			tsx: ["import_statement"],
			js: ["import_statement"],
			jsx: ["import_statement"],
			py: ["import_statement", "import_from_statement"],
			java: ["import_declaration"],
			go: ["import_declaration"],
		}

		return typeMap[language] || []
	}

	/**
	 * 解析导入节点
	 */
	private parseImportNode(node: Parser.SyntaxNode, lines: string[]): ParsedImport | null {
		const lineNumber = node.startPosition.row
		const line = lines[lineNumber]

		// TypeScript/JavaScript: import ... from '...'
		const tsImportMatch = line.match(/import\s+(.+?)\s+from\s+['"](.+?)['"]/)
		if (tsImportMatch) {
			const [, imports, path] = tsImportMatch
			return {
				importPath: path,
				importType: imports.trim().startsWith("{") ? "named" : "default",
				importedNames: this.parseImportedNames(imports),
				lineNumber,
			}
		}

		// Python: from ... import ...
		const pyImportMatch = line.match(/from\s+(.+?)\s+import\s+(.+)/)
		if (pyImportMatch) {
			const [, module, imports] = pyImportMatch
			return {
				importPath: module.trim(),
				importType: "named",
				importedNames: imports.split(",").map((s) => s.trim()),
				lineNumber,
			}
		}

		return null
	}

	/**
	 * 解析导入的名称列表
	 */
	private parseImportedNames(importString: string): string[] {
		// { Component, useState } => ['Component', 'useState']
		const match = importString.match(/\{(.+?)\}/)
		if (match) {
			return match[1].split(",").map((s) => s.trim())
		}

		// Component => ['Component']
		return [importString.trim()]
	}
}

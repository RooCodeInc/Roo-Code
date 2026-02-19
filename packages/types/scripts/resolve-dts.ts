/**
 * Post-build script that resolves `z.infer<typeof X>` expressions in generated
 * .d.ts and .d.cts declaration files using the TypeScript Compiler API.
 *
 * tsup (and all DTS bundlers) preserve `z.infer<typeof schema>` verbatim in
 * declaration output. This script loads the source project, resolves each
 * inferred type via the type checker, and text-replaces the z.infer expressions
 * with their fully-expanded type strings.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as ts from "typescript"

/** Normalize a path to forward slashes (TypeScript API always uses `/`). */
function normalizePath(p: string): string {
	return p.replace(/\\/g, "/")
}

const ROOT = normalizePath(path.resolve(import.meta.dirname, ".."))
const DIST = normalizePath(path.join(ROOT, "dist"))
const DTS_FILES = ["index.d.ts", "index.d.cts"]

// ---------------------------------------------------------------------------
// 1. Load the source project and create a type checker
// ---------------------------------------------------------------------------

function createProgram(): ts.Program {
	const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, "tsconfig.json")

	if (!configPath) {
		throw new Error("Could not find tsconfig.json")
	}

	const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
	const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT)

	return ts.createProgram(parsed.fileNames, {
		...parsed.options,
		noEmit: true,
	})
}

// ---------------------------------------------------------------------------
// 2. Walk source files and build a replacement map
//    schemaName -> resolved type string
//    e.g. "toolNamesSchema" -> '"execute_command" | "read_file" | ...'
// ---------------------------------------------------------------------------

interface ReplacementEntry {
	schemaName: string
	resolvedType: string
}

function buildReplacementMap(program: ts.Program): ReplacementEntry[] {
	const checker = program.getTypeChecker()
	const entries: ReplacementEntry[] = []
	const srcDir = normalizePath(path.join(ROOT, "src"))

	for (const sourceFile of program.getSourceFiles()) {
		if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("node_modules")) {
			continue
		}

		if (!normalizePath(sourceFile.fileName).startsWith(srcDir)) {
			continue
		}

		ts.forEachChild(sourceFile, (node) => {
			if (!ts.isTypeAliasDeclaration(node)) {
				return
			}

			const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

			if (!isExported) {
				return
			}

			// Check if the type node text matches z.infer<typeof X> (possibly multi-line)
			const typeText = node.type.getText(sourceFile).replace(/\s+/g, " ").trim()
			const match = typeText.match(/^z\.infer<\s*typeof\s+(\w+)\s*>$/)

			if (!match) {
				return
			}

			const schemaName = match[1]!

			// Resolve the type via the checker
			const symbol = checker.getSymbolAtLocation(node.name)

			if (!symbol) {
				return
			}

			const type = checker.getDeclaredTypeOfSymbol(symbol)
			const resolvedType = checker.typeToString(
				type,
				undefined,
				ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType,
			)

			// Skip if the checker couldn't resolve it
			if (resolvedType === node.name.text || resolvedType === "any") {
				console.warn(`  ⚠ Could not resolve type for ${node.name.text} (schema: ${schemaName})`)
				return
			}

			entries.push({ schemaName, resolvedType })
		})
	}

	return entries
}

// ---------------------------------------------------------------------------
// 3. Apply replacements to declaration files
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyReplacements(entries: ReplacementEntry[]): { file: string; count: number }[] {
	const results: { file: string; count: number }[] = []

	for (const dtsFile of DTS_FILES) {
		const filePath = path.join(DIST, dtsFile)

		if (!fs.existsSync(filePath)) {
			console.warn(`  ⚠ ${dtsFile} not found, skipping`)
			continue
		}

		let content = fs.readFileSync(filePath, "utf-8")
		let totalReplacements = 0

		for (const { schemaName, resolvedType } of entries) {
			const pattern = new RegExp(`z\\.infer<typeof\\s+${escapeRegex(schemaName)}>`, "g")
			const matches = content.match(pattern)

			if (matches) {
				content = content.replace(pattern, resolvedType)
				totalReplacements += matches.length
			}
		}

		if (totalReplacements > 0) {
			fs.writeFileSync(filePath, content, "utf-8")
			console.log(`  ✅ ${dtsFile}: replaced ${totalReplacements} z.infer expressions`)
		} else {
			console.log(`  ℹ ${dtsFile}: no z.infer expressions found`)
		}

		results.push({ file: dtsFile, count: totalReplacements })
	}

	return results
}

// ---------------------------------------------------------------------------
// 4. Verify no remaining z.infer<typeof ...> expressions
// ---------------------------------------------------------------------------

function verifyNoZInfer(): boolean {
	let clean = true

	for (const dtsFile of DTS_FILES) {
		const filePath = path.join(DIST, dtsFile)

		if (!fs.existsSync(filePath)) {
			continue
		}

		const content = fs.readFileSync(filePath, "utf-8")
		const remaining = content.match(/z\.infer<typeof\s+\w+>/g)

		if (remaining && remaining.length > 0) {
			console.error(`  ❌ ${dtsFile} still contains ${remaining.length} z.infer<typeof ...> expressions:`)

			for (const expr of remaining.slice(0, 10)) {
				console.error(`     - ${expr}`)
			}

			clean = false
		}
	}

	return clean
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------

function main(): void {
	console.log("resolve-dts: Resolving z.infer expressions in declaration files...")

	const program = createProgram()
	const entries = buildReplacementMap(program)

	console.log(`  Found ${entries.length} z.infer type aliases to resolve`)

	if (entries.length === 0) {
		console.log("  No z.infer type aliases found in source.")
	} else {
		applyReplacements(entries)
	}

	const clean = verifyNoZInfer()

	if (!clean) {
		console.error("resolve-dts: Some z.infer expressions could not be resolved!")
		process.exit(1)
	}

	console.log("resolve-dts: Done ✅")
}

main()

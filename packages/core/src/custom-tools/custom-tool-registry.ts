/**
 * CustomToolRegistry - A reusable class for dynamically loading and managing TypeScript tools.
 *
 * Features:
 * - Dynamic TypeScript/JavaScript tool loading with esbuild transpilation.
 * - Runtime validation of tool definitions.
 * - Tool execution with context.
 * - JSON Schema generation for LLM integration.
 */

import fs from "fs"
import path from "path"
import { createHash } from "crypto"
import os from "os"

import { build } from "esbuild"

import type {
	CustomToolDefinition,
	SerializedCustomToolDefinition,
	CustomToolParametersSchema,
	CustomToolContext,
} from "@roo-code/types"

import { serializeCustomTool } from "./serialize.js"

/**
 * Default subdirectory name for custom tools within a .roo directory.
 * Tools placed in `{rooDir}/tools/` will be automatically discovered and loaded.
 *
 * @example
 * ```ts
 * // Typical usage with getRooDirectoriesForCwd from roo-config:
 * for (const rooDir of getRooDirectoriesForCwd(cwd)) {
 *   await registry.loadFromDirectory(path.join(rooDir, TOOLS_DIR_NAME))
 * }
 * ```
 */
export const TOOLS_DIR_NAME = "tools"

export interface LoadResult {
	loaded: string[]
	failed: Array<{ file: string; error: string }>
}

export interface RegistryOptions {
	/** Directory for caching compiled TypeScript files. */
	cacheDir?: string
	/** Additional paths for resolving node modules (useful for tools outside node_modules). */
	nodePaths?: string[]
}

export class CustomToolRegistry {
	private tools = new Map<string, CustomToolDefinition>()
	private tsCache = new Map<string, string>()
	private cacheDir: string
	private nodePaths: string[]
	private lastLoaded: Map<string, number> = new Map()

	constructor(options?: RegistryOptions) {
		this.cacheDir = options?.cacheDir ?? path.join(os.tmpdir(), "dynamic-tools-cache")
		// Default to current working directory's node_modules.
		this.nodePaths = options?.nodePaths ?? [path.join(process.cwd(), "node_modules")]
	}

	/**
	 * Load all tools from a directory.
	 * Supports both .ts and .js files.
	 *
	 * @param toolDir - Absolute path to the tools directory
	 * @returns LoadResult with lists of loaded and failed tools
	 *
	 * @example
	 * ```ts
	 * // Load tools from multiple .roo directories (global and project):
	 * import { getRooDirectoriesForCwd } from "../services/roo-config"
	 * import { CustomToolRegistry, TOOLS_DIR_NAME } from "@roo-code/core"
	 *
	 * const registry = new CustomToolRegistry()
	 * for (const rooDir of getRooDirectoriesForCwd(cwd)) {
	 *   await registry.loadFromDirectory(path.join(rooDir, TOOLS_DIR_NAME))
	 * }
	 * ```
	 */
	async loadFromDirectory(toolDir: string): Promise<LoadResult> {
		const result: LoadResult = { loaded: [], failed: [] }

		try {
			if (!fs.existsSync(toolDir)) {
				return result
			}

			const files = fs.readdirSync(toolDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"))

			for (const file of files) {
				const filePath = path.join(toolDir, file)

				try {
					console.log(`[CustomToolRegistry] importing tool from ${filePath}`)
					const mod = await this.importTypeScript(filePath)

					for (const [exportName, value] of Object.entries(mod)) {
						const def = this.validateToolDefinition(exportName, value)

						if (!def) {
							continue
						}

						this.tools.set(def.name, def)
						console.log(`[CustomToolRegistry] loaded tool ${def.name} from ${filePath}`)
						result.loaded.push(def.name)
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					console.error(`[CustomToolRegistry] importTypeScript(${filePath}) failed: ${message}`)
					result.failed.push({ file, error: message })
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(`[CustomToolRegistry] loadFromDirectory(${toolDir}) failed: ${message}`)
		}

		return result
	}

	async loadFromDirectoryIfStale(toolDir: string): Promise<LoadResult> {
		// Return empty result if directory doesn't exist
		if (!fs.existsSync(toolDir)) {
			return { loaded: [], failed: [] }
		}

		const lastLoaded = this.lastLoaded.get(toolDir)
		const stat = fs.statSync(toolDir)
		const isStale = lastLoaded ? stat.mtimeMs > lastLoaded : true

		if (isStale) {
			this.lastLoaded.set(toolDir, stat.mtimeMs)
			return this.loadFromDirectory(toolDir)
		}

		return { loaded: this.list(), failed: [] }
	}

	/**
	 * Register a tool directly (without loading from file).
	 */
	register(definition: CustomToolDefinition): void {
		const { name: id } = definition
		const validated = this.validateToolDefinition(id, definition)

		if (!validated) {
			throw new Error(`Invalid tool definition for '${id}'`)
		}

		this.tools.set(id, validated)
	}

	/**
	 * Unregister a tool by ID.
	 */
	unregister(id: string): boolean {
		return this.tools.delete(id)
	}

	/**
	 * Get a tool by ID.
	 */
	get(id: string): CustomToolDefinition | undefined {
		return this.tools.get(id)
	}

	/**
	 * Check if a tool exists.
	 */
	has(id: string): boolean {
		return this.tools.has(id)
	}

	/**
	 * Get all registered tool IDs.
	 */
	list(): string[] {
		return Array.from(this.tools.keys())
	}

	/**
	 * Get all registered tools.
	 */
	getAll(): CustomToolDefinition[] {
		return Array.from(this.tools.values())
	}

	getAllSerialized(): SerializedCustomToolDefinition[] {
		return this.getAll().map(serializeCustomTool)
	}

	/**
	 * Get the number of registered tools.
	 */
	get size(): number {
		return this.tools.size
	}

	/**
	 * Execute a tool with given arguments.
	 */
	async execute(toolId: string, args: unknown, context: CustomToolContext): Promise<string> {
		const tool = this.tools.get(toolId)

		if (!tool) {
			throw new Error(`Tool not found: ${toolId}`)
		}

		// Validate args against schema if available.
		if (tool.parameters && "parse" in tool.parameters) {
			;(tool.parameters as { parse: (args: unknown) => void }).parse(args)
		}

		return tool.execute(args, context)
	}

	/**
	 * Clear all registered tools.
	 */
	clear(): void {
		this.tools.clear()
	}

	/**
	 * Clear the TypeScript compilation cache (both in-memory and on disk).
	 */
	clearCache(): void {
		this.tsCache.clear()

		// Also remove compiled files from disk
		if (fs.existsSync(this.cacheDir)) {
			try {
				const files = fs.readdirSync(this.cacheDir)
				for (const file of files) {
					if (file.endsWith(".mjs")) {
						fs.unlinkSync(path.join(this.cacheDir, file))
					}
				}
			} catch (error) {
				// Silently ignore cleanup errors
				console.error(`[CustomToolRegistry] clearCache failed to clean disk cache: ${error}`)
			}
		}
	}

	/**
	 * Dynamically import a TypeScript or JavaScript file.
	 * TypeScript files are transpiled on-the-fly using esbuild.
	 */
	private async importTypeScript(filePath: string): Promise<Record<string, CustomToolDefinition>> {
		const absolutePath = path.resolve(filePath)
		const ext = path.extname(absolutePath)

		if (ext === ".js" || ext === ".mjs") {
			return import(`file://${absolutePath}`)
		}

		const stat = fs.statSync(absolutePath)
		const cacheKey = `${absolutePath}:${stat.mtimeMs}`

		// Check if we have a cached version.
		if (this.tsCache.has(cacheKey)) {
			const cachedPath = this.tsCache.get(cacheKey)!
			return import(`file://${cachedPath}`)
		}

		// Ensure cache directory exists.
		fs.mkdirSync(this.cacheDir, { recursive: true })

		const hash = createHash("sha256").update(cacheKey).digest("hex").slice(0, 16)
		const tempFile = path.join(this.cacheDir, `${hash}.mjs`)

		// Bundle the TypeScript file with dependencies.
		await build({
			entryPoints: [absolutePath],
			bundle: true,
			format: "esm",
			platform: "node",
			target: "node18",
			outfile: tempFile,
			sourcemap: "inline",
			packages: "bundle",
			// Include node_modules paths for module resolution.
			nodePaths: this.nodePaths,
		})

		this.tsCache.set(cacheKey, tempFile)
		return import(`file://${tempFile}`)
	}

	/**
	 * Check if a value is a Zod schema by looking for the _def property
	 * which is present on all Zod types.
	 */
	private isParametersSchema(value: unknown): value is CustomToolParametersSchema {
		return (
			value !== null &&
			typeof value === "object" &&
			"_def" in value &&
			typeof (value as Record<string, unknown>)._def === "object"
		)
	}

	/**
	 * Validate a tool definition and return a typed result.
	 * Returns null for non-tool exports, throws for invalid tools.
	 */
	private validateToolDefinition(exportName: string, value: unknown): CustomToolDefinition | null {
		// Quick pre-check to filter out non-objects.
		if (!value || typeof value !== "object") {
			return null
		}

		// Check if it looks like a tool (has execute function).
		if (!("execute" in value) || typeof (value as Record<string, unknown>).execute !== "function") {
			return null
		}

		const obj = value as Record<string, unknown>
		const errors: string[] = []

		// Validate name.
		if (typeof obj.name !== "string") {
			errors.push("name: Expected string")
		} else if (obj.name.length === 0) {
			errors.push("name: Tool must have a non-empty name")
		}

		// Validate description.
		if (typeof obj.description !== "string") {
			errors.push("description: Expected string")
		} else if (obj.description.length === 0) {
			errors.push("description: Tool must have a non-empty description")
		}

		// Validate parameters (optional).
		if (obj.parameters !== undefined && !this.isParametersSchema(obj.parameters)) {
			errors.push("parameters: parameters must be a Zod schema")
		}

		if (errors.length > 0) {
			throw new Error(`Invalid tool definition for '${exportName}': ${errors.join(", ")}`)
		}

		return value as CustomToolDefinition
	}
}

export const customToolRegistry = new CustomToolRegistry()

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

import type { CustomToolDefinition, SerializedCustomToolDefinition, CustomToolParametersSchema } from "@roo-code/types"

import type { StoredCustomTool, LoadResult } from "./types.js"
import { serializeCustomTool } from "./serialize.js"
import { runEsbuild } from "./esbuild-runner.js"

export interface RegistryOptions {
	/** Directory for caching compiled TypeScript files. */
	cacheDir?: string
	/** Additional paths for resolving node modules (useful for tools outside node_modules). */
	nodePaths?: string[]
	/** Path to the extension root directory (for finding bundled esbuild binary in production). */
	extensionPath?: string
}

export class CustomToolRegistry {
	private tools = new Map<string, StoredCustomTool>()
	private tsCache = new Map<string, string>()
	private cacheDir: string
	private nodePaths: string[]
	private extensionPath?: string
	private lastLoaded: Map<string, number> = new Map()

	constructor(options?: RegistryOptions) {
		this.cacheDir = options?.cacheDir ?? path.join(os.tmpdir(), "dynamic-tools-cache")
		// Default to current working directory's node_modules.
		this.nodePaths = options?.nodePaths ?? [path.join(process.cwd(), "node_modules")]
		this.extensionPath = options?.extensionPath
	}

	/**
	 * Load all tools from a directory.
	 * Supports both .ts and .js files.
	 *
	 * @param toolDir - Absolute path to the tools directory
	 * @returns LoadResult with lists of loaded and failed tools
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
					const mod = await this.import(filePath)

					for (const [exportName, value] of Object.entries(mod)) {
						const def = this.validate(exportName, value)

						if (!def) {
							continue
						}

						this.tools.set(def.name, { ...def, source: filePath })
						console.log(`[CustomToolRegistry] loaded tool ${def.name} from ${filePath}`)
						result.loaded.push(def.name)
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					console.error(`[CustomToolRegistry] import(${filePath}) failed: ${message}`)
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
	 * Load all tools from multiple directories.
	 * Directories are processed in order, so later directories can override tools from earlier ones.
	 * Supports both .ts and .js files.
	 *
	 * @param toolDirs - Array of absolute paths to tools directories
	 * @returns LoadResult with lists of loaded and failed tools from all directories
	 */
	async loadFromDirectories(toolDirs: string[]): Promise<LoadResult> {
		const result: LoadResult = { loaded: [], failed: [] }

		for (const toolDir of toolDirs) {
			const dirResult = await this.loadFromDirectory(toolDir)
			result.loaded.push(...dirResult.loaded)
			result.failed.push(...dirResult.failed)
		}

		return result
	}

	/**
	 * Load all tools from multiple directories if any has become stale.
	 * Directories are processed in order, so later directories can override tools from earlier ones.
	 *
	 * @param toolDirs - Array of absolute paths to tools directories
	 * @returns LoadResult with lists of loaded and failed tools
	 */
	async loadFromDirectoriesIfStale(toolDirs: string[]): Promise<LoadResult> {
		const result: LoadResult = { loaded: [], failed: [] }

		for (const toolDir of toolDirs) {
			const dirResult = await this.loadFromDirectoryIfStale(toolDir)
			result.loaded.push(...dirResult.loaded)
			result.failed.push(...dirResult.failed)
		}

		return result
	}

	/**
	 * Register a tool directly (without loading from file).
	 */
	register(definition: CustomToolDefinition, source?: string): void {
		const { name: id } = definition
		const validated = this.validate(id, definition)

		if (!validated) {
			throw new Error(`Invalid tool definition for '${id}'`)
		}

		const storedTool: StoredCustomTool = source ? { ...validated, source } : validated
		this.tools.set(id, storedTool)
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

	/**
	 * Get all registered tools in the serialized format.
	 */
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
	 * Clear all registered tools.
	 */
	clear(): void {
		this.tools.clear()
	}

	/**
	 * Set the extension path for finding bundled esbuild binary.
	 * This should be called with context.extensionPath when the extension activates.
	 */
	setExtensionPath(extensionPath: string): void {
		this.extensionPath = extensionPath
	}

	/**
	 * Get the current extension path.
	 */
	getExtensionPath(): string | undefined {
		return this.extensionPath
	}

	/**
	 * Clear the TypeScript compilation cache (both in-memory and on disk).
	 */
	clearCache(): void {
		this.tsCache.clear()

		if (fs.existsSync(this.cacheDir)) {
			try {
				const files = fs.readdirSync(this.cacheDir)
				for (const file of files) {
					if (file.endsWith(".mjs")) {
						fs.unlinkSync(path.join(this.cacheDir, file))
					}
				}
			} catch (error) {
				console.error(
					`[CustomToolRegistry] clearCache failed to clean disk cache: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	/**
	 * Dynamically import a TypeScript or JavaScript file.
	 * TypeScript files are transpiled on-the-fly using esbuild.
	 */
	private async import(filePath: string): Promise<Record<string, CustomToolDefinition>> {
		const absolutePath = path.resolve(filePath)
		const ext = path.extname(absolutePath)

		if (ext === ".js" || ext === ".mjs") {
			return import(`file://${absolutePath}`)
		}

		const stat = fs.statSync(absolutePath)
		const cacheKey = `${absolutePath}:${stat.mtimeMs}`

		// Check if we have a cached version in memory.
		if (this.tsCache.has(cacheKey)) {
			const cachedPath = this.tsCache.get(cacheKey)!
			return import(`file://${cachedPath}`)
		}

		// Ensure cache directory exists.
		fs.mkdirSync(this.cacheDir, { recursive: true })

		const hash = createHash("sha256").update(cacheKey).digest("hex").slice(0, 16)
		const tempFile = path.join(this.cacheDir, `${hash}.mjs`)

		// Check if we have a cached version on disk (from a previous run/instance).
		if (fs.existsSync(tempFile)) {
			this.tsCache.set(cacheKey, tempFile)
			return import(`file://${tempFile}`)
		}

		// Bundle the TypeScript file with dependencies using esbuild CLI.
		await runEsbuild(
			{
				entryPoint: absolutePath,
				outfile: tempFile,
				format: "esm",
				platform: "node",
				target: "node18",
				bundle: true,
				sourcemap: "inline",
				packages: "bundle",
				nodePaths: this.nodePaths,
			},
			this.extensionPath,
		)

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
	private validate(exportName: string, value: unknown): CustomToolDefinition | null {
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

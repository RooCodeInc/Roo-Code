import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { glob } from "glob"
import crypto from "crypto"

import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { formatResponse } from "../prompts/responses"

export interface FileContext {
	path: string
	content?: string
	hash?: string
	lastModified?: number
	size?: number
	isDirectory: boolean
}

export interface RepositoryContext {
	files: Map<string, FileContext>
	lastUpdated: number
	projectStructure: string
	relevantFiles: string[]
	codePatterns: Map<string, string[]> // pattern -> file paths
}

export interface RepositoryContextConfig {
	enabled: boolean
	maxFileSize: number // in bytes
	maxFiles: number
	includeFileContent: boolean
	excludePatterns: string[]
	updateInterval: number // in milliseconds
	smartSelection: boolean // intelligently select relevant files
}

const DEFAULT_CONFIG: RepositoryContextConfig = {
	enabled: false,
	maxFileSize: 100 * 1024, // 100KB
	maxFiles: 500,
	includeFileContent: false,
	excludePatterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.log", "*.lock"],
	updateInterval: 60000, // 1 minute
	smartSelection: true,
}

export class RepositoryContextManager {
	private context: RepositoryContext | null = null
	private config: RepositoryContextConfig
	private cwd: string
	private rooIgnoreController?: RooIgnoreController
	private updateTimer?: NodeJS.Timeout
	private fileWatcher?: vscode.FileSystemWatcher
	private isUpdating: boolean = false

	constructor(cwd: string, config: Partial<RepositoryContextConfig> = {}, rooIgnoreController?: RooIgnoreController) {
		this.cwd = cwd
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.rooIgnoreController = rooIgnoreController
	}

	/**
	 * Initialize the repository context manager
	 */
	async initialize(): Promise<void> {
		if (!this.config.enabled) {
			return
		}

		// Initial context build
		await this.updateContext()

		// Set up file watcher for automatic updates
		this.setupFileWatcher()

		// Set up periodic updates
		if (this.config.updateInterval > 0) {
			this.updateTimer = setInterval(() => {
				this.updateContext().catch(console.error)
			}, this.config.updateInterval)
		}
	}

	/**
	 * Get the current repository context
	 */
	getContext(): RepositoryContext | null {
		return this.context
	}

	/**
	 * Update the repository context
	 */
	async updateContext(): Promise<void> {
		if (this.isUpdating) {
			return // Prevent concurrent updates
		}

		this.isUpdating = true
		try {
			const files = new Map<string, FileContext>()
			const codePatterns = new Map<string, string[]>()

			// Get all files in the repository
			const allFiles = await this.getAllFiles()

			// Filter files based on configuration
			const filteredFiles = await this.filterFiles(allFiles)

			// Process each file
			for (const filePath of filteredFiles) {
				const fileContext = await this.processFile(filePath)
				if (fileContext) {
					files.set(filePath, fileContext)

					// Extract code patterns if content is available
					if (fileContext.content && this.config.smartSelection) {
						this.extractCodePatterns(filePath, fileContext.content, codePatterns)
					}
				}
			}

			// Generate project structure
			const projectStructure = this.generateProjectStructure(files)

			// Identify relevant files based on patterns and usage
			const relevantFiles = this.identifyRelevantFiles(files, codePatterns)

			this.context = {
				files,
				lastUpdated: Date.now(),
				projectStructure,
				relevantFiles,
				codePatterns,
			}
		} finally {
			this.isUpdating = false
		}
	}

	/**
	 * Get all files in the repository
	 */
	private async getAllFiles(): Promise<string[]> {
		const pattern = "**/*"
		const options = {
			cwd: this.cwd,
			ignore: this.config.excludePatterns,
			nodir: false,
			dot: true,
		}

		try {
			const files = await glob(pattern, options)
			return files.map((f) => path.relative(this.cwd, path.join(this.cwd, f)))
		} catch (error) {
			console.error("Error getting files:", error)
			return []
		}
	}

	/**
	 * Filter files based on configuration and .rooignore
	 */
	private async filterFiles(files: string[]): Promise<string[]> {
		let filtered = files

		// Apply .rooignore if available
		if (this.rooIgnoreController) {
			// filterPaths returns an array of allowed paths
			filtered = this.rooIgnoreController.filterPaths(files)
		}

		// Apply max files limit
		if (filtered.length > this.config.maxFiles) {
			// Prioritize source code files
			const prioritized = this.prioritizeFiles(filtered)
			filtered = prioritized.slice(0, this.config.maxFiles)
		}

		return filtered
	}

	/**
	 * Process a single file to create FileContext
	 */
	private async processFile(filePath: string): Promise<FileContext | null> {
		const fullPath = path.join(this.cwd, filePath)

		try {
			const stats = await fs.stat(fullPath)
			const fileContext: FileContext = {
				path: filePath,
				isDirectory: stats.isDirectory(),
				lastModified: stats.mtimeMs,
				size: stats.size,
			}

			// Include file content if configured and file is not too large
			if (this.config.includeFileContent && !stats.isDirectory() && stats.size <= this.config.maxFileSize) {
				try {
					const content = await fs.readFile(fullPath, "utf-8")
					fileContext.content = content
					fileContext.hash = this.hashContent(content)
				} catch (error) {
					// File might be binary or unreadable
					console.debug(`Could not read file ${filePath}:`, error)
				}
			}

			return fileContext
		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error)
			return null
		}
	}

	/**
	 * Generate a hash for file content
	 */
	private hashContent(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex").substring(0, 8)
	}

	/**
	 * Extract code patterns from file content
	 */
	private extractCodePatterns(filePath: string, content: string, patterns: Map<string, string[]>): void {
		// Extract imports/requires
		// Handle both ES6 imports (import X from 'Y') and CommonJS (require('Y'))
		const importPattern =
			/(?:import\s+(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g
		let match
		while ((match = importPattern.exec(content)) !== null) {
			const moduleName = match[1] || match[2]
			const pattern = `import:${moduleName}`
			if (!patterns.has(pattern)) {
				patterns.set(pattern, [])
			}
			patterns.get(pattern)!.push(filePath)
		}

		// Extract function/class definitions
		const definitionPattern = /(?:function|class|interface|type|const|let|var)\s+([A-Z][A-Za-z0-9_]*)/g
		while ((match = definitionPattern.exec(content)) !== null) {
			const pattern = `definition:${match[1]}`
			if (!patterns.has(pattern)) {
				patterns.set(pattern, [])
			}
			patterns.get(pattern)!.push(filePath)
		}

		// Extract API endpoints
		const apiPattern = /(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi
		while ((match = apiPattern.exec(content)) !== null) {
			const pattern = `api:${match[1]}`
			if (!patterns.has(pattern)) {
				patterns.set(pattern, [])
			}
			patterns.get(pattern)!.push(filePath)
		}
	}

	/**
	 * Generate project structure representation
	 */
	private generateProjectStructure(files: Map<string, FileContext>): string {
		const tree: any = {}

		// Build tree structure
		for (const [filePath, context] of files) {
			const parts = filePath.split(path.sep)
			let current = tree

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i]
				if (i === parts.length - 1) {
					// Leaf node
					current[part] = context.isDirectory ? {} : null
				} else {
					// Directory node
					if (!current[part]) {
						current[part] = {}
					}
					current = current[part]
				}
			}
		}

		// Convert tree to string representation
		return this.treeToString(tree)
	}

	/**
	 * Convert tree structure to string
	 */
	private treeToString(tree: any, prefix: string = "", isLast: boolean = true): string {
		let result = ""
		const entries = Object.entries(tree)

		entries.forEach(([name, value], index) => {
			const isLastEntry = index === entries.length - 1
			const connector = isLastEntry ? "└── " : "├── "
			const extension = isLastEntry ? "    " : "│   "

			result += prefix + connector + name

			if (value === null) {
				// File
				result += "\n"
			} else if (typeof value === "object" && Object.keys(value).length > 0) {
				// Directory with contents
				result += "/\n"
				result += this.treeToString(value, prefix + extension, isLastEntry)
			} else {
				// Empty directory
				result += "/\n"
			}
		})

		return result
	}

	/**
	 * Prioritize files based on importance
	 */
	private prioritizeFiles(files: string[]): string[] {
		const priorities: { [key: string]: number } = {
			// Configuration files
			"package.json": 1,
			"tsconfig.json": 1,
			".env": 1,
			config: 2,

			// Source code
			".ts": 3,
			".tsx": 3,
			".js": 3,
			".jsx": 3,
			".py": 3,
			".java": 3,
			".go": 3,
			".rs": 3,

			// Documentation
			".md": 4,
			README: 2,

			// Tests
			".spec": 5,
			".test": 5,

			// Assets and others
			".css": 6,
			".scss": 6,
			".html": 6,
			".json": 7,
			".yaml": 7,
			".yml": 7,
		}

		return files.sort((a, b) => {
			const getPriority = (file: string): number => {
				for (const [pattern, priority] of Object.entries(priorities)) {
					if (file.includes(pattern)) {
						return priority
					}
				}
				return 999
			}

			return getPriority(a) - getPriority(b)
		})
	}

	/**
	 * Identify the most relevant files for the current context
	 */
	private identifyRelevantFiles(files: Map<string, FileContext>, patterns: Map<string, string[]>): string[] {
		const relevance = new Map<string, number>()

		// Initialize relevance scores
		for (const filePath of files.keys()) {
			relevance.set(filePath, 0)
		}

		// Boost relevance for files with many connections
		for (const [pattern, filePaths] of patterns) {
			for (const filePath of filePaths) {
				relevance.set(filePath, (relevance.get(filePath) || 0) + 1)
			}
		}

		// Boost relevance for recently modified files
		const now = Date.now()
		for (const [filePath, context] of files) {
			if (context.lastModified) {
				const age = now - context.lastModified
				const dayInMs = 24 * 60 * 60 * 1000
				if (age < dayInMs) {
					relevance.set(filePath, (relevance.get(filePath) || 0) + 10)
				} else if (age < 7 * dayInMs) {
					relevance.set(filePath, (relevance.get(filePath) || 0) + 5)
				}
			}
		}

		// Sort by relevance and return top files
		const sorted = Array.from(relevance.entries()).sort((a, b) => b[1] - a[1])

		return sorted.slice(0, 100).map(([filePath]) => filePath)
	}

	/**
	 * Set up file system watcher for automatic updates
	 */
	private setupFileWatcher(): void {
		const pattern = new vscode.RelativePattern(this.cwd, "**/*")
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern)

		// Debounce updates to avoid too frequent refreshes
		let updateTimeout: NodeJS.Timeout | undefined

		const scheduleUpdate = () => {
			if (updateTimeout) {
				clearTimeout(updateTimeout)
			}
			updateTimeout = setTimeout(() => {
				this.updateContext().catch(console.error)
			}, 1000) // Wait 1 second after last change
		}

		this.fileWatcher.onDidCreate(scheduleUpdate)
		this.fileWatcher.onDidChange(scheduleUpdate)
		this.fileWatcher.onDidDelete(scheduleUpdate)
	}

	/**
	 * Format context for inclusion in environment details
	 */
	formatForEnvironment(): string {
		if (!this.context) {
			return ""
		}

		let details = "\n\n# Repository Context"
		details += `\nLast Updated: ${new Date(this.context.lastUpdated).toISOString()}`
		details += `\nTotal Files: ${this.context.files.size}`

		if (this.context.projectStructure) {
			details += "\n\n## Project Structure\n```"
			details += "\n" + this.context.projectStructure
			details += "\n```"
		}

		if (this.context.relevantFiles.length > 0) {
			details += "\n\n## Most Relevant Files"
			for (const file of this.context.relevantFiles.slice(0, 20)) {
				const fileContext = this.context.files.get(file)
				if (fileContext) {
					details += `\n- ${file}`
					if (fileContext.hash) {
						details += ` (hash: ${fileContext.hash})`
					}
				}
			}
		}

		if (this.config.includeFileContent && this.context.relevantFiles.length > 0) {
			details += "\n\n## File Contents (Top Relevant)"
			let contentCount = 0
			for (const file of this.context.relevantFiles) {
				if (contentCount >= 5) break // Limit to 5 files
				const fileContext = this.context.files.get(file)
				if (fileContext?.content) {
					details += `\n\n### ${file}\n\`\`\`\n${fileContext.content.slice(0, 500)}`
					if (fileContext.content.length > 500) {
						details += "\n... (truncated)"
					}
					details += "\n```"
					contentCount++
				}
			}
		}

		return details
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		if (this.updateTimer) {
			clearInterval(this.updateTimer)
			this.updateTimer = undefined
		}

		if (this.fileWatcher) {
			this.fileWatcher.dispose()
			this.fileWatcher = undefined
		}

		this.context = null
	}
}

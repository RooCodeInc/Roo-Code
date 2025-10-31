import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit } from "simple-git"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../../services/search/file-search"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected readonly log: (message: string) => void
	protected shadowGitConfigWorktree?: string

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	public getCheckpoints(): string[] {
		return this._checkpoints.slice()
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		const homedir = os.homedir()
		const desktopPath = path.join(homedir, "Desktop")
		const documentsPath = path.join(homedir, "Documents")
		const downloadsPath = path.join(homedir, "Downloads")
		const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir

		this.dotGitDir = path.join(this.checkpointsDir, ".git")
		this.log = log
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = simpleGit(this.checkpointsDir)
		const gitVersion = await git.version()
		this.log(`[${this.constructor.name}#create] git = ${gitVersion}`)

		let created = false
		const startTime = Date.now()

		if (await fileExistsAtPath(this.dotGitDir)) {
			this.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
			const worktree = await this.getShadowGitConfigWorktree(git)

			if (worktree !== this.workspaceDir) {
				throw new Error(
					`Checkpoints can only be used in the original workspace: ${worktree} !== ${this.workspaceDir}`,
				)
			}

			await this.writeExcludeFile()
			this.baseHash = await git.revparse(["HEAD"])
		} else {
			this.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`)
			await git.init()
			await git.addConfig("core.worktree", this.workspaceDir) // Sets the working tree to the current workspace.
			await git.addConfig("commit.gpgSign", "false") // Disable commit signing for shadow repo.
			await git.addConfig("user.name", "Roo Code")
			await git.addConfig("user.email", "noreply@example.com")
			await this.writeExcludeFile()
			await this.stageAll(git)
			const { commit } = await git.commit("initial commit", { "--allow-empty": null })
			this.baseHash = commit
			created = true
		}

		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
		)

		this.git = git

		await onInit?.()

		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseHash,
			created,
			duration,
		})

		return { created, duration }
	}

	// Add basic excludes directly in git config, while respecting any
	// .gitignore in the workspace.
	// .git/info/exclude is local to the shadow git repo, so it's not
	// shared with the main repo - and won't conflict with user's
	// .gitignore.
	protected async writeExcludeFile() {
		await fs.mkdir(path.join(this.dotGitDir, "info"), { recursive: true })
		const patterns = await getExcludePatterns(this.workspaceDir)
		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	private async stageAll(git: SimpleGit) {
		try {
			// Find all nested repos to exclude
			const nestedRepos = await this.findNestedRepos(git)

			if (nestedRepos.length > 0) {
				this.log(
					`[${this.constructor.name}#stageAll] excluding ${nestedRepos.length} nested repos: ${nestedRepos.join(", ")}`,
				)
			}

			// Remove any existing gitlinks from the index before staging
			for (const repoPath of nestedRepos) {
				try {
					await git.raw(["rm", "--cached", "--ignore-unmatch", "-r", repoPath])
				} catch (error) {
					this.log(
						`[${this.constructor.name}#stageAll] failed to remove cached gitlink ${repoPath}: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}

			// Build add command with pathspec excludes
			const addArgs: string[] = ["-A", ":/"]
			for (const repoPath of nestedRepos) {
				addArgs.push(`:(exclude)${repoPath}/`)
			}

			// Stage files
			await git.add(addArgs)

			// Enhanced safety check: verify no mode 160000 entries in staging area
			const stagedFiles = await git.raw(["ls-files", "-s", "--cached"])
			const gitlinkEntries = stagedFiles
				.split("\n")
				.filter((line) => line.startsWith("160000"))
				.map((line) => line.split(/\s+/)[3])
				.filter(Boolean)

			if (gitlinkEntries.length > 0) {
				throw new Error(
					`Gitlink entries detected in staging area: ${gitlinkEntries.join(", ")} - this should not happen`,
				)
			}

			// Additional check for .gitmodules changes
			const diffSummary = await git.raw(["diff", "--cached", "--name-only"])
			if (diffSummary.includes(".gitmodules")) {
				this.log(`[${this.constructor.name}#stageAll] warning: .gitmodules changes detected in staging area`)
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`,
			)
			throw error
		}
	}

	private async findNestedRepos(git: SimpleGit): Promise<string[]> {
		const nestedRepos = new Set<string>()

		// 1. From .gitmodules (declared submodules)
		try {
			const config = await git.raw(["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"])
			for (const line of config.split("\n")) {
				const match = line.match(/submodule\..*\.path\s+(.+)/)
				if (match) nestedRepos.add(match[1])
			}
		} catch (error) {
			// No .gitmodules file is expected in most cases, only log if it's a real error
			if (error instanceof Error && !error.message.includes("exit code 1")) {
				this.log(
					`[${this.constructor.name}#findNestedRepos] warning: failed to read .gitmodules: ${error.message}`,
				)
			}
		}

		// 2. From index (gitlinks with mode 160000)
		try {
			const lsFiles = await git.raw(["ls-files", "-s"])
			for (const line of lsFiles.split("\n")) {
				if (line.startsWith("160000")) {
					const parts = line.split(/\s+/)
					if (parts[3]) nestedRepos.add(parts[3])
				}
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#findNestedRepos] warning: failed to list files from index: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// 3. From filesystem (any nested .git directory or worktree)
		try {
			const gitDirs = await executeRipgrep({
				args: ["--files", "--hidden", "--follow", "-g", "**/.git/HEAD", this.workspaceDir],
				workspacePath: this.workspaceDir,
			})

			for (const result of gitDirs) {
				if (result.type === "file") {
					const normalizedPath = result.path.replace(/\\/g, "/")
					if (
						normalizedPath.includes(".git/HEAD") &&
						!normalizedPath.startsWith(".git/") &&
						normalizedPath !== ".git/HEAD"
					) {
						// Extract repo directory (remove .git/HEAD)
						const gitDir = path.dirname(result.path)
						const repoDir = path.dirname(gitDir)
						nestedRepos.add(repoDir)
					}
				}
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#findNestedRepos] failed to search filesystem: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// 4. From filesystem (git worktrees - .git files pointing to worktree)
		try {
			const gitFiles = await executeRipgrep({
				args: ["--files", "--hidden", "--follow", "-g", "**/.git", this.workspaceDir],
				workspacePath: this.workspaceDir,
			})

			for (const result of gitFiles) {
				if (result.type === "file") {
					const normalizedPath = result.path.replace(/\\/g, "/")
					// Check if this is a .git file (not directory) and not the root
					if (normalizedPath.endsWith("/.git") && normalizedPath !== ".git") {
						try {
							// Read the .git file to check if it's a worktree
							const gitFilePath = path.join(this.workspaceDir, result.path)
							const content = await fs.readFile(gitFilePath, "utf8")
							if (content.trim().startsWith("gitdir:")) {
								// This is a worktree - exclude its directory
								const repoDir = path.dirname(result.path)
								nestedRepos.add(repoDir)
							}
						} catch (error) {
							this.log(
								`[${this.constructor.name}#findNestedRepos] warning: failed to read .git file at ${result.path}: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}
				}
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#findNestedRepos] failed to search for worktrees: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		return Array.from(nestedRepos).filter((p) => p && p !== ".")
	}

	private async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined
			} catch (error) {
				this.log(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	public async saveCheckpoint(
		message: string,
		options?: { allowEmpty?: boolean; suppressMessage?: boolean },
	): Promise<CheckpointResult | undefined> {
		try {
			this.log(
				`[${this.constructor.name}#saveCheckpoint] starting checkpoint save (allowEmpty: ${options?.allowEmpty ?? false})`,
			)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const startTime = Date.now()
			await this.stageAll(this.git)
			const commitArgs = options?.allowEmpty ? { "--allow-empty": null } : undefined
			const result = await this.git.commit(message, commitArgs)
			const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash!
			const toHash = result.commit || fromHash
			this._checkpoints.push(toHash)
			const duration = Date.now() - startTime

			if (result.commit) {
				this.emit("checkpoint", {
					type: "checkpoint",
					fromHash,
					toHash,
					duration,
					suppressMessage: options?.suppressMessage ?? false,
				})
			}

			if (result.commit) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)
				return result
			} else {
				this.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`)
				return undefined
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		try {
			this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const start = Date.now()
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])

			// Remove all checkpoints after the specified commitHash.
			const checkpointIndex = this._checkpoints.indexOf(commitHash)

			if (checkpointIndex !== -1) {
				this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1)
			}

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash, duration })
			this.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const result = []

		if (!from) {
			from = (await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim()
		}

		// Stage all changes so that untracked files appear in diff summary.
		await this.stageAll(this.git)

		this.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`)
		const { files } = to ? await this.git.diffSummary([`${from}..${to}`]) : await this.git.diffSummary([from])

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""

		for (const file of files) {
			const relPath = file.file
			const absPath = path.join(cwdPath, relPath)
			const before = await this.git.show([`${from}:${relPath}`]).catch(() => "")

			const after = to
				? await this.git.show([`${to}:${relPath}`]).catch(() => "")
				: await fs.readFile(absPath, "utf8").catch(() => "")

			result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
		}

		return result
	}

	/**
	 * EventEmitter
	 */

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	/**
	 * Storage
	 */

	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	protected static taskRepoDir({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		return path.join(globalStorageDir, "tasks", taskId, "checkpoints")
	}

	protected static workspaceRepoDir({
		globalStorageDir,
		workspaceDir,
	}: {
		globalStorageDir: string
		workspaceDir: string
	}) {
		return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir))
	}

	public static async deleteTask({
		taskId,
		globalStorageDir,
		workspaceDir,
	}: {
		taskId: string
		globalStorageDir: string
		workspaceDir: string
	}) {
		const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir })
		const branchName = `roo-${taskId}`
		const git = simpleGit(workspaceRepoDir)
		const success = await this.deleteBranch(git, branchName)

		if (success) {
			console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`)
			return false
		}

		const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

		if (currentBranch === branchName) {
			const worktree = await git.getConfig("core.worktree")

			try {
				await git.raw(["config", "--unset", "core.worktree"])
				await git.reset(["--hard"])
				await git.clean("f", ["-d"])
				const defaultBranch = branches.all.includes("main") ? "main" : "master"
				await git.checkout([defaultBranch, "--force"])

				await pWaitFor(
					async () => {
						const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
						return newBranch === defaultBranch
					},
					{ interval: 500, timeout: 2_000 },
				)

				await git.branch(["-D", branchName])
				return true
			} catch (error) {
				console.error(
					`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			return true
		}
	}
}

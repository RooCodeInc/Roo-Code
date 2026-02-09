import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../../services/search/file-search"
import { t } from "../../i18n"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"

/**
 * Creates a SimpleGit instance with sanitized environment variables to prevent
 * interference from inherited git environment variables like GIT_DIR and GIT_WORK_TREE.
 * This ensures checkpoint operations always target the intended shadow repository.
 *
 * @param baseDir - The directory where git operations should be executed
 * @returns A SimpleGit instance with sanitized environment
 */
function createSanitizedGit(baseDir: string): SimpleGit {
	// Create a clean environment by explicitly unsetting git-related environment variables
	// that could interfere with checkpoint operations
	const sanitizedEnv: Record<string, string> = {}
	const removedVars: string[] = []

	// Copy all environment variables except git-specific ones
	for (const [key, value] of Object.entries(process.env)) {
		// Skip git environment variables that would override repository location
		if (
			key === "GIT_DIR" ||
			key === "GIT_WORK_TREE" ||
			key === "GIT_INDEX_FILE" ||
			key === "GIT_OBJECT_DIRECTORY" ||
			key === "GIT_ALTERNATE_OBJECT_DIRECTORIES" ||
			key === "GIT_CEILING_DIRECTORIES"
		) {
			removedVars.push(`${key}=${value}`)
			continue
		}

		// Only include defined values
		if (value !== undefined) {
			sanitizedEnv[key] = value
		}
	}

	// Log which git env vars were removed (helps with debugging Dev Container issues)
	if (removedVars.length > 0) {
		console.log(
			`[createSanitizedGit] Removed git environment variables for checkpoint isolation: ${removedVars.join(", ")}`,
		)
	}

	const options: Partial<SimpleGitOptions> = {
		baseDir,
		config: [],
	}

	// Create git instance and set the sanitized environment
	const git = simpleGit(options)

	// Use the .env() method to set the complete sanitized environment
	// This replaces the inherited environment with our sanitized version
	git.env(sanitizedEnv)

	console.log(`[createSanitizedGit] Created git instance for baseDir: ${baseDir}`)

	return git
}

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string
	protected nestedRepoPaths: string[] = []
	protected nestedRepoDetectionFailed = false

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

		// Detect nested git repos once at init. Stored as workspace-relative POSIX
		// paths (e.g. "frontend", "packages/foo") for use in exclude patterns and
		// pathspec excludes. Detection is intentionally not repeated on every save
		// because ripgrep scans are expensive in large workspaces; instead, stageAll()
		// enforces safety post-staging by scanning for gitlink entries.
		this.nestedRepoPaths = await this.findNestedGitRepositories()

		if (this.nestedRepoPaths.length > 0) {
			const sortedPaths = [...this.nestedRepoPaths].sort()
			this.log(
				`[${this.constructor.name}#initShadowGit] found ${sortedPaths.length} nested git repositories, excluding from checkpoints: ${sortedPaths.join(", ")}`,
			)
			const maxDisplayPaths = 5
			const shown = sortedPaths.slice(0, maxDisplayPaths)
			const remaining = sortedPaths.length - shown.length
			const displayPaths =
				remaining > 0
					? `${shown.join(", ")}, \u2026 (${remaining} more)`
					: shown.join(", ")
			const message = t("common:errors.nested_git_repos_excluded", {
				count: String(sortedPaths.length),
				paths: displayPaths,
			})
			vscode.window.showWarningMessage(message)
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = createSanitizedGit(this.checkpointsDir)
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

		// Add anchored exclude patterns for nested git repos so the shadow git
		// ignores them entirely. Leading "/" anchors the pattern to the worktree
		// root, preventing accidental matches at other directory depths.
		for (const repoRel of this.nestedRepoPaths) {
			patterns.push(`/${repoRel}/`)
		}

		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	private isIgnoredPathsAddError(error: unknown): boolean {
		const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
		return msg.includes("paths are ignored by one of your .gitignore files")
	}

	private async stageAll(git: SimpleGit) {
		const addArgs: string[] = ["--ignore-errors", "--", "."]

		// Add top-anchored pathspec excludes for each known nested repo.
		for (const repoRel of this.nestedRepoPaths) {
			addArgs.push(`:(exclude,top)${repoRel}/`)
		}

		try {
			await git.add(addArgs)
		} catch (error) {
			if (!this.isIgnoredPathsAddError(error)) {
				// Real failure (index corruption, disk full, lock file, etc.)
				// must abort — proceeding would produce a bad checkpoint.
				throw error
			}

			this.log(
				`[${this.constructor.name}#stageAll] git add ignored-paths warning (expected): ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// Safety enforcement runs outside the git-add catch so their
		// throws propagate to saveCheckpoint() and abort the save.

		// Post-staging safety layer 1: scan for gitlink entries (mode 160000)
		// that indicate a nested repo slipped through despite the exclude file
		// and pathspec. This catches repos added after init without requiring
		// expensive re-detection on every save.
		await this.purgeGitlinkEntries(git)

		// Post-staging safety layer 2: when detection failed, walk parent
		// directories of staged paths on the filesystem to find .git
		// markers that reveal nested repos. This catches the case where
		// nested repo source files were staged as regular files (the
		// shadow repo's .git/ exclude hides the marker from git, so no
		// gitlink is created and purgeGitlinkEntries cannot help). Gated
		// on nestedRepoDetectionFailed to avoid filesystem walks on the
		// normal path where the exclude file and pathspec are trustworthy.
		if (this.nestedRepoDetectionFailed) {
			await this.rejectStagedNestedRepoContent(git)
		}
	}

	private async purgeGitlinkEntries(git: SimpleGit) {
		const lsOutput = await git.raw(["ls-files", "--stage"])
		const gitlinkPaths: string[] = []

		for (const line of lsOutput.split("\n")) {
			if (line.startsWith("160000 ")) {
				// Format: "160000 <hash> <stage>\t<path>"
				const tabIndex = line.indexOf("\t")
				if (tabIndex !== -1) {
					gitlinkPaths.push(line.substring(tabIndex + 1))
				}
			}
		}

		if (gitlinkPaths.length === 0) {
			return
		}

		this.log(
			`[${this.constructor.name}#purgeGitlinkEntries] removing ${gitlinkPaths.length} gitlink entries: ${gitlinkPaths.join(", ")}`,
		)

		for (const gitlinkPath of gitlinkPaths) {
			await git.raw(["rm", "--cached", "--ignore-unmatch", "-r", "--", gitlinkPath])
		}

		// Triggered re-detection: a gitlink that was not in our known list
		// means a nested repo appeared after init. Update the exclude set so
		// subsequent saves are protected by the exclude file too.
		const newPaths = gitlinkPaths.filter(
			(p) => !this.nestedRepoPaths.includes(p),
		)

		if (newPaths.length > 0) {
			this.log(
				`[${this.constructor.name}#purgeGitlinkEntries] discovered ${newPaths.length} new nested repos, updating excludes: ${newPaths.join(", ")}`,
			)
			this.nestedRepoPaths = Array.from(new Set([...this.nestedRepoPaths, ...newPaths]))
			await this.writeExcludeFile()
		}

		// Verify all gitlinks are gone. If any persist, staging is unsafe and
		// the checkpoint save must be aborted.
		const verifyOutput = await git.raw(["ls-files", "--stage"])
		const remaining = verifyOutput.split("\n").filter((l) => l.startsWith("160000 "))
		if (remaining.length > 0) {
			throw new Error(
				`Staging is unsafe: ${remaining.length} gitlink entries persist after purge. ` +
					"Aborting checkpoint save.",
			)
		}
	}

	/**
	 * Conservative fallback for when ripgrep-based detection failed. Walks
	 * parent directories of staged paths on the filesystem to discover `.git`
	 * markers (`.git/HEAD` for real repos, `.git` pointer files for
	 * submodules/worktrees). Unstages any nested repo roots found and updates
	 * the exclude list for subsequent saves. Throws if staged paths under a
	 * nested repo root persist after removal.
	 *
	 * Only called when `nestedRepoDetectionFailed` is true, so the filesystem
	 * walk cost is acceptable — it is the rare error-recovery path.
	 */
	private async rejectStagedNestedRepoContent(git: SimpleGit) {
		const rawOutput = await git.raw(["diff", "--cached", "--name-only", "-z"])
		const stagedPaths = rawOutput.split("\0").filter(Boolean)

		if (stagedPaths.length === 0) {
			return
		}

		// Walk unique ancestor directories of staged paths, checking for
		// .git markers on the filesystem. The checkedDirs cache ensures each
		// directory is stat'd at most once regardless of how many staged
		// files share it.
		const checkedDirs = new Set<string>()
		const nestedRepoRoots = new Set<string>()

		for (const filePath of stagedPaths) {
			// Staged paths from git are POSIX-style; use path.posix to
			// avoid platform-dependent separator drift on Windows.
			let dir = path.posix.dirname(filePath)

			while (dir && dir !== "." && dir !== "") {
				if (checkedDirs.has(dir)) {
					dir = path.posix.dirname(dir)
					continue // skip stat calls but keep walking up — an earlier
					// traversal may have found a deeper repo and broken out
					// before checking this directory's ancestors
				}

				checkedDirs.add(dir)

				// Check for .git directory (real nested repo).
				// path.join is used here to build filesystem paths for stat calls.
				const gitHeadPath = path.join(this.workspaceDir, dir, ".git", "HEAD")
				if (await fileExistsAtPath(gitHeadPath)) {
					nestedRepoRoots.add(dir)
					break
				}

				// Check for .git pointer file (submodule / worktree).
				const gitFilePath = path.join(this.workspaceDir, dir, ".git")
				try {
					const stat = await fs.stat(gitFilePath)
					if (stat.isFile()) {
						const content = await fs.readFile(gitFilePath, "utf8")
						if (content.trimStart().startsWith("gitdir:")) {
							nestedRepoRoots.add(dir)
							break
						}
					}
				} catch {
					// Not a .git pointer file — continue walking up.
				}

				dir = path.posix.dirname(dir)
			}
		}

		if (nestedRepoRoots.size === 0) {
			return
		}

		const roots = Array.from(nestedRepoRoots)

		this.log(
			`[${this.constructor.name}#rejectStagedNestedRepoContent] detection fallback found ${roots.length} nested repos via filesystem: ${roots.join(", ")}`,
		)

		// Unstage nested repo contents.
		for (const root of roots) {
			await git.raw(["rm", "--cached", "--ignore-unmatch", "-r", "--", root + "/"])
		}

		// Update exclude list so subsequent saves are protected.
		this.nestedRepoPaths = Array.from(new Set([...this.nestedRepoPaths, ...roots]))
		await this.writeExcludeFile()

		// Verify no staged paths remain under nested repo roots.
		const verifyRaw = await git.raw(["diff", "--cached", "--name-only", "-z"])
		const verifyPaths = verifyRaw.split("\0").filter(Boolean)
		const leaked = verifyPaths.filter((p) => {
			const pNorm = p.replace(/\\/g, "/")
			return roots.some((r) => pNorm === r || pNorm.startsWith(r + "/"))
		})

		if (leaked.length > 0) {
			throw new Error(
				`Staging is unsafe: ${leaked.length} paths from nested repos persist after removal. ` +
					"Aborting checkpoint save.",
			)
		}
	}

	/**
	 * Finds all nested git repositories inside the workspace.
	 *
	 * Returns workspace-relative POSIX paths (e.g. ["frontend", "packages/foo"])
	 * suitable for use in gitignore patterns and pathspec excludes. Detection
	 * covers both real `.git/` directories and `.git` pointer files used by
	 * submodules and worktrees. The `--follow` flag is intentionally omitted to
	 * avoid symlink false positives.
	 *
	 * On success, sets `nestedRepoDetectionFailed` to false. On error, sets it
	 * to true and returns an empty array. When detection has failed, downstream
	 * safety is enforced by `rejectStagedNestedRepoContent()` in `stageAll()`.
	 */
	private async findNestedGitRepositories(): Promise<string[]> {
		try {
			// Search 1: real nested .git directories via their HEAD file.
			const headArgs = ["--files", "--hidden", "-g", "**/.git/HEAD", this.workspaceDir]
			const headResults = await executeRipgrep({ args: headArgs, workspacePath: this.workspaceDir })

			// Search 2: .git pointer files (submodules / worktrees).
			const pointerArgs = ["--files", "--hidden", "-g", "**/.git", this.workspaceDir]
			const pointerResults = await executeRipgrep({ args: pointerArgs, workspacePath: this.workspaceDir })

			const repoPaths = new Set<string>()

			// Process .git/HEAD results — each gives us a nested .git directory.
			for (const { type, path: filePath } of headResults) {
				if (type !== "file") {
					continue
				}

				// Skip the workspace root's own .git/HEAD.
				const normalized = filePath.replace(/\\/g, "/")
				if (normalized === ".git/HEAD") {
					continue
				}

				// Verify structure: basename must be HEAD, parent must be .git.
				if (path.basename(filePath) !== "HEAD" || path.basename(path.dirname(filePath)) !== ".git") {
					continue
				}

				// .git/HEAD → .git → repo directory
				const repoDir = path.dirname(path.dirname(filePath))
				const repoRel = repoDir.replace(/\\/g, "/")

				// Skip if resolved to workspace root or outside workspace.
				if (repoRel === "." || repoRel === "" || repoRel.startsWith("..")) {
					continue
				}

				repoPaths.add(repoRel)
			}

			// Process .git pointer file results — submodules store a file
			// containing "gitdir: <path>" instead of a directory.
			for (const { type, path: filePath } of pointerResults) {
				if (type !== "file") {
					continue
				}

				// Skip the workspace root's own .git.
				const normalized = filePath.replace(/\\/g, "/")
				if (normalized === ".git") {
					continue
				}

				// Only consider entries where the basename is exactly ".git".
				if (path.basename(filePath) !== ".git") {
					continue
				}

				// Validate that this is a pointer file (contains "gitdir:").
				const absPath = path.join(this.workspaceDir, filePath)
				try {
					const content = await fs.readFile(absPath, "utf8")
					if (!content.trimStart().startsWith("gitdir:")) {
						continue
					}
				} catch {
					// Can't read the file — skip it.
					continue
				}

				const repoDir = path.dirname(filePath)
				const repoRel = repoDir.replace(/\\/g, "/")

				if (repoRel === "." || repoRel === "" || repoRel.startsWith("..")) {
					continue
				}

				repoPaths.add(repoRel)
			}

			const result = Array.from(repoPaths)

			this.log(
				`[${this.constructor.name}#findNestedGitRepositories] found ${result.length} nested git repositories: ${result.join(", ") || "(none)"}`,
			)

			this.nestedRepoDetectionFailed = false
			return result
		} catch (error) {
			this.log(
				`[${this.constructor.name}#findNestedGitRepositories] detection failed: ${error instanceof Error ? error.message : String(error)}`,
			)

			// Fail-soft: detection failure is not fatal to init, but staging
			// will run the conservative filesystem-based scan via
			// rejectStagedNestedRepoContent() to prevent unsafe checkpoints.
			this.nestedRepoDetectionFailed = true
			return []
		}
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
		const git = createSanitizedGit(workspaceRepoDir)
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

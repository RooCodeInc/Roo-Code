/**
utils/gitUtils.ts
─────────────────────────────────────────────────────────────
Lightweight git helpers for the hook system.
All functions are non-throwing — they return null on failure.
─────────────────────────────────────────────────────────────
*/
import { execSync } from "child_process"
import * as path from "path"

/**
Get the current HEAD commit SHA.
Returns null if not in a git repo or git is not installed.
*/
export function getCurrentGitSha(workspacePath: string): string | null {
	try {
		return execSync("git rev-parse HEAD", {
			cwd: workspacePath,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 3000,
		})
			.toString()
			.trim()
	} catch {
		return null
	}
}

/**
Get the SHA of a specific file at HEAD.
Useful for optimistic locking — get the "known good" hash.
*/
export function getFileGitSha(workspacePath: string, relativeFilePath: string): string | null {
	try {
		return execSync(`git hash-object "${relativeFilePath}"`, {
			cwd: workspacePath,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 3000,
		})
			.toString()
			.trim()
	} catch {
		return null
	}
}

/**
Check if a file has uncommitted changes.
*/
export function hasUncommittedChanges(workspacePath: string, relativeFilePath: string): boolean {
	try {
		const result = execSync(`git status --porcelain "${relativeFilePath}"`, {
			cwd: workspacePath,
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 3000,
		})
			.toString()
			.trim()
		return result.length > 0
	} catch {
		return false
	}
}

/**
Get the path of a file relative to the workspace root.
*/
export function toRelativePath(workspacePath: string, absoluteFilePath: string): string {
	return path.relative(workspacePath, absoluteFilePath).replace(/\\/g, "/")
}

/**
utils/gitUtils.ts
─────────────────────────────────────────────────────────────
Lightweight git helpers for the hook system.
─────────────────────────────────────────────────────────────
*/
import { execSync } from "child_process";
import * as path from "path";

export function getCurrentGitSha(workspacePath: string): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: workspacePath,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function getFileGitSha(
  workspacePath: string,
  relativeFilePath: string
): string | null {
  try {
    return execSync(`git hash-object "${relativeFilePath}"`, {
      cwd: workspacePath,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function hasUncommittedChanges(
  workspacePath: string,
  relativeFilePath: string
): boolean {
  try {
    const result = execSync(`git status --porcelain "${relativeFilePath}"`, {
      cwd: workspacePath,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    })
      .toString()
      .trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

export function toRelativePath(
  workspacePath: string,
  absoluteFilePath: string
): string {
  return path.relative(workspacePath, absoluteFilePath).replace(/\\/g, "/"); // ✅ FIXED
}

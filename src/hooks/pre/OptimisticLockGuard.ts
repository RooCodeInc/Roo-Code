/**
 * pre/OptimisticLockGuard.ts
 * ─────────────────────────────────────────────────────────────
 * PRE-HOOK #4 — Optimistic Locking (Parallel Agent Safety)
 *
 * Prevents parallel agents from overwriting each other's work.
 *
 * How it works:
 *   When an agent reads a file, it stores its SHA-256 hash as
 *   "read_hash" in the tool params. Before writing, this hook
 *   compares that hash to the CURRENT file on disk.
 *
 *   If they differ → a parallel agent (or human) modified the
 *   file → BLOCK the write and force re-read.
 *
 * This hook also captures the pre-write file content so the
 * post-hook mutation classifier can compare old vs new.
 *
 * Note: read_hash is optional. If not provided, the write
 * proceeds but we still capture old content for classification.
 * ─────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ToolContext, BlockSignal } from '../HookEngine';

const WRITE_TOOLS = new Set([
  'write_file',
  'write_to_file',
  'create_file',
  'apply_diff',
  'insert_code_block',
  'replace_in_file',
]);

export async function optimisticLockGuard(ctx: ToolContext): Promise<ToolContext | BlockSignal> {
  if (!WRITE_TOOLS.has(ctx.toolName)) return ctx;

  const targetPath = ctx.params['path'] as string ?? ctx.params['file_path'] as string;
  if (!targetPath) return ctx;

  const absolutePath = path.resolve(ctx.workspacePath, targetPath);

  // If file doesn't exist yet, this is a new file creation — no conflict possible
  if (!fs.existsSync(absolutePath)) return ctx;

  const currentContent = fs.readFileSync(absolutePath, 'utf8');
  const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

  // Capture old content for mutation classifier (post-hook)
  ctx.__oldContent__ = currentContent;

  // If agent provided a read_hash, verify it matches current state
  const agentReadHash = ctx.params['read_hash'] as string | undefined;
  if (agentReadHash) {
    // Normalize — agent may include "sha256:" prefix
    const normalizedAgentHash = agentReadHash.replace(/^sha256:/, '');

    if (normalizedAgentHash !== currentHash) {
      return new BlockSignal(
        `BLOCKED [STALE_FILE]: "${targetPath}" has been modified by another agent or process ` +
        `since you last read it.\n\n` +
        `Your read hash:    sha256:${normalizedAgentHash}\n` +
        `Current file hash: sha256:${currentHash}\n\n` +
        `You MUST re-read the file with read_file("${targetPath}") before attempting to write. ` +
        `Incorporate any changes made by the other agent before proceeding.`,
        'STALE_FILE'
      );
    }
  }

  return ctx;
}

/**
 * Utility: compute SHA-256 hash of file content.
 * Agents can call this (via a tool) to get a read_hash before editing.
 */
export function computeFileHash(absolutePath: string): string | null {
  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}
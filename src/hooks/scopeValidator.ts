import { HookContext, ToolEvent } from './hookEngine';
import * as path from 'path';
import * as fs from 'fs';

/**
 * scopeValidator
 * - Validates that a file operation is within allowed directories
 * - Checks agent-assigned scope from context
 */
export function scopeValidator(event: ToolEvent, context: HookContext): boolean {
  const { filePath } = event.payload || {};
  if (!filePath) return false;

  // Get absolute path of the target file
  const absolutePath = path.resolve(context.workspaceRoot, filePath);

  // Allowed paths for the current agent
  const allowedPaths = context.allowedPaths || [];

  // Validate: file must be under one of the allowed paths
  const isAllowed = allowedPaths.some((allowed: string) =>
    absolutePath.startsWith(path.resolve(context.workspaceRoot, allowed))
  );

  if (!isAllowed) {
    context.addFeedback(`Scope violation: Agent attempted to modify ${filePath}`);
    return false; // block execution
  }

  return true; // allowed
}

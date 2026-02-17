import { HookContext, ToolEvent } from './hookEngine';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * concurrencyGuard
 * - Checks if the target file or code block has changed since the agent started its task
 * - Uses content hashing to detect collisions
 */
export function concurrencyGuard(event: ToolEvent, context: HookContext): boolean {
  const { filePath, originalHash } = event.payload || {};
  if (!filePath || !originalHash) return false;

  try {
    const currentContent = fs.readFileSync(filePath, 'utf-8');

    // Compute hash of current content
    const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');

    if (currentHash !== originalHash) {
      context.addFeedback(
        `Collision detected: ${filePath} has been modified since task started.`
      );
      return false; // block execution to prevent overwriting
    }

    return true; // safe to proceed
  } catch (err) {
    context.addFeedback(`Error checking concurrency for ${filePath}: ${err.message}`);
    return false;
  }
}

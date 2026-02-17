import { HookContext, ToolEvent } from './hookEngine';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * PostToolUse hook
 * - Automatically runs formatters, linters, or security checks
 * - Feeds errors back into agent context for self-correction
 */
export async function postToolUse(event: ToolEvent, context: HookContext): Promise<void> {
  const { filePath } = event.payload || {};

  if (!filePath) return;

  try {
    // 1. Run Prettier to format code
    await execAsync(`npx prettier --write "${filePath}"`);

    // 2. Run ESLint for linting
    const { stdout, stderr } = await execAsync(`npx eslint "${filePath}" --fix`);
    if (stderr) {
      // Feed linting errors back into agent context for autonomous correction
      context.addFeedback(`ESLint issues in ${filePath}: ${stderr}`);
    } else if (stdout) {
      context.addFeedback(`ESLint applied fixes to ${filePath}: ${stdout}`);
    }

    // 3. Optional: run security checks
    // await execAsync(`npx security-checker "${filePath}"`);

  } catch (error: any) {
    // Capture any errors and add to agent context
    context.addFeedback(`PostToolUse error for ${filePath}: ${error.message}`);
  }
}

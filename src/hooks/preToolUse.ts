import { HookContext, ToolEvent } from './hookEngine';

export type PreToolUseResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * PreToolUse hook
 * Validates tool commands before execution.
 * - Classifies commands as Safe or Destructive
 * - Blocks unsafe commands
 */
export async function preToolUse(event: ToolEvent, context: HookContext): Promise<PreToolUseResult> {
  const { type, payload } = event;

  // Example: classify destructive commands
  const destructiveCommands = ['rm -rf', 'git push --force', 'sudo', 'mv /', 'del /F /Q'];
  const commandStr = payload?.command?.toString() || '';

  const isDestructive = destructiveCommands.some((cmd) => commandStr.includes(cmd));

  if (isDestructive) {
    return {
      allowed: false,
      reason: `Command blocked by PreToolUse: "${commandStr}" classified as destructive`,
    };
  }

  // Optional: allow only whitelisted safe commands
  const safeCommands = ['read_file', 'write_file', 'ls', 'echo', 'mkdir'];
  if (!safeCommands.includes(type) && !type.startsWith('customTool')) {
    return {
      allowed: false,
      reason: `Command "${type}" not recognized as safe`,
    };
  }

  // Passed all checks
  return { allowed: true };
}

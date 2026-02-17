import * as vscode from 'vscode';
import { HookContext, ToolEvent } from './hookEngine';

/**
 * approvalGuard
 * - Pauses execution for destructive commands
 * - Prompts the user to Approve or Reject
 */
export async function approvalGuard(event: ToolEvent, context: HookContext): Promise<boolean> {
  const { commandType, payload } = event;

  // Only prompt for destructive commands
  if (commandType !== 'destructive') return true;

  const message = `The agent is attempting a destructive operation: ${payload?.command || 'unknown'}.\nDo you approve?`;

  const approve = 'Approve';
  const reject = 'Reject';

  const selection = await vscode.window.showWarningMessage(message, { modal: true }, approve, reject);

  if (selection === approve) {
    context.addFeedback(`User approved command: ${payload?.command}`);
    return true; // proceed
  } else {
    context.addFeedback(`User rejected command: ${payload?.command}`);
    return false; // block execution
  }
}

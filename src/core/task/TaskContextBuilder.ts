import { type TaskContext, type TaskPermissions, mergePermissions } from "@roo-code/types"

import { defaultModeSlug } from "../../shared/modes"
import type { ClineProvider } from "../webview/ClineProvider"

/**
 * Build a TaskContext from the current provider state.
 *
 * This factory snapshots the provider's current mode and API config
 * into an immutable TaskContext that a child task can carry independently.
 * This is the key enabler for Phase 3a: tasks no longer need to reach
 * back into the provider for their mode/config during execution.
 *
 * @param provider - The ClineProvider to snapshot state from
 * @param overrides - Optional overrides (e.g., mode from new_task tool)
 * @returns A TaskContext snapshot
 */
export async function buildTaskContext(
	provider: ClineProvider,
	overrides?: Partial<TaskContext>,
): Promise<TaskContext> {
	const state = await provider.getState()

	const context: TaskContext = {
		mode: overrides?.mode ?? state?.mode ?? defaultModeSlug,
		apiConfigName: overrides?.apiConfigName ?? state?.currentApiConfigName ?? "default",
		permissions: overrides?.permissions,
		inheritSkills: overrides?.inheritSkills ?? true,
		skillOverrides: overrides?.skillOverrides,
		workspacePath: overrides?.workspacePath,
		parentTaskId: overrides?.parentTaskId,
		rootTaskId: overrides?.rootTaskId,
	}

	return context
}

/**
 * Build a TaskContext for a child task, inheriting from a parent context
 * and applying any child-specific overrides.
 *
 * Permission merging follows the "most restrictive" principle:
 * the child's effective permissions are the intersection of the parent's
 * permissions and any child-specific permissions.
 *
 * @param parentContext - The parent task's context
 * @param childOverrides - Child-specific overrides
 * @returns A new TaskContext for the child task
 */
export function buildChildTaskContext(parentContext: TaskContext, childOverrides: Partial<TaskContext>): TaskContext {
	const mergedPermissions = mergePermissions(parentContext.permissions, childOverrides.permissions)

	return {
		mode: childOverrides.mode ?? parentContext.mode,
		apiConfigName: childOverrides.apiConfigName ?? parentContext.apiConfigName,
		permissions: mergedPermissions,
		inheritSkills: childOverrides.inheritSkills ?? parentContext.inheritSkills,
		skillOverrides: childOverrides.skillOverrides ?? parentContext.skillOverrides,
		workspacePath: childOverrides.workspacePath ?? parentContext.workspacePath,
		parentTaskId: childOverrides.parentTaskId,
		rootTaskId: childOverrides.rootTaskId ?? parentContext.rootTaskId,
	}
}

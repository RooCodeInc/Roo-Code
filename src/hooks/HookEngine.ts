import { Task } from "../core/task/Task"
import { OrchestrationStore } from "../orchestration/OrchestrationStore"

interface HookEngineOptions {
	task: Task
}

export class HookEngine {
	private readonly store: OrchestrationStore

	constructor({ task }: HookEngineOptions) {
		this.store = new OrchestrationStore({ workspaceRoot: task.cwd })
	}

	/** Called before any tool execution */
	preToolHook() {
		this.store.ensureInitialized()
	}

	/** Called after any tool execution */
	postToolHook() {}

	/** */
	preLLMHook() {}
}

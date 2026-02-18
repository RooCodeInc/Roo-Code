import type * as vscode from "vscode"
import {
	type HookCallback,
	type HookContext,
	type HookLifecycleStage,
	type HookEventType,
	type HookOptions,
	type HookRegistration,
	type HookUnregister,
	HookPriority,
} from "./types"

const PRIORITY_ORDER: Record<HookPriority, number> = {
	[HookPriority.Low]: 0,
	[HookPriority.Normal]: 1,
	[HookPriority.High]: 2,
	[HookPriority.Critical]: 3,
}

export class HookManager {
	private static instance: HookManager | null = null
	private hooks: Map<string, HookRegistration> = new Map()
	private lifecycleHooks: Map<HookLifecycleStage, HookRegistration[]> = new Map()
	private eventHooks: Map<HookEventType, HookRegistration[]> = new Map()
	private context: HookContext | null = null
	private hookIdCounter = 0

	private constructor() {
		for (const stage of Object.values(HookLifecycleStage)) {
			this.lifecycleHooks.set(stage, [])
		}
		for (const event of Object.values(HookEventType)) {
			this.eventHooks.set(event, [])
		}
	}

	static getInstance(): HookManager {
		if (!HookManager.instance) {
			HookManager.instance = new HookManager()
		}
		return HookManager.instance
	}

	initialize(context: HookContext): void {
		this.context = context
	}

	registerLifecycleHook(
		stage: HookLifecycleStage,
		callback: HookCallback,
		options: HookOptions = {},
	): HookUnregister {
		const id = options.name || `hook-${++this.hookIdCounter}`
		const registration: HookRegistration = {
			id,
			stage,
			callback,
			options: { priority: HookPriority.Normal, ...options },
		}

		this.hooks.set(id, registration)
		const stageHooks = this.lifecycleHooks.get(stage) || []
		stageHooks.push(registration)
		stageHooks.sort((a, b) => {
			const priorityA = PRIORITY_ORDER[a.options.priority || HookPriority.Normal]
			const priorityB = PRIORITY_ORDER[b.options.priority || HookPriority.Normal]
			return priorityB - priorityA
		})
		this.lifecycleHooks.set(stage, stageHooks)

		return () => this.unregister(id)
	}

	registerEventHook(event: HookEventType, callback: HookCallback, options: HookOptions = {}): HookUnregister {
		const id = options.name || `hook-${++this.hookIdCounter}`
		const registration: HookRegistration = {
			id,
			event,
			callback,
			options: { priority: HookPriority.Normal, ...options },
		}

		this.hooks.set(id, registration)
		const eventHooks = this.eventHooks.get(event) || []
		eventHooks.push(registration)
		eventHooks.sort((a, b) => {
			const priorityA = PRIORITY_ORDER[a.options.priority || HookPriority.Normal]
			const priorityB = PRIORITY_ORDER[b.options.priority || HookPriority.Normal]
			return priorityB - priorityA
		})
		this.eventHooks.set(event, eventHooks)

		return () => this.unregister(id)
	}

	async executeLifecycleHook(stage: HookLifecycleStage, data?: unknown): Promise<void> {
		if (!this.context) {
			throw new Error("HookManager not initialized. Call initialize() first.")
		}

		const hooks = this.lifecycleHooks.get(stage) || []
		for (const hook of hooks) {
			try {
				await hook.callback(this.context, data)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.context.outputChannel.appendLine(
					`[HookManager] Error executing lifecycle hook "${hook.id}" at stage "${stage}": ${errorMessage}`,
				)
			}
		}
	}

	async executeEventHook(event: HookEventType, data?: unknown): Promise<void> {
		if (!this.context) {
			throw new Error("HookManager not initialized. Call initialize() first.")
		}

		const hooks = this.eventHooks.get(event) || []
		for (const hook of hooks) {
			try {
				await hook.callback(this.context, data)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.context.outputChannel.appendLine(
					`[HookManager] Error executing event hook "${hook.id}" for event "${event}": ${errorMessage}`,
				)
			}
		}
	}

	unregister(id: string): boolean {
		const registration = this.hooks.get(id)
		if (!registration) {
			return false
		}

		this.hooks.delete(id)

		if (registration.stage) {
			const stageHooks = this.lifecycleHooks.get(registration.stage) || []
			const index = stageHooks.findIndex((h) => h.id === id)
			if (index !== -1) {
				stageHooks.splice(index, 1)
			}
		}

		if (registration.event) {
			const eventHooks = this.eventHooks.get(registration.event) || []
			const index = eventHooks.findIndex((h) => h.id === id)
			if (index !== -1) {
				eventHooks.splice(index, 1)
			}
		}

		return true
	}

	getRegisteredHooks(): HookRegistration[] {
		return Array.from(this.hooks.values())
	}

	clear(): void {
		this.hooks.clear()
		for (const stage of Object.values(HookLifecycleStage)) {
			this.lifecycleHooks.set(stage, [])
		}
		for (const event of Object.values(HookEventType)) {
			this.eventHooks.set(event, [])
		}
	}
}

/**
 * Minimal Laminar tracing integration for Roo Code.
 *
 * This service is a safe, no-op wrapper when disabled or missing configuration.
 * It can later be wired to @lmnr-ai/lmnr SDK without breaking callers.
 */

type Attributes = Record<string, any>

type InternalSpan = {
	id: string
	name: string
	startTime: number
	endTime?: number
	attributes: Attributes
	error?: { message: string; stack?: string; type?: string }
	children: InternalSpan[]
	parentId?: string
}

export class LaminarService {
	private static _instance: LaminarService | undefined
	public static get instance(): LaminarService {
		if (!this._instance) this._instance = new LaminarService()
		return this._instance
	}

	private enabled = false
	private projectKey?: string
	private userId?: string
	private machineId?: string
	private sessionId?: string

	// Simple in-memory span store and active stack
	private spans = new Map<string, InternalSpan>()
	private activeStack: string[] = []

	// Optional real SDK client (loaded dynamically when available)
	private sdk: any | undefined

	/**
	 * Initialize tracing service. Safe to call multiple times.
	 */
	public async initialize(
		config: {
			apiKey?: string
			userId?: string
			machineId?: string
			sessionId?: string
			enabled?: boolean
		} = {},
	): Promise<void> {
		try {
			const { apiKey, userId, machineId, sessionId, enabled } = config
			this.projectKey = apiKey
			this.userId = userId
			this.machineId = machineId
			this.sessionId = sessionId

			// Enable only if explicitly enabled and apiKey is present
			this.enabled = Boolean(enabled && apiKey)

			// Try to dynamically load the SDK if enabled
			if (this.enabled) {
				try {
					const mod = await import("@lmnr-ai/lmnr")
					this.sdk = mod
					// Potential real SDK init could go here in the future
					// await this.sdk?.init?.({ apiKey })
					this.debug("[Laminar] Initialized")
				} catch (e) {
					// If SDK not available, remain in no-op mode but keep enabled to collect local spans
					this.sdk = undefined
					this.debug(`[Laminar] SDK not found; running in lightweight mode`)
				}
			} else {
				this.debug("[Laminar] Disabled (no apiKey or enabled flag false)")
			}
		} catch (e) {
			this.enabled = false
			this.debug(`[Laminar] initialize() failed: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	/**
	 * Start a span. Returns a spanId that must be passed to endSpan().
	 * Safe no-op when disabled; still returns an id for balanced calls.
	 */
	public startSpan(name: string, attributes: Attributes = {}): string {
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
		const parentId = this.activeStack[this.activeStack.length - 1]

		const span: InternalSpan = {
			id,
			name,
			startTime: Date.now(),
			attributes: {
				...attributes,
				"roo.sessionId": this.sessionId,
				"roo.userId": this.userId,
				"roo.machineId": this.machineId,
			},
			children: [],
			parentId,
		}

		if (parentId) {
			const parent = this.spans.get(parentId)
			if (parent) parent.children.push(span)
		}

		this.spans.set(id, span)
		this.activeStack.push(id)

		// If real SDK exists, this is where we'd call sdk.startSpan(name, attributes)
		return id
	}

	/**
	 * Add or overwrite attributes on a span.
	 */
	public addAttributesToSpan(spanId: string, attrs: Attributes): void {
		const span = this.spans.get(spanId)
		if (!span) return
		Object.assign(span.attributes, attrs)
		// Real SDK would add attributes here as well
	}

	/**
	 * Record an exception onto a span without ending it.
	 */
	public recordExceptionOnSpan(spanId: string, error: unknown): void {
		const span = this.spans.get(spanId)
		if (!span) return

		const err =
			error instanceof Error
				? { message: error.message, stack: error.stack, type: error.name }
				: { message: String(error) }

		span.error = err
		// Real SDK would record exception here
	}

	/**
	 * End a span and optionally attach final attributes (e.g., usage metrics).
	 */
	public endSpan(spanId: string, finalAttributes: Attributes = {}): void {
		const span = this.spans.get(spanId)
		if (!span) return

		span.endTime = Date.now()
		Object.assign(span.attributes, finalAttributes)

		// Pop from active stack if it is the current top
		if (this.activeStack[this.activeStack.length - 1] === spanId) {
			this.activeStack.pop()
		} else {
			// Remove from stack if found deeper (defensive)
			const idx = this.activeStack.indexOf(spanId)
			if (idx !== -1) this.activeStack.splice(idx, 1)
		}

		// Real SDK would end the span here
		this.debugSpan(span)
	}

	/**
	 * Helper to run a function within a span.
	 */
	public async withSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
		const id = this.startSpan(name, attributes)
		try {
			const result = await fn()
			return result
		} catch (e) {
			this.recordExceptionOnSpan(id, e)
			throw e
		} finally {
			this.endSpan(id)
		}
	}

	/**
	 * Decorator factory for class methods to auto-instrument them.
	 * Usage:
	 *   const observed = LaminarService.instance.observeDecorator('MyClass.method')
	 *   class MyClass {
	 *     @observed
	 *     commit() { ... }
	 *   }
	 */
	public observeDecorator(spanName: string, attributes?: Attributes) {
		return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
			const original = descriptor.value
			descriptor.value = async function (...args: any[]) {
				const id = LaminarService.instance.startSpan(spanName, attributes ?? {})
				try {
					const out = await original.apply(this, args)
					return out
				} catch (e) {
					LaminarService.instance.recordExceptionOnSpan(id, e)
					throw e
				} finally {
					LaminarService.instance.endSpan(id)
				}
			}
			return descriptor
		}
	}

	private debug(msg: string) {
		// Keep logs minimal to avoid noise
		try {
			console.log(msg)
		} catch {}
	}

	private debugSpan(span: InternalSpan) {
		// Lightweight end-span debug; avoid logging large attributes
		const durationMs = span.endTime! - span.startTime
		this.debug(
			`[Laminar] span '${span.name}' (${span.id})${span.parentId ? ` child of ${span.parentId}` : ""} duration=${durationMs}ms`,
		)
	}
}

// Export a singleton instance for convenience
export const laminar = LaminarService.instance

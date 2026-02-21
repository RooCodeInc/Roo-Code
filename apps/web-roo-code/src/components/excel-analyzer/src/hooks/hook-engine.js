/**
 * Hook Engine
 *
 * Lightweight hook system for registering and executing synchronous/asynchronous hooks
 * with priority and one-time execution support.
 */

class HookEngine {
    constructor() {
        this.hooks = new Map();
        this.sequence = 0;
    }

    /**
     * Register a hook handler.
     * @param {string} hookName
     * @param {Function} handler
     * @param {{ priority?: number, once?: boolean }} options
     * @returns {string} Hook id
     */
    tap(hookName, handler, options = {}) {
        if (!hookName || typeof hookName !== 'string') {
            throw new Error('hookName must be a non-empty string');
        }

        if (typeof handler !== 'function') {
            throw new Error('handler must be a function');
        }

        const priority = Number.isFinite(options.priority) ? options.priority : 0;
        const once = Boolean(options.once);
        const id = `${hookName}:${Date.now()}:${this.sequence++}`;

        const record = {
            id,
            hookName,
            handler,
            priority,
            once,
            order: this.sequence
        };

        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }

        const items = this.hooks.get(hookName);
        items.push(record);
        items.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.order - b.order;
        });

        return id;
    }

    /**
     * Register a one-time hook handler.
     */
    tapOnce(hookName, handler, options = {}) {
        return this.tap(hookName, handler, { ...options, once: true });
    }

    /**
     * Remove a specific hook by id.
     */
    untap(hookName, hookId) {
        const items = this.hooks.get(hookName);
        if (!items || !items.length) return false;

        const next = items.filter((entry) => entry.id !== hookId);
        this.hooks.set(hookName, next);
        return next.length !== items.length;
    }

    /**
     * Remove all handlers for a hook, or all hooks when no name provided.
     */
    clear(hookName = null) {
        if (!hookName) {
            this.hooks.clear();
            return;
        }
        this.hooks.delete(hookName);
    }

    /**
     * Check if a hook has handlers.
     */
    has(hookName) {
        const items = this.hooks.get(hookName);
        return Boolean(items && items.length);
    }

    /**
     * List registered handlers for a hook.
     */
    list(hookName) {
        return [...(this.hooks.get(hookName) || [])];
    }

    /**
     * Execute all handlers for a hook with a shared context object.
     * Returns collected results and errors.
     */
    async run(hookName, context = {}) {
        const handlers = [...(this.hooks.get(hookName) || [])];
        const results = [];
        const errors = [];

        for (const entry of handlers) {
            try {
                const value = await entry.handler(context);
                results.push({ id: entry.id, value });
            } catch (error) {
                errors.push({ id: entry.id, error });
            } finally {
                if (entry.once) {
                    this.untap(hookName, entry.id);
                }
            }
        }

        return { results, errors };
    }

    /**
     * Execute hook handlers in waterfall mode.
     * Each handler can transform the payload and pass to the next handler.
     */
    async runWaterfall(hookName, payload, context = {}) {
        const handlers = [...(this.hooks.get(hookName) || [])];
        let current = payload;

        for (const entry of handlers) {
            try {
                const next = await entry.handler(current, context);
                if (typeof next !== 'undefined') {
                    current = next;
                }
            } finally {
                if (entry.once) {
                    this.untap(hookName, entry.id);
                }
            }
        }

        return current;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HookEngine;
} else {
    window.HookEngine = HookEngine;
}

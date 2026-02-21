/**
 * Event System of Web Application
 * 
 * Custom event management system for the Excel Analyzer application.
 */

class EventSystem {
    constructor() {
        this.events = new Map();
        this.maxListeners = 10;
    }
    
    /**
     * Add event listener
     */
    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const listeners = this.events.get(event);
        
        // Check max listeners limit
        if (listeners.size >= this.maxListeners) {
            console.warn(`Maximum number of listeners (${this.maxListeners}) reached for event: ${event}`);
        }
        
        listeners.add({ callback, context });
        
        return this;
    }
    
    /**
     * Add one-time event listener
     */
    once(event, callback, context = null) {
        const onceCallback = (...args) => {
            this.off(event, onceCallback);
            callback.apply(context, args);
        };
        
        return this.on(event, onceCallback, context);
    }
    
    /**
     * Remove event listener
     */
    off(event, callback) {
        if (!this.events.has(event)) {
            return this;
        }
        
        const listeners = this.events.get(event);
        
        if (callback) {
            // Remove specific callback
            for (const listener of listeners) {
                if (listener.callback === callback) {
                    listeners.delete(listener);
                    break;
                }
            }
        } else {
            // Remove all listeners for this event
            listeners.clear();
        }
        
        // Clean up empty event sets
        if (listeners.size === 0) {
            this.events.delete(event);
        }
        
        return this;
    }
    
    /**
     * Emit event
     */
    emit(event, data = null) {
        if (!this.events.has(event)) {
            return false;
        }
        
        const listeners = this.events.get(event);
        let hasListeners = false;
        
        for (const listener of listeners) {
            hasListeners = true;
            try {
                listener.callback.call(listener.context, data);
            } catch (error) {
                console.error(`Error in event listener for '${event}':`, error);
            }
        }
        
        return hasListeners;
    }
    
    /**
     * Get all listeners for an event
     */
    listeners(event) {
        if (!this.events.has(event)) {
            return [];
        }
        
        return Array.from(this.events.get(event)).map(listener => listener.callback);
    }
    
    /**
     * Check if event has listeners
     */
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).size > 0;
    }
    
    /**
     * Remove all listeners for all events
     */
    removeAllListeners() {
        this.events.clear();
        return this;
    }
    
    /**
     * Remove all listeners for specific event
     */
    removeAllListenersForEvent(event) {
        if (this.events.has(event)) {
            this.events.get(event).clear();
            this.events.delete(event);
        }
        return this;
    }
    
    /**
     * Set max listeners limit
     */
    setMaxListeners(max) {
        if (typeof max !== 'number' || max < 0) {
            throw new Error('Max listeners must be a non-negative number');
        }
        
        this.maxListeners = max;
        return this;
    }
    
    /**
     * Get event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
    
    /**
     * Get listener count for event
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).size : 0;
    }
    
    /**
     * Create namespaced event
     */
    namespace(namespace) {
        return {
            on: (event, callback, context) => this.on(`${namespace}:${event}`, callback, context),
            once: (event, callback, context) => this.once(`${namespace}:${event}`, callback, context),
            off: (event, callback) => this.off(`${namespace}:${event}`, callback),
            emit: (event, data) => this.emit(`${namespace}:${event}`, data),
            removeAllListeners: () => {
                const eventsToRemove = [];
                for (const eventName of this.eventNames()) {
                    if (eventName.startsWith(`${namespace}:`)) {
                        eventsToRemove.push(eventName);
                    }
                }
                eventsToRemove.forEach(event => this.removeAllListenersForEvent(event));
            }
        };
    }
    
    /**
     * Create event chain
     */
    chain(events) {
        if (!Array.isArray(events) || events.length < 2) {
            throw new Error('Event chain requires at least 2 events');
        }
        
        return {
            start: (initialData) => {
                this.emit(events[0], initialData);
            },
            link: (event, callback) => {
                this.on(event, callback);
            }
        };
    }
    
    /**
     * Debounced event emitter
     */
    debouncedEmit(event, data, delay = 300) {
        if (!this._debounceTimers) {
            this._debounceTimers = new Map();
        }
        
        if (this._debounceTimers.has(event)) {
            clearTimeout(this._debounceTimers.get(event));
        }
        
        const timer = setTimeout(() => {
            this.emit(event, data);
            this._debounceTimers.delete(event);
        }, delay);
        
        this._debounceTimers.set(event, timer);
    }
    
    /**
     * Throttled event emitter
     */
    throttledEmit(event, data, limit = 1000) {
        if (!this._throttleTimers) {
            this._throttleTimers = new Map();
        }
        
        const lastEmit = this._throttleTimers.get(event);
        const now = Date.now();
        
        if (!lastEmit || (now - lastEmit) >= limit) {
            this.emit(event, data);
            this._throttleTimers.set(event, now);
        }
    }
    
    /**
     * Event logger
     */
    enableLogging(enabled = true) {
        if (enabled) {
            this._originalEmit = this.emit;
            this.emit = (event, data) => {
                console.log(`Event emitted: ${event}`, data);
                return this._originalEmit.call(this, event, data);
            };
        } else if (this._originalEmit) {
            this.emit = this._originalEmit;
            delete this._originalEmit;
        }
    }
    
    /**
     * Event history
     */
    enableHistory(enabled = true, maxSize = 100) {
        if (enabled) {
            this._eventHistory = [];
            this._historyMaxSize = maxSize;
            
            this._originalEmit = this.emit;
            this.emit = (event, data) => {
                const result = this._originalEmit.call(this, event, data);
                
                // Add to history
                this._eventHistory.push({
                    event,
                    data,
                    timestamp: Date.now()
                });
                
                // Limit history size
                if (this._eventHistory.length > this._historyMaxSize) {
                    this._eventHistory.shift();
                }
                
                return result;
            };
        } else if (this._originalEmit) {
            this.emit = this._originalEmit;
            delete this._originalEmit;
            delete this._eventHistory;
            delete this._historyMaxSize;
        }
    }
    
    /**
     * Get event history
     */
    getHistory() {
        return this._eventHistory || [];
    }
    
    /**
     * Clear event history
     */
    clearHistory() {
        if (this._eventHistory) {
            this._eventHistory = [];
        }
    }
    
    /**
     * Event filter
     */
    filter(event, filterFn) {
        if (typeof filterFn !== 'function') {
            throw new Error('Filter function must be provided');
        }
        
        const originalEmit = this.emit;
        this.emit = (eventName, data) => {
            if (eventName === event && !filterFn(data)) {
                return false; // Don't emit if filter returns false
            }
            return originalEmit.call(this, eventName, data);
        };
        
        return this;
    }
    
    /**
     * Event transformer
     */
    transform(event, transformFn) {
        if (typeof transformFn !== 'function') {
            throw new Error('Transform function must be provided');
        }
        
        const originalEmit = this.emit;
        this.emit = (eventName, data) => {
            if (eventName === event) {
                data = transformFn(data);
            }
            return originalEmit.call(this, eventName, data);
        };
        
        return this;
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventSystem;
} else {
    window.EventSystem = EventSystem;
}
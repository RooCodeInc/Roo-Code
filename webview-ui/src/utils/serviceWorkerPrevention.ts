/**
 * Prevents ServiceWorker registration in VS Code webview environment
 * This is necessary because VS Code webviews have security restrictions
 * that don't allow ServiceWorker registration, which can cause errors
 * with third-party libraries like PostHog that attempt to use them.
 */

/**
 * Checks if we're running in a VS Code webview environment
 */
export function isVSCodeWebview(): boolean {
	// Check for VS Code webview-specific global
	return typeof acquireVsCodeApi !== "undefined"
}

/**
 * Disables ServiceWorker registration by overriding the navigator.serviceWorker API
 * This prevents third-party libraries from attempting to register ServiceWorkers
 * which would fail in the VS Code webview environment.
 */
export function disableServiceWorkerRegistration(): void {
	if (!isVSCodeWebview()) {
		// Only disable in VS Code webview environment
		return
	}

	// Override navigator.serviceWorker to prevent registration attempts
	if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
		// Create a mock serviceWorker object that prevents registration
		const mockServiceWorker = {
			register: () => {
				console.warn("ServiceWorker registration blocked in VS Code webview environment")
				return Promise.reject(new Error("ServiceWorker registration is not allowed in VS Code webview"))
			},
			getRegistration: () => Promise.resolve(undefined),
			getRegistrations: () => Promise.resolve([]),
			ready: new Promise(() => {
				// Never resolves, as no ServiceWorker will be ready
			}),
			controller: null,
			oncontrollerchange: null,
			onmessage: null,
			onmessageerror: null,
		}

		// Override the serviceWorker property
		Object.defineProperty(navigator, "serviceWorker", {
			get: () => mockServiceWorker,
			configurable: true,
		})
	}
}

/**
 * Initialize ServiceWorker prevention
 * This should be called as early as possible in the application lifecycle
 */
export function initServiceWorkerPrevention(): void {
	try {
		disableServiceWorkerRegistration()
	} catch (error) {
		console.error("Failed to initialize ServiceWorker prevention:", error)
	}
}

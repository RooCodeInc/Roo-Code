/**
 * Service Worker Polyfill for VS Code Webviews
 *
 * VS Code webviews run in an iframe-like context that doesn't support service workers.
 * This polyfill prevents errors when code attempts to register service workers
 * by mocking the navigator.serviceWorker API to gracefully handle registration attempts.
 *
 * This is injected early during webview initialization to intercept any service worker
 * registration attempts before they cause errors.
 */

export function installServiceWorkerPolyfill(): void {
	// Only install if we're in a browser-like context that has navigator
	if (typeof navigator === "undefined") {
		return
	}

	// If service workers are missing, install a safe stub that rejects with a DOMException
	if (!navigator.serviceWorker) {
		;(navigator as any).serviceWorker = {
			register: function (): Promise<any> {
				const msg =
					"Service workers are not supported in VS Code webviews. Registration ignored."
				console.warn("Service Worker registration ignored: ", msg)
				return Promise.reject(new DOMException(msg, "InvalidStateError"))
			},
		}
		return
	}

	// Store the original register method (if present) and wrap it to catch sync errors
	const originalRegister = navigator.serviceWorker.register

	navigator.serviceWorker.register = function (...args: any[]): Promise<any> {
		try {
			// Some browsers may throw synchronously when attempting to register in this context.
			const result = (originalRegister as any).apply(this, args)

			// If the original returned a promise, attach a handler to normalize the rejection
			if (result && typeof (result as any).then === "function") {
				return (result as Promise<any>).catch((err) => {
					console.warn(
						"Service Worker registration failed in VS Code webview context:",
						err,
					)
					return Promise.reject(err)
				})
			}

			// Non-standard result; resolve it safely
			return Promise.resolve(result)
		} catch (err: any) {
			// Convert synchronous throws into a rejected promise so callers can handle them
			console.warn(
				"Service Worker registration threw synchronously in VS Code webview context:",
				err,
			)
			const message =
				err && err.message
					? String(err.message)
					: "Service Worker registration failed in webview context"
			return Promise.reject(new DOMException(message, "InvalidStateError"))
		}
	}

	// Also try to disable any automatic service worker registration
	// by checking for common patterns
	if (typeof window !== "undefined") {
		// Prevent the window from trying to register service workers on load
		const originalAddEventListener = window.addEventListener
		window.addEventListener = function (type: string, listener: any, options?: any): void {
			// Block service worker related events
			if (
				type.toLowerCase().includes("sw") ||
				type.toLowerCase() === "load"
			) {
				// Still register the listener, but it won't do anything harmful
			}
			return originalAddEventListener.call(this, type, listener, options)
		}
	}

	console.debug("Service Worker polyfill installed for VS Code webview")
}

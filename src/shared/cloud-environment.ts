/**
 * Cloud environment detection utilities.
 *
 * These utilities help detect when the extension is running in a cloud
 * environment (Roo Code Cloud) and determine the deployment environment
 * (development, preview, production).
 */

/**
 * Possible app environment values.
 * - 'development': Local development environment
 * - 'preview': Preview/staging environment (e.g., Vercel preview deployments)
 * - 'production': Production environment
 */
export type AppEnvironment = "development" | "preview" | "production"

/**
 * Checks if the extension is running in Roo Code Cloud.
 * This is determined by the presence of the ROO_CODE_IPC_SOCKET_PATH environment variable,
 * which is set by the cloud worker when spawning VS Code.
 */
export function isCloudEnvironment(): boolean {
	return typeof process.env.ROO_CODE_IPC_SOCKET_PATH === "string"
}

/**
 * Gets the app environment (development, preview, or production).
 * This is determined by the ROO_CODE_APP_ENV environment variable set by the cloud worker.
 * Returns undefined if not running in a cloud environment or if the variable is not set.
 */
export function getAppEnvironment(): AppEnvironment | undefined {
	const appEnv = process.env.ROO_CODE_APP_ENV
	if (appEnv === "development" || appEnv === "preview" || appEnv === "production") {
		return appEnv
	}
	return undefined
}

/**
 * Checks if the extension is running in a preview environment.
 * Preview environments are typically used for testing features before production.
 */
export function isPreviewEnvironment(): boolean {
	return getAppEnvironment() === "preview"
}

/**
 * Checks if the extension is running in a production environment.
 */
export function isProductionEnvironment(): boolean {
	return getAppEnvironment() === "production"
}

/**
 * Checks if the extension is running in a development environment.
 */
export function isDevelopmentEnvironment(): boolean {
	return getAppEnvironment() === "development"
}

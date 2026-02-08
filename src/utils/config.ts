import * as vscode from "vscode"
import * as path from "path"

export type InjectableConfigType =
	| string
	| {
			[key: string]:
				| undefined
				| null
				| boolean
				| number
				| InjectableConfigType
				| Array<undefined | null | boolean | number | InjectableConfigType>
	  }

/**
 * Deeply injects environment variables into a configuration object/string/json
 *
 * Uses VSCode env:name pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 */
export async function injectEnv<C extends InjectableConfigType>(config: C, notFoundValue: any = "") {
	return injectVariables(config, { env: process.env }, notFoundValue)
}

/**
 * Deeply injects variables into a configuration object/string/json
 *
 * Uses VSCode's variables reference pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 *
 * There is a special handling for a nested (record-type) variables, where it is replaced by `propNotFoundValue` (if available) if the root key exists but the nested key does not.
 *
 * Matched keys that have `null` | `undefined` values are treated as not found.
 */
export async function injectVariables<C extends InjectableConfigType>(
	config: C,
	variables: Record<string, undefined | null | string | Record<string, undefined | null | string>>,
	propNotFoundValue?: any,
) {
	const isObject = typeof config === "object"
	let configString: string = isObject ? JSON.stringify(config) : config

	for (const [key, value] of Object.entries(variables)) {
		if (value == null) continue

		if (typeof value === "string") {
			// Normalize paths to forward slashes for cross-platform compatibility
			configString = configString.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value.toPosix())
		} else {
			// Handle nested variables (e.g., ${env:VAR_NAME})
			configString = configString.replace(new RegExp(`\\$\\{${key}:([\\w]+)\\}`, "g"), (match, name) => {
				const nestedValue = value[name]

				if (nestedValue == null) {
					console.warn(`[injectVariables] variable "${name}" referenced but not found in "${key}"`)
					return propNotFoundValue ?? match
				}

				// Normalize paths for string values
				return typeof nestedValue === "string" ? nestedValue.toPosix() : nestedValue
			})
		}
	}

	return (isObject ? JSON.parse(configString) : configString) as C extends string ? string : C
}

/**
 * Synchronously injects variables into a string value.
 * Used for interpolating individual header values.
 *
 * @param value The string value to interpolate
 * @param variables The variables to inject
 * @returns The interpolated string
 */
function injectVariablesSync(
	value: string,
	variables: Record<string, undefined | null | string | Record<string, undefined | null | string>>,
): string {
	let result = value

	for (const [key, varValue] of Object.entries(variables)) {
		if (varValue == null) continue

		if (typeof varValue === "string") {
			// Normalize paths to forward slashes for cross-platform compatibility
			result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), varValue.toPosix())
		} else {
			// Handle nested variables (e.g., ${env:VAR_NAME})
			result = result.replace(new RegExp(`\\$\\{${key}:([\\w]+)\\}`, "g"), (match, name) => {
				const nestedValue = varValue[name]

				if (nestedValue == null) {
					console.warn(`[injectVariablesSync] variable "${name}" referenced but not found in "${key}"`)
					return match
				}

				// Normalize paths for string values
				return typeof nestedValue === "string" ? nestedValue.toPosix() : nestedValue
			})
		}
	}

	return result
}

/**
 * Synchronously interpolates VS Code-style variables in custom headers.
 *
 * Supports the following variables:
 * - ${workspaceFolder} - Full path to the workspace root
 * - ${workspaceFolderBasename} - Just the folder name (e.g., "my-repo-name")
 * - ${env:VAR_NAME} - Environment variables
 *
 * This function is synchronous to be compatible with provider constructors.
 *
 * @param headers The headers object to interpolate (can be undefined)
 * @returns The interpolated headers object, or undefined if input was undefined
 */
export function interpolateHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
	if (!headers || Object.keys(headers).length === 0) {
		return headers
	}

	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""
	const workspaceFolderBasename = workspaceFolder ? path.basename(workspaceFolder) : ""

	const variables = {
		workspaceFolder,
		workspaceFolderBasename,
		env: process.env as Record<string, string>,
	}

	const result: Record<string, string> = {}
	for (const [headerKey, headerValue] of Object.entries(headers)) {
		result[headerKey] = injectVariablesSync(headerValue, variables)
	}

	return result
}

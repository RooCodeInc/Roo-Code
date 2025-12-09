import { z } from "zod"

import { Package } from "../../../shared/package"

/**
 * Schema for a versioned setting value.
 * Allows settings to be gated behind a minimum plugin version.
 *
 * Example:
 * ```
 * {
 *   includedTools: {
 *     value: ['search_replace'],
 *     minPluginVersion: '3.36.4',
 *   }
 * }
 * ```
 */
export const versionedValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
	z.object({
		value: valueSchema,
		minPluginVersion: z.string(),
	})

/**
 * Type for a versioned setting value.
 */
export type VersionedValue<T> = {
	value: T
	minPluginVersion: string
}

/**
 * Type guard to check if a value is a versioned value object.
 */
export function isVersionedValue(value: unknown): value is VersionedValue<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		"value" in value &&
		"minPluginVersion" in value &&
		typeof (value as VersionedValue<unknown>).minPluginVersion === "string"
	)
}

/**
 * Compares two semantic version strings.
 *
 * @param version1 First version string (e.g., "3.36.4")
 * @param version2 Second version string (e.g., "3.36.0")
 * @returns negative if version1 < version2, 0 if equal, positive if version1 > version2
 */
export function compareSemver(version1: string, version2: string): number {
	// Parse version strings, handling potential pre-release tags
	const parseVersion = (v: string): number[] => {
		// Remove any pre-release suffix (e.g., "-beta.1", "-rc.2")
		const baseVersion = v.split("-")[0]
		return baseVersion.split(".").map((part) => {
			const num = parseInt(part, 10)
			return isNaN(num) ? 0 : num
		})
	}

	const v1Parts = parseVersion(version1)
	const v2Parts = parseVersion(version2)

	// Pad shorter array with zeros
	const maxLength = Math.max(v1Parts.length, v2Parts.length)
	while (v1Parts.length < maxLength) v1Parts.push(0)
	while (v2Parts.length < maxLength) v2Parts.push(0)

	// Compare each component
	for (let i = 0; i < maxLength; i++) {
		const diff = v1Parts[i] - v2Parts[i]
		if (diff !== 0) {
			return diff
		}
	}

	return 0
}

/**
 * Checks if the current plugin version meets or exceeds the required minimum version.
 *
 * @param minPluginVersion The minimum required version
 * @param currentVersion The current plugin version (defaults to Package.version)
 * @returns true if current version >= minPluginVersion
 */
export function meetsMinimumVersion(minPluginVersion: string, currentVersion: string = Package.version): boolean {
	return compareSemver(currentVersion, minPluginVersion) >= 0
}

/**
 * Resolves versioned settings by extracting values only when the current plugin
 * version meets the minimum version requirement.
 *
 * Settings can be either:
 * - Direct values: `{ includedTools: ['search_replace'] }`
 * - Versioned values: `{ includedTools: { value: ['search_replace'], minPluginVersion: '3.36.4' } }`
 *
 * @param settings The settings object with potentially versioned values
 * @param currentVersion The current plugin version (defaults to Package.version)
 * @returns A new settings object with versioned values resolved
 */
export function resolveVersionedSettings<T extends Record<string, unknown>>(
	settings: T,
	currentVersion: string = Package.version,
): Partial<T> {
	const resolved: Partial<T> = {}

	for (const [key, value] of Object.entries(settings)) {
		if (isVersionedValue(value)) {
			// Only include the setting if the version requirement is met
			if (meetsMinimumVersion(value.minPluginVersion, currentVersion)) {
				resolved[key as keyof T] = value.value as T[keyof T]
			}
			// If version requirement is not met, the setting is omitted
		} else {
			// Non-versioned values are included directly
			resolved[key as keyof T] = value as T[keyof T]
		}
	}

	return resolved
}

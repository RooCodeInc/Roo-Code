/**
 * useRenderProfiler - Hook for component-level render profiling
 *
 * Tracks render count, timing, and optionally identifies which props
 * changed to cause the re-render. Only active when profiling is enabled.
 *
 * Usage:
 *   function MyComponent(props: Props) {
 *     useRenderProfiler({
 *       name: 'MyComponent',
 *       trackProps: true,
 *       props, // Pass current props for diffing
 *       propsToTrack: ['id', 'content'] // Optional: limit which props to track
 *     })
 *     // ... rest of component
 *   }
 */

import React, { useRef, useEffect } from "react"
import { RenderProfiler } from "../utils/renderProfiler.js"

export interface UseRenderProfilerOptions {
	/** Component name for logging */
	name: string
	/** Whether to track which props changed */
	trackProps?: boolean
	/** Current props object (required if trackProps is true) */
	props?: Record<string, unknown>
	/** Specific prop names to track (if not provided, tracks all) */
	propsToTrack?: string[]
	/** Warn if component renders more than N times per second */
	warnOnFrequentRenders?: number
}

interface RenderStats {
	count: number
	lastRenderTime: number
	rendersInLastSecond: number
	lastSecondStart: number
}

/**
 * Get a value from a nested object using dot notation path
 * e.g., getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".")
	let current: unknown = obj
	for (const part of parts) {
		if (current === null || current === undefined) return undefined
		if (typeof current !== "object") return undefined
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

/**
 * Compare two values for equality (shallow)
 */
function valuesEqual(a: unknown, b: unknown): boolean {
	// Handle arrays - compare by reference (shallow)
	if (Array.isArray(a) && Array.isArray(b)) {
		return a === b
	}
	// Handle objects - compare by reference (shallow)
	if (typeof a === "object" && typeof b === "object") {
		return a === b
	}
	return a === b
}

/**
 * Find which props changed between renders
 */
function findChangedProps(
	prevProps: Record<string, unknown>,
	nextProps: Record<string, unknown>,
	propsToTrack?: string[],
): string[] {
	const changed: string[] = []
	const keysToCheck = propsToTrack || [...new Set([...Object.keys(prevProps), ...Object.keys(nextProps)])]

	for (const key of keysToCheck) {
		const prevValue = propsToTrack ? getNestedValue(prevProps, key) : prevProps[key]
		const nextValue = propsToTrack ? getNestedValue(nextProps, key) : nextProps[key]

		if (!valuesEqual(prevValue, nextValue)) {
			changed.push(key)
		}
	}

	return changed
}

/**
 * Hook to profile component renders
 *
 * This hook tracks:
 * - Total render count
 * - Time since last render
 * - Which props changed (if trackProps enabled)
 * - Frequency warnings (if warnOnFrequentRenders set)
 */
export function useRenderProfiler(options: UseRenderProfilerOptions): void {
	const { name, trackProps = false, props, propsToTrack, warnOnFrequentRenders } = options

	const profiler = RenderProfiler.getInstance()
	const renderStartTime = useRef<number>(performance.now())
	const statsRef = useRef<RenderStats>({
		count: 0,
		lastRenderTime: 0,
		rendersInLastSecond: 0,
		lastSecondStart: Date.now(),
	})
	const prevPropsRef = useRef<Record<string, unknown> | null>(null)
	const isFirstRender = useRef(true)

	// Record render timing at the start
	renderStartTime.current = performance.now()

	// Track props changes
	useEffect(() => {
		// Skip if profiling is disabled
		if (!profiler.isEnabled()) {
			return
		}

		const stats = statsRef.current
		const now = Date.now()
		const renderDuration = performance.now() - renderStartTime.current

		// Update render count
		stats.count++

		// Track renders per second
		if (now - stats.lastSecondStart >= 1000) {
			// Reset counter for new second
			stats.rendersInLastSecond = 1
			stats.lastSecondStart = now
		} else {
			stats.rendersInLastSecond++
		}

		// Determine render reason
		let reason: string | undefined

		if (isFirstRender.current) {
			reason = "initial mount"
			isFirstRender.current = false
		} else if (trackProps && props && prevPropsRef.current) {
			const changedProps = findChangedProps(prevPropsRef.current, props, propsToTrack)
			if (changedProps.length > 0) {
				reason = `props changed: ${changedProps.join(", ")}`
			} else {
				reason = "parent re-render (no prop changes)"
			}
		}

		// Record the render
		profiler.recordRender(name, renderDuration, reason)

		// Warn on frequent renders
		if (warnOnFrequentRenders && stats.rendersInLastSecond > warnOnFrequentRenders) {
			profiler.recordRender(
				name,
				renderDuration,
				`WARNING: ${stats.rendersInLastSecond} renders in last second (threshold: ${warnOnFrequentRenders})`,
			)
		}

		// Store current props for next comparison
		if (trackProps && props) {
			// Shallow copy the props for comparison
			prevPropsRef.current = { ...props }
		}

		stats.lastRenderTime = now
	})

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Nothing to clean up - profiler is a singleton
		}
	}, [])
}

/**
 * Higher-order component wrapper for profiling class components or
 * components where you can't use hooks directly.
 *
 * Usage:
 *   const ProfiledComponent = withRenderProfiler(MyComponent, 'MyComponent')
 */
export function withRenderProfiler<P extends Record<string, unknown>>(
	Component: React.ComponentType<P>,
	name: string,
	options?: Omit<UseRenderProfilerOptions, "name" | "props">,
): React.ComponentType<P> {
	const ProfiledComponent = (props: P) => {
		useRenderProfiler({
			name,
			...options,
			props: props as Record<string, unknown>,
		})

		return React.createElement(Component, props)
	}

	ProfiledComponent.displayName = `Profiled(${name})`
	return ProfiledComponent
}

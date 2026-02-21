import { useEffect, useState } from "react"
import { formatDuration } from "@src/utils/format"

/**
 * Hook that provides a live-updating formatted duration string.
 *
 * While the task is running (taskStartTime is set), it ticks every second
 * using Date.now() - taskStartTime.
 *
 * When the task stops (taskStartTime becomes undefined), it freezes at the
 * taskElapsedTime value provided by the backend instead of continuing to tick.
 */
export function useTaskTimer(taskStartTime?: number, taskElapsedTime?: number): string | null {
	const [elapsed, setElapsed] = useState<string | null>(() => {
		if (taskStartTime && taskElapsedTime !== undefined) {
			return formatDuration(taskElapsedTime)
		}
		if (taskStartTime) {
			return formatDuration(0)
		}
		if (taskElapsedTime && taskElapsedTime > 0) {
			return formatDuration(taskElapsedTime)
		}
		return null
	})

	useEffect(() => {
		// Task is running — tick live
		if (taskStartTime) {
			const baseElapsed = taskElapsedTime ?? 0
			const startedAt = Date.now()

			setElapsed(formatDuration(baseElapsed))

			const interval = setInterval(() => {
				setElapsed(formatDuration(baseElapsed + (Date.now() - startedAt)))
			}, 1000)

			return () => {
				clearInterval(interval)
			}
		}

		// Task stopped — freeze at backend-provided elapsed time
		if (taskElapsedTime && taskElapsedTime > 0) {
			setElapsed(formatDuration(taskElapsedTime))
			return
		}

		// No timer data
		setElapsed(null)
	}, [taskStartTime, taskElapsedTime])

	return elapsed
}

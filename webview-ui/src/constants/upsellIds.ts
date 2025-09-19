/**
 * Constants for all upsell IDs used in the application.
 * Using constants ensures type safety and prevents typos.
 */

export const UPSELL_IDS = {
	TASK_LIST: "taskList", // Cloud upsell in the home page task list
	LONG_RUNNING_TASK: "longRunningTask", // Cloud upsell when a task takes a while
} as const

// Type for all valid upsell IDs
export type UpsellId = (typeof UPSELL_IDS)[keyof typeof UPSELL_IDS]

// Helper to validate if a string is a valid upsell ID
export function isValidUpsellId(id: string): id is UpsellId {
	return Object.values(UPSELL_IDS).includes(id as UpsellId)
}

// Export existing hooks
export { TerminalSizeProvider, useTerminalSize } from "./TerminalSizeContext.js"
export { useToast, useToastStore } from "./useToast.js"
export { useInputHistory } from "./useInputHistory.js"

// Export new extracted hooks
export { useFollowupCountdown } from "./useFollowupCountdown.js"
export { useFocusManagement } from "./useFocusManagement.js"
export { useExtensionHost } from "./useExtensionHost.js"
export { useTaskSubmit } from "./useTaskSubmit.js"
export { useGlobalInput } from "./useGlobalInput.js"
export { usePickerHandlers } from "./usePickerHandlers.js"
export { useClientEvents } from "./useClientEvents.js"
export { useExtensionState } from "./useExtensionState.js"

// Export types
export type { UseFollowupCountdownOptions } from "./useFollowupCountdown.js"
export type { UseFocusManagementOptions, UseFocusManagementReturn } from "./useFocusManagement.js"
export type { UseExtensionHostOptions, UseExtensionHostReturn } from "./useExtensionHost.js"
export type { UseTaskSubmitOptions, UseTaskSubmitReturn } from "./useTaskSubmit.js"
export type { UseGlobalInputOptions } from "./useGlobalInput.js"
export type { UsePickerHandlersOptions, UsePickerHandlersReturn } from "./usePickerHandlers.js"
export type { UseClientEventsOptions, UseClientEventsReturn } from "./useClientEvents.js"
export type { UseExtensionStateReturn } from "./useExtensionState.js"

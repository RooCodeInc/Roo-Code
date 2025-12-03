/**
 * Context Management UI Components
 *
 * This module provides a unified set of components for displaying context management
 * events in the ChatView. It handles all types of context management operations:
 *
 * - Context Condensation: AI-powered summarization to reduce token usage
 * - Context Truncation: Sliding window removal of older messages
 * - Error States: When context management operations fail
 *
 * Usage:
 * ```tsx
 * import { ContextManagementRow, isContextManagementMessage } from "./context-management"
 *
 * if (isContextManagementMessage(message)) {
 *   return <ContextManagementRow message={message} />
 * }
 * ```
 */

export { ContextManagementRow, isContextManagementMessage } from "./ContextManagementRow"
export { InProgressRow } from "./InProgressRow"
export { CondensationResultRow } from "./CondensationResultRow"
export { CondensationErrorRow } from "./CondensationErrorRow"
export { TruncationResultRow } from "./TruncationResultRow"

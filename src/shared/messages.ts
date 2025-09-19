/**
 * Centralized user-facing message constants for interruption labels.
 * TODO: Consider moving these to i18n JSON in src/i18n/locales/* and wiring through t()
 * so they can be localized consistently across the UI.
 *
 * Note: These are plain phrases (no surrounding brackets). Call sites add any desired decoration.
 */
export const RESPONSE_INTERRUPTED_BY_USER = "Response interrupted by user"
export const RESPONSE_INTERRUPTED_BY_API_ERROR = "Response interrupted by API Error"

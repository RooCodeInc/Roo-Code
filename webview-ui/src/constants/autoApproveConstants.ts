import { AutoApproveSetting } from "../components/settings/AutoApproveToggle"

/**
 * Keyboard shortcuts mapping for auto-approve options
 * Maps keyboard keys (1-9, 0) to their corresponding auto-approve settings
 */
export const KEYBOARD_SHORTCUTS: Record<string, AutoApproveSetting> = {
	"1": "alwaysAllowReadOnly",
	"2": "alwaysAllowWrite",
	"3": "alwaysAllowBrowser",
	"4": "alwaysAllowExecute",
	"5": "alwaysAllowMcp",
	"6": "alwaysAllowModeSwitch",
	"7": "alwaysAllowSubtasks",
	"8": "alwaysAllowFollowupQuestions",
	"9": "alwaysAllowUpdateTodoList",
	"0": "alwaysApproveResubmit",
}

/**
 * Keyboard shortcuts display mapping
 * Maps auto-approve settings to their display shortcut strings
 */
export const KEYBOARD_SHORTCUTS_DISPLAY: Record<AutoApproveSetting, string> = {
	alwaysAllowReadOnly: "Alt+1",
	alwaysAllowWrite: "Alt+2",
	alwaysAllowBrowser: "Alt+3",
	alwaysAllowExecute: "Alt+4",
	alwaysAllowMcp: "Alt+5",
	alwaysAllowModeSwitch: "Alt+6",
	alwaysAllowSubtasks: "Alt+7",
	alwaysAllowFollowupQuestions: "Alt+8",
	alwaysAllowUpdateTodoList: "Alt+9",
	alwaysApproveResubmit: "Alt+0",
}

/**
 * Configuration for keyboard shortcuts
 * Can be extended in the future to support user preferences
 */
export interface KeyboardShortcutConfig {
	enabled: boolean
	useAltKey: boolean
	useCtrlShiftKey: boolean
}

/**
 * Default keyboard shortcut configuration
 * In the future, this can be loaded from user settings
 */
export const DEFAULT_KEYBOARD_CONFIG: KeyboardShortcutConfig = {
	enabled: true,
	useAltKey: true,
	useCtrlShiftKey: false,
}

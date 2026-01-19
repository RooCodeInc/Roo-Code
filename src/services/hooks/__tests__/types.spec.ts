import { describe, it, expect } from "vitest"
import {
	TOOL_EVENTS,
	LIFECYCLE_EVENTS_WITH_MATCHERS,
	LIFECYCLE_EVENTS_WITHOUT_MATCHERS,
	TOOL_MATCHERS,
	SESSION_START_MATCHERS,
	NOTIFICATION_MATCHERS,
	PRE_COMPACT_MATCHERS,
	EVENT_MATCHER_MAP,
	isToolEvent,
	eventSupportsMatchers,
	getValidMatchersForEvent,
	isValidMatcherForEvent,
	type HookEventType,
} from "../types"

describe("Event Category Constants", () => {
	it("TOOL_EVENTS contains all tool-related events", () => {
		expect(TOOL_EVENTS).toContain("PreToolUse")
		expect(TOOL_EVENTS).toContain("PostToolUse")
		expect(TOOL_EVENTS).toContain("PostToolUseFailure")
		expect(TOOL_EVENTS).toContain("PermissionRequest")
		expect(TOOL_EVENTS).toHaveLength(4)
	})

	it("LIFECYCLE_EVENTS_WITH_MATCHERS contains events that have matchers", () => {
		expect(LIFECYCLE_EVENTS_WITH_MATCHERS).toContain("SessionStart")
		expect(LIFECYCLE_EVENTS_WITH_MATCHERS).toContain("Notification")
		expect(LIFECYCLE_EVENTS_WITH_MATCHERS).toContain("PreCompact")
		expect(LIFECYCLE_EVENTS_WITH_MATCHERS).toHaveLength(3)
	})

	it("LIFECYCLE_EVENTS_WITHOUT_MATCHERS contains events without matchers", () => {
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toContain("Stop")
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toContain("SubagentStart")
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toContain("SubagentStop")
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toContain("SessionEnd")
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toContain("UserPromptSubmit")
		expect(LIFECYCLE_EVENTS_WITHOUT_MATCHERS).toHaveLength(5)
	})
})

describe("Matcher Constants", () => {
	it("TOOL_MATCHERS contains all tool groups", () => {
		expect(TOOL_MATCHERS).toContain("read")
		expect(TOOL_MATCHERS).toContain("edit")
		expect(TOOL_MATCHERS).toContain("browser")
		expect(TOOL_MATCHERS).toContain("command")
		expect(TOOL_MATCHERS).toContain("mcp")
		expect(TOOL_MATCHERS).toContain("modes")
		expect(TOOL_MATCHERS).toHaveLength(6)
	})

	it("SESSION_START_MATCHERS contains session start triggers", () => {
		expect(SESSION_START_MATCHERS).toContain("startup")
		expect(SESSION_START_MATCHERS).toContain("resume")
		expect(SESSION_START_MATCHERS).toContain("clear")
		expect(SESSION_START_MATCHERS).toContain("compact")
		expect(SESSION_START_MATCHERS).toHaveLength(4)
	})

	it("NOTIFICATION_MATCHERS contains notification types", () => {
		expect(NOTIFICATION_MATCHERS).toContain("permission_prompt")
		expect(NOTIFICATION_MATCHERS).toContain("idle_prompt")
		expect(NOTIFICATION_MATCHERS).toContain("auth_success")
		expect(NOTIFICATION_MATCHERS).toContain("elicitation_dialog")
		expect(NOTIFICATION_MATCHERS).toHaveLength(4)
	})

	it("PRE_COMPACT_MATCHERS contains compaction triggers", () => {
		expect(PRE_COMPACT_MATCHERS).toContain("manual")
		expect(PRE_COMPACT_MATCHERS).toContain("auto")
		expect(PRE_COMPACT_MATCHERS).toHaveLength(2)
	})
})

describe("isToolEvent", () => {
	it("returns true for tool events", () => {
		expect(isToolEvent("PreToolUse")).toBe(true)
		expect(isToolEvent("PostToolUse")).toBe(true)
		expect(isToolEvent("PostToolUseFailure")).toBe(true)
		expect(isToolEvent("PermissionRequest")).toBe(true)
	})

	it("returns false for lifecycle events", () => {
		expect(isToolEvent("SessionStart")).toBe(false)
		expect(isToolEvent("SessionEnd")).toBe(false)
		expect(isToolEvent("Stop")).toBe(false)
		expect(isToolEvent("SubagentStart")).toBe(false)
		expect(isToolEvent("SubagentStop")).toBe(false)
		expect(isToolEvent("Notification")).toBe(false)
		expect(isToolEvent("PreCompact")).toBe(false)
		expect(isToolEvent("UserPromptSubmit")).toBe(false)
	})
})

describe("eventSupportsMatchers", () => {
	it("returns true for tool events", () => {
		expect(eventSupportsMatchers("PreToolUse")).toBe(true)
		expect(eventSupportsMatchers("PostToolUse")).toBe(true)
		expect(eventSupportsMatchers("PostToolUseFailure")).toBe(true)
		expect(eventSupportsMatchers("PermissionRequest")).toBe(true)
	})

	it("returns true for lifecycle events with matchers", () => {
		expect(eventSupportsMatchers("SessionStart")).toBe(true)
		expect(eventSupportsMatchers("Notification")).toBe(true)
		expect(eventSupportsMatchers("PreCompact")).toBe(true)
	})

	it("returns false for lifecycle events without matchers", () => {
		expect(eventSupportsMatchers("Stop")).toBe(false)
		expect(eventSupportsMatchers("SubagentStart")).toBe(false)
		expect(eventSupportsMatchers("SubagentStop")).toBe(false)
		expect(eventSupportsMatchers("SessionEnd")).toBe(false)
		expect(eventSupportsMatchers("UserPromptSubmit")).toBe(false)
	})
})

describe("getValidMatchersForEvent", () => {
	it("returns TOOL_MATCHERS for tool events", () => {
		expect(getValidMatchersForEvent("PreToolUse")).toEqual(TOOL_MATCHERS)
		expect(getValidMatchersForEvent("PostToolUse")).toEqual(TOOL_MATCHERS)
		expect(getValidMatchersForEvent("PostToolUseFailure")).toEqual(TOOL_MATCHERS)
		expect(getValidMatchersForEvent("PermissionRequest")).toEqual(TOOL_MATCHERS)
	})

	it("returns SESSION_START_MATCHERS for SessionStart", () => {
		expect(getValidMatchersForEvent("SessionStart")).toEqual(SESSION_START_MATCHERS)
	})

	it("returns NOTIFICATION_MATCHERS for Notification", () => {
		expect(getValidMatchersForEvent("Notification")).toEqual(NOTIFICATION_MATCHERS)
	})

	it("returns PRE_COMPACT_MATCHERS for PreCompact", () => {
		expect(getValidMatchersForEvent("PreCompact")).toEqual(PRE_COMPACT_MATCHERS)
	})

	it("returns null for events without matchers", () => {
		expect(getValidMatchersForEvent("Stop")).toBeNull()
		expect(getValidMatchersForEvent("SubagentStart")).toBeNull()
		expect(getValidMatchersForEvent("SubagentStop")).toBeNull()
		expect(getValidMatchersForEvent("SessionEnd")).toBeNull()
		expect(getValidMatchersForEvent("UserPromptSubmit")).toBeNull()
	})
})

describe("isValidMatcherForEvent", () => {
	describe("for tool events", () => {
		it("returns true for any non-empty string (supports regex/glob)", () => {
			expect(isValidMatcherForEvent("PreToolUse", "read")).toBe(true)
			expect(isValidMatcherForEvent("PreToolUse", "edit|read")).toBe(true)
			expect(isValidMatcherForEvent("PreToolUse", "Write|Edit")).toBe(true)
			expect(isValidMatcherForEvent("PreToolUse", "mcp__memory__.*")).toBe(true)
			expect(isValidMatcherForEvent("PostToolUse", "custom-pattern")).toBe(true)
		})

		it("returns false for empty string", () => {
			expect(isValidMatcherForEvent("PreToolUse", "")).toBe(false)
		})
	})

	describe("for SessionStart", () => {
		it("returns true for valid matchers", () => {
			expect(isValidMatcherForEvent("SessionStart", "startup")).toBe(true)
			expect(isValidMatcherForEvent("SessionStart", "resume")).toBe(true)
			expect(isValidMatcherForEvent("SessionStart", "startup|resume")).toBe(true)
		})

		it("returns false for invalid matchers", () => {
			expect(isValidMatcherForEvent("SessionStart", "invalid")).toBe(false)
			expect(isValidMatcherForEvent("SessionStart", "read")).toBe(false)
		})
	})

	describe("for Notification", () => {
		it("returns true for valid matchers", () => {
			expect(isValidMatcherForEvent("Notification", "permission_prompt")).toBe(true)
			expect(isValidMatcherForEvent("Notification", "idle_prompt|auth_success")).toBe(true)
		})

		it("returns false for invalid matchers", () => {
			expect(isValidMatcherForEvent("Notification", "invalid")).toBe(false)
			expect(isValidMatcherForEvent("Notification", "read")).toBe(false)
		})
	})

	describe("for PreCompact", () => {
		it("returns true for valid matchers", () => {
			expect(isValidMatcherForEvent("PreCompact", "manual")).toBe(true)
			expect(isValidMatcherForEvent("PreCompact", "auto")).toBe(true)
			expect(isValidMatcherForEvent("PreCompact", "manual|auto")).toBe(true)
		})

		it("returns false for invalid matchers", () => {
			expect(isValidMatcherForEvent("PreCompact", "invalid")).toBe(false)
		})
	})

	describe("for events without matchers", () => {
		it("returns false for any matcher", () => {
			expect(isValidMatcherForEvent("Stop", "anything")).toBe(false)
			expect(isValidMatcherForEvent("SessionEnd", "read")).toBe(false)
			expect(isValidMatcherForEvent("SubagentStart", "")).toBe(false)
		})
	})
})

describe("EVENT_MATCHER_MAP", () => {
	it("has correct mapping for all 12 event types", () => {
		// Tool events
		expect(EVENT_MATCHER_MAP.PreToolUse).toEqual(TOOL_MATCHERS)
		expect(EVENT_MATCHER_MAP.PostToolUse).toEqual(TOOL_MATCHERS)
		expect(EVENT_MATCHER_MAP.PostToolUseFailure).toEqual(TOOL_MATCHERS)
		expect(EVENT_MATCHER_MAP.PermissionRequest).toEqual(TOOL_MATCHERS)

		// Lifecycle with matchers
		expect(EVENT_MATCHER_MAP.SessionStart).toEqual(SESSION_START_MATCHERS)
		expect(EVENT_MATCHER_MAP.Notification).toEqual(NOTIFICATION_MATCHERS)
		expect(EVENT_MATCHER_MAP.PreCompact).toEqual(PRE_COMPACT_MATCHERS)

		// Lifecycle without matchers
		expect(EVENT_MATCHER_MAP.Stop).toBeNull()
		expect(EVENT_MATCHER_MAP.SubagentStart).toBeNull()
		expect(EVENT_MATCHER_MAP.SubagentStop).toBeNull()
		expect(EVENT_MATCHER_MAP.SessionEnd).toBeNull()
		expect(EVENT_MATCHER_MAP.UserPromptSubmit).toBeNull()
	})
})

// Ensure the exported HookEventType stays aligned with our hardcoded expectations in this spec.
// This is a no-op at runtime, but TypeScript will verify the union type.
const _eventTypeSmoke: HookEventType[] = [
	"PreToolUse",
	"PostToolUse",
	"PostToolUseFailure",
	"PermissionRequest",
	"SessionStart",
	"Notification",
	"PreCompact",
	"Stop",
	"SubagentStart",
	"SubagentStop",
	"SessionEnd",
	"UserPromptSubmit",
]

void _eventTypeSmoke

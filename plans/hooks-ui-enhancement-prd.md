# Hooks UI Enhancement PRD

## Overview

Enhance the "Config" tab in the Hook details view to provide a richer, more interactive configuration experience using VSCode-style UI components (checkboxes, dropdowns) instead of raw text display.

## Problem Statement

Currently, the Hooks UI Config tab displays configuration values as read-only text/code blocks, requiring users to manually edit YAML files for any changes. This is inconsistent with the rest of the settings UI and reduces usability.

## Goals

1. Replace text input/display for **Event**, **Matcher**, and **Timeout** with appropriate VSCode UI components
2. Enable immediate configuration updates that modify the underlying YAML file
3. Support multiple event selection (a conceptual hook can trigger on multiple events)
4. Provide intuitive tool group selection via checkboxes
5. Offer preset timeout options via dropdown

---

## Requirements

### 1. Event Configuration

**Current Behavior:**

- Displays as a single text label: `<code>{hook.event}</code>`

**Desired Behavior:**

- Replace with a set of checkboxes for event selection
- Available events (from `HookEventType`):
    - `PreToolUse`
    - `PostToolUse`
    - `PostToolUseFailure`
    - `PermissionRequest`
    - `UserPromptSubmit`
    - `Stop`
    - `SubagentStop`
    - `SubagentStart`
    - `SessionStart`
    - `SessionEnd`
    - `Notification`
    - `PreCompact`

**Technical Approach for YAML Updates:**

Since hooks are currently structured under event keys in YAML:

```yaml
hooks:
  PreToolUse:
    - id: example-hook
      ...
```

The UI will treat a "hook" as a **conceptual entity** that may have multiple YAML entries (one per event).

**Update Logic:**

- **When adding an event**: Copy the hook definition to the new event key in YAML
- **When removing an event**: Remove the hook definition from that event key in YAML
- **When changing events**: Combination of remove from old + add to new
- **Validation**: A hook must have at least one event selected at all times

**Edge Case - Multiple Entries with Same ID:**
If the same hook ID exists under multiple event keys (which can happen with manual editing), the UI should:

1. Load all entries as separate instances in the list
2. Allow editing each independently OR merge them into a "multi-event" view
3. **Recommendation**: Show as separate expandable items, but allow bulk event changes via a context menu

### 2. Matcher Configuration

**Current Behavior:**

- Displays as a bulleted list of matcher patterns
- No edit capability in UI

**Desired Behavior:**

- Replace with a set of checkboxes for tool groups
- Available groups (from `TOOL_GROUPS`):

    - `read` - read_file, fetch_instructions, search_files, list_files, codebase_search
    - `edit` - apply_diff, write_to_file, generate_image (plus customTools)
    - `browser` - browser_action
    - `command` - execute_command
    - `mcp` - use_mcp_tool, access_mcp_resource
    - `modes` - switch_mode, new_task

- Additional "Custom" option that reveals a text input for regex patterns
- Checkboxes represent the `matcher` field, joined with `|` (e.g., `read|edit`)

**UI Layout:**

```
[ ] read      [ ] edit      [ ] browser
[ ] command   [ ] mcp       [ ] modes
[ ] Custom matcher:
    ┌─────────────────────────┐
    │ file.*\.ts              │
    └─────────────────────────┘
```

**Update Logic:**

- Selected checkboxes → join with `|` → `matcher: "read|edit"`
- If custom input has value → append to the joined string
- Pattern: `[group1]|[group2]|[customPattern]`

**Handling Mixed Matchers:**

- If user has `matcher: "read|file.*\.ts"`:
    - `read` checkbox: checked
    - `file.*\.ts` shown in custom input (with label indicating it's not a standard group)

### 3. Timeout Configuration

**Current Behavior:**

- Displays as plain text: `<span>{hook.timeout}s</span>`

**Desired Behavior:**

- Replace with a dropdown menu with preset options
- Options:
    - 15 seconds
    - 30 seconds
    - 1 minute
    - 5 minutes
    - 10 minutes
    - 15 minutes
    - 30 minutes
    - 60 minutes

**UI Component:**

```
Timeout: [ 30 seconds ▼ ]
```

**Update Logic:**

- Convert selected dropdown value to seconds for YAML storage
- Store as `timeout: 30` (seconds) in YAML

---

## Technical Design

### Data Model Updates

Extend `ResolvedHook` or create a new `HookConfigUIState` for the enhanced UI:

```typescript
interface HookConfigUIState {
	id: string
	filePath: string
	source: "project" | "mode" | "global"
	enabled: boolean

	// New fields for enhanced UI
	events: HookEventType[] // Multiple events this hook responds to
	matcher: string // Raw matcher string (for editing)
	matcherGroups: ToolGroup[] // Parsed group names from matcher
	timeout: number // in seconds
	command: string
	shell?: string
	description?: string
	commandPreview: string
}
```

### Backend Message Protocol

Add new message type for updating hook configuration:

```typescript
// Webview -> Extension
interface HooksUpdateHookMessage {
	type: "hooksUpdateHook"
	hookId: string
	filePath: string // Source file to modify
	updates: {
		events?: HookEventType[] // New set of events
		matcher?: string // New matcher string
		timeout?: number // New timeout in seconds
	}
}

// Extension -> Webview (response)
interface HooksUpdateHookResult {
	success: boolean
	error?: string
}
```

### YAML Update Algorithm

```typescript
async function updateHookConfig(filePath: string, hookId: string, updates: HookUpdates): Promise<void> {
	const content = await fs.readFile(filePath, "utf-8")
	const parsed = parseYAML(content)

	// Get existing hook definition
	const existingHook = findHookById(parsed.hooks, hookId)

	// For events update:
	if (updates.events) {
		const currentEvents = getEventsForHook(parsed.hooks, hookId)
		const newEvents = updates.events

		// Remove from events no longer selected
		for (const event of currentEvents) {
			if (!newEvents.includes(event)) {
				removeHookFromEvent(parsed.hooks, event, hookId)
			}
		}

		// Add to newly selected events
		for (const event of newEvents) {
			if (!currentEvents.includes(event)) {
				addHookToEvent(parsed.hooks, event, existingHook)
			}
		}
	}

	// For matcher update:
	if (updates.matcher !== undefined) {
		updateHookMatcher(parsed.hooks, hookId, updates.matcher)
	}

	// For timeout update:
	if (updates.timeout !== undefined) {
		updateHookTimeout(parsed.hooks, hookId, updates.timeout)
	}

	await fs.writeFile(filePath, stringifyYAML(parsed))
}
```

### UI Component Architecture

```
HookConfigPanel
├── EventSelector
│   └── CheckboxGroup (12 events)
├── MatcherSelector
│   ├── CheckboxGroup (6 tool groups)
│   └── CustomMatcherInput (optional text field)
└── TimeoutSelector
    └── VSCodeDropdown (8 preset options)
```

---

## Implementation Phases

### Phase 1: Basic UI Components

- Create `EventCheckboxGroup` component
- Create `MatcherCheckboxGroup` component
- Create `TimeoutDropdown` component
- Add to `HooksSettings.tsx` in the Config panel

**Testable Outcome:** UI displays checkboxes/dropdown, but changes don't persist yet.

### Phase 2: Backend Protocol

- Add `hooksUpdateHook` message handler in `webviewMessageHandler.ts`
- Implement YAML update logic in a new `HookConfigWriter` service
- Connect UI components to send messages on change

**Testable Outcome:** Changes to event/matcher/timeout update the YAML file.

### Phase 3: Event Multi-Selection Logic

- Handle adding/removing hook definitions across event keys
- Add validation (at least one event must be selected)
- Handle "delete hook" across all event keys

**Testable Outcome:** A hook can respond to multiple events, with proper YAML structure.

### Phase 4: UX Refinements

- Add "Unsaved changes" indicator
- Add "Reload required" notification after edits
- Add inline validation errors
- Add tooltips explaining each event/matcher's purpose

---

## Files to Modify

### Backend (src/)

| File                                    | Changes                        |
| --------------------------------------- | ------------------------------ |
| `core/webview/webviewMessageHandler.ts` | Add `hooksUpdateHook` case     |
| `services/hooks/HookConfigWriter.ts`    | New file - YAML writing logic  |
| `services/hooks/index.ts`               | Export new service             |
| `services/hooks/types.ts`               | Add `HookUpdateData` interface |

### Frontend (webview-ui/)

| File                                          | Changes                                  |
| --------------------------------------------- | ---------------------------------------- |
| `components/settings/HooksSettings.tsx`       | Replace text display with new components |
| `components/settings/HookEventSelector.tsx`   | New component                            |
| `components/settings/HookMatcherSelector.tsx` | New component                            |
| `components/settings/HookTimeoutSelector.tsx` | New component                            |
| `i18n/locales/en/settings.json`               | Add new translation strings              |
| `types.ts`                                    | Add `HookUpdateMessage` type             |

---

## Risk Assessment

### High Risk

1. **YAML Structure Changes**: Moving hooks between event keys could corrupt files if not handled carefully

    - Mitigation: Always read-modify-write with validation
    - Backup original file before first write (optional)

2. **Concurrent Edits**: User editing file while UI modifies it
    - Mitigation: Warn on "Reload" if local changes detected
    - Consider file watching for external changes

### Medium Risk

3. **Multiple Hook Entries**: Same ID in multiple event keys

    - Mitigation: Detect and handle gracefully in UI
    - Show warning in UI when detected

4. **Custom Matcher Parsing**: Extracting groups from arbitrary regex
    - Mitigation: Use simple substring matching for known groups
    - Fall back to "Custom" when pattern doesn't match known groups

### Low Risk

5. **Dropdown Localization**: Time display in user locale
    - Store internally as seconds, display as localized string
    - Use standard i18n approach

---

## Open Questions

1. **Should matcher groups be editable?** The prompt implies read-only checkboxes, but users might want to add custom patterns. Should we allow adding new groups?

    - **Recommendation**: No, keep groups fixed to documented tool categories for simplicity.

2. **Should event selection support "all events" or "all blocking events"?**

    - **Recommendation**: No, explicit selection is clearer. Power users can edit YAML directly.

3. **How to handle hooks in JSON format vs YAML?**
    - **Recommendation**: Both formats should be supported. Use `parseYAML` which handles JSON too.

---

## Success Criteria

1. ✅ Event selector shows 12 checkboxes, allows multi-selection
2. ✅ Matcher selector shows 6 tool group checkboxes + custom input
3. ✅ Timeout selector shows dropdown with 8 preset options
4. ✅ Changes to any field update the underlying YAML file
5. ✅ Hook can respond to multiple events (multiple YAML entries)
6. ✅ UI shows "Reload required" after configuration changes
7. ✅ All existing functionality (delete, toggle, view logs) still works

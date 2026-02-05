# Implementation Plan: Context Dashboard

## Summary

Create a collapsible dashboard component that displays files and folders from the current context above the ChatView. This dashboard will provide visual feedback about what files are currently being included in the AI's context, improving transparency and user awareness.

## Architecture

### Key Files to Create/Modify

**New Files:**

- `webview-ui/src/components/chat/ContextDashboard/ContextDashboard.tsx` - Main dashboard component
- `webview-ui/src/components/chat/ContextDashboard/ContextDashboardHeader.tsx` - Header with toggle button
- `webview-ui/src/components/chat/ContextDashboard/ContextDashboardContent.tsx` - Content area showing files/folders
- `webview-ui/src/components/chat/ContextDashboard/ContextDashboardItem.tsx` - Individual file/folder item
- `webview-ui/src/components/chat/ContextDashboard/index.ts` - Export file

**Files to Modify:**

- `webview-ui/src/components/chat/ChatView.tsx` - Integrate ContextDashboard above ChatTextArea
- `webview-ui/src/i18n/locales/en/chat.json` - Add translations

### Data Flow

```
ExtensionStateContext (filePaths, openedTabs)
    ↓
ContextDashboard (reads from useExtensionState)
    ↓
ContextDashboardContent (filters and groups files/folders)
    ↓
ContextDashboardItem (renders individual items with icons)
```

### Component Structure

```
ContextDashboard
├── ContextDashboardHeader (collapsible trigger)
└── ContextDashboardContent (scrollable list)
    ├── Section: Opened Files (tabs)
    ├── Section: Workspace Files (filePaths)
    └── Section: Folders (nested structure)
```

## Tasks

### 1. Create ContextDashboard Component Structure

**File**: `webview-ui/src/components/chat/ContextDashboard/ContextDashboard.tsx`
**Description**: Create the main dashboard component with collapse/expand state management
**Validation**: Component renders with proper state and can toggle visibility
**Dependencies**: None
**Status**: ✅ COMPLETED

### 2. Create Header Component

**File**: `webview-ui/src/components/chat/ContextDashboard/ContextDashboardHeader.tsx`
**Description**: Create collapsible header with icon, title, and toggle button
**Validation**: Header shows/hides content when toggle is clicked
**Dependencies**: Task 1

### 3. Create Content Component

**File**: `webview-ui/src/components/chat/ContextDashboard/ContextDashboardContent.tsx`
**Description**: Create scrollable content area that displays files and folders grouped by type
**Validation**: Displays opened tabs and workspace files with correct icons
**Dependencies**: Task 1

### 4. Create Individual Item Component

**File**: `webview-ui/src/components/chat/ContextDashboard/ContextDashboardItem.tsx`
**Description**: Create component for individual file/folder items with icons and paths
**Validation**: Each item displays with correct icon and path
**Dependencies**: Task 3

### 5. Add Translations

**File**: `webview-ui/src/i18n/locales/en/chat.json`
**Description**: Add English translations for dashboard UI elements
**Validation**: Translations are accessible via useAppTranslation()
**Dependencies**: Task 1
**Status**: ✅ COMPLETED

### 6. Integrate into ChatView

**File**: `webview-ui/src/components/chat/ChatView.tsx`
**Description**: Add ContextDashboard component above ChatTextArea in ChatView
**Validation**: Dashboard appears above chat input and doesn't interfere with scrolling
**Dependencies**: Task 1
**Status**: ✅ COMPLETED

### 7. Add Tests

**File**: `webview-ui/src/components/chat/ContextDashboard/__tests__/ContextDashboard.spec.tsx`
**Description**: Write unit tests for dashboard functionality
**Validation**: All tests pass
**Dependencies**: Task 1
**Status**: ✅ COMPLETED

## Validation

### Overall Acceptance Criteria

- Dashboard displays files and folders from current context
- Dashboard is collapsible/expandable
- Dashboard shows proper icons for files and folders
- Dashboard is positioned above ChatView as requested
- Dashboard doesn't interfere with chat functionality
- Dashboard is responsive and works with VSCode theme

### Testing

1. Open VSCode with Roo extension
2. Open several files in workspace
3. Verify dashboard shows opened files
4. Verify dashboard shows workspace files
5. Click toggle to collapse/expand
6. Verify chat input still works correctly
7. Test with different VSCode themes

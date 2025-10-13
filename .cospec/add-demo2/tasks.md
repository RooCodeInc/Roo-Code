# 前置依赖文件: [design.md](./design.md) 和 [requirements.md](./requirements.md)

# Implementation Plan

- [x]   1. Set up core infrastructure and interfaces

    - Create directory structure for coworkflow support components
    - Define TypeScript interfaces for file context, task status, and CodeLens models
    - Set up basic command registration structure
    - _Requirements: 1.1, 1.2_

- [x]   2. Implement CoworkflowFileWatcher
- [x] 2.1 Create file monitoring foundation

    - Implement CoworkflowFileWatcher class with initialization and disposal methods
    - Add .coworkflow directory detection and validation
    - Create file system watchers for requirements.md, design.md, and tasks.md
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3_

- [ ] 2.2 Add workspace change handling

    - Implement workspace folder change detection
    - Add watcher re-establishment when workspace changes
    - Handle multiple workspace scenarios with independent monitoring
    - _Requirements: 1.3, 5.4_

- [-] 2.3 Implement file change coordination

    - Create file change event handlers that notify providers
    - Add debouncing for rapid file changes
    - Implement proper error handling for missing files and directories
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3_

- [ ]   3. Implement CoworkflowCodeLensProvider
- [ ] 3.1 Create CodeLens provider foundation

    - Implement CodeLensProvider interface with provideCodeLenses and resolveCodeLens methods
    - Add document type detection (requirements, design, tasks)
    - Create basic Markdown parsing utilities for section detection
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.4_

- [ ] 3.2 Add requirements.md CodeLens support

    - Implement requirement section header detection using regex patterns
    - Create "Update" CodeLens actions at appropriate locations
    - Add command handlers for requirement update operations
    - _Requirements: 2.1, 4.1_

- [ ] 3.3 Add design.md CodeLens support

    - Implement major section header detection for design documents
    - Create "Update" CodeLens actions for design sections
    - Add command handlers for design update operations
    - _Requirements: 2.2, 4.2_

- [ ] 3.4 Add tasks.md CodeLens support

    - Implement task item detection using checkbox patterns
    - Create "Run" and "Retry" CodeLens actions for individual tasks
    - Add command handlers for task execution operations
    - _Requirements: 2.3, 4.3_

- [ ]   4. Implement CoworkflowDecorationProvider
- [ ] 4.1 Create decoration foundation

    - Implement decoration provider class with updateDecorations method
    - Create TextEditorDecorationType instances for different task statuses
    - Add task status parsing utilities for [ ], [ ], [ ] patterns
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4.2 Add task status decoration logic

    - Implement task status detection and range calculation
    - Apply appropriate background decorations based on task status
    - Add real-time decoration updates when document content changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4.3 Add decoration lifecycle management

    - Implement proper decoration disposal when documents close
    - Add decoration clearing when task status changes
    - Handle multiple editors showing the same document
    - _Requirements: 3.4, 3.5_

- [ ]   5. Integrate components with extension
- [ ] 5.1 Add extension activation integration

    - Register CoworkflowFileWatcher in extension activation
    - Register CoworkflowCodeLensProvider with VS Code
    - Register CoworkflowDecorationProvider with document change events
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 5.2 Add command registration

    - Register coworkflow-specific commands in package.json
    - Implement command handlers for Update, Run, and Retry actions
    - Add proper command context and parameter passing
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5.3 Add proper disposal and cleanup

    - Implement extension deactivation cleanup for all providers
    - Add proper disposable management for watchers and decorations
    - Handle workspace closing scenarios gracefully
    - _Requirements: 1.3, 5.4_

- [ ]   6. Add comprehensive error handling
- [ ] 6.1 Implement file system error handling

    - Add graceful handling for missing .coworkflow directory
    - Handle file permission errors with appropriate logging
    - Implement fallback behavior when target files don't exist
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6.2 Add parsing error resilience

    - Handle malformed Markdown content without crashing
    - Provide fallback parsing for corrupted files
    - Add error logging with appropriate detail levels
    - _Requirements: 5.3_

- [ ] 6.3 Add provider error handling

    - Implement error recovery for CodeLens resolution failures
    - Handle decoration application errors gracefully
    - Add user-friendly error messages for command execution failures
    - _Requirements: 2.4, 5.3_

- [ ]   7. Create comprehensive tests
- [ ] 7.1 Add unit tests for core components

    - Write tests for CoworkflowFileWatcher file monitoring logic
    - Create tests for CoworkflowCodeLensProvider document parsing
    - Add tests for CoworkflowDecorationProvider task status detection
    - _Requirements: All requirements validation_

- [ ] 7.2 Add integration tests

    - Test file system watcher integration with temporary files
    - Verify CodeLens and decoration provider integration with VS Code API
    - Test command execution and error handling scenarios
    - _Requirements: All requirements validation_

- [ ] 7.3 Add edge case tests
    - Test behavior with empty and large documents
    - Verify concurrent file change handling
    - Test workspace switching and cleanup scenarios
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

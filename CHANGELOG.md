# Costrict Change Log

## [1.6.18]

- Increase context window size for ZGSM provider
- Add user ID display and improve cloud account handling
- Enhance error handling with errorCode field in global settings
- Improve stream cancellation and request handling
- Enhance commit message generation with i18n support
- Optimize rate limit retry message handling in UI
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/702b269a1bf17e76d856e7a989657417a85eaa42)
- Fix known issues

## [1.6.17]

- Enhance rate limit detection and retry logic in API requests
- Add `getAllInstance()` method to ClineProvider for better instance management
- Update UI to properly handle rate limit retry messages
- Fix known issues

## [1.6.16]

- Add auto-generation of commit messages based on local i18n language
- Optimize request cancellation edge case handling
- Enhance provider API completePrompt request, support system prompts and language metadata
- Update internationalization
- Change default request interval from 0s to 1s to reduce concurrency
- Optimized CodeReview
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/a57528dc8e65c468fa244f0e174a47fea8331f7e)
- Fix known issues

## [1.6.15]

- Increase max read character limit to 30,000
- Add user quota information
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/87d50a78cb92ab5f050a4ec1233afe7004a52e3c)
- Fix known issues

## [1.6.14]

- Optimize the 'line jump' for batch file reading
- Optimize file read character limit
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/0e1b23d09c5d7bfc84f87d85fb9f0022e75c26bd)
- Fix known issues

## [1.6.13]

- New Chat UI (more readable and user-friendly)
- Updates base URL retrieval in ErrorCodeManager
- Refines localization strings for clarity
- Adds os-locale package for improved language detection
- Add file read character limit
- Sync roocode
- Fix known issues

## [1.6.12]

- Improve default values for zgsm configuration
- Sync roocode
- Fix known issues

## [1.6.11]

- Adds models refresh for costrict provider
- Add line navigation for file jumps in chat interface
- Implement chat cancellation and improve search functionality
- Enhance metrics loading and pushing logic in PrometheusTelemetryClient
- Update conditional class for provider renderer visibility
- Enhance chat UI
- Sync roocode
- Update ci
- Fix known issues

## [1.6.10]

- Improves chat search
- Improves encoding handling for Windows terminal commands
- Add zgsmAiCustomModelInfo config
- Enhance model handling and configuration
- Improve rate limiting
- Sync roocode
- Update ci

## [1.6.9]

- Fix binary file check

## [1.6.8]

- Add chat search
- Enhance binary file detection and encoding handling
- Enhanced models cache
- Sync roocode
- Fixed test cases
- Fix known issues

## [1.6.7]

- Implement MetricsSerializer for metric persistence and locking
- Optimized shell integration
- Optimized models cache
- Optimized message edit
- Update docs
- Sync roocode
- Fix known issues

## [1.6.6]

- Fixed non-UTF8 encoding file issues
- Improved shell integration command logic
- Enhanced hidden directory detection as workspace root
- Disabled codebase in non-workspace
- Added history conversation editing mode
- Performance optimization: cached device features
- Updated i18n translations
- Fixed test cases
- Improved dialog "@" and "/" hide logic with ESC exit
- Sync roocode

## [1.6.5]

- Optimize file watching and ignore patterns
- Updates project references and contact information
- Optimize error handling and localization
- Sync roocode

## [1.6.4]

- Fix wsl2 `your 131072x1 screen size is bogus. expect trouble`

## [1.6.3]

- Optimize history cache warning
- Default enable auto approve settings display in chat
- Optimize workspace event handling and request management
- Enhance process detection and health check
- Enhance codebase index handling and confirmation dialog
- Improve file monitoring performance
- Update internationalization entries
- Sync roocode
- Fix known issues

## [1.6.2]

- Optimize login tips
- Update mode icons
- Update error message
- Update model picker
- Fix known issues

## [1.6.1]

- Add message rendering speed mode
- Fix: Implements dropdown close behavior on outside click
- Sync roocode
- Fix known issues

## [1.6.0]

- Auto mode for Agent
- Auto codebase search
- Denied commands support
- New codebase
- New tools support (todolist, simpleReadFileTool etc.)
- New telemetry report
- Optimized tasks disk usage
- Optimized CodeReview
- Optimized UI
- Sync roocode
- Fix known issues

## [1.5.12]

- Update default modelID
- Fix CodeReview path causing service exception
- Add new commands for context
- Fix known issues

## [1.5.11]

- Update docs
- Update error message

## [1.5.10]

- Remove deprecated api
- Fix known issues

## [1.5.9]

- Add Telemetry
- Add AutoCommit
- Optimized shell integration
- Update models config (Grok and o4)
- Fix known issues

## [1.5.8]

- Optimization context window
- Update docs
- Fix known issues

## [1.5.7]

- Project renamed to `costrict`
- Optimized CodeReview
- Code optimization

## [1.5.6]

- Update Error Code

## [1.5.5]

- Optimized Prompts
- Add Model Permission Control
- Fix known issues

## [1.5.4]

- Optimized CodeReview
- Fix PowerShell command formatting
- Update Error Code

## [1.5.3]

- Add Gemini CLI ProjectId Config
- Fix known issues

## [1.5.2]

- Optimized CodeReview
- Update Error Code

## [1.5.1]

- Support "Add To Context" ExplorerSubmenu
- Update Error Code

## [1.5.0]

- Code optimization

## [1.4.9]

- Add CodeReview
- Add Codebase
- Enhanced Code Completion.
- New Authentication Flow
- Add Quota Management
- Optimized UI

## [1.4.8]

- Add Gemini CLI provider
- Fix known issues
- Optimize Code

## [1.4.7]

- Fix model outputs Unix system commands causing PowerShell execution failure
- Add timeout for model request
- Optimize logs

## [1.4.6]

- Fix known issues

## [1.4.5]

- Prompts optimization
- Optimize logs

## [1.4.4]

- Add qwen25-vl-32b model info to support imege input
- Code optimization
- Fix known issues

## [1.4.3]

- Add clearHistory method for task history cleanup when reset extension
- Fix known issues

## [1.4.2]

- Update Costrict provider and error handling improvements
- Update vscode engine requirement to ^1.86.2

## [1.4.1]

- Update svg and add re-login button
- Adds onboarding messages and new settings descriptions
- Fix On-Premise model info
- Add window reload check for command availability

## [1.4.0]

- Sync upstream changes

## [1.3.3]

- Fixed the issue of exceeding file read limits under specific scenarios
- Added support for configuring custom OAuth2 endpoints

## [1.3.2]

- Remove unnecessary files to reduce the plugin size
- Disable request resending in automatic retry mode upon 400 responses from the backend

## [1.0.0]

- Initial release with code auto-completion support

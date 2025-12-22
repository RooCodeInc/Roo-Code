# CoStrict Change Log

## [2.1.2]

- Enhanced code review mode with improved UI behavior and provider support

## [2.1.1]

- Fix model response handling for "no tools used" scenarios
- Add comprehensive error handling utilities for different API providers
- Update UI components for better error display and user experience
- Fix telemetry client to send events through vscode.postMessage instead of posthog-js
- Update system prompts to use "Native fallback" instead of "XML fallback" as default
- Add internationalization updates for error messages in multiple languages
- Fix ModeSwitch component display issues
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/78dc34498be499cacd395bd7daf317fbbd1fbd8b)
- Fix known issues

## [2.1.0]

- Refactor: Convert claude-code models to dynamic loading with getClaudeCodeModels()
- Fix: Race condition in new_task tool for native protocol
- Add model-specific tool customization via excludedTools and includedTools
- Add customTools for opt-in only tools
- Add search_and_replace tool for batch text replacements
- Enable native tool support for DeepSeek, Doubao, Requesty, and multiple other providers
- Add native tool support to OpenAI-compatible providers, Vertex Gemini, Grok, Bedrock, and more
- Refactor: Terminal simplification (Vscode/JetBrains)
- Update i18n: Improve skipHint text clarity in multiple languages
- Refactor: Update scope prefix from roo_cline to costrict
- Update terminal test mocks and shell path handling
- Add ModeSwitch component to manage display modes in chat
- Optimize directory scanning by caching gitignore checks
- Enhance error messages and documentation links
- Remove line_count parameter from write_to_file tool
- Handle malformed native tool calls to prevent hanging
- Fix Vercel AI Gateway model fetching
- Add search_replace native tool for single-replacement operations
- Improve auto-approve timer visibility in follow-up suggestions
- Cancel auto-approval timeout when user starts typing
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/06c5c7f980b605a447eea8fa6818d98fcbc913f8)
- Fix known issues

## [2.0.27]

- Add tool result ID validation and fix mechanism to prevent ID mismatch issues in API requests
- Enhance maxTokens handling in ZgsmAiHandler and SettingsView components
- Improve code review event handling to prevent duplicate completions
- Optimize code review mode handling using reset functions for task completion and error states
- Enhance task error handling by including request IDs in streaming failure messages
- Add /dotest shortcut command and update mode configuration
- Reduce maximum non-busy terminal count from 5 to 3
- Fix disable handling logic in reasoning budget component
- Unify webview panel identifiers using consistent tabPanelId
- Add minimum and medium reasoning effort levels for Gemini
- Filter out non-Anthropic content blocks sent to Vertex API
- Fix test cases in terminal registry to adapt to new terminal limits
- Add rehype-sanitize and markdown error handling
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/f97b5155ac16290865af3016e2b7512e4bc9a389)
- Fix known issues

## [2.0.26]

- Add multiple-choice question tool for structured user input collection
- Enhance CoStrict provider with parallel tool calls support
- Add MCP support to workflow modes (requirements, design, tasks, testing, code)
- Improve terminal running state detection with platform-specific delays
- Update architect mode instructions to use /plans directory
- Add plans directory to .gitignore
- Fix Gemini transformer to gracefully skip unsupported content blocks
- Update system prompts and localization for multiple-choice feature
- Update apply_diff BUFFER_LINES
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/24eb6ae984cf2fb4300839f4e615393bd90918ff)

## [2.0.25]

- Refactor auto-completion
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/c103a4a639c54c67fb3e0210a0fe338c18496154)

## [2.0.24]

- Enhance model cache flushing mechanism to support optional configuration parameters
- Add "Plan" development mode
- Fix model cache race condition by preserving memory cache during refresh operations
- Remove deprecated insert_content tool logic and prompts
- Optimize apply-related tool validation to reduce errors from outdated monitoring rules
- Optimize bash.exe command rules for double-slash parameter cases
- Optimize tool invocation prompts for more flexible model tool usage
- Optimize context compression summary to prevent key information truncation and context corruption loops
- Optimize file editing behavior: treat identical AI edits as normal rather than errors to proceed with next steps
- Optimize inline terminal execution/termination logic for conversation stability
- Fix JetBrains shell integration compatibility (sync default shell changes from IDEA to plugin to avoid mismatched shell commands)
- Add conversation button to editor opentab top for user-friendly guidance
- Update gemini-cli gemini-3-pro-preview model
- Optimize JetBrains shell integration
- Improve JetBrains workflow compatibility
- Optimize statistics performance
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/1f7e1ee6304ad16a6261a4be2f233b7c183be29c)
- Fix known issues

## [2.0.23]

- Fix welcome page login url

## [2.0.22]

- Add JetBrains platform detection and disable unsupported VS Code features (code completion, CodeLens)
- Add editor type detection for API and Webview message handler
- Add mode preservation in code review service
- Add parameter support and proportional limits to file content reading
- Rebrand diff view scheme to costrict and improve wechat image styling
- Update rate limit default and optimize streaming-related components
- Adjust content limits and simplify prompts
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/873a763ea794b80265d965b2613e6eea5002e303)
- Fix known issues

## [2.0.21]

- Remove apiRequestBlockHide setting and related UI components

## [2.0.20]

- Update files prompt
- Update getSafeOperatingSystemName call in safe fallback for OS detection
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/4591e960ed08079c763c21ec205d1eea291f6c80)
- Fix known issues

## [2.0.19]

- Remove run_test action and simplify run_task action prompt

## [2.0.18]

- Add vibeplus built-in commands
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/5b64aa95f6ee67623099803784696cfd993d87d7)
- Fix known issues

## [2.0.17]

- Fix WriteToFileTool.handlePartial
- Update About page
- Fix finishSubTask no taskId when canceling or deleting tasks
- Fix user_feedback when readfile
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/a8a44510d5e3d92626e987d01796c1cbc82ceab2)
- Fix known issues

## [2.0.16]

- Added bidirectional navigation between parent and child tasks.
- Adapted to Browser Control 2.0.
- Added built-in openspec-init initialization command.
- Hid hint-type warnings to reduce noise.
- Strictly compatible with all attempt_completion formats to reduce unnecessary requests.
- Added compatibility for browser_action tool parameters, enabling small models to use the built-in browser tool.
- Fixed freeze issue when clicking Force Continue during command execution.
- Enabled chatbox input to write directly into the command line (note: inline terminal does not support sudo).
- Fixed deleted files appearing in context.
- Moved the MCP icon out of the collapse menu.
- Upgraded upstream repository dependencies to resolve file-encoding security issues.
- Improved JetBrains platform compatibility.
- Optimized duplicate shell terminal creation (limit up to 5 terminals).
- Added native tool support for CoStrict provider.
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/8949c2f6fed704399a115bbb269ba322944984ee)
- Fix known issues

## [2.0.15]

- Add user ID tracking to API requests
- Restore previous mode after review completion
- Add signal parameter support to provider completePrompt methods and improve request cancellation
- Enhance condition checks and error handling
- Enhance model info schema and update model fetching logic
- Update jetBrains code review config
- Update Gemini tool config
- Optimize modes defaultSelect
- Optimize build size
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/4ae0fc5f02dcac44204bd72fb09579e25a01e0dc)
- Fix codereview (#638)

## [2.0.14]

- Add api provider filtering for modes and workflow features
- Add commit review
- Add abort signal handling for streaming responses
- Optimize model display information calculation
- Optimize codereview
- Optimize UI identification for all models
- Optimize performance
- Update mcp dependencies
- Refactor follow-up auto-approval
- Remove unused TelemetryEventName import
- Update disclaimer section
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/f7c2e8d164eb53a4d13b6b7d672be473785d76eb)
- Fix known issues

## [2.0.13]

- Add additional notes on Windows `taskkill` argument behavior in bash
- Add API provider validation for code review features
- Optimize settings for batch saving
- Update branding and improve debounce timing
- Add notification service with banner
- Update UI style
- Updated internationalization
- Optimized performance
- Optimize PDF file processing
- Update default modelID to `Auto`
- Fix mcp timeout setting
- Fixed `zgsmAiCustomModelInfo` being overwritten
- Fix `openAiHeaders` being overwritten
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/4e6cdad052d9526a8d861c6a5fc02443e46646c1)
- Fix known issues

## [2.0.12]

- Fix codereview (#638)

## [2.0.11]

- Update docs
- Update error message
- Updated internationalization
- Optimize commands parsing
- Add purchase quota
- Fix message queue status inconsistency
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/6e6341346e7cf9813bec995134921ee503bf5a2a)
- Fix known issues

## [2.0.10]

- Update todolist ui
- Enhance attempt_completion parsing
- Optimize message retrieval
- Update error message
- Optimized tools prompts
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/4da9c3adb171dd83aed93039d686c466f1b9a378)
- Fix known issues

## [2.0.9]

- Update userinfo
- Optimize tools prompts
- Add 413 error handle
- Update mcp handle
- Optimize auto completion
- Optimize log output
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/63b4a785c1f31a4fc1c05968ae58d9dc02453e24)
- Fix known issues

## [2.0.8]

- Add mode parameter to ZgsmAiHandler
- Optimized codereview error handle
- Update wiki to v2
- Update file detail
- Optimized tools prompts
- Optimized shell config
- Fix eliminate UI flicker during task cancellation
- Update internationalization of agents
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/6965e5c791b4514f8f83b881a08091b4d2fbaa9a)
- Fix known issues

## [2.0.7]

- Delete legacy api and add timeout handling
- Add auto discount
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/5fb36d9c852f412d05e2e980b8af11b28ef30a3f)
- Fix known issues

## [2.0.6]

- Optimized auto completion
- simplify custom instructions
- Updated zgsm provider default temperature
- Optimized logging
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/ca10cba3c4634d8b15e83423ea7abb374a3f82b6)
- Fix known issues

## [2.0.5]

- Optimized request sending speed
- Reduced file read/write handle usage
- Optimized shell/non-shell integration compatibility and command execution efficiency
- Updated brand name to CoStrict
- Compatible with [jetbrains codereview](https://github.com/zgsm-ai/costrict-jetbrains-agent)
- Added review mode request headers
- Optimized static file size
- Optimized conversation memory usage
- Fixed background silent editing Chinese encoding issues
- Optimized shell integration prompts
- Optimized readfile prompts
- Optimized tool logs
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/ff0c65af10064cc63626ce500800a8c388a1c6b4)
- Fix known issues

## [2.0.4]

- Add support for project spec commands from .cospec directory (#583)
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/97331bcb2edbaece9a395ae20a3db05fffef8fc5)
- Fix known issues

## [2.0.3]

- Add mode toggle with vibe/strict options in ModeSelector (#564)
- Fix: update isInvalidId function to include additional invalid machine ID (#567)
- Add error tracking with raw error storage enhancement (#569)
- Add client ID header to API requests for completion (#570)
- Refactor code-review to simplify startReview method (#572)
- Add cursor positioning to first change after file save (#573)
- Update default limits and delays, refactor follow-up countdown handling (#575)
- Fix K2 model output truncation
- Optimized CodeReview
- Updated workflow prompts
- Optimized api request performance and memory usage
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/ab9a48578c02f28403dd5644781ecd07d0c82a84)
- Fix known issues

## [2.0.2]

- Optimized CodeReview
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/270dce5050f270aa30a2b39f5a84b931525a7a22)
- Fix known issues

## [2.0.1]

- Optimized performance
- Optimized CodeReview
- Add TestGuide agent
- Refactored project wiki command
- Optimized project wiki prompts
- Added codebase fix functionality
- Updated workflow prompts
- Updated internationalization
- Updated default model ID（GLM-4.5）
- Increase context window size for ZGSM provider
- Fix known issues

## [2.0.0]

- Add workflow with requirements, design, tasks, and testing support
- Add test guide functionality for project testing solutions
- Add project wiki generation
- Add development modes: Vibe and Strict
- Improve type definitions and global settings
- Add AI-assisted review suggestion
- Add commit model setting
- Optimization CoStrict provider api performance
- Fix known issues

## [1.6.19]

- Optimized gemini-cli provider
- Optimized shell prompts
- Sync roocode [last commit](https://github.com/zgsm-ai/costrict/commit/507a600ee99faa4fc02fc446f90b9a7a82ce71a5)
- Fix known issues

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

- Adds models refresh for CoStrict provider
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

- Update CoStrict provider and error handling improvements
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

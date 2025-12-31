# Roo Code Changelog

## [3.38.2] - 2025-12-31

![3.38.2 Release - Skill Alignment](/releases/3.38.2-release.png)

- Align skills system with Agent Skills specification (PR #10409 by @hannesrudolph)
- Prevent write_to_file from creating files at truncated paths (PR #10415 by @mrubens and @daniel-lxs)
- Update Cerebras maxTokens to 16384 (PR #10387 by @sebastiand-cerebras)
- Fix rate limit wait display (PR #10389 by @hannesrudolph)
- Remove human-relay provider (PR #10388 by @hannesrudolph)
- Replace Todo Lists video with Context Management video in documentation (PR #10375 by @SannidhyaSah)

## [3.38.1] - 2025-12-29

![3.38.1 Release - Bug Fixes and Stability](/releases/3.38.1-release.png)

- Fix: Flush pending tool results before condensing context (PR #10379 by @daniel-lxs)
- Fix: Revert mergeToolResultText for OpenAI-compatible providers (PR #10381 by @hannesrudolph)
- Fix: Enforce maxConcurrentFileReads limit in read_file tool (PR #10363 by @roomote)
- Fix: Improve feedback message when read_file is used on a directory (PR #10371 by @roomote)
- Fix: Handle custom tool use similarly to MCP tools for IPC schema purposes (PR #10364 by @jr)
- Fix: Correct GitHub repository URL in marketing page (#10376 by @jishnuteegala, PR #10377 by @roomote)
- Docs: Clarify path to Security Settings in privacy policy (PR #10367 by @roomote)

## [3.38.0] - 2025-12-27

![3.38.0 Release - Skills](/releases/3.38.0-release.png)

- Add support for [Agent Skills](https://agentskills.io/), enabling reusable packages of prompts, tools, and resources to extend Roo's capabilities (PR #10335 by @mrubens)
- Add optional mode field to slash command front matter, allowing commands to automatically switch to a specific mode when triggered (PR #10344 by @app/roomote)
- Add support for npm packages and .env files to custom tools, allowing custom tools to import dependencies and access environment variables (PR #10336 by @cte)
- Remove simpleReadFileTool feature, streamlining the file reading experience (PR #10254 by @app/roomote)
- Remove OpenRouter Transforms feature (PR #10341 by @app/roomote)
- Fix mergeToolResultText handling in Roo provider (PR #10359 by @mrubens)

## [3.37.1] - 2025-12-23

![3.37.1 Release - Tool Fixes and Provider Improvements](/releases/3.37.1-release.png)

- Fix: Send native tool definitions by default for OpenAI to ensure proper tool usage (PR #10314 by @hannesrudolph)
- Fix: Preserve reasoning_details shape to prevent malformed responses when processing model output (PR #10313 by @hannesrudolph)
- Fix: Drain queued messages while waiting for ask to prevent message loss (PR #10315 by @hannesrudolph)
- Feat: Add grace retry for empty assistant messages to improve reliability (PR #10297 by @hannesrudolph)
- Feat: Enable mergeToolResultText for all OpenAI-compatible providers for better tool result handling (PR #10299 by @hannesrudolph)
- Feat: Enable mergeToolResultText for Roo Code Cloud provider (PR #10301 by @hannesrudolph)
- Feat: Strengthen native tool-use guidance in prompts for improved model behavior (PR #10311 by @hannesrudolph)
- UX: Account-centric signup flow for improved onboarding experience (PR #10306 by @brunobergher)

## [3.37.0] - 2025-12-22

![3.37.0 Release - Custom Tool Calling](/releases/3.37.0-release.png)

- Add MiniMax M2.1 and improve environment_details handling for Minimax thinking models (PR #10284 by @hannesrudolph)
- Add GLM-4.7 model with thinking mode support for Zai provider (PR #10282 by @hannesrudolph)
- Add experimental custom tool calling - define custom tools that integrate seamlessly with your AI workflow (PR #10083 by @cte)
- Deprecate XML tool protocol selection and force native tool format for new tasks (PR #10281 by @daniel-lxs)
- Fix: Emit tool_call_end events in OpenAI handler when streaming ends (#10275 by @torxeon, PR #10280 by @daniel-lxs)
- Fix: Emit tool_call_end events in BaseOpenAiCompatibleProvider (PR #10293 by @hannesrudolph)
- Fix: Disable strict mode for MCP tools to preserve optional parameters (PR #10220 by @daniel-lxs)
- Fix: Move array-specific properties into anyOf variant in normalizeToolSchema (PR #10276 by @daniel-lxs)
- Fix: Add CRLF line ending normalization to search_replace and search_and_replace tools (PR #10288 by @hannesrudolph)
- Fix: Add graceful fallback for model parsing in Chutes provider (PR #10279 by @hannesrudolph)
- Fix: Enable Requesty refresh models with credentials (PR #10273 by @daniel-lxs)
- Fix: Improve reasoning_details accumulation and serialization (PR #10285 by @hannesrudolph)
- Fix: Preserve reasoning_content in condense summary for DeepSeek-reasoner (PR #10292 by @hannesrudolph)
- Refactor Zai provider to merge environment_details into tool result instead of system message (PR #10289 by @hannesrudolph)
- Remove parallel_tool_calls parameter from litellm provider (PR #10274 by @roomote)
- Add Cloud Team page with comprehensive team management features (PR #10267 by @roomote)
- Add message log deduper utility for evals (PR #10286 by @hannesrudolph)

## [3.36.16] - 2025-12-19

- Fix: Normalize tool schemas for VS Code LM API to resolve error 400 when using VS Code Language Model API providers (PR #10221 by @hannesrudolph)

## [3.36.15] - 2025-12-19

![3.36.15 Release - 1M Context Window Support](/releases/3.36.15-release.png)

- Add 1M context window beta support for Claude Sonnet 4 on Vertex AI, enabling significantly larger context for complex tasks (PR #10209 by @hannesrudolph)
- Add native tool calling support for LM Studio and Qwen-Code providers, improving compatibility with local models (PR #10208 by @hannesrudolph)
- Add native tool call defaults for OpenAI-compatible providers, expanding native function calling across more configurations (PR #10213 by @hannesrudolph)
- Enable native tool calls for Requesty provider (PR #10211 by @daniel-lxs)
- Improve API error handling and visibility with clearer error messages and better user feedback (PR #10204 by @brunobergher)
- Add downloadable error diagnostics from chat errors, making it easier to troubleshoot and report issues (PR #10188 by @brunobergher)
- Fix refresh models button not properly flushing the cache, ensuring model lists update correctly (#9682 by @tl-hbk, PR #9870 by @pdecat)
- Fix additionalProperties handling for strict mode compatibility, resolving schema validation issues with certain providers (PR #10210 by @daniel-lxs)

## [3.36.14] - 2025-12-18

![3.36.14 Release - Native Tool Calling for Claude on Vertex AI](/releases/3.36.14-release.png)

- Add native tool calling support for Claude models on Vertex AI, enabling more efficient and reliable tool interactions (PR #10197 by @hannesrudolph)
- Fix JSON Schema format value stripping for OpenAI compatibility, resolving issues with unsupported format values (PR #10198 by @daniel-lxs)
- Improve "no tools used" error handling with graceful retry mechanism for better reliability when tools fail to execute (PR #10196 by @hannesrudolph)

## [3.36.13] - 2025-12-18

![3.36.13 Release - Native Tool Protocol](/releases/3.36.13-release.png)

- Change default tool protocol from XML to native for improved reliability and performance (PR #10186 by @mrubens)
- Add native tool support for VS Code Language Model API providers (PR #10191 by @daniel-lxs)
- Lock task tool protocol for consistent task resumption, ensuring tasks resume with the same protocol they started with (PR #10192 by @daniel-lxs)
- Replace edit_file tool alias with actual edit_file tool for improved diff editing capabilities (PR #9983 by @hannesrudolph)
- Fix LiteLLM router models by merging default model info for native tool calling support (PR #10187 by @daniel-lxs)
- Add PostHog exception tracking for consecutive mistake errors to improve error monitoring (PR #10193 by @daniel-lxs)

## [3.36.12] - 2025-12-18

![3.36.12 Release - Better telemetry and Bedrock fixes](/releases/3.36.12-release.png)

- Fix: Add userAgentAppId to Bedrock embedder for code indexing (#10165 by @jackrein, PR #10166 by @roomote)
- Update OpenAI and Gemini tool preferences for improved model behavior (PR #10170 by @hannesrudolph)
- Extract error messages from JSON payloads for better PostHog error grouping (PR #10163 by @daniel-lxs)

## [3.36.11] - 2025-12-17

![3.36.11 Release - Native Tool Calling Enhancements](/releases/3.36.11-release.png)

- Add support for Claude Code Provider native tool calling, improving tool execution performance and reliability (PR #10077 by @hannesrudolph)
- Enable native tool calling by default for Z.ai models for better model compatibility (PR #10158 by @app/roomote)
- Enable native tools by default for OpenAI compatible provider to improve tool calling support (PR #10159 by @daniel-lxs)
- Fix: Normalize MCP tool schemas for Bedrock and OpenAI strict mode to ensure proper tool compatibility (PR #10148 by @daniel-lxs)
- Fix: Remove dots and colons from MCP tool names for Bedrock compatibility (PR #10152 by @daniel-lxs)
- Fix: Convert tool_result to XML text when native tools disabled for Bedrock (PR #10155 by @daniel-lxs)
- Fix: Refresh Roo models cache with session token on auth state change to resolve model list refresh issues (PR #10156 by @daniel-lxs)
- Fix: Support AWS GovCloud and China region ARNs in Bedrock provider for expanded regional support (PR #10157 by @app/roomote)

## [3.36.10] - 2025-12-17

![3.36.10 Release - Gemini 3 Flash Preview](/releases/3.36.10-release.png)

- Add support for Gemini 3 Flash Preview model in the Gemini provider (PR #10151 by @hannesrudolph)
- Implement interleaved thinking mode for DeepSeek Reasoner, enabling streaming reasoning output (PR #9969 by @hannesrudolph)
- Fix: Preserve reasoning_content during tool call sequences in DeepSeek (PR #10141 by @hannesrudolph)
- Fix: Correct token counting for context truncation display (PR #9961 by @hannesrudolph)
- Update Next.js dependency to ~15.2.8 (PR #10140 by @jr)

## [3.36.9] - 2025-12-15

![3.36.9 Release - Cross-Provider Compatibility](/releases/3.36.9-release.png)

- Fix: Normalize tool call IDs for cross-provider compatibility via OpenRouter, ensuring consistent handling across different AI providers (PR #10102 by @daniel-lxs)
- Fix: Add additionalProperties: false to nested MCP tool schemas, improving schema validation and preventing unexpected properties (PR #10109 by @daniel-lxs)
- Fix: Validate tool_result IDs in delegation resume flow, preventing errors when resuming delegated tasks (PR #10135 by @daniel-lxs)
- Feat: Add full error details to streaming failure dialog, providing more comprehensive information for debugging streaming issues (PR #10131 by @roomote)
- Feat: Improve evals UI with tool groups and duration fix, enhancing the evaluation interface organization and timing accuracy (PR #10133 by @hannesrudolph)

## [3.36.8] - 2025-12-16

![3.36.8 Release - Native Tools Enabled by Default](/releases/3.36.8-release.png)

- Implement incremental token-budgeted file reading for smarter, more efficient file content retrieval (PR #10052 by @jr)
- Enable native tools by default for multiple providers including OpenAI, Azure, Google, Vertex, and more (PR #10059 by @daniel-lxs)
- Enable native tools by default for Anthropic and add telemetry tracking for tool format usage (PR #10021 by @daniel-lxs)
- Fix: Prevent race condition from deleting wrong API messages during streaming (PR #10113 by @hannesrudolph)
- Fix: Prevent duplicate MCP tools error by deduplicating servers at source (PR #10096 by @daniel-lxs)
- Remove strict ARN validation for Bedrock custom ARN users allowing more flexibility (#10108 by @wisestmumbler, PR #10110 by @roomote)
- Add metadata to error details dialog for improved debugging (PR #10050 by @roomote)
- Add configuration to control public sharing feature (PR #10105 by @mrubens)
- Remove description from Bedrock service tiers for cleaner UI (PR #10118 by @mrubens)
- Fix: Correct link to provider pricing page on web (PR #10107 by @brunobergher)

## [3.36.7] - 2025-12-15

- Improve tool configuration for OpenAI models in OpenRouter (PR #10082 by @hannesrudolph)
- Capture more detailed provider-specific error information from OpenRouter for better debugging (PR #10073 by @jr)
- Add Amazon Nova 2 Lite model to Bedrock provider (#9802 by @Smartsheet-JB-Brown, PR #9830 by @roomote)
- Add AWS Bedrock service tier support (#9874 by @Smartsheet-JB-Brown, PR #9955 by @roomote)
- Remove auto-approve toggles for to-do and retry actions to simplify the approval workflow (PR #10062 by @hannesrudolph)
- Move isToolAllowedForMode out of shared directory for better code organization (PR #10089 by @cte)
- Improve run logs and formatters in web-evals for better evaluation tracking (PR #10081 by @hannesrudolph)

## [3.36.6] - 2025-12-12

![3.36.6 Release - Tool Alias Support](/releases/3.36.6-release.png)

- Add tool alias support for model-specific tool customization, allowing users to configure how tools are presented to different AI models (PR #9989 by @daniel-lxs)
- Sanitize MCP server and tool names for API compatibility, ensuring special characters don't cause issues with API calls (PR #10054 by @daniel-lxs)
- Improve auto-approve timer visibility in follow-up suggestions for better user awareness of pending actions (PR #10048 by @brunobergher)
- Fix: Cancel auto-approval timeout when user starts typing, preventing accidental auto-approvals during user interaction (PR #9937 by @roomote)
- Add WorkspaceTaskVisibility type for organization cloud settings to support team visibility controls (PR #10020 by @roomote)
- Fix: Extract raw error message from OpenRouter metadata for clearer error reporting (PR #10039 by @daniel-lxs)
- Fix: Show tool protocol dropdown for LiteLLM provider, restoring missing configuration option (PR #10053 by @daniel-lxs)

## [3.36.5] - 2025-12-11

![3.36.5 Release - GPT-5.2](/releases/3.36.5-release.png)

- Add: GPT-5.2 model to openai-native provider (PR #10024 by @hannesrudolph)
- Add: Toggle for Enter key behavior in chat input allowing users to configure whether Enter sends or creates new line (#8555 by @lmtr0, PR #10002 by @hannesrudolph)
- Add: App version to telemetry exception captures and filter 402 errors (PR #9996 by @daniel-lxs)
- Fix: Handle empty Gemini responses and reasoning loops to prevent infinite retries (PR #10007 by @hannesrudolph)
- Fix: Add missing tool_result blocks to prevent API errors when tool results are expected (PR #10015 by @daniel-lxs)
- Fix: Filter orphaned tool_results when more results than tool_uses to prevent message validation errors (PR #10027 by @daniel-lxs)
- Fix: Add general API endpoints for Z.ai provider (#9879 by @richtong, PR #9894 by @roomote)
- Fix: Apply versioned settings on nightly builds (PR #9997 by @hannesrudolph)
- Remove: Glama provider (PR #9801 by @hannesrudolph)
- Remove: Deprecated list_code_definition_names tool (PR #10005 by @hannesrudolph)

## [3.36.4] - 2025-12-10

![3.36.4 Release - Error Details Modal](/releases/3.36.4-release.png)

- Add error details modal with on-demand display for improved error visibility when debugging issues (PR #9985 by @roomote)
- Fix: Prevent premature rawChunkTracker clearing for MCP tools, improving reliability of MCP tool streaming (PR #9993 by @daniel-lxs)
- Fix: Filter out 429 rate limit errors from API error telemetry for cleaner metrics (PR #9987 by @daniel-lxs)
- Fix: Correct TODO list display order in chat view to show items in proper sequence (PR #9991 by @roomote)

## [3.36.3] - 2025-12-09

![3.36.3 Release](/releases/3.36.3-release.png)

- Refactor: Unified context-management architecture with improved UX for better context control (PR #9795 by @hannesrudolph)
- Add new `search_replace` native tool for single-replacement operations with improved editing precision (PR #9918 by @hannesrudolph)
- Streaming tool stats and token usage throttling for better real-time feedback during generation (PR #9926 by @hannesrudolph)
- Add versioned settings support with minPluginVersion gating for Roo provider (PR #9934 by @hannesrudolph)
- Make Architect mode save plans to `/plans` directory and gitignore it (PR #9944 by @brunobergher)
- Add announcement support CTA and social icons to UI (PR #9945 by @hannesrudolph)
- Add ability to save screenshots from the browser tool (PR #9963 by @mrubens)
- Refactor: Decouple tools from system prompt for cleaner architecture (PR #9784 by @daniel-lxs)
- Update DeepSeek models to V3.2 with new pricing (PR #9962 by @hannesrudolph)
- Add minimal and medium reasoning effort levels for Gemini models (PR #9973 by @hannesrudolph)
- Update xAI models catalog with latest model options (PR #9872 by @hannesrudolph)
- Add DeepSeek V3-2 support for Baseten provider (PR #9861 by @AlexKer)
- Tweaks to Baseten model definitions for better defaults (PR #9866 by @mrubens)
- Fix: Add xhigh reasoning effort support for gpt-5.1-codex-max (#9891 by @andrewginns, PR #9900 by @andrewginns)
- Fix: Add Kimi, MiniMax, and Qwen model configurations for Bedrock (#9902 by @jbearak, PR #9905 by @app/roomote)
- Configure tool preferences for xAI models (PR #9923 by @hannesrudolph)
- Default to using native tools when supported on OpenRouter (PR #9878 by @mrubens)
- Fix: Exclude apply_diff from native tools when diffEnabled is false (#9919 by @denis-kudelin, PR #9920 by @app/roomote)
- Fix: Always show tool protocol selector for openai-compatible provider (#9965 by @bozoweed, PR #9966 by @hannesrudolph)
- Fix: Respect explicit supportsReasoningEffort array values for proper model configuration (PR #9970 by @hannesrudolph)
- Add timeout configuration to OpenAI Compatible Provider Client (PR #9898 by @dcbartlett)
- Revert default tool protocol change from xml to native for stability (PR #9956 by @mrubens)
- Remove defaultTemperature from Roo provider configuration (PR #9932 by @mrubens)
- Improve OpenAI error messages to be more useful for debugging (PR #9639 by @mrubens)
- Better error logs for parseToolCall exceptions (PR #9857 by @cte)
- Improve cloud job error logging for RCC provider errors (PR #9924 by @cte)
- Fix: Display actual API error message instead of generic text on retry (PR #9954 by @hannesrudolph)
- Add API error telemetry to OpenRouter provider for better diagnostics (PR #9953 by @daniel-lxs)
- Fix: Sanitize removed/invalid API providers to prevent infinite loop (PR #9869 by @hannesrudolph)
- Fix: Use foreground color for context-management icons (PR #9912 by @hannesrudolph)
- Fix: Suppress 'ask promise was ignored' error in handleError (PR #9914 by @daniel-lxs)
- Fix: Process finish_reason to emit tool_call_end events properly (PR #9927 by @daniel-lxs)
- Fix: Add finish_reason processing to xai.ts provider (PR #9929 by @daniel-lxs)
- Fix: Validate and fix tool_result IDs before API requests (PR #9952 by @daniel-lxs)
- Fix: Return undefined instead of 0 for disabled API timeout (PR #9960 by @hannesrudolph)
- Stop making unnecessary count_tokens requests for better performance (PR #9884 by @mrubens)
- Refactor: Consolidate ThinkingBudget components and fix disable handling (PR #9930 by @hannesrudolph)
- Forbid time estimates in architect mode for more focused planning (PR #9931 by @app/roomote)
- Web: Add product pages (PR #9865 by @brunobergher)
- Make eval runs deleteable in the web UI (PR #9909 by @mrubens)
- Feat: Change defaultToolProtocol default from xml to native (later reverted) (PR #9892 by @app/roomote)

## [3.36.2] - 2025-12-04

![3.36.2 Release - Dynamic API Settings](/releases/3.36.2-release.png)

- Restrict GPT-5 tool set to apply_patch for improved compatibility (PR #9853 by @hannesrudolph)
- Add dynamic settings support for Roo models from API, allowing model-specific configurations to be fetched dynamically (PR #9852 by @hannesrudolph)
- Fix: Resolve Chutes provider model fetching issue (PR #9854 by @cte)

## [3.36.1] - 2025-12-04

![3.36.1 Release - Message Management & Stability Improvements](/releases/3.36.1-release.png)

- Add MessageManager layer for centralized history coordination, fixing message synchronization issues (PR #9842 by @hannesrudolph)
- Fix: Prevent cascading truncation loop by only truncating visible messages (PR #9844 by @hannesrudolph)
- Fix: Handle unknown/invalid native tool calls to prevent extension freeze (PR #9834 by @daniel-lxs)
- Always enable reasoning for models that require it (PR #9836 by @cte)
- ChatView: Smoother stick-to-bottom behavior during streaming (PR #8999 by @hannesrudolph)
- UX: Improved error messages and documentation links (PR #9777 by @brunobergher)
- Fix: Overly round follow-up question suggestions styling (PR #9829 by @brunobergher)
- Add symlink support for slash commands in .roo/commands folder (PR #9838 by @mrubens)
- Ignore input to the execa terminal process for safer command execution (PR #9827 by @mrubens)
- Be safer about large file reads (PR #9843 by @jr)
- Add gpt-5.1-codex-max model to OpenAI provider (PR #9848 by @hannesrudolph)
- Evals UI: Add filtering, bulk delete, tool consolidation, and run notes (PR #9837 by @hannesrudolph)
- Evals UI: Add multi-model launch and UI improvements (PR #9845 by @hannesrudolph)
- Web: New pricing page (PR #9821 by @brunobergher)

## [3.36.0] - 2025-12-04

![3.36.0 Release - Rewind Kangaroo](/releases/3.36.0-release.png)

- Fix: Restore context when rewinding after condense (#8295 by @hannesrudolph, PR #9665 by @hannesrudolph)
- Add reasoning_details support to Roo provider for enhanced model reasoning visibility (PR #9796 by @app/roomote)
- Default to native tools for all models in the Roo provider for improved performance (PR #9811 by @mrubens)
- Enable search_and_replace for Minimax models (PR #9780 by @mrubens)
- Fix: Resolve Vercel AI Gateway model fetching issues (PR #9791 by @cte)
- Fix: Apply conservative max tokens for Cerebras provider (PR #9804 by @sebastiand-cerebras)
- Fix: Remove omission detection logic to eliminate false positives (#9785 by @Michaelzag, PR #9787 by @app/roomote)
- Refactor: Remove deprecated insert_content tool (PR #9751 by @daniel-lxs)
- Chore: Hide parallel tool calls experiment and disable feature (PR #9798 by @hannesrudolph)
- Update next.js documentation site dependencies (PR #9799 by @jr)
- Fix: Correct download count display on homepage (PR #9807 by @mrubens)

## [3.35.5] - 2025-12-03

- Feat: Add provider routing selection for OpenRouter embeddings (#9144 by @SannidhyaSah, PR #9693 by @SannidhyaSah)
- Default Minimax M2 to native tool calling (PR #9778 by @mrubens)
- Sanitize the native tool calls to fix a bug with Gemini (PR #9769 by @mrubens)
- UX: Updates to CloudView (PR #9776 by @roomote)

## [3.35.4] - 2025-12-02

- Fix: Handle malformed native tool calls to prevent hanging (PR #9758 by @daniel-lxs)
- Fix: Remove reasoning toggles for GLM-4.5 and GLM-4.6 on z.ai provider (PR #9752 by @roomote)
- Refactor: Remove line_count parameter from write_to_file tool (PR #9667 by @hannesrudolph)

## [3.35.3] - 2025-12-02

- Switch to new welcome view for improved onboarding experience (PR #9741 by @mrubens)
- Update homepage with latest changes (PR #9675 by @brunobergher)
- Improve privacy for stealth models by adding vendor confidentiality section to system prompt (PR #9742 by @mrubens)

## [3.35.2] - 2025-12-01

![3.35.2 Release - Model Default Temperatures](/releases/3.35.2-release.png)

- Allow models to contain default temperature settings for provider-specific optimal defaults (PR #9734 by @mrubens)
- Add tag-based native tool calling detection for Roo provider models (PR #9735 by @mrubens)
- Enable native tool support for all LiteLLM models by default (PR #9736 by @mrubens)
- Pass app version to provider for improved request tracking (PR #9730 by @cte)

## [3.35.1] - 2025-12-01

- Fix: Flush pending tool results before task delegation (PR #9726 by @daniel-lxs)
- Improve: Better IPC error logging for easier debugging (PR #9727 by @cte)

## [3.35.0] - 2025-12-01

![3.35.0 Release - Subtasks & Native Tools](/releases/3.35.0-release.png)

- Metadata-driven subtasks with automatic parent resume and single-open safety for improved task orchestration (#8081 by @hannesrudolph, PR #9090 by @hannesrudolph)
- Native tool calling support expanded across many providers: Bedrock (PR #9698 by @mrubens), Cerebras (PR #9692 by @mrubens), Chutes with auto-detection from API (PR #9715 by @daniel-lxs), DeepInfra (PR #9691 by @mrubens), DeepSeek and Doubao (PR #9671 by @daniel-lxs), Groq (PR #9673 by @daniel-lxs), LiteLLM (PR #9719 by @daniel-lxs), Ollama (PR #9696 by @mrubens), OpenAI-compatible providers (PR #9676 by @daniel-lxs), Requesty (PR #9672 by @daniel-lxs), Unbound (PR #9699 by @mrubens), Vercel AI Gateway (PR #9697 by @mrubens), Vertex Gemini (PR #9678 by @daniel-lxs), and xAI with new Grok 4 Fast and Grok 4.1 Fast models (PR #9690 by @mrubens)
- Fix: Preserve tool_use blocks in summary for parallel tool calls (#9700 by @SilentFlower, PR #9714 by @SilentFlower)
- Default Grok Code Fast to native tools for better performance (PR #9717 by @mrubens)
- UX improvements to the Roo Code Cloud provider-centric onboarding flow (PR #9709 by @brunobergher)
- UX toolbar cleanup and settings consolidation for a cleaner interface (PR #9710 by @brunobergher)
- Add model-specific tool customization via `excludedTools` and `includedTools` configuration (PR #9641 by @daniel-lxs)
- Add new `apply_patch` native tool for more efficient file editing operations (PR #9663 by @hannesrudolph)
- Add new `search_and_replace` tool for batch text replacements across files (PR #9549 by @hannesrudolph)
- Add debug buttons to view API and UI history for troubleshooting (PR #9684 by @hannesrudolph)
- Include tool format in environment details for better context awareness (PR #9661 by @mrubens)
- Fix: Display install count in millions instead of thousands (PR #9677 by @app/roomote)
- Web-evals improvements: add task log viewing, export failed logs, and new run options (PR #9637 by @hannesrudolph)
- Web-evals updates: add kill run functionality (PR #9681 by @hannesrudolph)
- Fix: Prevent navigation buttons from wrapping on smaller screens (PR #9721 by @app/roomote)

## [3.34.8] - 2025-11-27

![3.34.8 Release - Race Condition Fix](/releases/3.34.8-release.png)

- Fix: Race condition in new_task tool for native protocol (PR #9655 by @daniel-lxs)

## [3.34.7] - 2025-11-27

![3.34.7 Release - More Native Tool Integrations](/releases/3.34.7-release.png)

- Support native tools in the Anthropic provider for improved tool calling (PR #9644 by @mrubens)
- Enable native tool calling for z.ai models (PR #9645 by @mrubens)
- Enable native tool calling for Moonshot models (PR #9646 by @mrubens)
- Fix: OpenRouter tool calls handling improvements (PR #9642 by @mrubens)
- Fix: OpenRouter GPT-5 strict schema validation for read_file tool (PR #9633 by @daniel-lxs)
- Fix: Create parent directories early in write_to_file to prevent ENOENT errors (#9634 by @ivanenev, PR #9640 by @daniel-lxs)
- Fix: Disable native tools and temperature support for claude-code provider (PR #9643 by @hannesrudolph)
- Add 'taking you to cloud' screen after provider welcome for improved onboarding (PR #9652 by @mrubens)

## [3.34.6] - 2025-11-26

![3.34.6 Release - Bedrock Embeddings](/releases/3.34.6-release.png)

- Add support for AWS Bedrock embeddings in code indexing (#8658 by @kyle-hobbs, PR #9475 by @ggoranov-smar)
- Add native tool calling support for Mistral provider (PR #9625 by @hannesrudolph)
- Wire MULTIPLE_NATIVE_TOOL_CALLS experiment to OpenAI parallel_tool_calls for parallel tool execution (PR #9621 by @hannesrudolph)
- Add fine grained tool streaming for OpenRouter Anthropic (PR #9629 by @mrubens)
- Allow global inference selection for Bedrock when cross-region is enabled (PR #9616 by @roomote)
- Fix: Filter non-Anthropic content blocks before sending to Vertex API (#9583 by @cardil, PR #9618 by @hannesrudolph)
- Fix: Restore content undefined check in WriteToFileTool.handlePartial() (#9611 by @Lissanro, PR #9614 by @daniel-lxs)
- Fix: Prevent model cache from persisting empty API responses (#9597 by @zx2021210538, PR #9623 by @daniel-lxs)
- Fix: Exclude access_mcp_resource tool when MCP has no resources (PR #9615 by @daniel-lxs)
- Fix: Update default settings for inline terminal and codebase indexing (PR #9622 by @roomote)
- Fix: Convert line_ranges strings to lineRanges objects in native tool calls (PR #9627 by @daniel-lxs)
- Fix: Defer new_task tool_result until subtask completes for native protocol (PR #9628 by @daniel-lxs)

## [3.34.5] - 2025-11-25

![3.34.5 Release - Experimental Parallel Tool Calling](/releases/3.34.5-release.png)

- Experimental feature to enable multiple native tool calls per turn (PR #9273 by @daniel-lxs)
- Add Bedrock Opus 4.5 to global inference model list (PR #9595 by @roomote)
- Fix: Update API handler when toolProtocol changes (PR #9599 by @mrubens)
- Set native tools as default for minimax-m2 and claude-haiku-4.5 (PR #9586 by @daniel-lxs)
- Make single file read only apply to XML tools (PR #9600 by @mrubens)
- Enhance web-evals dashboard with dynamic tool columns and UX improvements (PR #9592 by @hannesrudolph)
- Revert "Add support for Roo Code Cloud as an embeddings provider" while we fix some issues (PR #9602 by @mrubens)

## [3.34.4] - 2025-11-25

![3.34.4 Release - BFL Image Generation](/releases/3.34.4-release.png)

- Add new Black Forest Labs image generation models, free on Roo Code Cloud and also available on OpenRouter (PR #9587 and #9589 by @mrubens)
- Fix: Preserve dynamic MCP tool names in native mode API history to prevent tool name mismatches (PR #9559 by @daniel-lxs)
- Fix: Preserve tool_use blocks in summary message during condensing with native tools to maintain conversation context (PR #9582 by @daniel-lxs)

## [3.34.3] - 2025-11-25

![3.34.3 Release - Streaming and Opus 4.5](/releases/3.34.3-release.png)

- Implement streaming for native tool calls, providing real-time feedback during tool execution (PR #9542 by @daniel-lxs)
- Add Claude Opus 4.5 model to Claude Code provider (PR #9560 by @mrubens)
- Add Claude Opus 4.5 model to Bedrock provider (#9571 by @pisicode, PR #9572 by @roomote)
- Enable caching for Opus 4.5 model to improve performance (#9567 by @iainRedro, PR #9568 by @roomote)
- Add support for Roo Code Cloud as an embeddings provider (PR #9543 by @mrubens)
- Fix ask_followup_question streaming issue and add missing tool cases (PR #9561 by @daniel-lxs)
- Add contact links to About Roo Code settings page (PR #9570 by @roomote)
- Switch from asdf to mise-en-place in bare-metal evals setup script (PR #9548 by @cte)

## [3.34.2] - 2025-11-24

![3.34.2 Release - Opus Conductor](/releases/3.34.2-release.png)

- Add support for Claude Opus 4.5 in Anthropic and Vertex providers (PR #9541 by @daniel-lxs)
- Add support for Claude Opus 4.5 in OpenRouter with prompt caching and reasoning budget (PR #9540 by @daniel-lxs)
- Add Roo Code Cloud as an image generation provider (PR #9528 by @mrubens)
- Fix: Gracefully skip unsupported content blocks in Gemini transformer (PR #9537 by @daniel-lxs)
- Fix: Flush LiteLLM cache when credentials change on refresh (PR #9536 by @daniel-lxs)
- Fix: Ensure XML parser state matches tool protocol on config update (PR #9535 by @daniel-lxs)
- Update Cerebras models (PR #9527 by @sebastiand-cerebras)
- Fix: Support reasoning_details format for Gemini 3 models (PR #9506 by @daniel-lxs)

## [3.34.1] - 2025-11-23

- Show the prompt for image generation in the UI (PR #9505 by @mrubens)
- Fix double todo list display issue (PR #9517 by @mrubens)
- Add tracking for cloud synced messages (PR #9518 by @mrubens)
- Enable the Roo Code Cloud provider in evals (PR #9492 by @cte)

## [3.34.0] - 2025-11-21

![3.34.0 Release - Browser Use 2.0](/releases/3.34.0-release.png)

- Add Browser Use 2.0 with enhanced browser interaction capabilities (PR #8941 by @hannesrudolph)
- Add support for Baseten as a new AI provider (PR #9461 by @AlexKer)
- Improve base OpenAI compatible provider with better error handling and configuration (PR #9462 by @mrubens)
- Add provider-oriented welcome screen to improve onboarding experience (PR #9484 by @mrubens)
- Pin Roo provider to the top of the provider list for better discoverability (PR #9485 by @mrubens)
- Enhance native tool descriptions with examples and clarifications for better AI understanding (PR #9486 by @daniel-lxs)
- Fix: Make cancel button immediately responsive during streaming (#9435 by @jwadow, PR #9448 by @daniel-lxs)
- Fix: Resolve apply_diff performance regression from earlier changes (PR #9474 by @daniel-lxs)
- Fix: Implement model cache refresh to prevent stale disk cache issues (PR #9478 by @daniel-lxs)
- Fix: Copy model-level capabilities to OpenRouter endpoint models correctly (PR #9483 by @daniel-lxs)
- Fix: Add fallback to yield tool calls regardless of finish_reason (PR #9476 by @daniel-lxs)

## [3.33.3] - 2025-11-20

![3.33.3 Release - Gemini 3 Pro Image Preview](/releases/3.33.3-release.png)

- Add Google Gemini 3 Pro Image Preview to image generation models (PR #9440 by @app/roomote)
- Add support for Minimax as Anthropic-compatible provider (PR #9455 by @daniel-lxs)
- Store reasoning in conversation history for all providers (PR #9451 by @daniel-lxs)
- Fix: Improve preserveReasoning flag to control API reasoning inclusion (PR #9453 by @daniel-lxs)
- Fix: Prevent OpenAI Native parallel tool calls for native tool calling (PR #9433 by @hannesrudolph)
- Fix: Improve search and replace symbol parsing (PR #9456 by @daniel-lxs)
- Fix: Send tool_result blocks for skipped tools in native protocol (PR #9457 by @daniel-lxs)
- Fix: Improve markdown formatting and add reasoning support (PR #9458 by @daniel-lxs)
- Fix: Prevent duplicate environment_details when resuming cancelled tasks (PR #9442 by @daniel-lxs)
- Improve read_file tool description with examples (PR #9422 by @daniel-lxs)
- Update glob dependency to ^11.1.0 (PR #9449 by @jr)
- Update tar-fs to 3.1.1 via pnpm override (PR #9450 by @app/roomote)

## [3.33.2] - 2025-11-19

- Enable native tool calling for Gemini provider (PR #9343 by @hannesrudolph)
- Add RCC credit balance display (PR #9386 by @jr)
- Fix: Preserve user images in native tool call results (PR #9401 by @daniel-lxs)
- Perf: Reduce excessive getModel() calls and implement disk cache fallback (PR #9410 by @daniel-lxs)
- Show zero price for free models (PR #9419 by @mrubens)

## [3.33.1] - 2025-11-18

![3.33.1 Release - Native Tool Protocol Fixes](/releases/3.33.1-release.png)

- Add native tool calling support to OpenAI-compatible (PR #9369 by @mrubens)
- Fix: Resolve native tool protocol race condition causing 400 errors (PR #9363 by @daniel-lxs)
- Fix: Update tools to return structured JSON for native protocol (PR #9373 by @daniel-lxs)
- Fix: Include nativeArgs in tool repetition detection (PR #9377 by @daniel-lxs)
- Fix: Ensure no XML parsing when protocol is native (PR #9371 by @daniel-lxs)
- Fix: Gemini maxOutputTokens and reasoning config (PR #9375 by @hannesrudolph)
- Fix: Gemini thought signature validation and token counting errors (PR #9380 by @hannesrudolph)
- Fix: Exclude XML tool examples from MODES section when native protocol enabled (PR #9367 by @daniel-lxs)
- Retry eval tasks if API instability detected (PR #9365 by @cte)
- Add toolProtocol property to PostHog tool usage telemetry (PR #9374 by @app/roomote)

## [3.33.0] - 2025-11-18

![3.33.0 Release - Twin Kangaroos and the Gemini Constellation](/releases/3.33.0-release.png)

- Add Gemini 3 Pro Preview model (PR #9357 by @hannesrudolph)
- Improve Google Gemini defaults with better temperature and cost reporting (PR #9327 by @hannesrudolph)
- Enable native tool calling for openai-native provider (PR #9348 by @hannesrudolph)
- Add git status information to environment details (PR #9310 by @daniel-lxs)
- Add tool protocol selector to advanced settings (PR #9324 by @daniel-lxs)
- Implement dynamic tool protocol resolution with proper precedence hierarchy (PR #9286 by @daniel-lxs)
- Move Import/Export functionality to Modes view toolbar and cleanup Mode Edit view (PR #9077 by @hannesrudolph)
- Update cloud agent CTA to point to setup page (PR #9338 by @app/roomote)
- Fix: Prevent duplicate tool_result blocks in native tool protocol (PR #9248 by @daniel-lxs)
- Fix: Format tool responses properly for native protocol (PR #9270 by @daniel-lxs)
- Fix: Centralize toolProtocol configuration checks (PR #9279 by @daniel-lxs)
- Fix: Preserve tool blocks for native protocol in conversation history (PR #9319 by @daniel-lxs)
- Fix: Prevent infinite loop when task_done succeeds (PR #9325 by @daniel-lxs)
- Fix: Sync parser state with profile/model changes (PR #9355 by @daniel-lxs)
- Fix: Pass tool protocol parameter to lineCountTruncationError (PR #9358 by @daniel-lxs)
- Use VSCode theme color for outline button borders (PR #9336 by @app/roomote)
- Replace broken badgen.net badges with shields.io (PR #9318 by @app/roomote)
- Add max git status files setting to evals (PR #9322 by @mrubens)
- Roo Code Cloud Provider pricing page and changes elsewhere (PR #9195 by @brunobergher)

## [3.32.1] - 2025-11-14

![3.32.1 Release - Bug Fixes](/releases/3.32.1-release.png)

- Fix: Add abort controller for request cancellation in OpenAI native protocol (PR #9276 by @daniel-lxs)
- Fix: Resolve duplicate tool blocks causing 'tool has already been used' error in native protocol mode (PR #9275 by @daniel-lxs)
- Fix: Prevent duplicate tool_result blocks in native protocol mode for read_file (PR #9272 by @daniel-lxs)
- Fix: Correct OpenAI Native handling of encrypted reasoning blocks to prevent errors during condensing (PR #9263 by @hannesrudolph)
- Fix: Disable XML parser for native tool protocol to prevent parsing conflicts (PR #9277 by @daniel-lxs)

## [3.32.0] - 2025-11-14

![3.32.0 Release - GPT-5.1 models and OpenAI prompt caching](/releases/3.32.0-release.png)

- Feature: Add GPT-5.1 models to OpenAI provider (PR #9252 by @hannesrudolph)
- Feature: Support for OpenAI Responses 24 hour prompt caching (PR #9259 by @hannesrudolph)
- Fix: Repair the share button in the UI (PR #9253 by @hannesrudolph)
- Docs: Include PR numbers in the release guide to improve traceability (PR #9236 by @hannesrudolph)

## [3.31.3] - 2025-11-13

![3.31.3 Release - Kangaroo Decrypting a Message](/releases/3.31.3-release.png)

- Fix: OpenAI Native encrypted_content handling and remove gpt-5-chat-latest verbosity flag (#9225 by @politsin, PR by @hannesrudolph)
- Fix: Roo Code Cloud provider Anthropic input token normalization to avoid double-counting (thanks @hannesrudolph!)
- Refactor: Rename sliding-window to context-management and truncateConversationIfNeeded to manageContext (thanks @hannesrudolph!)

## [3.31.2] - 2025-11-12

- Fix: Apply updated API profile settings when provider/model unchanged (#9208 by @hannesrudolph, PR by @hannesrudolph)
- Migrate conversation continuity to plugin-side encrypted reasoning items using Responses API for improved reliability (thanks @hannesrudolph!)
- Fix: Include mcpServers in getState() for auto-approval (#9190 by @bozoweed, PR by @daniel-lxs)
- Batch settings updates from the webview to the extension host for improved performance (thanks @cte!)
- Fix: Replace rate-limited badges with badgen.net to improve README reliability (thanks @daniel-lxs!)

## [3.31.1] - 2025-11-11

![3.31.1 Release - Kangaroo Stuck in the Clouds](/releases/3.31.1-release.png)

- Fix: Prevent command_output ask from blocking in cloud/headless environments (thanks @daniel-lxs!)
- Add IPC command for sending messages to the current task (thanks @mrubens!)
- Fix: Model switch re-applies selected profile, ensuring task configuration stays in sync (#9179 by @hannesrudolph, PR by @hannesrudolph)
- Move auto-approval logic from `ChatView` to `Task` for better architecture (thanks @cte!)
- Add custom Button component with variant system (thanks @brunobergher!)

## [3.31.0] - 2025-11-07

![3.31.0 Release - Todo List and Task Header Improvements](/releases/3.31.0-release.png)

- Improvements to to-do lists and task headers (thanks @brunobergher!)
- Fix: Prevent crash when streaming chunks have null choices array (thanks @daniel-lxs!)
- Fix: Prevent context condensing on settings save when provider/model unchanged (#4430 by @hannesrudolph, PR by @daniel-lxs)
- Fix: Respect custom OpenRouter URL for all API operations (#8947 by @sstraus, PR by @roomote)
- Add comprehensive error logging to Roo Cloud provider (thanks @daniel-lxs!)
- UX: Less caffeinated kangaroo (thanks @brunobergher!)

## [3.30.3] - 2025-11-06

![3.30.3 Release - Moonshot Brain](/releases/3.30.3-release.png)

- Feat: Add kimi-k2-thinking model to Moonshot provider (thanks @daniel-lxs!)
- Fix: Auto-retry on empty assistant response to prevent task failures (#9076 by @Akillatech, PR by @daniel-lxs)
- Fix: Use system role for OpenAI Compatible provider when streaming is disabled (#8215 by @whitfin, PR by @roomote)
- Fix: Prevent notification sound on attempt_completion with queued messages (#8537 by @hannesrudolph, PR by @roomote)
- Feat: Auto-switch to imported mode with architect fallback for better mode detection (#8239 by @hannesrudolph, PR by @daniel-lxs)
- Feat: Add MiniMax-M2-Stable model and enable prompt caching (#9070 by @nokaka, PR by @roomote)
- Feat: Improve diff appearance in main chat view (thanks @hannesrudolph!)
- UX: Home screen visuals (thanks @brunobergher!)
- Docs: Clarify that setting 0 disables Error & Repetition Limit (thanks @roomote!)
- Chore: Update dependency @changesets/cli to v2.29.7 (thanks @renovate!)

## [3.30.2] - 2025-11-05

![3.30.2 Release - Eliminating UI Flicker](/releases/3.30.2-release.png)

- Fix: eliminate UI flicker during task cancellation (thanks @daniel-lxs!)
- Add Global Inference support for Bedrock models (#8750 by @ronyblum, PR by @hannesrudolph)
- Add Qwen3 embedding models (0.6B and 4B) to OpenRouter support (#9058 by @dmarkey, PR by @app/roomote)
- Fix: resolve incorrect commit location when GIT_DIR set in Dev Containers (#4567 by @nonsleepr, PR by @heyseth)
- Fix: keep pinned models fixed at top of scrollable list (#8812 by @XiaoYingYo, PR by @app/roomote)
- Fix: update Opus 4.1 max tokens from 8K to 32K (#9045 by @kaveh-deriv, PR by @app/roomote)
- Set Claude Sonnet 4.5 as default for key providers (thanks @hannesrudolph!)
- Fix: dynamic provider model validation to prevent cross-contamination (#9047 by @NotADev137, PR by @daniel-lxs)
- Fix: Bedrock user agent to report full SDK details (#9031 by @ajjuaire, PR by @ajjuaire)
- Add file path tooltips with centralized PathTooltip component (#8278 by @da2ce7, PR by @daniel-lxs)
- Add conditional test running to pre-push hook (thanks @daniel-lxs!)
- Update Cerebras integration (thanks @sebastiand-cerebras!)

## [3.30.1] - 2025-11-04

- Fix: Correct OpenRouter Mistral model embedding dimension from 3072 to 1536 (thanks @daniel-lxs!)
- Revert: Previous UI flicker fix that caused issues with task resumption (thanks @mrubens!)

## [3.30.0] - 2025-11-03

![3.30.0 Release - PR Fixer](/releases/3.30.0-release.png)

- Feat: Add OpenRouter embedding provider support (#8972 by @dmarkey, PR by @dmarkey)
- Feat: Add GLM-4.6 model to Fireworks provider (#8752 by @mmealman, PR by @app/roomote)
- Feat: Add MiniMax M2 model to Fireworks provider (#8961 by @dmarkey, PR by @app/roomote)
- Feat: Add preserveReasoning flag to include reasoning in API history (thanks @daniel-lxs!)
- Fix: Prevent message loss during queue drain race condition (#8536 by @hannesrudolph, PR by @daniel-lxs)
- Fix: Capture the reasoning content in base-openai-compatible for GLM 4.6 (thanks @mrubens!)
- Fix: Create new Requesty profile during OAuth (thanks @Thibault00!)
- Fix: Prevent UI flicker and enable resumption after task cancellation (thanks @daniel-lxs!)
- Fix: Cleanup terminal settings tab and change default terminal to inline (thanks @hannesrudolph!)

## [3.29.5] - 2025-11-01

- Fix: Resolve Qdrant codebase_search error by adding keyword index for type field (#8963 by @rossdonald, PR by @app/roomote)
- Fix cost and token tracking between provider styles to ensure accurate usage metrics (thanks @mrubens!)

## [3.29.4] - 2025-10-30

- Feat: Add Minimax Provider (thanks @Maosghoul!)
- Fix: prevent infinite loop when canceling during auto-retry (#8901 by @mini2s, PR by @app/roomote)
- Fix: Enhanced codebase index recovery and reuse ('Start Indexing' button now reuses existing Qdrant index) (#8129 by @jaroslaw-weber, PR by @heyseth)
- Fix: make code index initialization non-blocking at activation (#8777 by @cjlawson02, PR by @daniel-lxs)
- Fix: remove search_and_replace tool from codebase (#8891 by @hannesrudolph, PR by @app/roomote)
- Fix: custom modes under custom path not showing (#8122 by @hannesrudolph, PR by @elianiva)
- Fix: prevent MCP server restart when toggling tool permissions (#8231 by @hannesrudolph, PR by @heyseth)
- Fix: truncate type definition to match max read line (#8149 by @chenxluo, PR by @elianiva)
- Fix: auto-sync enableReasoningEffort with reasoning dropdown selection (thanks @daniel-lxs!)
- Fix: Gate auth-driven Roo model refresh to active provider only (thanks @daniel-lxs!)
- Prevent a noisy cloud agent exception (thanks @cte!)
- Feat: improve @ file search for large projects (#5721 by @Naituw, PR by @daniel-lxs)
- Feat: add zai-glm-4.6 model to Cerebras and set gpt-oss-120b as default (thanks @kevint-cerebras!)
- Feat: rename MCP Errors tab to Logs for mixed-level messages (#8893 by @hannesrudolph, PR by @app/roomote)
- docs(vscode-lm): clarify VS Code LM API integration warning (thanks @hannesrudolph!)

## [3.29.3] - 2025-10-28

- Update Gemini models with latest 09-2025 versions including Gemini 2.5 Pro and Flash (#8485 by @cleacos, PR by @roomote)
- Add reasoning support for Z.ai GLM binary thinking mode (#8465 by @BeWater799, PR by @daniel-lxs)
- Enable reasoning in Roo provider (thanks @mrubens!)
- Add settings to configure time and cost display in system prompt (#8450 by @jaxnb, PR by @roomote)
- Fix: Use max_output_tokens when available in LiteLLM fetcher (#8454 by @fabb, PR by @roomote)
- Fix: Process queued messages after context condensing completes (#8477 by @JosXa, PR by @roomote)
- Fix: Use monotonic clock for rate limiting to prevent timing issues (#7770 by @intermarkec, PR by @chrarnoldus)
- Fix: Resolve checkpoint menu popover overflow (thanks @daniel-lxs!)
- Fix: LiteLLM test failures after merge (thanks @daniel-lxs!)
- Improve UX: Focus textbox and add newlines after adding to context (thanks @mrubens!)

## [3.29.2] - 2025-10-27

- Add support for LongCat-Flash-Thinking-FP8 models in Chutes AI provider (#8425 by @leakless21, PR by @roomote)
- Fix: Remove specific Claude model version from settings descriptions to avoid outdated references (#8435 by @rwydaegh, PR by @roomote)
- Fix: Correct caching logic in Roo provider to improve performance (thanks @mrubens!)
- Fix: Ensure free models don't display pricing information in the UI (thanks @mrubens!)

## [3.29.1] - 2025-10-26

![3.29.1 Release - Window Cleaning](/releases/3.29.1-release.png)

- Fix: Clean up max output token calculations to prevent context window overruns (#8821 by @enerage, PR by @roomote)
- Fix: Change Add to Context keybinding to avoid Redo conflict (#8652 by @swythan, PR by @roomote)
- Fix provider model loading race conditions (thanks @mrubens!)

## [3.29.0] - 2025-10-24

![3.29.0 Release - Intelligent File Reading](/releases/3.29.0-release.png)

- Add token-budget based file reading with intelligent preview to avoid context overruns (thanks @daniel-lxs!)
- Enable browser-use tool for all image-capable models (#8116 by @hannesrudolph, PR by @app/roomote!)
- Add dynamic model loading for Roo Code Cloud provider (thanks @app/roomote!)
- Fix: Respect nested .gitignore files in search_files (#7921 by @hannesrudolph, PR by @daniel-lxs)
- Fix: Preserve trailing newlines in stripLineNumbers for apply_diff (#8020 by @liyi3c, PR by @app/roomote)
- Fix: Exclude max tokens field for models that don't support it in export (#7944 by @hannesrudolph, PR by @elianiva)
- Retry API requests on stream failures instead of aborting task (thanks @daniel-lxs!)
- Improve auto-approve button responsiveness (thanks @daniel-lxs!)
- Add checkpoint initialization timeout settings and fix checkpoint timeout warnings (#7843 by @NaccOll, PR by @NaccOll)
- Always show checkpoint restore options regardless of change detection (thanks @daniel-lxs!)
- Improve checkpoint menu translations (thanks @daniel-lxs!)
- Add GLM-4.6-turbo model to chutes ai provider (thanks @mohammad154!)
- Add Claude Haiku 4.5 to prompt caching models (thanks @hannesrudolph!)
- Expand Z.ai model coverage with GLM-4.5-X, AirX, Flash (thanks @hannesrudolph!)
- Update Mistral Medium model name (#8362 by @ThomsenDrake, PR by @ThomsenDrake)
- Remove GPT-5 instructions/reasoning_summary from UI message metadata to prevent ui_messages.json bloat (thanks @hannesrudolph!)
- Normalize docs-extractor audience tags; remove admin/stakeholder; strip tool invocations (thanks @hannesrudolph!)
- Update X/Twitter username from roo_code to roocode (thanks @app/roomote!)
- Update Configuring Profiles video link (thanks @app/roomote!)
- Fix link text for Roomote Control in README (thanks @laz-001!)
- Remove verbose error for cloud agents (thanks @cte!)
- Try 5s status mutation timeout (thanks @cte!)

## [3.28.18] - 2025-10-17

- Fix: Remove request content from UI messages to improve performance and reduce clutter (#5601 by @MuriloFP, #8594 by @multivac2x, #8690 by @hannesrudolph, PR by @mrubens)
- Fix: Prevent file editing issues when git diff views are open (thanks @hassoncs!)
- Fix: Add userAgent to Bedrock client for version tracking (#8660 by @ajjuaire, PR by @app/roomote)
- Feat: Z AI now uses only two coding endpoints for better performance (#8687 by @hannesrudolph)
- Feat: Update image generation model selection for improved quality (thanks @chrarnoldus!)

## [3.28.17] - 2025-10-15

- Add support for Claude Haiku 4.5 model (thanks @daniel-lxs!)
- Fix: Update zh-TW run command title translation (thanks @PeterDaveHello!)

## [3.28.16] - 2025-10-09

![3.28.16 Release - Expanded Context Window](/releases/3.28.16-release.png)

- feat: Add Claude Sonnet 4.5 1M context window support for Claude Code (thanks @ColbySerpa!)
- feat: Identify cloud tasks in the extension bridge (thanks @cte!)
- fix: Add the parent task ID in telemetry (thanks @mrubens!)

## [3.28.15] - 2025-10-03

![3.28.15 Release - Kangaroo Sliding Down a Chute](/releases/3.28.15-release.png)

- Add new DeepSeek and GLM models with detailed descriptions to the Chutes provider (thanks @mohammad154!)
- Fix: properly reset cost limit tracking when user clicks "Reset and Continue" (#6889 by @alecoot, PR by app/roomote)
- Fix: improve save button activation in prompts settings (#5780 by @beccare, PR by app/roomote)
- Fix: overeager 'there are unsaved changes' dialog in settings (thanks @brunobergher!)
- Fix: show send button when only images are selected in chat textarea (thanks app/roomote!)
- Fix: Claude Sonnet 4.5 compatibility improvements (thanks @mrubens!)
- Add UsageStats schema and type for better analytics tracking (thanks app/roomote!)
- Include reasoning messages in cloud tasks (thanks @mrubens!)
- Security: update dependency vite to v6.3.6 (thanks app/renovate!)
- Deprecate free grok 4 fast model (thanks @mrubens!)
- Remove unsupported Gemini 2.5 Flash Image Preview free model (thanks @SannidhyaSah!)
- Add structured data to the homepage for better SEO (thanks @mrubens!)
- Update dependency glob to v11.0.3 (thanks app/renovate!)

## [3.28.14] - 2025-09-30

![3.28.14 Release - GLM-4.6 Model Support](/releases/3.28.14-release.png)

- Add support for GLM-4.6 model for z.ai provider (#8406 by @dmarkey, PR by @roomote)

## [3.28.13] - 2025-09-29

- Fix: Remove topP parameter from Bedrock inference config (#8377 by @ronyblum, PR by @daniel-lxs)
- Fix: Correct Vertex AI Sonnet 4.5 model configuration (#8387 by @nickcatal, PR by @mrubens!)

## [3.28.12] - 2025-09-29

- Fix: Correct Anthropic Sonnet 4.5 model ID and add Bedrock 1M context checkbox (thanks @daniel-lxs!)

## [3.28.11] - 2025-09-29

- Fix: Correct Amazon Bedrock Claude Sonnet 4.5 model identifier (#8371 by @sunhyung, PR by @app/roomote)
- Fix: Correct Claude Sonnet 4.5 model ID format (thanks @daniel-lxs!)

## [3.28.10] - 2025-09-29

![3.28.10 Release - Kangaroo Writing Sonnet 4.5](/releases/3.28.10-release.png)

- Feat: Add Sonnet 4.5 support (thanks @daniel-lxs!)
- Fix: Resolve max_completion_tokens issue for GPT-5 models in LiteLLM provider (#6979 by @lx1054331851, PR by @roomote)
- Fix: Make chat icons properly sized with shrink-0 class (thanks @mrubens!)
- Enhancement: Track telemetry settings changes for better analytics (thanks @mrubens!)
- Web: Add testimonials section to website (thanks @brunobergher!)
- CI: Refresh contrib.rocks cache workflow for contributor badges (thanks @hannesrudolph!)

## [3.28.9] - 2025-09-26

![3.28.9 Release - Supernova Upgrade](/releases/3.28.9-release.png)

- The free Supernova model now has a 1M token context window (thanks @mrubens!)
- Experiment to show the Roo provider on the welcome screen (thanks @mrubens!)
- Web: Website improvements to https://roocode.com/ (thanks @brunobergher!)
- Fix: Remove <thinking> tags from prompts for cleaner output and fewer tokens (#8318 by @hannesrudolph, PR by @app/roomote)
- Correct tool use suggestion to improve model adherence to suggestion (thanks @hannesrudolph!)
- feat: log out from cloud when resetting extension state (thanks @app/roomote!)
- feat: Add telemetry tracking to DismissibleUpsell component (thanks @app/roomote!)
- refactor: remove pr-reviewer mode (thanks @daniel-lxs!)
- Removing user hint when refreshing models (thanks @requesty-JohnCosta27!)

## [3.28.8] - 2025-09-25

![3.28.8 Release - Bug fixes and improvements](/releases/3.28.8-release.png)

- Fix: Resolve frequent "No tool used" errors by clarifying tool-use rules (thanks @hannesrudolph!)
- Fix: Include initial ask in condense summarization (thanks @hannesrudolph!)
- Add support for more free models in the Roo provider (thanks @mrubens!)
- Show cloud switcher and option to add a team when logged in (thanks @mrubens!)
- Add Opengraph image for web (thanks @brunobergher!)

## [3.28.7] - 2025-09-23

![3.28.7 Release - Hidden Thinking](/releases/3.28.7-release.png)

- UX: Collapse thinking blocks by default with UI settings to always show them (thanks @brunobergher!)
- Fix: Resolve checkpoint restore popover positioning issue (#8219 by @NaccOll, PR by @app/roomote)
- Add cloud account switcher functionality (thanks @mrubens!)
- Add support for zai-org/GLM-4.5-turbo model in Chutes provider (#8155 by @mugnimaestra, PR by @app/roomote)

## [3.28.6] - 2025-09-23

![3.28.6 Release - Kangaroo studying ancient codex](/releases/3.28.6-release.png)

- Feat: Add GPT-5-Codex model (thanks @daniel-lxs!)
- Feat: Add keyboard shortcut for toggling auto-approve (Cmd/Ctrl+Alt+A) (thanks @brunobergher!)
- Fix: Improve reasoning block formatting for better readability (thanks @daniel-lxs!)
- Fix: Respect Ollama Modelfile num_ctx configuration (#7797 by @hannesrudolph, PR by @app/roomote)
- Fix: Prevent checkpoint text from wrapping in non-English languages (#8206 by @NaccOll, PR by @app/roomote)
- Remove language selection and word wrap toggle from CodeBlock (thanks @mrubens!)
- Feat: Add package.nls.json checking to find-missing-translations script (thanks @app/roomote!)
- Fix: Bare metal evals fixes (thanks @cte!)
- Fix: Follow-up questions should trigger the "interactive" state (thanks @cte!)

## [3.28.5] - 2025-09-20

![3.28.5 Release - Kangaroo staying hydrated](/releases/3.28.5-release.png)

- Fix: Resolve duplicate rehydrate during reasoning; centralize rehydrate and preserve cancel metadata (#8153 by @hannesrudolph, PR by @hannesrudolph)
- Add an announcement for Supernova (thanks @mrubens!)
- Wrap code blocks by default for improved readability (thanks @mrubens!)
- Fix: Support dash prefix in parseMarkdownChecklist for todo lists (#8054 by @NaccOll, PR by app/roomote)
- Fix: Apply tiered pricing for Gemini models via Vertex AI (#8017 by @ikumi3, PR by app/roomote)
- Update SambaNova models to latest versions (thanks @snova-jorgep!)
- Update privacy policy to allow occasional emails (thanks @jdilla1277!)

## [3.28.4] - 2025-09-19

![3.28.4 Release - Supernova Discovery](/releases/3.28.4-release.png)

- UX: Redesigned Message Feed (thanks @brunobergher!)
- UX: Responsive Auto-Approve (thanks @brunobergher!)
- Add telemetry retry queue for network resilience (thanks @daniel-lxs!)
- Fix: Transform keybindings in nightly build to fix command+y shortcut (thanks @app/roomote!)
- New code-supernova stealth model in the Roo Code Cloud provider (thanks @mrubens!)

## [3.28.3] - 2025-09-16

![3.28.3 Release - UI/UX Improvements and Bug Fixes](/releases/3.28.3-release.png)

- Fix: Filter out Claude Code built-in tools (ExitPlanMode, BashOutput, KillBash) (#7817 by @juliettefournier-econ, PR by @roomote)
- Replace + icon with edit icon for New Task button (#7941 by @hannesrudolph, PR by @roomote)
- Fix: Corrected C# tree-sitter query (#5238 by @vadash, PR by @mubeen-zulfiqar)
- Add keyboard shortcut for "Add to Context" action (#7907 by @hannesrudolph, PR by @roomote)
- Fix: Context menu is obscured when edit message (#7759 by @mini2s, PR by @NaccOll)
- Fix: Handle ByteString conversion errors in OpenAI embedders (#7959 by @PavelA85, PR by @daniel-lxs)
- Add Z.ai coding plan support (thanks @daniel-lxs!)
- Move slash commands to Settings tab with gear icon for discoverability (thanks @roomote!)
- Reposition Add Image button inside ChatTextArea (thanks @roomote!)
- Bring back a way to temporarily and globally pause auto-approve without losing your toggle state (thanks @brunobergher!)
- Makes text area buttons appear only when there's text (thanks @brunobergher!)
- CONTRIBUTING.md tweaks and issue template rewrite (thanks @hannesrudolph!)
- Bump axios from 1.9.0 to 1.12.0 (thanks @dependabot!)

## [3.28.2] - 2025-09-14

![3.28.2 Release - Auto-approve improvements](/releases/3.28.2-release.png)

- Improve auto-approve UI with smaller and more subtle design (thanks @brunobergher!)
- Fix: Message queue re-queue loop in Task.ask() causing performance issues (#7861 by @hannesrudolph, PR by @daniel-lxs)
- Fix: Restrict @-mention parsing to line-start or whitespace boundaries to prevent false triggers (#7875 by @hannesrudolph, PR by @app/roomote)
- Fix: Make nested git repository warning persistent with path info for better visibility (#7884 by @hannesrudolph, PR by @app/roomote)
- Fix: Include API key in Ollama /api/tags requests for authenticated instances (#7902 by @ItsOnlyBinary, PR by @app/roomote)
- Fix: Preserve original first message context during conversation condensing (thanks @daniel-lxs!)
- Add Qwen3 Next 80B A3B models to chutes provider (thanks @daniel-lxs!)
- Disable Roomote Control on logout for better security (thanks @cte!)
- Add padding to the cloudview for better visual spacing (thanks @mrubens!)

## [3.28.1] - 2025-09-11

![3.28.1 Release - Kangaroo riding rocket to the clouds](/releases/3.28.1-release.png)

- Announce Roo Code Cloud!
- Add cloud task button for opening tasks in Roo Code Cloud (thanks @app/roomote!)
- Make Posthog telemetry the default (thanks @mrubens!)
- Show notification when the checkpoint initialization fails (thanks @app/roomote!)
- Bust cache in generated image preview (thanks @mrubens!)
- Fix: Center active mode in selector dropdown on open (#7882 by @hannesrudolph, PR by @app/roomote)
- Fix: Preserve first message during conversation condensing (thanks @daniel-lxs!)

## [3.28.0] - 2025-09-10

![3.28.0 Release - Continue tasks in Roo Code Cloud](/releases/3.28.0-release.png)

- feat: Continue tasks in Roo Code Cloud (thanks @brunobergher!)
- feat: Support connecting to Cloud without redirect handling (thanks @mrubens!)
- feat: Add toggle to control task syncing to Cloud (thanks @jr!)
- feat: Add click-to-edit, ESC-to-cancel, and fix padding consistency for chat messages (#7788 by @hannesrudolph, PR by @app/roomote)
- feat: Make reasoning more visible (thanks @app/roomote!)
- fix: Fix Groq context window display (thanks @mrubens!)
- fix: Add GIT_EDITOR env var to merge-resolver mode for non-interactive rebase (thanks @daniel-lxs!)
- fix: Resolve chat message edit/delete duplication issues (thanks @daniel-lxs!)
- fix: Reduce CodeBlock button z-index to prevent overlap with popovers (#7703 by @A0nameless0man, PR by @daniel-lxs)
- fix: Revert PR #7188 - Restore temperature parameter to fix TabbyApi/ExLlamaV2 crashes (#7581 by @drknyt, PR by @daniel-lxs)
- fix: Make ollama models info transport work like lmstudio (#7674 by @ItsOnlyBinary, PR by @ItsOnlyBinary)
- fix: Update DeepSeek pricing to new unified rates effective Sept 5, 2025 (#7685 by @NaccOll, PR by @app/roomote)
- feat: Update Vertex AI models and regions (#7725 by @ssweens, PR by @ssweens)
- chore: Update dependency eslint-plugin-turbo to v2.5.6 (thanks @app/renovate!)
- chore: Update dependency @changesets/cli to v2.29.6 (thanks @app/renovate!)
- chore: Update dependency nock to v14.0.10 (thanks @app/renovate!)
- chore: Update dependency eslint-config-prettier to v10.1.8 (thanks @app/renovate!)
- chore: Update dependency esbuild to v0.25.9 (thanks @app/renovate!)

## [3.27.0] - 2025-09-05

![3.27.0 Release - Bug Fixes and Improvements](/releases/3.27.0-release.png)

- Add: User message editing and deletion functionality (thanks @NaccOll!)
- Add: Kimi K2-0905 model support in Chutes provider (#7700 by @pwilkin, PR by @app/roomote)
- Fix: Prevent stack overflow in codebase indexing for large projects (#7588 by @StarTrai1, PR by @daniel-lxs)
- Fix: Resolve race condition in Gemini Grounding Sources by improving code design (#6372 by @daniel-lxs, PR by @HahaBill)
- Fix: Preserve conversation context by retrying with full conversation on invalid previous_response_id (thanks @daniel-lxs!)
- Fix: Identify MCP and slash command config path in multiple folder workspaces (#6720 by @kfuglsang, PR by @NaccOll)
- Fix: Handle array paths from VSCode terminal profiles correctly (#7695 by @Amosvcc, PR by @app/roomote)
- Fix: Improve WelcomeView styling and readability (thanks @daniel-lxs!)
- Fix: Resolve CI e2e test ETIMEDOUT errors when downloading VS Code (thanks @daniel-lxs!)

## [3.26.7] - 2025-09-04

![3.26.7 Release - OpenAI Service Tiers](/releases/3.26.7-release.png)

- Feature: Add OpenAI Responses API service tiers (flex/priority) with UI selector and pricing (thanks @hannesrudolph!)
- Feature: Add DeepInfra as a model provider in Roo Code (#7661 by @Thachnh, PR by @Thachnh)
- Feature: Update kimi-k2-0905-preview and kimi-k2-turbo-preview models on the Moonshot provider (thanks @CellenLee!)
- Feature: Add kimi-k2-0905-preview to Groq, Moonshot, and Fireworks (thanks @daniel-lxs and Cline!)
- Fix: Prevent countdown timer from showing in history for answered follow-up questions (#7624 by @XuyiK, PR by @daniel-lxs)
- Fix: Moonshot's maximum return token count limited to 1024 issue resolved (#6936 by @greyishsong, PR by @wangxiaolong100)
- Fix: Add error transform to cryptic OpenAI SDK errors when API key is invalid (#7483 by @A0nameless0man, PR by @app/roomote)
- Fix: Validate MCP tool exists before execution (#7631 by @R-omk, PR by @app/roomote)
- Fix: Handle zsh glob qualifiers correctly (thanks @mrubens!)
- Fix: Handle zsh process substitution correctly (thanks @mrubens!)
- Fix: Minor zh-TW Traditional Chinese locale typo fix (thanks @PeterDaveHello!)

## [3.26.6] - 2025-09-03

![3.26.6 Release - Bug Fixes and Tool Improvements](/releases/3.26.6-release.png)

- Add experimental run_slash_command tool to let the model initiate slash commands (thanks @app/roomote!)
- Fix: use askApproval wrapper in insert_content and search_and_replace tools (#7648 by @hannesrudolph, PR by @app/roomote)
- Add Kimi K2 Turbo model configuration to moonshotModels (thanks @wangxiaolong100!)
- Fix: preserve scroll position when switching tabs in settings (thanks @DC-Dancao!)

## [3.26.5] - 2025-09-03

![3.26.5 Release - Enhanced AI Thinking Capabilities](/releases/3.26.5-release.png)

- feat: Add support for Qwen3 235B A22B Thinking 2507 model in chutes (thanks @mohammad154!)
- feat: Add auto-approve support for MCP access_resource tool (#7565 by @m-ibm, PR by @daniel-lxs)
- feat: Add configurable embedding batch size for code indexing (#7356 by @BenLampson, PR by @app/roomote)
- fix: Add cache reporting support for OpenAI-Native provider (thanks @hannesrudolph!)
- feat: Move message queue to the extension host for better performance (thanks @cte!)

## [3.26.4] - 2025-09-01

![3.26.4 Release - Memory Optimization](/releases/3.26.4-release.png)

- Optimize memory usage for image handling in webview (thanks @daniel-lxs!)
- Fix: Special tokens should not break task processing (#7539 by @pwilkin, PR by @pwilkin)
- Add Ollama API key support for Turbo mode (#7147 by @LivioGama, PR by @app/roomote)
- Rename Account tab to Cloud tab for clarity (thanks @app/roomote!)
- Add kangaroo-themed release image generation (thanks @mrubens!)

## [3.26.3] - 2025-08-29

![3.26.3 Release - Kangaroo Photo Editor](/releases/3.26.3-release.png)

- Add optional input image parameter to image generation tool (thanks @roomote!)
- Refactor: Flatten image generation settings structure (thanks @daniel-lxs!)
- Show console logging in vitests when the --no-silent flag is set (thanks @hassoncs!)

## [3.26.2] - 2025-08-28

![3.26.2 Release - Kangaroo Digital Artist](/releases/3.26.2-release.png)

- feat: Add experimental image generation tool with OpenRouter integration (thanks @daniel-lxs!)
- Fix: Resolve GPT-5 Responses API issues with condensing and image support (#7334 by @nlbuescher, PR by @daniel-lxs)
- Fix: Hide .rooignore'd files from environment details by default (#7368 by @AlexBlack772, PR by @app/roomote)
- Fix: Exclude browser scroll actions from repetition detection (#7470 by @cgrierson-smartsheet, PR by @app/roomote)

## [3.26.1] - 2025-08-27

![3.26.1 Release - Kangaroo Network Engineer](/releases/3.26.1-release.png)

- Add Vercel AI Gateway provider integration (thanks @joshualipman123!)
- Add support for Vercel embeddings (thanks @mrubens!)
- Enable on-disk storage for Qdrant vectors and HNSW index (thanks @daniel-lxs!)
- Show model ID in API configuration dropdown (thanks @daniel-lxs!)
- Update tooltip component to match native VSCode tooltip shadow styling (thanks @roomote!)
- Fix: remove duplicate cache display in task header (thanks @mrubens!)
- Random chat text area cleanup (thanks @cte!)

## [3.26.0] - 2025-08-26

![3.26.0 Release - Kangaroo Speed Racer](/releases/3.26.0-release.png)

- Sonic -> Grok Code Fast
- feat: Add Qwen Code CLI API Support with OAuth Authentication (thanks @evinelias and Cline!)
- feat: Add Deepseek v3.1 to Fireworks AI provider (#7374 by @dmarkey, PR by @app/roomote)
- Add a built-in /init slash command (thanks @mrubens and @hannesrudolph!)
- Fix: Make auto approve toggle trigger stay (#3909 by @kyle-apex, PR by @elianiva)
- Fix: Preserve user input when selecting follow-up choices (#7316 by @teihome, PR by @daniel-lxs)
- Fix: Handle Mistral thinking content as reasoning chunks (#6842 by @Biotrioo, PR by @app/roomote)
- Fix: Resolve newTaskRequireTodos setting not working correctly (thanks @hannesrudolph!)
- Fix: Requesty model listing (#7377 by @dtrugman, PR by @dtrugman)
- feat: Hide static providers with no models from provider list (thanks @daniel-lxs!)
- Add todos parameter to new_task tool usage in issue-fixer mode (thanks @hannesrudolph!)
- Handle substitution patterns in command validation (thanks @mrubens!)
- Mark code-workspace files as protected (thanks @mrubens!)
- Update list of default allowed commands (thanks @mrubens!)
- Follow symlinks in rooignore checks (thanks @mrubens!)
- Show cache read and write prices for OpenRouter inference providers (thanks @chrarnoldus!)
- chore(deps): Update dependency drizzle-kit to v0.31.4 (thanks @app/renovate!)

## [3.25.23] - 2025-08-22

- feat: add custom base URL support for Requesty provider (thanks @requesty-JohnCosta27!)
- feat: add DeepSeek V3.1 model to Chutes AI provider (#7294 by @dmarkey, PR by @app/roomote)
- Revert "feat: enable loading Roo modes from multiple files in .roo/modes directory" temporarily to fix a bug with mode installation

## [3.25.22] - 2025-08-22

- Add prompt caching support for Kimi K2 on Groq (thanks @daniel-lxs and @benank!)
- Add documentation links for global custom instructions in UI (thanks @app/roomote!)

## [3.25.21] - 2025-08-21

- Ensure subtask results are provided to GPT-5 in OpenAI Responses API
- Promote the experimental AssistantMessageParser to the default parser
- Update DeepSeek models context window to 128k (thanks @JuanPerezReal)
- Enable grounding features for Vertex AI (thanks @anguslees)
- Allow orchestrator to pass TODO lists to subtasks
- Improved MDM handling
- Handle nullish token values in ContextCondenseRow to prevent UI crash (thanks @s97712)
- Improved context window error handling for OpenAI and other providers
- Add "installed" filter to Roo Marketplace (thanks @semidark)
- Improve filesystem access checks (thanks @elianiva)
- Support for loading Roo modes from multiple YAML files in the `.roo/modes/` directory (thanks @farazoman)
- Add Featherless provider (thanks @DarinVerheijke)

## [3.25.20] - 2025-08-19

- Add announcement for Sonic model

## [3.25.19] - 2025-08-19

- Fix issue where new users couldn't select the Roo Code Cloud provider (thanks @daniel-lxs!)

## [3.25.18] - 2025-08-19

- Add new stealth Sonic model through the Roo Code Cloud provider
- Fix: respect enableReasoningEffort setting when determining reasoning usage (#7048 by @ikbencasdoei, PR by @app/roomote)
- Fix: prevent duplicate LM Studio models with case-insensitive deduplication (#6954 by @fbuechler, PR by @daniel-lxs)
- Feat: simplify ask_followup_question prompt documentation (thanks @daniel-lxs!)
- Feat: simple read_file tool for single-file-only models (thanks @daniel-lxs!)
- Fix: Add missing zaiApiKey and doubaoApiKey to SECRET_STATE_KEYS (#7082 by @app/roomote)
- Feat: Add new models and update configurations for vscode-lm (thanks @NaccOll!)

## [3.25.17] - 2025-08-17

- Fix: Resolve terminal reuse logic issues

## [3.25.16] - 2025-08-16

- Add support for OpenAI gpt-5-chat-latest model (#7057 by @PeterDaveHello, PR by @app/roomote)
- Fix: Use native Ollama API instead of OpenAI compatibility layer (#7070 by @LivioGama, PR by @daniel-lxs)
- Fix: Prevent XML entity decoding in diff tools (#7107 by @indiesewell, PR by @app/roomote)
- Fix: Add type check before calling .match() on diffItem.content (#6905 by @pwilkin, PR by @app/roomote)
- Refactor task execution system: improve call stack management (thanks @catrielmuller!)
- Fix: Enable save button for provider dropdown and checkbox changes (thanks @daniel-lxs!)
- Add an API for resuming tasks by ID (thanks @mrubens!)
- Emit event when a task ask requires interaction (thanks @cte!)
- Make enhance with task history default to true (thanks @liwilliam2021!)
- Fix: Use cline.cwd as primary source for workspace path in codebaseSearchTool (thanks @NaccOll!)
- Hotfix multiple folder workspace checkpoint (thanks @NaccOll!)

## [3.25.15] - 2025-08-14

- Fix: Remove 500-message limit to prevent scrollbar jumping in long conversations (#7052, #7063 by @daniel-lxs, PR by @app/roomote)
- Fix: Reset condensing state when switching tasks (#6919 by @f14XuanLv, PR by @f14XuanLv)
- Fix: Implement sitemap generation in TypeScript and remove XML file (#5231 by @abumalick, PR by @abumalick)
- Fix: allowedMaxRequests and allowedMaxCost values not showing in the settings UI (thanks @chrarnoldus!)

## [3.25.14] - 2025-08-13

- Fix: Only include verbosity parameter for models that support it (#7054 by @eastonmeth, PR by @app/roomote)
- Fix: Amazon Bedrock 1M context - Move anthropic_beta to additionalModelRequestFields (thanks @daniel-lxs!)
- Fix: Make cancelling requests more responsive by reverting recent changes

## [3.25.13] - 2025-08-12

- Add Sonnet 1M context checkbox to Bedrock
- Fix: add --no-messages flag to ripgrep to suppress file access errors (#6756 by @R-omk, PR by @app/roomote)
- Add support for AGENT.md alongside AGENTS.md (#6912 by @Brendan-Z, PR by @app/roomote)
- Remove deprecated GPT-4.5 Preview model (thanks @PeterDaveHello!)

## [3.25.12] - 2025-08-12

- Update: Claude Sonnet 4 context window configurable to 1 million tokens in Anthropic provider (thanks @daniel-lxs!)
- Add: Minimal reasoning support to OpenRouter (thanks @daniel-lxs!)
- Fix: Add configurable API request timeout for local providers (#6521 by @dabockster, PR by @app/roomote)
- Fix: Add --no-sandbox flag to browser launch options (#6632 by @QuinsZouls, PR by @QuinsZouls)
- Fix: Ensure JSON files respect .rooignore during indexing (#6690 by @evermoving, PR by @app/roomote)
- Add: New Chutes provider models (#6698 by @fstandhartinger, PR by @app/roomote)
- Add: OpenAI gpt-oss models to Amazon Bedrock dropdown (#6752 by @josh-clanton-powerschool, PR by @app/roomote)
- Fix: Correct tool repetition detector to not block first tool call when limit is 1 (#6834 by @NaccOll, PR by @app/roomote)
- Fix: Improve checkpoint service initialization handling (thanks @NaccOll!)
- Update: Improve zh-TW Traditional Chinese locale (thanks @PeterDaveHello!)
- Add: Task expand and collapse translations (thanks @app/roomote!)
- Update: Exclude GPT-5 models from 20% context window output token cap (thanks @app/roomote!)
- Fix: Truncate long model names in model selector to prevent overflow (thanks @app/roomote!)
- Add: Requesty base url support (thanks @requesty-JohnCosta27!)

## [3.25.11] - 2025-08-11

- Add: Native OpenAI provider support for Codex Mini model (#5386 by @KJ7LNW, PR by @daniel-lxs)
- Add: IO Intelligence Provider support (thanks @ertan2002!)
- Fix: MCP startup issues and remove refresh notifications (thanks @hannesrudolph!)
- Fix: Improvements to GPT-5 OpenAI provider configuration (thanks @hannesrudolph!)
- Fix: Clarify codebase_search path parameter as optional and improve tool descriptions (thanks @app/roomote!)
- Fix: Bedrock provider workaround for LiteLLM passthrough issues (thanks @jr!)
- Fix: Token usage and cost being underreported on cancelled requests (thanks @chrarnoldus!)

## [3.25.10] - 2025-08-07

- Add support for GPT-5 (thanks Cline and @app/roomote!)
- Fix: Use CDATA sections in XML examples to prevent parser errors (#4852 by @hannesrudolph, PR by @hannesrudolph)
- Fix: Add missing MCP error translation keys (thanks @app/roomote!)

## [3.25.9] - 2025-08-07

- Fix: Resolve rounding issue with max tokens (#6806 by @markp018, PR by @mrubens)
- Add support for GLM-4.5 and OpenAI gpt-oss models in Fireworks provider (#6753 by @alexfarlander, PR by @app/roomote)
- Improve UX by focusing chat input when clicking plus button in extension menu (thanks @app/roomote!)

## [3.25.8] - 2025-08-06

- Fix: Prevent disabled MCP servers from starting processes and show correct status (#6036 by @hannesrudolph, PR by @app/roomote)
- Fix: Handle current directory path "." correctly in codebase_search tool (#6514 by @hannesrudolph, PR by @app/roomote)
- Fix: Trim whitespace from OpenAI base URL to fix model detection (#6559 by @vauhochzett, PR by @app/roomote)
- Feat: Reduce Gemini 2.5 Pro minimum thinking budget to 128 (thanks @app/roomote!)
- Fix: Improve handling of net::ERR_ABORTED errors in URL fetching (#6632 by @QuinsZouls, PR by @app/roomote)
- Fix: Recover from error state when Qdrant becomes available (#6660 by @hannesrudolph, PR by @app/roomote)
- Fix: Resolve memory leak in ChatView virtual scrolling implementation (thanks @xyOz-dev!)
- Add: Swift files to fallback list (#5857 by @niteshbalusu11, #6555 by @sealad886, PR by @niteshbalusu11)
- Feat: Clamp default model max tokens to 20% of context window (thanks @mrubens!)

## [3.25.7] - 2025-08-05

- Add support for Claude Opus 4.1
- Add Fireworks AI provider (#6653 by @ershang-fireworks, PR by @ershang-fireworks)
- Add Z AI provider (thanks @jues!)
- Add Groq support for GPT-OSS
- Add Cerebras support for GPT-OSS
- Add code indexing support for multiple folders similar to task history (#6197 by @NaccOll, PR by @NaccOll)
- Make mode selection dropdowns responsive (#6423 by @AyazKaan, PR by @AyazKaan)
- Redesigned task header and task history (thanks @brunobergher!)
- Fix checkpoints timing and ensure checkpoints work properly (#4827 by @mrubens, PR by @NaccOll)
- Fix empty mode names from being saved (#5766 by @kfxmvp, PR by @app/roomote)
- Fix MCP server creation when setting is disabled (#6607 by @characharm, PR by @app/roomote)
- Update highlight layer style and align to textarea (#6647 by @NaccOll, PR by @NaccOll)
- Fix UI for approving chained commands
- Use assistantMessageParser class instead of parseAssistantMessage (#5340 by @qdaxb, PR by @qdaxb)
- Conditionally include reminder section based on todo list config (thanks @NaccOll!)
- Task and TaskProvider event emitter cleanup with new events (thanks @cte!)

## [3.25.6] - 2025-08-01

- Set horizon-beta model max tokens to 32k for OpenRouter (requested by @hannesrudolph, PR by @app/roomote)
- Add support for syncing provider profiles from the cloud

## [3.25.5] - 2025-08-01

- Fix: Improve Claude Code ENOENT error handling with installation guidance (#5866 by @JamieJ1, PR by @app/roomote)
- Fix: LM Studio model context length (#5075 by @Angular-Angel, PR by @pwilkin)
- Fix: VB.NET indexing by implementing fallback chunking system (#6420 by @JensvanZutphen, PR by @daniel-lxs)
- Add auto-approved cost limits (thanks @hassoncs!)
- Add Cerebras as a provider (thanks @kevint-cerebras!)
- Add Qwen 3 Coder from Cerebras (thanks @kevint-cerebras!)
- Fix: Handle Qdrant deletion errors gracefully to prevent indexing interruption (thanks @daniel-lxs!)
- Fix: Restore message sending when clicking save button (thanks @daniel-lxs!)
- Fix: Linter not applied to locales/\*/README.md (thanks @liwilliam2021!)
- Handle more variations of chaining and subshell command validation
- More tolerant search/replace match
- Clean up the auto-approve UI (thanks @mrubens!)
- Skip interpolation for non-existent slash commands (thanks @app/roomote!)

## [3.25.4] - 2025-07-30

- feat: add SambaNova provider integration (#6077 by @snova-jorgep, PR by @snova-jorgep)
- feat: add Doubao provider integration (thanks @AntiMoron!)
- feat: set horizon-alpha model max tokens to 32k for OpenRouter (thanks @app/roomote!)
- feat: add zai-org/GLM-4.5-FP8 model to Chutes AI provider (#6440 by @leakless21, PR by @app/roomote)
- feat: add symlink support for AGENTS.md file loading (thanks @app/roomote!)
- feat: optionally add task history context to prompt enhancement (thanks @liwilliam2021!)
- fix: remove misleading task resumption message (#5850 by @KJ7LNW, PR by @KJ7LNW)
- feat: add pattern to support Databricks /invocations endpoints (thanks @adambrand!)
- fix: resolve navigator global error by updating mammoth and bluebird dependencies (#6356 by @hishtadlut, PR by @app/roomote)
- feat: enhance token counting by extracting text from messages using VSCode LM API (#6112 by @sebinseban, PR by @NaccOll)
- feat: auto-refresh marketplace data when organization settings change (thanks @app/roomote!)
- fix: kill button for execute_command tool (thanks @daniel-lxs!)

## [3.25.3] - 2025-07-30

- Allow queueing messages with images
- Increase Claude Code default max output tokens to 16k (#6125 by @bpeterson1991, PR by @app/roomote)
- Add docs link for slash commands
- Hide Gemini checkboxes on the welcome view
- Clarify apply_diff tool descriptions to emphasize surgical edits
- Fix: Prevent input clearing when clicking chat buttons (thanks @hassoncs!)
- Update PR reviewer rules and mode configuration (thanks @daniel-lxs!)
- Add translation check action to pull_request.opened event (thanks @app/roomote!)
- Remove "(prev Roo Cline)" from extension title in all languages (thanks @app/roomote!)
- Remove event types mention from PR reviewer rules (thanks @daniel-lxs!)

## [3.25.2] - 2025-07-29

- Fix: Show diff view before approval when background edits are disabled (thanks @daniel-lxs!)
- Add support for organization-level MCP controls
- Fix zap icon hover state

## [3.25.1] - 2025-07-29

- Add support for GLM-4.5-Air model to Chutes AI provider (#6376 by @matbgn, PR by @app/roomote)
- Improve subshell validation for commands

## [3.25.0] - 2025-07-29

- Add message queueing (thanks @app/roomote!)
- Add custom slash commands
- Add options for URL Context and Grounding with Google Search to the Gemini provider (thanks @HahaBill!)
- Add image support to read_file tool (thanks @samhvw8!)
- Add experimental setting to prevent editor focus disruption (#4784 by @hannesrudolph, PR by @app/roomote)
- Add prompt caching support for LiteLLM (#5791 by @steve-gore-snapdocs, PR by @MuriloFP)
- Add markdown table rendering support
- Fix list_files recursive mode now works for dot directories (#2992 by @avtc, #4807 by @zhang157686, #5409 by @MuriloFP, PR by @MuriloFP)
- Add search functionality to mode selector popup and reorganize layout
- Sync API config selector style with mode selector
- Fix keyboard shortcuts for non-QWERTY layouts (#6161 by @shlgug, PR by @app/roomote)
- Add ESC key handling for modes, API provider, and indexing settings popovers (thanks @app/roomote!)
- Make task mode sticky to task (thanks @app/roomote!)
- Add text wrapping to command patterns in Manage Command Permissions (thanks @app/roomote!)
- Update list-files test for fixed hidden files bug (thanks @daniel-lxs!)
- Fix normalize Windows paths to forward slashes in mode export (#6307 by @hannesrudolph, PR by @app/roomote)
- Ensure form-data >= 4.0.4
- Fix filter out non-text tab inputs (Kilo-Org/kilocode#712 by @szermatt, PR by @hassoncs)

## [3.24.0] - 2025-07-25

- Add Hugging Face provider with support for open source models (thanks @TGlide!)
- Add terminal command permissions UI to chat interface
- Add support for Agent Rules standard via AGENTS.md (thanks @sgryphon!)
- Add settings to control diagnostic messages
- Fix auto-approve checkbox to be toggled at any time (thanks @KJ7LNW!)
- Add efficiency warning for single SEARCH/REPLACE blocks in apply_diff (thanks @KJ7LNW!)
- Fix respect maxReadFileLine setting for file mentions to prevent context exhaustion (thanks @sebinseban!)
- Fix Ollama API URL normalization by removing trailing slashes (thanks @Naam!)
- Fix restore list styles for markdown lists in chat interface (thanks @village-way!)
- Add support for bedrock api keys
- Add confirmation dialog and proper cleanup for marketplace mode removal
- Fix cancel auto-approve timer when editing follow-up suggestion (thanks @hassoncs!)
- Fix add error message when no workspace folder is open for code indexing

## [3.23.19] - 2025-07-23

- Add Roo Code Cloud Waitlist CTAs (thanks @brunobergher!)
- Split commands on newlines when evaluating auto-approve
- Smarter auto-deny of commands

## [3.23.18] - 2025-07-23

- Fix: Resolve 'Bad substitution' error in command parsing (#5978 by @KJ7LNW, PR by @daniel-lxs)
- Fix: Add ErrorBoundary component for better error handling (#5731 by @elianiva, PR by @KJ7LNW)
- Fix: Todo list toggle not working (thanks @chrarnoldus!)
- Improve: Use SIGKILL for command execution timeouts in the "execa" variant (thanks @cte!)

## [3.23.17] - 2025-07-22

- Add: todo list tool enable checkbox to provider advanced settings
- Add: Moonshot provider (thanks @CellenLee!)
- Add: Qwen/Qwen3-235B-A22B-Instruct-2507 model to Chutes AI provider
- Fix: move context condensing prompt to Prompts section (thanks @SannidhyaSah!)
- Add: jump icon for newly created files
- Fix: add character limit to prevent terminal output context explosion
- Fix: resolve global mode export not including rules files
- Fix: enable export, share, and copy buttons during API operations (thanks @MuriloFP!)
- Add: configurable timeout for evals (5-10 min)
- Add: auto-omit MCP content when no servers are configured
- Fix: sort symlinked rules files by symlink names, not target names
- Docs: clarify when to use update_todo_list tool
- Add: Mistral embedding provider (thanks @SannidhyaSah!)
- Fix: add run parameter to vitest command in rules (thanks @KJ7LNW!)
- Update: the max_tokens fallback logic in the sliding window
- Fix: Bedrock and Vertext token counting improvements (thanks @daniel-lxs!)
- Add: llama-4-maverick model to Vertex AI provider (thanks @MuriloFP!)
- Fix: properly distinguish between user cancellations and API failures
- Fix: add case sensitivity mention to suggested fixes in apply_diff error message

## [3.23.16] - 2025-07-19

- Add global rate limiting for OpenAI-compatible embeddings (thanks @daniel-lxs!)
- Add batch limiting to code indexer (thanks @daniel-lxs!)
- Fix Docker port conflicts for evals services

## [3.23.15] - 2025-07-18

- Fix configurable delay for diagnostics to prevent premature error reporting
- Add command timeout allowlist
- Add description and whenToUse fields to custom modes in .roomodes (thanks @RandalSchwartz!)
- Fix Claude model detection by name for API protocol selection (thanks @daniel-lxs!)
- Move marketplace icon from overflow menu to top navigation
- Optional setting to prevent completion with open todos
- Added YouTube to website footer (thanks @thill2323!)

## [3.23.14] - 2025-07-17

- Log api-initiated tasks to a tmp directory

## [3.23.13] - 2025-07-17

- Add the ability to "undo" enhance prompt changes
- Fix a bug where the path component of the baseURL for the LiteLLM provider contains path in it (thanks @ChuKhaLi)
- Add support for Vertex AI model name formatting when using Claude Code with Vertex AI (thanks @janaki-sasidhar)
- The list-files tool must include at least the first-level directory contents (thanks @qdaxb)
- Add a configurable limit that controls both consecutive errors and tool repetitions (thanks @MuriloFP)
- Add `.terraform/` and `.terragrunt-cache/` directories to the checkpoint exclusion patterns (thanks @MuriloFP)
- Increase Ollama API timeout values (thanks @daniel-lxs)
- Fix an issue where you need to "discard changes" before saving even though there are no settings changes
- Fix `DirectoryScanner` memory leak and improve file limit handling (thanks @daniel-lxs)
- Fix time formatting in environment (thanks @chrarnoldus)
- Prevent empty mode names from being saved (thanks @daniel-lxs)
- Improve auto-approve checkbox UX
- Improve the chat message edit / delete functionality (thanks @liwilliam2021)
- Add `commandExecutionTimeout` to `GlobalSettings`

## [3.23.12] - 2025-07-15

- Update the max-token calculation in model-params to better support Kimi K2 and others

## [3.23.11] - 2025-07-14

- Add Kimi K2 model to Groq along with fixes to context condensing math
- Add Cmd+Shift+. keyboard shortcut for previous mode switching

## [3.23.10] - 2025-07-14

- Prioritize built-in model dimensions over custom dimensions (thanks @daniel-lxs!)
- Add padding to the index model options

## [3.23.9] - 2025-07-14

- Enable Claude Code provider to run natively on Windows (thanks @SannidhyaSah!)
- Add gemini-embedding-001 model to code-index service (thanks @daniel-lxs!)
- Resolve vector dimension mismatch error when switching embedding models
- Return the cwd in the exec tool's response so that the model is not lost after subsequent calls (thanks @chris-garrett!)
- Add configurable timeout for command execution in VS Code settings

## [3.23.8] - 2025-07-13

- Add enable/disable toggle for code indexing (thanks @daniel-lxs!)
- Add a command auto-deny list to auto-approve settings
- Add navigation link to history tab in HistoryPreview

## [3.23.7] - 2025-07-11

- Fix Mermaid syntax warning (thanks @MuriloFP!)
- Expand Vertex AI region config to include all available regions in GCP Vertex AI (thanks @shubhamgupta731!)
- Handle Qdrant vector dimension mismatch when switching embedding models (thanks @daniel-lxs!)
- Fix typos in comment & document (thanks @noritaka1166!)
- Improve the display of codebase search results
- Correct translation fallback logic for embedding errors (thanks @daniel-lxs!)
- Clean up MCP tool disabling
- Link to marketplace from modes and MCP tab
- Fix TTS button display (thanks @sensei-woo!)
- Add Devstral Medium model support
- Add comprehensive error telemetry to code-index service (thanks @daniel-lxs!)
- Exclude cache tokens from context window calculation (thanks @daniel-lxs!)
- Enable dynamic tool selection in architect mode for context discovery
- Add configurable max output tokens setting for claude-code

## [3.23.6] - 2025-07-10

- Grok 4

## [3.23.5] - 2025-07-09

- Fix: use decodeURIComponent in openFile (thanks @vivekfyi!)
- Fix(embeddings): Translate error messages before sending to UI (thanks @daniel-lxs!)
- Make account tab visible

## [3.23.4] - 2025-07-09

- Update chat area icons for better discoverability & consistency
- Fix a bug that allowed `list_files` to return directory results that should be excluded by .gitignore
- Add an overflow header menu to make the UI a little tidier (thanks @dlab-anton)
- Fix a bug the issue where null custom modes configuration files cause a 'Cannot read properties of null' error (thanks @daniel-lxs!)
- Replace native title attributes with StandardTooltip component for consistency (thanks @daniel-lxs!)

## [3.23.3] - 2025-07-09

- Remove erroneous line from announcement modal

## [3.23.2] - 2025-07-09

- Fix bug where auto-approval was intermittently failing

## [3.23.1] - 2025-07-09

- Always show the code indexing dot under the chat text area

## [3.23.0] - 2025-07-08

- Move codebase indexing out of experimental (thanks @daniel-lxs and @MuriloFP!)
- Add todo list tool (thanks @qdaxb!)
- Fix code index secret persistence and improve settings UX (thanks @daniel-lxs!)
- Add Gemini embedding provider for codebase indexing (thanks @SannidhyaSah!)
- Support full endpoint URLs in OpenAI Compatible provider (thanks @SannidhyaSah!)
- Add markdown support to codebase indexing (thanks @MuriloFP!)
- Add Search/Filter Functionality to API Provider Selection in Settings (thanks @GOODBOY008!)
- Add configurable max search results (thanks @MuriloFP!)
- Add copy prompt button to task actions (thanks @Juice10 and @vultrnerd!)
- Fix insertContentTool to create new files with content (thanks @Ruakij!)
- Fix typescript compiler watch path inconsistency (thanks @bbenshalom!)
- Use actual max_completion_tokens from OpenRouter API (thanks @shariqriazz!)
- Prevent completion sound from replaying when reopening completed tasks (thanks @SannidhyaSah!)
- Fix access_mcp_resource fails to handle images correctly (thanks @s97712!)
- Prevent chatbox focus loss during automated file editing (thanks @hannesrudolph!)
- Resolve intermittent hangs and lack of clear error feedback in apply_diff tool (thanks @lhish!)
- Resolve Go duplicate references in tree-sitter queries (thanks @MuriloFP!)
- Chat UI consistency and layout shifts (thanks @seedlord!)
- Chat index UI enhancements (thanks @MuriloFP!)
- Fix model search being prefilled on dropdown (thanks @kevinvandijk!)
- Improve chat UI - add camera icon margin and make placeholder non-selectable (thanks @MuriloFP!)
- Delete .roo/rules-{mode} folder when custom mode is deleted
- Enforce file restrictions for all edit tools in architect mode
- Add User-Agent header to API providers
- Fix auto question timer unmount (thanks @liwilliam2021!)
- Fix new_task tool streaming issue
- Optimize file listing when maxWorkspaceFiles is 0 (thanks @daniel-lxs!)
- Correct export/import of OpenAI Compatible codebase indexing settings (thanks @MuriloFP!)
- Resolve workspace path inconsistency in code indexing for multi-workspace scenarios

## [3.22.6] - 2025-07-02

- Add timer-based auto approve for follow up questions (thanks @liwilliam2021!)
- Add import/export modes functionality
- Add persistent version indicator on chat screen
- Add automatic configuration import on extension startup (thanks @takakoutso!)
- Add user-configurable search score threshold slider for semantic search (thanks @hannesrudolph!)
- Add default headers and testing for litellm fetcher (thanks @andrewshu2000!)
- Fix consistent cancellation error messages for thinking vs streaming phases
- Fix Amazon Bedrock cross-region inference profile mapping (thanks @KevinZhao!)
- Fix URL loading timeout issues in @ mentions (thanks @MuriloFP!)
- Fix API retry exponential backoff capped at 10 minutes (thanks @MuriloFP!)
- Fix Qdrant URL field auto-filling with default value (thanks @SannidhyaSah!)
- Fix profile context condensation threshold (thanks @PaperBoardOfficial!)
- Fix apply_diff tool documentation for multi-file capabilities
- Fix cache files excluded from rules compilation (thanks @MuriloFP!)
- Add streamlined extension installation and documentation (thanks @devxpain!)
- Prevent Architect mode from providing time estimates
- Remove context size from environment details
- Change default mode to architect for new installations
- Suppress Mermaid error rendering
- Improve Mermaid buttons with light background in light mode (thanks @chrarnoldus!)
- Add .vscode/ to write-protected files/directories
- Update Amazon Bedrock cross-region inference profile mapping (thanks @KevinZhao!)

## [3.22.5] - 2025-06-28

- Remove Gemini CLI provider while we work with Google on a better integration

## [3.22.4] - 2025-06-27

- Fix: resolve E2BIG error by passing large prompts via stdin to Claude CLI (thanks @Fovty!)
- Add optional mode suggestions to follow-up questions
- Fix: move StandardTooltip inside PopoverTrigger in ShareButton (thanks @daniel-lxs!)

## [3.22.3] - 2025-06-27

- Restore JSON backwards compatibility for .roomodes files (thanks @daniel-lxs!)

## [3.22.2] - 2025-06-27

- Fix: eliminate XSS vulnerability in CodeBlock component (thanks @KJ7LNW!)
- Fix terminal keyboard shortcut error when adding content to context (thanks @MuriloFP!)
- Fix checkpoint popover not opening due to StandardTooltip wrapper conflict (thanks @daniel-lxs!)
- Fix(i18n): correct gemini cli error translation paths (thanks @daniel-lxs!)
- Code Index (Qdrant) recreate services when change configurations (thanks @catrielmuller!)

## [3.22.1] - 2025-06-26

- Add Gemini CLI provider (thanks Cline!)
- Fix undefined mcp command (thanks @qdaxb!)
- Use upstream_inference_cost for OpenRouter BYOK cost calculation and show cached token count (thanks @chrarnoldus!)
- Update maxTokens value for qwen/qwen3-32b model on Groq (thanks @KanTakahiro!)
- Standardize tooltip delays to 300ms

## [3.22.0] - 2025-06-25

- Add 1-click task sharing
- Add support for loading rules from a global .roo directory (thanks @samhvw8!)
- Modes selector improvements (thanks @brunobergher!)
- Use safeWriteJson for all JSON file writes to avoid task history corruption (thanks @KJ7LNW!)
- Improve YAML error handling when editing modes
- Register importSettings as VSCode command (thanks @shivamd1810!)
- Add default task names for empty tasks (thanks @daniel-lxs!)
- Improve translation workflow to avoid unnecessary file reads (thanks @KJ7LNW!)
- Allow write_to_file to handle newline-only and empty content (thanks @Githubguy132010!)
- Address multiple memory leaks in CodeBlock component (thanks @kiwina!)
- Memory cleanup (thanks @xyOz-dev!)
- Fix port handling bug in code indexing for HTTPS URLs (thanks @benashby!)
- Improve Bedrock error handling for throttling and streaming contexts
- Handle long Claude code messages (thanks @daniel-lxs!)
- Fixes to Claude Code caching and image upload
- Disable reasoning budget UI controls for Claude Code provider
- Remove temperature parameter for Azure OpenAI reasoning models (thanks @ExactDoug!)
- Allowed commands import/export (thanks @catrielmuller!)
- Add VS Code setting to disable quick fix context actions (thanks @OlegOAndreev!)

## [3.21.5] - 2025-06-23

- Fix Qdrant URL prefix handling for QdrantClient initialization (thanks @CW-B-W!)
- Improve LM Studio model detection to show all downloaded models (thanks @daniel-lxs!)
- Resolve Claude Code provider JSON parsing and reasoning block display

## [3.21.4] - 2025-06-23

- Fix start line not working in multiple apply diff (thanks @samhvw8!)
- Resolve diff editor issues with markdown preview associations (thanks @daniel-lxs!)
- Resolve URL port handling bug for HTTPS URLs in Qdrant (thanks @benashby!)
- Mark unused Ollama schema properties as optional (thanks @daniel-lxs!)
- Close the local browser when used as fallback for remote (thanks @markijbema!)
- Add Claude Code provider for local CLI integration (thanks @BarreiroT!)

## [3.21.3] - 2025-06-21

- Add profile-specific context condensing thresholds (thanks @SannidhyaSah!)
- Fix context length for lmstudio and ollama (thanks @thecolorblue!)
- Resolve MCP tool eye icon state and hide in chat context (thanks @daniel-lxs!)

## [3.21.2] - 2025-06-20

- Add LaTeX math equation rendering in chat window
- Add toggle for excluding MCP server tools from the prompt (thanks @Rexarrior!)
- Add symlink support to list_files tool
- Fix marketplace blanking after populating
- Fix recursive directory scanning in @ mention "Add Folder" functionality (thanks @village-way!)
- Resolve phantom subtask display on cancel during API retry
- Correct Gemini 2.5 Flash pricing (thanks @daniel-lxs!)
- Resolve marketplace timeout issues and display installed MCPs (thanks @daniel-lxs!)
- Onboarding tweaks to emphasize modes (thanks @brunobergher!)
- Rename 'Boomerang Tasks' to 'Task Orchestration' for clarity
- Remove command execution from attempt_completion
- Fix markdown for links followed by punctuation (thanks @xyOz-dev!)

## [3.21.1] - 2025-06-19

- Fix tree-sitter issues that were preventing codebase indexing from working correctly
- Improve error handling for codebase search embeddings
- Resolve MCP server execution on Windows with node version managers
- Default 'Enable MCP Server Creation' to false
- Rate limit correctly when starting a subtask (thanks @olweraltuve!)

## [3.21.0] - 2025-06-17

- Add Roo Marketplace to make it easy to discover and install great MCPs and modes!
- Add Gemini 2.5 models (Pro, Flash and Flash Lite) (thanks @daniel-lxs!)
- Add support for Excel (.xlsx) files in tools (thanks @chrarnoldus!)
- Add max tokens checkbox option for OpenAI compatible provider (thanks @AlexandruSmirnov!)
- Update provider models and prices for Groq & Mistral (thanks @KanTakahiro!)
- Add proper error handling for API conversation history issues (thanks @KJ7LNW!)
- Fix ambiguous model id error (thanks @elianiva!)
- Fix save/discard/revert flow for Prompt Settings (thanks @hassoncs!)
- Fix codebase indexing alignment with list-files hidden directory filtering (thanks @daniel-lxs!)
- Fix subtask completion mismatch (thanks @feifei325!)
- Fix Windows path normalization in MCP variable injection (thanks @daniel-lxs!)
- Update marketplace branding to 'Roo Marketplace' (thanks @SannidhyaSah!)
- Refactor to more consistent history UI (thanks @elianiva!)
- Adjust context menu positioning to be near Copilot
- Update evals Docker setup to work on Windows (thanks @StevenTCramer!)
- Include current working directory in terminal details
- Encourage use of start_line in multi-file diff to match legacy diff
- Always focus the panel when clicked to ensure menu buttons are visible (thanks @hassoncs!)

## [3.20.3] - 2025-06-13

- Resolve diff editor race condition in multi-monitor setups (thanks @daniel-lxs!)
- Add logic to prevent auto-approving edits of configuration files
- Adjust searching and listing files outside of the workspace to respect the auto-approve settings
- Add Indonesian translation support (thanks @chrarnoldus and @daniel-lxs!)
- Fix multi-file diff error handling and UI feedback (thanks @daniel-lxs!)
- Improve prompt history navigation to not interfere with text editing (thanks @daniel-lxs!)
- Fix errant maxReadFileLine default

## [3.20.2] - 2025-06-13

- Limit search_files to only look within the workspace for improved security
- Force tar-fs >=2.1.3 for security vulnerability fix
- Add cache breakpoints for custom vertex models on Unbound (thanks @pugazhendhi-m!)
- Reapply reasoning for bedrock with fix (thanks @daniel-lxs!)
- Sync BatchDiffApproval styling with BatchFilePermission for UI consistency (thanks @samhvw8!)
- Add max height constraint to MCP execution response for better UX (thanks @samhvw8!)
- Prevent MCP 'installed' label from being squeezed #4630 (thanks @daniel-lxs!)
- Allow a lower context condesning threshold (thanks @SECKainersdorfer!)
- Avoid type system duplication for cleaner codebase (thanks @EamonNerbonne!)

## [3.20.1] - 2025-06-12

- Temporarily revert thinking support for Bedrock models
- Improve performance of MCP execution block
- Add indexing status badge to chat view

## [3.20.0] - 2025-06-12

- Add experimental Marketplace for extensions and modes (thanks @Smartsheet-JB-Brown, @elianiva, @monkeyDluffy6017, @NamesMT, @daniel-lxs, Cline, and more!)
- Add experimental multi-file edits (thanks @samhvw8!)
- Move concurrent reads setting to context settings with default of 5
- Improve MCP execution UX (thanks @samhvw8!)
- Add magic variables support for MCPs with `workspaceFolder` injection (thanks @NamesMT!)
- Add prompt history navigation via arrow up/down in prompt field
- Add support for escaping context mentions (thanks @KJ7LNW!)
- Add DeepSeek R1 support to Chutes provider
- Add reasoning budget support to Bedrock models for extended thinking
- Add mermaid diagram support buttons (thanks @qdaxb!)
- Update XAI models and pricing (thanks @edwin-truthsearch-io!)
- Update O3 model pricing
- Add manual OpenAI-compatible format specification and parsing (thanks @dflatline!)
- Add core tools integration tests for comprehensive coverage
- Add JSDoc documentation for ClineAsk and ClineSay types (thanks @hannesrudolph!)
- Populate whenToUse descriptions for built-in modes
- Fix file write tool with early relPath & newContent validation checks (thanks @Ruakij!)
- Fix TaskItem display and copy issues with HTML tags in task messages (thanks @forestyoo!)
- Fix OpenRouter cost calculation with BYOK (thanks @chrarnoldus!)
- Fix terminal busy state reset after manual commands complete
- Fix undefined output on multi-file apply_diff operations (thanks @daniel-lxs!)

## [3.19.7] - 2025-06-11

- Fix McpHub sidebar focus behavior to prevent unwanted focus grabbing
- Disable checkpoint functionality when nested git repositories are detected to prevent conflicts
- Remove unused Storybook components and dependencies to reduce bundle size
- Add data-testid ESLint rule for improved testing standards (thanks @elianiva!)
- Update development dependencies including eslint, knip, @types/node, i18next, fast-xml-parser, and @google/genai
- Improve CI infrastructure with GitHub Actions and Blacksmith runner migrations

## [3.19.6] - 2025-06-09

- Replace explicit caching with implicit caching to reduce latency for Gemini models
- Clarify that the default concurrent file read limit is 15 files (thanks @olearycrew!)
- Fix copy button logic (thanks @samhvw8!)
- Fade buttons on history preview if no interaction in progress (thanks @sachasayan!)
- Allow MCP server refreshing, fix state changes in MCP server management UI view (thanks @taylorwilsdon!)
- Remove unnecessary npx usage in some npm scripts (thanks @user202729!)
- Bug fix for trailing slash error when using LiteLLM provider (thanks @kcwhite!)

## [3.19.5] - 2025-06-05

- Fix Gemini 2.5 Pro Preview thinking budget bug

## [3.19.4] - 2025-06-05

- Add Gemini Pro 06-05 model support (thanks @daniel-lxs and @shariqriazz!)
- Fix reading PDF, DOCX, and IPYNB files in read_file tool (thanks @samhvw8!)
- Fix Mermaid CSP errors with enhanced bundling strategy (thanks @KJ7LNW!)
- Improve model info detection for custom Bedrock ARNs (thanks @adamhill!)
- Add OpenAI Compatible embedder for codebase indexing (thanks @SannidhyaSah!)
- Fix multiple memory leaks in ChatView component (thanks @kiwina!)
- Fix WorkspaceTracker resource leaks by disposing FileSystemWatcher (thanks @kiwina!)
- Fix RooTips setTimeout cleanup to prevent state updates on unmounted components (thanks @kiwina!)
- Fix FileSystemWatcher leak in RooIgnoreController (thanks @kiwina!)
- Fix clipboard memory leak by clearing setTimeout in useCopyToClipboard (thanks @kiwina!)
- Fix ClineProvider instance cleanup (thanks @xyOz-dev!)
- Enforce codebase_search as primary tool for code understanding tasks (thanks @hannesrudolph!)
- Improve Docker setup for evals
- Move evals into pnpm workspace, switch from SQLite to Postgres
- Refactor MCP to use getDefaultEnvironment for stdio client transport (thanks @samhvw8!)
- Get rid of "partial" component in names referencing not necessarily partial messages (thanks @wkordalski!)
- Improve feature request template (thanks @elianiva!)

## [3.19.3] - 2025-06-02

- Fix SSE MCP Invocation - Fixed SSE connection issue in McpHub.ts by ensuring transport.start override only applies to stdio transports, allowing SSE and streamable-http transports to retain their original start methods (thanks @taylorwilsdon!)

## [3.19.2] - 2025-06-01

- Add support for Streamable HTTP Transport MCP servers (thanks @taylorwilsdon!)
- Add cached read and writes to stats and cost calculation for LiteLLM provider (thanks @mollux!)
- Prevent dump of an entire file into the context on user edit (thanks @KJ7LNW!)
- Fix directory link handling in markdown (thanks @KJ7LNW!)
- Prevent start_line/end_line in apply_diff REPLACE (thanks @KJ7LNW!)
- Unify history item UI with TaskItem and TaskItemHeader (thanks @KJ7LNW!)
- Fix the label of the OpenAI-compatible API keys
- Fix Virtuoso footer re-rendering issue (thanks @kiwina!)
- Optimize ChatRowContent layout and styles (thanks @zhangtony239!)
- Release memory in apply diff (thanks @xyOz-dev!)
- Upgrade Node.js to v20.19.2 for security enhancements (thanks @PeterDaveHello!)
- Fix typos (thanks @noritaka1166!)

## [3.19.1] - 2025-05-30

- Experimental feature to allow reading multiple files at once (thanks @samhvw8!)
- Fix to correctly pass headers to SSE MCP servers
- Adding support for custom VPC endpoints when using Amazon Bedrock (thanks @kcwhite!)
- Fix bug with context condensing in Amazon Bedrock
- Fix UTF-8 encoding in ExecaTerminalProcess (thanks @mr-ryan-james!)
- Set sidebar name bugfix (thanks @chrarnoldus!)
- Fix link to CONTRIBUTING.md in feature request template (thanks @cannuri!)
- Add task metadata to Unbound and improve caching logic (thanks @pugazhendhi-m!)

## [3.19.0] - 2025-05-29

- Enable intelligent content condensing by default and move condense button out of expanded task menu
- Skip condense and show error if context grows during condensing
- Transform Prompts tab into Modes tab and move support prompts to Settings for better organization
- Add DeepSeek R1 0528 model support to Chutes provider (thanks @zeozeozeo!)
- Fix @directory not respecting .rooignore files (thanks @xyOz-dev!)
- Add rooignore checking for insert_content and search_and_replace tools
- Fix menu breaking when Roo is moved between primary and secondary sidebars (thanks @chrarnoldus!)
- Resolve memory leak in ChatView by stabilizing callback props (thanks @samhvw8!)
- Fix write_to_file to properly create empty files when content is empty (thanks @Ruakij!)
- Fix chat input clearing during running tasks (thanks @xyOz-dev!)
- Update AWS regions to include Spain and Hyderabad
- Improve POSIX shell compatibility in pre-push hook (thanks @PeterDaveHello and @chrarnoldus!)
- Update PAGER environment variable for Windows compatibility in Terminal (thanks @SmartManoj!)
- Add environment variable injection support for whole MCP config (thanks @NamesMT!)
- Update codebase search description to emphasize English query requirements (thanks @ChuKhaLi!)

## [3.18.5] - 2025-05-27

- Add thinking controls for Requesty (thanks @dtrugman!)
- Re-enable telemetry
- Improve zh-TW Traditional Chinese locale (thanks @PeterDaveHello and @chrarnoldus!)
- Improve model metadata for LiteLLM

## [3.18.4] - 2025-05-25

- Fix codebase indexing settings saving and Ollama indexing (thanks @daniel-lxs!)
- Fix handling BOM when user rejects apply_diff (thanks @avtc!)
- Fix wrongfully clearing input on auto-approve (thanks @Ruakij!)
- Fix correct spawnSync parameters for pnpm check in bootstrap.mjs (thanks @ChuKhaLi!)
- Update xAI models and default model ID (thanks @PeterDaveHello!)
- Add metadata to create message (thanks @dtrugman!)

## [3.18.3] - 2025-05-24

- Add reasoning support for Claude 4 and Gemini 2.5 Flash on OpenRouter, plus a fix for o1-pro
- Add experimental codebase indexing + semantic search feature (thanks @daniel-lxs!)
- For providers that used to default to Sonnet 3.7, change to Sonnet 4
- Enable prompt caching for Gemini 2.5 Flash Preview (thanks @shariqriazz!)
- Preserve model settings when selecting a specific OpenRouter provider
- Add ability to refresh LiteLLM models list
- Improve tool descriptions to guide proper file editing tool selection
- Fix MCP Server error loading config when running with npx and bunx (thanks @devxpain!)
- Improve pnpm bootstrapping and add compile script (thanks @KJ7LNW!)
- Simplify object assignment & use startsWith (thanks @noritaka1166!)
- Fix mark-as-read logic in the context tracker (thanks @samhvw8!)
- Remove deprecated claude-3.7-sonnet models from vscodelm (thanks @shariqriazz!)

## [3.18.2] - 2025-05-23

- Fix vscode-material-icons in the filer picker
- Fix global settings export
- Respect user-configured terminal integration timeout (thanks @KJ7LNW)
- Context condensing enhancements (thanks @SannidhyaSah)

## [3.18.1] - 2025-05-22

- Add support for Claude Sonnet 4 and Claude Opus 4 models with thinking variants in Anthropic, Bedrock, and Vertex (thanks @shariqriazz!)
- Fix README gif display in all localized versions
- Fix referer URL
- Switch codebase to a monorepo and create an automated "nightly" build

## [3.18.0] - 2025-05-21

- Add support for Gemini 2.5 Flash preview models (thanks @shariqriazz and @daniel-lxs!)
- Add button to task header to intelligently condense content with visual feedback
- Add YAML support for mode definitions (thanks @R-omk!)
- Add allowedMaxRequests feature to cap consecutive auto-approved requests (inspired by Cline, thanks @hassoncs!)
- Add Qwen3 model series to the Chutes provider (thanks @zeozeozeo!)
- Fix more causes of grey screen issues (thanks @xyOz-dev!)
- Add LM Studio reasoning support (thanks @avtc!)
- Add refresh models button for Unbound provider (thanks @pugazhendhi-m!)
- Add template variables for version numbers in announcement strings (thanks @ChuKhaLi!)
- Make prompt input textareas resizable again
- Fix diffview scroll display (thanks @qdaxb!)
- Fix LM Studio and Ollama usage tracking (thanks @xyOz-dev!)
- Fix links to filename:0 (thanks @RSO!)
- Fix missing or inconsistent syntax highlighting across UI components (thanks @KJ7LNW!)
- Fix packaging to include correct tiktoken.wasm (thanks @vagadiya!)
- Fix import settings bugs and position error messages correctly (thanks @ChuKhaLi!)
- Move audio playing to the webview to ensure cross-platform support (thanks @SmartManoj and @samhvw8!)
- Simplify loop syntax in multiple components (thanks @noritaka1166!)
- Auto reload extension core changes in dev mode (thanks @hassoncs!)

## [3.17.2] - 2025-05-15

- Revert "Switch to the new Roo message parser" (appears to cause a tool parsing bug)
- Lock the versions of vsce and ovsx

## [3.17.1] - 2025-05-15

- Fix the display of the command to execute during approval
- Fix incorrect reserved tokens calculation on OpenRouter (thanks @daniel-lxs!)

## [3.17.0] - 2025-05-14

- Enable Gemini implicit caching
- Add "when to use" section to mode definitions to enable better orchestration
- Add experimental feature to intelligently condense the task context instead of truncating it
- Fix one of the causes of the gray screen issue (thanks @xyOz-dev!)
- Focus improvements for better UI interactions (thanks Cline!)
- Switch to the new Roo message parser for improved performance (thanks Cline!)
- Enable source maps for improved debugging (thanks @KJ7LNW!)
- Update OpenRouter provider to use provider-specific model info (thanks @daniel-lxs!)
- Fix Requesty cost/token reporting (thanks @dtrugman!)
- Improve command execution UI
- Add more in-app links to relevant documentation
- Update the new task tool description and the ask mode custom instructions in the system prompt
- Add IPC types to roo-code.d.ts
- Add build VSIX workflow to pull requests (thanks @SmartManoj!)
- Improve apply_diff tool to intelligently deduce line numbers (thanks @samhvw8!)
- Fix command validation for shell array indexing (thanks @KJ7LNW!)
- Handle diagnostics that point at a directory URI (thanks @daniel-lxs!)
- Fix "Current ask promise was ignored" error (thanks @zxdvd!)

## [3.16.6] - 2025-05-12

- Restore "Improve provider profile management in the external API"
- Fix to subtask sequencing (thanks @wkordalski!)
- Fix webview terminal output processing error (thanks @KJ7LNW!)
- Fix textarea empty string fallback logic (thanks @elianiva!)

## [3.16.5] - 2025-05-10

- Revert "Improve provider profile management in the external API" until we track down a bug with defaults

## [3.16.4] - 2025-05-09

- Improve provider profile management in the external API
- Enforce provider selection in OpenRouter by using 'only' parameter and disabling fallbacks (thanks @shariqriazz!)
- Fix display issues with long profile names (thanks @cannuri!)
- Prevent terminal focus theft on paste after command execution (thanks @MuriloFP!)
- Save OpenAI compatible custom headers correctly
- Fix race condition when updating prompts (thanks @elianiva!)
- Fix display issues in high contrast themes (thanks @zhangtony239!)
- Fix not being able to use specific providers on Openrouter (thanks @daniel-lxs!)
- Show properly formatted multi-line commands in preview (thanks @KJ7LNW!)
- Handle unsupported language errors gracefully in read_file tool (thanks @KJ7LNW!)
- Enhance focus styles in select-dropdown and fix docs URL (thanks @zhangtony239!)
- Properly handle mode name overflow in UI (thanks @elianiva!)
- Fix project MCP always allow issue (thanks @aheizi!)

## [3.16.3] - 2025-05-08

- Revert Tailwind migration while we fix a few spots
- Add Elixir file extension support in language parser (thanks @pfitz!)

## [3.16.2] - 2025-05-07

- Clarify XML tool use formatting instructions
- Error handling code cleanup (thanks @monkeyDluffy6017!)

## [3.16.1] - 2025-05-07

- Add LiteLLM provider support
- Improve stability by detecting and preventing tool loops
- Add Dutch localization (thanks @Githubguy132010!)
- Add editor name to telemetry for better analytics
- Migrate to Tailwind CSS for improved UI consistency
- Fix footer button wrapping in About section on narrow screens (thanks @ecmasx!)
- Update evals defaults
- Update dependencies to latest versions

## [3.16.0] - 2025-05-06

- Add vertical tab navigation to the settings (thanks @dlab-anton)
- Add Groq and Chutes API providers (thanks @shariqriazz)
- Clickable code references in code block (thanks @KJ7LNW)
- Improve accessibility of ato-approve toggles (thanks @Deon588)
- Requesty provider fixes (thanks @dtrugman)
- Fix migration and persistence of per-mode API profiles (thanks @alasano)
- Fix usage of `path.basename` in the extension webview (thanks @samhvw8)
- Fix display issue of the programming language dropdown in the code block component (thanks @zhangtony239)
- MCP server errors are now captured and shown in a new "Errors" tab (thanks @robertheadley)
- Error logging will no longer break MCP functionality if the server is properly connected (thanks @ksze)
- You can now toggle the `terminal.integrated.inheritEnv` VSCode setting directly for the Roo Code settings (thanks @KJ7LNW)
- Add `gemini-2.5-pro-preview-05-06` to the Vertex and Gemini providers (thanks @zetaloop)
- Ensure evals exercises are up-to-date before running evals (thanks @shariqriazz)
- Lots of general UI improvements (thanks @elianiva)
- Organize provider settings into separate components
- Improved icons and translations for the code block component
- Add support for tests that use ESM libraries
- Move environment detail generation to a separate module
- Enable prompt caching by default for supported Gemini models

## [3.15.5] - 2025-05-05

- Update @google/genai to 0.12 (includes some streaming completion bug fixes)
- Rendering performance improvements for code blocks in chat (thanks @KJ7LNW)

## [3.15.4] - 2025-05-04

- Fix a nasty bug that would cause Roo Code to hang, particularly in orchestrator mode
- Improve Gemini caching efficiency

## [3.15.3] - 2025-05-02

- Terminal: Fix empty command bug
- Terminal: More robust process killing
- Optimize Gemini prompt caching for OpenRouter
- Chat view performance improvements

## [3.15.2] - 2025-05-02

- Fix terminal performance issues
- Handle Mermaid validation errors
- Add customizable headers for OpenAI-compatible provider (thanks @mark-bradshaw!)
- Add config option to overwrite OpenAI's API base (thanks @GOODBOY008!)
- Fixes to padding and height issues when resizing the sidebar (thanks @zhangtony239!)
- Remove tool groups from orchestrator mode definition
- Add telemetry for title button clicks

## [3.15.1] - 2025-04-30

- Capture stderr in execa-spawned processes
- Play sound only when action needed from the user (thanks @olearycrew)
- Make retries respect the global auto approve checkbox
- Fix a selection mode bug in the history view (thanks @jr)

## [3.15.0] - 2025-04-30

- Add prompt caching to the Google Vertex provider (thanks @ashktn)
- Add a fallback mechanism for executing terminal commands if VSCode terminal shell integration fails
- Improve the UI/UX of code snippets in the chat (thanks @KJ7LNW)
- Add a reasoning effort setting for the OpenAI Compatible provider (thanks @mr-ryan-james)
- Allow terminal commands to be stopped directly from the chat UI
- Adjust chat view padding to accommodate small width layouts (thanks @zhangtony239)
- Fix file mentions for filenames containing spaces
- Improve the auto-approve toggle buttons for some high-contrast VSCode themes
- Offload expensive count token operations to a web worker (thanks @samhvw8)
- Improve support for mult-root workspaces (thanks @snoyiatk)
- Simplify and streamline Roo Code's quick actions
- Allow Roo Code settings to be imported from the welcome screen (thanks @julionav)
- Remove unused types (thanks @wkordalski)
- Improve the performance of mode switching (thanks @dlab-anton)
- Fix importing & exporting of custom modes (thanks @julionav)

## [3.14.3] - 2025-04-25

- Add Boomerang Orchestrator as a built-in mode
- Improve home screen UI
- Make token count estimation more efficient to reduce gray screens
- Revert change to automatically close files after edit until we figure out how to make it work well with diagnostics
- Clean up settings data model
- Omit reasoning params for non-reasoning models
- Clearer documentation for adding settings (thanks @shariqriazz!)
- Fix word wrapping in Roo message title (thanks @zhangtony239!)
- Update default model id for Unbound from claude 3.5 to 3.7 (thanks @pugazhendhi-m!)

## [3.14.2] - 2025-04-24

- Enable prompt caching for Gemini (with some improvements)
- Allow users to turn prompt caching on / off for Gemini 2.5 on OpenRouter
- Compress terminal output with backspace characters (thanks @KJ7LNW)
- Add Russian language (Спасибо @asychin)

## [3.14.1] - 2025-04-24

- Disable Gemini caching while we investigate issues reported by the community.

## [3.14.0] - 2025-04-23

- Add prompt caching for `gemini-2.5-pro-preview-03-25` in the Gemini provider (Vertex and OpenRouter coming soon!)
- Improve the search_and_replace and insert_content tools and bring them out of experimental, and deprecate append_to_file (thanks @samhvw8!)
- Use material icons for files and folders in mentions (thanks @elianiva!)
- Make the list_files tool more efficient and smarter about excluding directories like .git/
- Fix file drag and drop on Windows and when using SSH tunnels (thanks @NyxJae!)
- Correctly revert changes and suggest alternative tools when write_to_file fails on a missing line count
- Allow interpolation of `workspace`, `mode`, `language`, `shell`, and `operatingSystem` into custom system prompt overrides (thanks @daniel-lxs!)
- Fix interpolation bug in the “add to context” code action (thanks @elianiva!)
- Preserve editor state and prevent tab unpinning during diffs (thanks @seedlord!)
- Improvements to icon rendering on Linux (thanks @elianiva!)
- Improvements to Requesty model list fetching (thanks @dtrugman!)
- Fix user feedback not being added to conversation history in API error state, redundant ‘TASK RESUMPTION’ prompts, and error messages not showing after cancelling API requests (thanks @System233!)
- Track tool use errors in evals
- Fix MCP hub error when dragging extension to another sidebar
- Improve display of long MCP tool arguments
- Fix redundant ‘TASK RESUMPTION’ prompts (thanks @System233!)
- Fix bug opening files when editor has no workspace root
- Make the VS Code LM provider show the correct model information (thanks @QuinsZouls!)
- Fixes to make the focusInput command more reliable (thanks @hongzio!)
- Better handling of aftercursor content in context mentions (thanks @elianiva!)
- Support injecting environment variables in MCP config (thanks @NamesMT!)
- Better handling of FakeAI “controller” object (thanks @wkordalski)
- Remove unnecessary calculation from VS Code LM provider (thanks @d-oit!)
- Allow Amazon Bedrock Marketplace ARNs (thanks @mlopezr!)
- Give better loading feedback on chat rows (thanks @elianiva!)
- Performance improvements to task size calculations
- Don’t immediately show a model ID error when changing API providers
- Fix apply_diff edge cases
- Use a more sensible task export icon
- Use path aliases in webview source files
- Display a warning when the system prompt is overridden
- Better progress indicator for apply_diff tools (thanks @qdaxb!)
- Fix terminal carriage return handling for correct progress bar display (thanks @Yikai-Liao!)

## [3.13.2] - 2025-04-18

- Allow custom URLs for Gemini provider

## [3.13.1] - 2025-04-18

- Support Gemini 2.5 Flash thinking mode (thanks @monotykamary)
- Make auto-approval toggle on/off states more obvious (thanks @sachasayan)
- Add telemetry for shell integration errors
- Fix the path of files dragging into the chat textarea on Windows (thanks @NyxJae)

## [3.13.0] - 2025-04-17

- UI improvements to task header, chat view, history preview, and welcome view (thanks @sachasayan!)
- Add append_to_file tool for appending content to files (thanks @samhvw8!)
- Add Gemini 2.5 Flash Preview to Gemini and Vertex providers (thanks @nbihan-mediware!)
- Fix image support in Bedrock (thanks @Smartsheet-JB-Brown!)
- Make diff edits more resilient to models passing in incorrect parameters

## [3.12.3] - 2025-04-17

- Fix character escaping issues in Gemini diff edits
- Support dragging and dropping tabs into the chat box (thanks @NyxJae!)
- Make sure slash commands only fire at the beginning of the chat box (thanks @logosstone!)

## [3.12.2] - 2025-04-16

- Add OpenAI o3 & 4o-mini (thanks @PeterDaveHello!)
- Improve file/folder context mention UI (thanks @elianiva!)
- Improve diff error telemetry

## [3.12.1] - 2025-04-16

- Bugfix to Edit button visibility in the select dropdowns

## [3.12.0] - 2025-04-15

- Add xAI provider and expose reasoning effort options for Grok on OpenRouter (thanks Cline!)
- Make diff editing config per-profile and improve pre-diff string normalization
- Make checkpoints faster and more reliable
- Add a search bar to mode and profile select dropdowns (thanks @samhvw8!)
- Add telemetry for code action usage, prompt enhancement usage, and consecutive mistake errors
- Suppress zero cost values in the task header (thanks @do-it!)
- Make JSON parsing safer to avoid crashing the webview on bad input
- Allow users to bind a keyboard shortcut for accepting suggestions or input in the chat view (thanks @axkirillov!)

## [3.11.17] - 2025-04-14

- Improvements to OpenAI cache reporting and cost estimates (thanks @monotykamary and Cline!)
- Visual improvements to the auto-approve toggles (thanks @sachasayan!)
- Bugfix to diff apply logic (thanks @avtc for the test case!) and telemetry to track errors going forward
- Fix race condition in capturing short-running terminal commands (thanks @KJ7LNW!)
- Fix eslint error (thanks @nobu007!)

## [3.11.16] - 2025-04-14

- Add gpt-4.1, gpt-4.1-mini, and gpt-4.1-nano to the OpenAI provider
- Include model ID in environment details and when exporting tasks (thanks @feifei325!)

## [3.11.15] - 2025-04-13

- Add ability to filter task history by workspace (thanks @samhvw8!)
- Fix Node.js version in the .tool-versions file (thanks @bogdan0083!)
- Fix duplicate suggested mentions for open tabs (thanks @samhvw8!)
- Fix Bedrock ARN validation and token expiry issue when using profiles (thanks @vagadiya!)
- Add Anthropic option to pass API token as Authorization header instead of X-Api-Key (thanks @mecab!)
- Better documentation for adding new settings (thanks @KJ7LNW!)
- Localize package.json (thanks @samhvw8!)
- Add option to hide the welcome message and fix the background color for the new profile dialog (thanks @zhangtony239!)
- Restore the focus ring for the VSCodeButton component (thanks @pokutuna!)

## [3.11.14] - 2025-04-11

- Support symbolic links in rules folders to directories and other symbolic links (thanks @taisukeoe!)
- Stronger enforcement of the setting to always read full files instead of doing partial reads

## [3.11.13] - 2025-04-11

- Loads of terminal improvements: command delay, PowerShell counter, and ZSH EOL mark (thanks @KJ7LNW!)
- Add file context tracking system (thanks @samhvw8 and @canvrno!)
- Improved display of diff errors + easy copying for investigation
- Fixes to .vscodeignore (thanks @franekp!)
- Fix a zh-CN translation for model capabilities (thanks @zhangtony239!)
- Rename Amazon Bedrock to Amazon Bedrock (thanks @ronyblum!)
- Update extension title and description (thanks @StevenTCramer!)

## [3.11.12] - 2025-04-09

- Make Grok3 streaming work with OpenAI Compatible (thanks @amittell!)
- Tweak diff editing logic to make it more tolerant of model errors

## [3.11.11] - 2025-04-09

- Fix highlighting interaction with mode/profile dropdowns (thanks @atlasgong!)
- Add the ability to set Host header and legacy OpenAI API in the OpenAI-compatible provider for better proxy support
- Improvements to TypeScript, C++, Go, Java, Python tree-sitter parsers (thanks @KJ7LNW!)
- Fixes to terminal working directory logic (thanks @KJ7LNW!)
- Improve readFileTool XML output format (thanks @KJ7LNW!)
- Add o1-pro support (thanks @arthurauffray!)
- Follow symlinked rules files/directories to allow for more flexible rule setups
- Focus Roo Code in the sidebar when running tasks in the sidebar via the API
- Improve subtasks UI

## [3.11.10] - 2025-04-08

- Fix bug where nested .roo/rules directories are not respected properly (thanks @taisukeoe!)
- Handle long command output more efficiently in the chat row (thanks @samhvw8!)
- Fix cache usage tracking for OpenAI-compatible providers
- Add custom translation instructions for zh-CN (thanks @System233!)
- Code cleanup after making rate-limits per-profile (thanks @ross!)

## [3.11.9] - 2025-04-07

- Rate-limit setting updated to be per-profile (thanks @ross and @olweraltuve!)
- You can now place multiple rules files in the .roo/rules/ and .roo/rules-{mode}/ folders (thanks @upamune!)
- Prevent unnecessary autoscroll when buttons appear (thanks @shtse8!)
- Add Gemini 2.5 Pro Preview to Vertex AI (thanks @nbihan-mediware!)
- Tidy up following ClineProvider refactor (thanks @diarmidmackenzie!)
- Clamp negative line numbers when reading files (thanks @KJ7LNW!)
- Enhance Rust tree-sitter parser with advanced language structures (thanks @KJ7LNW!)
- Persist settings on api.setConfiguration (thanks @gtaylor!)
- Add deep links to settings sections
- Add command to focus Roo Code input field (thanks @axkirillov!)
- Add resize and hover actions to the browser (thanks @SplittyDev!)
- Add resumeTask and isTaskInHistory to the API (thanks @franekp!)
- Fix bug displaying boolean/numeric suggested answers
- Dynamic Vite port detection for webview development (thanks @KJ7LNW!)

## [3.11.8] - 2025-04-05

- Improve combineApiRequests performance to reduce gray screens of death (thanks @kyle-apex!)
- Add searchable dropdown to API config profiles on the settings screen (thanks @samhvw8!)
- Add workspace tracking to history items in preparation for future filtering (thanks @samhvw8!)
- Fix search highlighting UI in history search (thanks @samhvw8!)
- Add support for .roorules and give deprecation warning for .clinerules (thanks @upamune!)
- Fix nodejs version format in .tool-versions file (thanks @upamune!)

## [3.11.7] - 2025-04-04

- Improve file tool context formatting and diff error guidance
- Improve zh-TW localization (thanks @PeterDaveHello!)
- Implement reference counting for McpHub disposal
- Update buttons to be more consistent (thanks @kyle-apex!)
- Improve zh-CN localization (thanks @System233!)

## [3.11.6] - 2025-04-04

- Add the gemini 2.5 pro preview model with upper bound pricing

## [3.11.5] - 2025-04-03

- Add prompt caching for Amazon Bedrock (thanks @Smartsheet-JB-Brown!)
- Add support for configuring the current working directory of MCP servers (thanks @shoopapa!)
- Add profile management functions to API (thanks @gtaylor!)
- Improvements to diff editing functionality, tests, and error messages (thanks @p12tic!)
- Fix for follow-up questions grabbing the focus (thanks @diarmidmackenzie!)
- Show menu buttons when popping the extension out into a new tab (thanks @benny123tw!)

## [3.11.4] - 2025-04-02

- Correctly post state to webview when the current task is cleared (thanks @wkordalski!)
- Fix unit tests to run properly on Windows (thanks @StevenTCramer!)
- Tree-sitter enhancements: TSX, TypeScript, JSON, and Markdown support (thanks @KJ7LNW!)
- Fix issue with line number stripping for deletions in apply_diff
- Update history selection mode button spacing (thanks @kyle-apex!)
- Limit dropdown menu height to 80% of the viewport (thanks @axmo!)
- Update dependencies via `npm audit fix` (thanks @PeterDaveHello!)
- Enable model select when api fails (thanks @kyle-apex!)
- Fix issue where prompts and settings tabs were not scrollable when accessed from dropdown menus
- Update AWS region dropdown menu to the most recent data (thanks @Smartsheet-JB-Brown!)
- Fix prompt enhancement for Bedrock (thanks @Smartsheet-JB-Brown!)
- Allow processes to access the Roo Code API via a unix socket
- Improve zh-TW Traditional Chinese translations (thanks @PeterDaveHello!)
- Add support for Azure AI Inference Service with DeepSeek-V3 model (thanks @thomasjeung!)
- Fix off-by-one error in tree-sitter line numbers
- Remove the experimental unified diff
- Make extension icon more visible in different themes

## [3.11.3] - 2025-03-31

- Revert mention changes in case they're causing performance issues/crashes

## [3.11.2] - 2025-03-31

- Fix bug in loading Requesty key balance
- Fix bug with Bedrock inference profiles
- Update the webview when changing settings via the API
- Refactor webview messages code (thanks @diarmidmackenzie!)

## [3.11.1] - 2025-03-30

- Relax provider profiles schema and add telemetry

## [3.11.0] - 2025-03-30

- Replace single-block-diff with multi-block-diff fast editing strategy
- Support project-level MCP config in .roo/mcp.json (thanks @aheizi!)
- Show OpenRouter and Requesty key balance on the settings screen
- Support import/export of settings
- Add pinning and sorting for API configuration dropdown (thanks @jwcraig!)
- Add Gemini 2.5 Pro to GCP Vertex AI provider (thanks @nbihan-mediware!)
- Smarter retry logic for Gemini
- Fix Gemini command escaping
- Support @-mentions of files with spaces in the name (thanks @samhvw8!)
- Improvements to partial file reads (thanks @KJ7LNW!)
- Fix list_code_definition_names to support files (thanks @KJ7LNW!)
- Refactor tool-calling logic to make the code a lot easier to work with (thanks @diarmidmackenzie, @bramburn, @KJ7LNW, and everyone else who helped!)
- Prioritize “Add to Context” in the code actions and include line numbers (thanks @samhvw8!)
- Add an activation command that other extensions can use to interface with Roo Code (thanks @gtaylor!)
- Preserve language characters in file @-mentions (thanks @aheizi!)
- Browser tool improvements (thanks @afshawnlotfi!)
- Display info about partial reads in the chat row
- Link to the settings page from the auto-approve toolbar
- Link to provider docs from the API options
- Fix switching profiles to ensure only the selected profile is switched (thanks @feifei325!)
- Allow custom o3-mini-<reasoning> model from OpenAI-compatible providers (thanks @snoyiatk!)
- Edit suggested answers before accepting them (thanks @samhvw8!)

## [3.10.5] - 2025-03-25

- Updated value of max tokens for gemini-2.5-pro-03-25 to 65,536 (thanks @linegel!)
- Fix logic around when we fire task completion events

## [3.10.4] - 2025-03-25

- Dynamically fetch instructions for creating/editing custom modes and MCP servers (thanks @diarmidmackenzie!)
- Added Gemini 2.5 Pro model to Google Gemini provider (thanks @samsilveira!)
- Add settings to control whether to auto-approve reads and writes outside of the workspace
- Update UX for chat text area (thanks @chadgauth!)
- Support a custom storage path for tasks (thanks @Chenjiayuan195!)
- Add a New Task command in the Command Palette (thanks @qdaxb!)
- Add R1 support checkbox to Open AI compatible provider to support QWQ (thanks @teddyOOXX!)
- Support test declarations in TypeScript tree-sitter queries (thanks @KJ7LNW!)
- Add Bedrock support for application-inference-profile (thanks @maekawataiki!)
- Rename and migrate global MCP and modes files (thanks @StevenTCramer!)
- Add watchPaths option to McpHub for file change detection (thanks @01Rian!)
- Read image responses from MCP calls (thanks @nevermorec!)
- Add taskCreated event to API and subscribe to Cline events earlier (thanks @wkordalski!)
- Fixes to numeric formatting suffix internationalization (thanks @feifei325!)
- Fix open tab support in the context mention suggestions (thanks @aheizi!)
- Better display of OpenRouter “overloaded” error messages
- Fix browser tool visibility in system prompt preview (thanks @cannuri!)
- Fix the supportsPromptCache value for OpenAI models (thanks @PeterDaveHello!)
- Fix readme links to docs (thanks @kvokka!)
- Run ‘npm audit fix’ on all of our libraries

## [3.10.3] - 2025-03-23

- Update the welcome page to provide 1-click OAuth flows with LLM routers (thanks @dtrugman!)
- Switch to a more direct method of tracking OpenRouter tokens/spend
- Make partial file reads backwards-compatible with custom system prompts and give users more control over the chunk size
- Fix issues where questions and suggestions weren’t showing up for non-streaming models and were hard to read in some themes
- A variety of fixes and improvements to experimental multi-block diff (thanks @KJ7LNW!)
- Fix opacity of drop-down menus in settings (thanks @KJ7LNW!)
- Fix bugs with reading and mentioning binary files like PDFs
- Fix the pricing information for OpenRouter free models (thanks @Jdo300!)
- Fix an issue with our unit tests on Windows (thanks @diarmidmackenzie!)
- Fix a maxTokens issue for the Outbound provider (thanks @pugazhendhi-m!)
- Fix a line number issue with partial file reads (thanks @samhvw8!)

## [3.10.2] - 2025-03-21

- Fixes to context mentions on Windows
- Fixes to German translations (thanks @cannuri!)
- Fixes to telemetry banner internationalization
- Sonnet 3.7 non-thinking now correctly uses 8192 max output tokens

## [3.10.1] - 2025-03-20

- Make the suggested responses optional to not break overridden system prompts

## [3.10.0] - 2025-03-20

- Suggested responses to questions (thanks samhvw8!)
- Support for reading large files in chunks (thanks samhvw8!)
- More consistent @-mention lookups of files and folders
- Consolidate code actions into a submenu (thanks samhvw8!)
- Fix MCP error logging (thanks aheizi!)
- Improvements to search_files tool formatting and logic (thanks KJ7LNW!)
- Fix changelog formatting in GitHub Releases (thanks pdecat!)
- Add fake provider for integration tests (thanks franekp!)
- Reflect Cross-region inference option in ap-xx region (thanks Yoshino-Yukitaro!)
- Fix bug that was causing task history to be lost when using WSL

## [3.9.2] - 2025-03-19

- Update GitHub Actions workflow to automatically create GitHub Releases (thanks @pdecat!)
- Correctly persist the text-to-speech speed state (thanks @heyseth!)
- Fixes to French translations (thanks @arthurauffray!)
- Optimize build time for local development (thanks @KJ7LNW!)
- VSCode theme fixes for select, dropdown and command components
- Bring back the ability to manually enter a model name in the model picker
- Fix internationalization of the announcement title and the browser

## [3.9.1] - 2025-03-18

- Pass current language to system prompt correctly so Roo thinks and speaks in the selected language

## [3.9.0] - 2025-03-18

- Internationalize Roo Code into Catalan, German, Spanish, French, Hindi, Italian, Japanese, Korean, Polish, Portuguese, Turkish, Vietnamese, Simplified Chinese, and Traditional Chinese (thanks @feifei325!)
- Bring back support for MCP over SSE (thanks @aheizi!)
- Add a text-to-speech option to have Roo talk to you as it works (thanks @heyseth!)
- Choose a specific provider when using OpenRouter (thanks PhunkyBob!)
- Support batch deletion of task history (thanks @aheizi!)
- Internationalize Human Relay, adjust the layout, and make it work on the welcome screen (thanks @NyxJae!)
- Fix shell integration race condition (thanks @KJ7LNW!)
- Fix display updating for Bedrock custom ARNs that are prompt routers (thanks @Smartsheet-JB-Brown!)
- Fix to exclude search highlighting when copying items from task history (thanks @im47cn!)
- Fix context mentions to work with multiple-workspace projects (thanks @teddyOOXX!)
- Fix to task history saving when running multiple Roos (thanks @samhvw8!)
- Improve task deletion when underlying files are missing (thanks @GitlyHallows!)
- Improve support for NixOS & direnv (thanks @wkordalski!)
- Fix wheel scrolling when Roo is opened in editor tabs (thanks @GitlyHallows!)
- Don’t automatically mention the file when using the "Add to context" code action (thanks @qdaxb!)
- Expose task stack in `RooCodeAPI` (thanks @franekp!)
- Give the models visibility into the current task's API cost

## [3.8.6] - 2025-03-13

- Revert SSE MCP support while we debug some config validation issues

## [3.8.5] - 2025-03-12

- Refactor terminal architecture to address critical issues with the current design (thanks @KJ7LNW!)
- MCP over SSE (thanks @aheizi!)
- Support for remote browser connections (thanks @afshawnlotfi!)
- Preserve parent-child relationship when cancelling subtasks (thanks @cannuri!)
- Custom baseUrl for Google AI Studio Gemini (thanks @dqroid!)
- PowerShell-specific command handling (thanks @KJ7LNW!)
- OpenAI-compatible DeepSeek/QwQ reasoning support (thanks @lightrabbit!)
- Anthropic-style prompt caching in the OpenAI-compatible provider (thanks @dleen!)
- Add Deepseek R1 for Amazon Bedrock (thanks @ATempsch!)
- Fix MarkdownBlock text color for Dark High Contrast theme (thanks @cannuri!)
- Add gemini-2.0-pro-exp-02-05 model to vertex (thanks @shohei-ihaya!)
- Bring back progress status for multi-diff edits (thanks @qdaxb!)
- Refactor alert dialog styles to use the correct vscode theme (thanks @cannuri!)
- Custom ARNs in Amazon Bedrock (thanks @Smartsheet-JB-Brown!)
- Update MCP servers directory path for platform compatibility (thanks @hannesrudolph!)
- Fix browser system prompt inclusion rules (thanks @cannuri!)
- Publish git tags to github from CI (thanks @pdecat!)
- Fixes to OpenAI-style cost calculations (thanks @dtrugman!)
- Fix to allow using an excluded directory as your working directory (thanks @Szpadel!)
- Kotlin language support in list_code_definition_names tool (thanks @kohii!)
- Better handling of diff application errors (thanks @qdaxb!)
- Update Bedrock prices to the latest (thanks @Smartsheet-JB-Brown!)
- Fixes to OpenRouter custom baseUrl support
- Fix usage tracking for SiliconFlow and other providers that include usage on every chunk
- Telemetry for checkpoint save/restore/diff and diff strategies

## [3.8.4] - 2025-03-09

- Roll back multi-diff progress indicator temporarily to fix a double-confirmation in saving edits
- Add an option in the prompts tab to save tokens by disabling the ability to ask Roo to create/edit custom modes for you (thanks @hannesrudolph!)

## [3.8.3] - 2025-03-09

- Fix VS Code LM API model picker truncation issue

## [3.8.2] - 2025-03-08

- Create an auto-approval toggle for subtask creation and completion (thanks @shaybc!)
- Show a progress indicator when using the multi-diff editing strategy (thanks @qdaxb!)
- Add o3-mini support to the OpenAI-compatible provider (thanks @yt3trees!)
- Fix encoding issue where unreadable characters were sometimes getting added to the beginning of files
- Fix issue where settings dropdowns were getting truncated in some cases

## [3.8.1] - 2025-03-07

- Show the reserved output tokens in the context window visualization
- Improve the UI of the configuration profile dropdown (thanks @DeXtroTip!)
- Fix bug where custom temperature could not be unchecked (thanks @System233!)
- Fix bug where decimal prices could not be entered for OpenAI-compatible providers (thanks @System233!)
- Fix bug with enhance prompt on Sonnet 3.7 with a high thinking budget (thanks @moqimoqidea!)
- Fix bug with the context window management for thinking models (thanks @ReadyPlayerEmma!)
- Fix bug where checkpoints were no longer enabled by default
- Add extension and VSCode versions to telemetry

## [3.8.0] - 2025-03-07

- Add opt-in telemetry to help us improve Roo Code faster (thanks Cline!)
- Fix terminal overload / gray screen of death, and other terminal issues
- Add a new experimental diff editing strategy that applies multiple diff edits at once (thanks @qdaxb!)
- Add support for a .rooignore to prevent Roo Code from read/writing certain files, with a setting to also exclude them from search/lists (thanks Cline!)
- Update the new_task tool to return results to the parent task on completion, supporting better orchestration (thanks @shaybc!)
- Support running Roo in multiple editor windows simultaneously (thanks @samhvw8!)
- Make checkpoints asynchronous and exclude more files to speed them up
- Redesign the settings page to make it easier to navigate
- Add credential-based authentication for Vertex AI, enabling users to easily switch between Google Cloud accounts (thanks @eonghk!)
- Update the DeepSeek provider with the correct baseUrl and track caching correctly (thanks @olweraltuve!)
- Add a new “Human Relay” provider that allows you to manually copy information to a Web AI when needed, and then paste the AI's response back into Roo Code (thanks @NyxJae)!
- Add observability for OpenAI providers (thanks @refactorthis!)
- Support speculative decoding for LM Studio local models (thanks @adamwlarson!)
- Improve UI for mode/provider selectors in chat
- Improve styling of the task headers (thanks @monotykamary!)
- Improve context mention path handling on Windows (thanks @samhvw8!)

## [3.7.12] - 2025-03-03

- Expand max tokens of thinking models to 128k, and max thinking budget to over 100k (thanks @monotykamary!)
- Fix issue where keyboard mode switcher wasn't updating API profile (thanks @aheizi!)
- Use the count_tokens API in the Anthropic provider for more accurate context window management
- Default middle-out compression to on for OpenRouter
- Exclude MCP instructions from the prompt if the mode doesn't support MCP
- Add a checkbox to disable the browser tool
- Show a warning if checkpoints are taking too long to load
- Update the warning text for the VS LM API
- Correctly populate the default OpenRouter model on the welcome screen

## [3.7.11] - 2025-03-02

- Don't honor custom max tokens for non thinking models
- Include custom modes in mode switching keyboard shortcut
- Support read-only modes that can run commands

## [3.7.10] - 2025-03-01

- Add Gemini models on Vertex AI (thanks @ashktn!)
- Keyboard shortcuts to switch modes (thanks @aheizi!)
- Add support for Mermaid diagrams (thanks Cline!)

## [3.7.9] - 2025-03-01

- Delete task confirmation enhancements
- Smarter context window management
- Prettier thinking blocks
- Fix maxTokens defaults for Claude 3.7 Sonnet models
- Terminal output parsing improvements (thanks @KJ7LNW!)
- UI fix to dropdown hover colors (thanks @SamirSaji!)
- Add support for Claude Sonnet 3.7 thinking via Vertex AI (thanks @lupuletic!)

## [3.7.8] - 2025-02-27

- Add Vertex AI prompt caching support for Claude models (thanks @aitoroses and @lupuletic!)
- Add gpt-4.5-preview
- Add an advanced feature to customize the system prompt

## [3.7.7] - 2025-02-27

- Graduate checkpoints out of beta
- Fix enhance prompt button when using Thinking Sonnet
- Add tooltips to make what buttons do more obvious

## [3.7.6] - 2025-02-26

- Handle really long text better in the in the ChatRow similar to TaskHeader (thanks @joemanley201!)
- Support multiple files in drag-and-drop
- Truncate search_file output to avoid crashing the extension
- Better OpenRouter error handling (no more "Provider Error")
- Add slider to control max output tokens for thinking models

## [3.7.5] - 2025-02-26

- Fix context window truncation math (see [#1173](https://github.com/RooCodeInc/Roo-Code/issues/1173))
- Fix various issues with the model picker (thanks @System233!)
- Fix model input / output cost parsing (thanks @System233!)
- Add drag-and-drop for files
- Enable the "Thinking Budget" slider for Claude 3.7 Sonnet on OpenRouter

## [3.7.4] - 2025-02-25

- Fix a bug that prevented the "Thinking" setting from properly updating when switching profiles.

## [3.7.3] - 2025-02-25

- Support for ["Thinking"](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking) Sonnet 3.7 when using the Anthropic provider.

## [3.7.2] - 2025-02-24

- Fix computer use and prompt caching for OpenRouter's `anthropic/claude-3.7-sonnet:beta` (thanks @cte!)
- Fix sliding window calculations for Sonnet 3.7 that were causing a context window overflow (thanks @cte!)
- Encourage diff editing more strongly in the system prompt (thanks @hannesrudolph!)

## [3.7.1] - 2025-02-24

- Add Amazon Bedrock support for Sonnet 3.7 and update some defaults to Sonnet 3.7 instead of 3.5

## [3.7.0] - 2025-02-24

- Introducing Roo Code 3.7, with support for the new Claude Sonnet 3.7. Because who cares about skipping version numbers anymore? Thanks @lupuletic and @cte for the PRs!

## [3.3.26] - 2025-02-27

- Adjust the default prompt for Debug mode to focus more on diagnosis and to require user confirmation before moving on to implementation

## [3.3.25] - 2025-02-21

- Add a "Debug" mode that specializes in debugging tricky problems (thanks [Ted Werbel](https://x.com/tedx_ai/status/1891514191179309457) and [Carlos E. Perez](https://x.com/IntuitMachine/status/1891516362486337739)!)
- Add an experimental "Power Steering" option to significantly improve adherence to role definitions and custom instructions

## [3.3.24] - 2025-02-20

- Fixed a bug with region selection preventing Amazon Bedrock profiles from being saved (thanks @oprstchn!)
- Updated the price of gpt-4o (thanks @marvijo-code!)

## [3.3.23] - 2025-02-20

- Handle errors more gracefully when reading custom instructions from files (thanks @joemanley201!)
- Bug fix to hitting "Done" on settings page with unsaved changes (thanks @System233!)

## [3.3.22] - 2025-02-20

- Improve the Provider Settings configuration with clear Save buttons and warnings about unsaved changes (thanks @System233!)
- Correctly parse `<think>` reasoning tags from Ollama models (thanks @System233!)
- Add support for setting custom preferred languages on the Prompts tab, as well as adding Catalan to the list of languages (thanks @alarno!)
- Add a button to delete MCP servers (thanks @hannesrudolph!)
- Fix a bug where the button to copy the system prompt preview always copied the Code mode version
- Fix a bug where the .roomodes file was not automatically created when adding custom modes from the Prompts tab
- Allow setting a wildcard (`*`) to auto-approve all command execution (use with caution!)

## [3.3.21] - 2025-02-17

- Fix input box revert issue and configuration loss during profile switch (thanks @System233!)
- Fix default preferred language for zh-cn and zh-tw (thanks @System233!)
- Fix Mistral integration (thanks @d-oit!)
- Feature to mention `@terminal` to pull terminal output into context (thanks Cline!)
- Fix system prompt to make sure Roo knows about all available modes
- Enable streaming mode for OpenAI o1

## [3.3.20] - 2025-02-14

- Support project-specific custom modes in a .roomodes file
- Add more Mistral models (thanks @d-oit and @bramburn!)
- By popular request, make it so Ask mode can't write to Markdown files and is purely for chatting with
- Add a setting to control the number of open editor tabs to tell the model about (665 is probably too many!)
- Fix race condition bug with entering API key on the welcome screen

## [3.3.19] - 2025-02-12

- Fix a bug where aborting in the middle of file writes would not revert the write
- Honor the VS Code theme for dialog backgrounds
- Make it possible to clear out the default custom instructions for built-in modes
- Add a help button that links to our new documentation site (which we would love help from the community to improve!)
- Switch checkpoints logic to use a shadow git repository to work around issues with hot reloads and polluting existing repositories (thanks Cline for the inspiration!)

## [3.3.18] - 2025-02-11

- Add a per-API-configuration model temperature setting (thanks @joemanley201!)
- Add retries for fetching usage stats from OpenRouter (thanks @jcbdev!)
- Fix bug where disabled MCP servers would not show up in the settings on initialization (thanks @MuriloFP!)
- Add the Requesty provider and clean up a lot of shared model picker code (thanks @samhvw8!)
- Add a button on the Prompts tab to copy the full system prompt to the clipboard (thanks @mamertofabian!)
- Fix issue where Ollama/LMStudio URLs would flicker back to previous while entering them in settings
- Fix logic error where automatic retries were waiting twice as long as intended
- Rework the checkpoints code to avoid conflicts with file locks on Windows (sorry for the hassle!)

## [3.3.17] - 2025-02-09

- Fix the restore checkpoint popover
- Unset git config that was previously set incorrectly by the checkpoints feature

## [3.3.16] - 2025-02-09

- Support Volcano Ark platform through the OpenAI-compatible provider
- Fix jumpiness while entering API config by updating on blur instead of input
- Add tooltips on checkpoint actions and fix an issue where checkpoints were overwriting existing git name/email settings - thanks for the feedback!

## [3.3.15] - 2025-02-08

- Improvements to MCP initialization and server restarts (thanks @MuriloFP and @hannesrudolph!)
- Add a copy button to the recent tasks (thanks @hannesrudolph!)
- Improve the user experience for adding a new API profile
- Another significant fix to API profile switching on the settings screen
- Opt-in experimental version of checkpoints in the advanced settings

## [3.3.14]

- Should have skipped floor 13 like an elevator. This fixes the broken 3.3.13 release by reverting some changes to the deployment scripts.

## [3.3.13]

- Ensure the DeepSeek r1 model works with Ollama (thanks @sammcj!)
- Enable context menu commands in the terminal (thanks @samhvw8!)
- Improve sliding window truncation strategy for models that do not support prompt caching (thanks @nissa-seru!)
- First step of a more fundamental fix to the bugs around switching API profiles. If you've been having issues with this please try again and let us know if works any better! More to come soon, including fixing the laggy text entry in provider settings.

## [3.3.12]

- Bug fix to changing a mode's API configuration on the prompts tab
- Add new Gemini models

## [3.3.11]

- Safer shell profile path check to avoid an error on Windows
- Autocomplete for slash commands

## [3.3.10]

- Add shortcuts to the currently open tabs in the "Add File" section of @-mentions (thanks @olup!)
- Fix pricing for o1-mini (thanks @hesara!)
- Fix context window size calculation (thanks @MuriloFP!)
- Improvements to experimental unified diff strategy and selection logic in code actions (thanks @nissa-seru!)
- Enable markdown formatting in o3 and o1 (thanks @nissa-seru!)
- Improved terminal shell detection logic (thanks @canvrno for the original and @nissa-seru for the port!)
- Fix occasional errors when switching between API profiles (thanks @samhvw8!)
- Visual improvements to the list of modes on the prompts tab
- Fix double-scrollbar in provider dropdown
- Visual cleanup to the list of modes on the prompts tab
- Improvements to the default prompts for Architect and Ask mode
- Allow switching between modes with slash messages like `/ask why is the sky blue?`

## [3.3.9]

- Add o3-mini-high and o3-mini-low

## [3.3.8]

- Fix o3-mini in the Glama provider (thanks @Punkpeye!)
- Add the option to omit instructions for creating MCP servers from the system prompt (thanks @samhvw8!)
- Fix a bug where renaming API profiles without actually changing the name would delete them (thanks @samhvw8!)

## [3.3.7]

- Support for o3-mini (thanks @shpigunov!)
- Code Action improvements to allow selecting code and adding it to context, plus bug fixes (thanks @samhvw8!)
- Ability to include a message when approving or rejecting tool use (thanks @napter!)
- Improvements to chat input box styling (thanks @psv2522!)
- Capture reasoning from more variants of DeepSeek R1 (thanks @Szpadel!)
- Use an exponential backoff for API retries (if delay after first error is 5s, delay after second consecutive error will be 10s, then 20s, etc)
- Add a slider in advanced settings to enable rate limiting requests to avoid overloading providers (i.e. wait at least 10 seconds between API requests)
- Prompt tweaks to make Roo better at creating new custom modes for you

## [3.3.6]

- Add a "new task" tool that allows Roo to start new tasks with an initial message and mode
- Fix a bug that was preventing the use of qwen-max and potentially other OpenAI-compatible providers (thanks @Szpadel!)
- Add support for perplexity/sonar-reasoning (thanks @Szpadel!)
- Visual fixes to dropdowns (thanks @psv2522!)
- Add the [Unbound](https://getunbound.ai/) provider (thanks @vigneshsubbiah16!)

## [3.3.5]

- Make information about the conversation's context window usage visible in the task header for humans and in the environment for models (thanks @MuriloFP!)
- Add checkboxes to auto-approve mode switch requests (thanks @MuriloFP!)
- Add new experimental editing tools `insert_content` (for inserting blocks of text at a line number) and `search_and_replace` (for replacing all instances of a phrase or regex) to complement diff editing and whole file editing (thanks @samhvw8!)
- Improved DeepSeek R1 support by capturing reasoning from DeepSeek API as well as more OpenRouter variants, not using system messages, and fixing a crash on empty chunks. Still depends on the DeepSeek API staying up but we'll be in a better place when it does! (thanks @Szpadel!)

## [3.3.4]

- Add per-server MCP network timeout configuration ranging from 15 seconds to an hour
- Speed up diff editing (thanks @hannesrudolph and @KyleHerndon!)
- Add option to perform explain/improve/fix code actions either in the existing task or a new task (thanks @samhvw8!)

## [3.3.3]

- Throw errors sooner when a mode tries to write a restricted file
- Styling improvements to the mode/configuration dropdowns (thanks @psv2522!)

## [3.3.2]

- Add a dropdown to select the API configuration for a mode in the Prompts tab
- Fix bug where always allow wasn't showing up for MCP tools
- Improve OpenRouter DeepSeek-R1 integration by setting temperature to the recommended 0.6 and displaying the reasoning output (thanks @Szpadel - it's really fascinating to watch!)
- Allow specifying a custom OpenRouter base URL (thanks @dairui1!)
- Make the UI for nested settings nicer (thanks @PretzelVector!)

## [3.3.1]

- Fix issue where the terminal management system was creating unnecessary new terminals (thanks @evan-fannin!)
- Fix bug where the saved API provider for a mode wasn't being selected after a mode switch command

## [3.3.0]

- Native VS Code code actions support with quick fixes and refactoring options
- Modes can now request to switch to other modes when needed
- Ask and Architect modes can now edit markdown files
- Custom modes can now be restricted to specific file patterns (for example, a technical writer who can only edit markdown files 👋)
- Support for configuring the Bedrock provider with AWS Profiles
- New Roo Code community Discord at https://roocode.com/discord!

## [3.2.8]

- Fixed bug opening custom modes settings JSON
- Reverts provider key entry back to checking onInput instead of onChange to hopefully address issues entering API keys (thanks @samhvw8!)
- Added explicit checkbox to use Azure for OpenAI compatible providers (thanks @samhvw8!)
- Fixed Glama usage reporting (thanks @punkpeye!)
- Added Llama 3.3 70B Instruct model to the Amazon Bedrock provider options (thanks @Premshay!)

## [3.2.7]

- Fix bug creating new configuration profiles

## [3.2.6]

- Fix bug with role definition overrides for built-in modes

## [3.2.5]

- Added gemini flash thinking 01-21 model and a few visual fixes (thanks @monotykamary!)

## [3.2.4]

- Only allow use of the diff tool if it's enabled in settings

## [3.2.3]

- Fix bug where language selector wasn't working

## [3.2.0 - 3.2.2]

- **Name Change From Roo Cline to Roo Code:** We're excited to announce our new name! After growing beyond 50,000 installations, we've rebranded from Roo Cline to Roo Code to better reflect our identity as we chart our own course.

- **Custom Modes:** Create your own personas for Roo Code! While our built-in modes (Code, Architect, Ask) are still here, you can now shape entirely new ones:
    - Define custom prompts
    - Choose which tools each mode can access
    - Create specialized assistants for any workflow
    - Just type "Create a new mode for <X>" or visit the Prompts tab in the top menu to get started

Join us at https://www.reddit.com/r/RooCode to share your custom modes and be part of our next chapter!

## [3.1.7]

- DeepSeek-R1 support (thanks @philipnext!)
- Experimental new unified diff algorithm can be enabled in settings (thanks @daniel-lxs!)
- More fixes to configuration profiles (thanks @samhvw8!)

## [3.1.6]

- Add Mistral (thanks Cline!)
- Fix bug with VSCode LM configuration profile saving (thanks @samhvw8!)

## [3.1.4 - 3.1.5]

- Bug fixes to the auto approve menu

## [3.1.3]

- Add auto-approve chat bar (thanks Cline!)
- Fix bug with VS Code Language Models integration

## [3.1.2]

- Experimental support for VS Code Language Models including Copilot (thanks @RaySinner / @julesmons!)
- Fix bug related to configuration profile switching (thanks @samhvw8!)
- Improvements to fuzzy search in mentions, history, and model lists (thanks @samhvw8!)
- PKCE support for Glama (thanks @punkpeye!)
- Use 'developer' message for o1 system prompt

## [3.1.1]

- Visual fixes to chat input and settings for the light+ themes

## [3.1.0]

- You can now customize the role definition and instructions for each chat mode (Code, Architect, and Ask), either through the new Prompts tab in the top menu or mode-specific .clinerules-mode files. Prompt Enhancements have also been revamped: the "Enhance Prompt" button now works with any provider and API configuration, giving you the ability to craft messages with fully customizable prompts for even better results.
- Add a button to copy markdown out of the chat

## [3.0.3]

- Update required vscode engine to ^1.84.0 to match cline

## [3.0.2]

- A couple more tiny tweaks to the button alignment in the chat input

## [3.0.1]

- Fix the reddit link and a small visual glitch in the chat input

## [3.0.0]

- This release adds chat modes! Now you can ask Roo Code questions about system architecture or the codebase without immediately jumping into writing code. You can even assign different API configuration profiles to each mode if you prefer to use different models for thinking vs coding. Would love feedback in the new Roo Code Reddit! https://www.reddit.com/r/RooCode

## [2.2.46]

- Only parse @-mentions in user input (not in files)

## [2.2.45]

- Save different API configurations to quickly switch between providers and settings (thanks @samhvw8!)

## [2.2.44]

- Automatically retry failed API requests with a configurable delay (thanks @RaySinner!)

## [2.2.43]

- Allow deleting single messages or all subsequent messages

## [2.2.42]

- Add a Git section to the context mentions

## [2.2.41]

- Checkbox to disable streaming for OpenAI-compatible providers

## [2.2.40]

- Add the Glama provider (thanks @punkpeye!)

## [2.2.39]

- Add toggle to enable/disable the MCP-related sections of the system prompt (thanks @daniel-lxs!)

## [2.2.38]

- Add a setting to control the number of terminal output lines to pass to the model when executing commands

## [2.2.36 - 2.2.37]

- Add a button to delete user messages

## [2.2.35]

- Allow selection of multiple browser viewport sizes and adjusting screenshot quality

## [2.2.34]

- Add the DeepSeek provider

## [2.2.33]

- "Enhance prompt" button (OpenRouter models only for now)
- Support listing models for OpenAI compatible providers (thanks @samhvw8!)

## [2.2.32]

- More efficient workspace tracker

## [2.2.31]

- Improved logic for auto-approving chained commands

## [2.2.30]

- Fix bug with auto-approving commands

## [2.2.29]

- Add configurable delay after auto-writes to allow diagnostics to catch up

## [2.2.28]

- Use createFileSystemWatcher to more reliably update list of files to @-mention

## [2.2.27]

- Add the current time to the system prompt and improve browser screenshot quality (thanks @libertyteeth!)

## [2.2.26]

- Tweaks to preferred language (thanks @yongjer)

## [2.2.25]

- Add a preferred language dropdown

## [2.2.24]

- Default diff editing to on for new installs

## [2.2.23]

- Fix context window for gemini-2.0-flash-thinking-exp-1219 (thanks @student20880)

## [2.2.22]

- Add gemini-2.0-flash-thinking-exp-1219

## [2.2.21]

- Take predicted file length into account when detecting omissions

## [2.2.20]

- Make fuzzy diff matching configurable (and default to off)

## [2.2.19]

- Add experimental option to use a bigger browser (1280x800)

## [2.2.18]

- More targeted styling fix for Gemini chats

## [2.2.17]

- Improved regex for auto-execution of chained commands

## [2.2.16]

- Incorporate Premshay's [PR](https://github.com/RooCodeInc/Roo-Code/pull/60) to add support for Amazon Nova and Meta Llama Models via Bedrock (3, 3.1, 3.2) and unified Bedrock calls using BedrockClient and Bedrock Runtime API

## [2.2.14 - 2.2.15]

- Make diff editing more robust to transient errors / fix bugs

## [2.2.13]

- Fixes to sound playing and applying diffs

## [2.2.12]

- Better support for pure deletion and insertion diffs

## [2.2.11]

- Added settings checkbox for verbose diff debugging

## [2.2.6 - 2.2.10]

- More fixes to search/replace diffs

## [2.2.5]

- Allow MCP servers to be enabled/disabled

## [2.2.4]

- Tweak the prompt to encourage diff edits when they're enabled

## [2.2.3]

- Clean up the settings screen

## [2.2.2]

- Add checkboxes to auto-approve MCP tools

## [2.2.1]

- Fix another diff editing indentation bug

## [2.2.0]

- Incorporate MCP changes from Cline 2.2.0

## [2.1.21]

- Larger text area input + ability to drag images into it

## [2.1.20]

- Add Gemini 2.0

## [2.1.19]

- Better error handling for diff editing

## [2.1.18]

- Diff editing bugfix to handle Windows line endings

## [2.1.17]

- Switch to search/replace diffs in experimental diff editing mode

## [2.1.16]

- Allow copying prompts from the history screen

## [2.1.15]

- Incorporate dbasclpy's [PR](https://github.com/RooCodeInc/Roo-Code/pull/54) to add support for gemini-exp-1206
- Make it clear that diff editing is very experimental

## [2.1.14]

- Fix bug where diffs were not being applied correctly and try Aider's [unified diff prompt](https://github.com/Aider-AI/aider/blob/3995accd0ca71cea90ef76d516837f8c2731b9fe/aider/coders/udiff_prompts.py#L75-L105)
- If diffs are enabled, automatically reject write_to_file commands that lead to truncated output

## [2.1.13]

- Fix https://github.com/RooCodeInc/Roo-Code/issues/50 where sound effects were not respecting settings

## [2.1.12]

- Incorporate JoziGila's [PR](https://github.com/cline/cline/pull/158) to add support for editing through diffs

## [2.1.11]

- Incorporate lloydchang's [PR](https://github.com/RooCodeInc/Roo-Code/pull/42) to add support for OpenRouter compression

## [2.1.10]

- Incorporate HeavenOSK's [PR](https://github.com/cline/cline/pull/818) to add sound effects to Cline

## [2.1.9]

- Add instructions for using .clinerules on the settings screen

## [2.1.8]

- Roo Cline now allows configuration of which commands are allowed without approval!

## [2.1.7]

- Updated extension icon and metadata

## [2.2.0]

- Add support for Model Context Protocol (MCP), enabling Cline to use custom tools like web-search tool or GitHub tool
- Add MCP server management tab accessible via the server icon in the menu bar
- Add ability for Cline to dynamically create new MCP servers based on user requests (e.g., "add a tool that gets the latest npm docs")

## [2.1.6]

- Roo Cline now runs in all VSCode-compatible editors

## [2.1.5]

- Fix bug in browser action approval

## [2.1.4]

- Roo Cline now can run side-by-side with Cline

## [2.1.3]

- Roo Cline now allows browser actions without approval when `alwaysAllowBrowser` is true

## [2.1.2]

- Support for auto-approval of write operations and command execution
- Support for .clinerules custom instructions

# Roo Code Changelog

For the complete changelog with all version history, please visit:
https://github.com/RooCodeInc/Roo-Code/blob/main/CHANGELOG.md

## Recent Updates

## [3.34.0] - 2025-11-21

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

---

**Note:** This is a lightweight version of the changelog optimized for VS Code's extension viewer.
For the complete version history with all details, please visit the GitHub repository.

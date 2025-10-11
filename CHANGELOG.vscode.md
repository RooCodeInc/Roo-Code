# Roo Code Changelog

## [3.28.15] - 2025-10-03

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

- Add support for GLM-4.6 model for z.ai provider (#8406 by @dmarkey, PR by @roomote)

## [3.28.13] - 2025-09-29

- Fix: Remove topP parameter from Bedrock inference config (#8377 by @ronyblum, PR by @daniel-lxs)
- Fix: Correct Vertex AI Sonnet 4.5 model configuration (#8387 by @nickcatal, PR by @mrubens!)

## [3.28.12] - 2025-09-29

- Fix: Correct Anthropic Sonnet 4.5 model ID and add Bedrock 1M context checkbox (thanks @daniel-lxs!)

## [3.28.11] - 2025-09-29

- Fix: Correct AWS Bedrock Claude Sonnet 4.5 model identifier (#8371 by @sunhyung, PR by @app/roomote)
- Fix: Correct Claude Sonnet 4.5 model ID format (thanks @daniel-lxs!)

## [3.28.10] - 2025-09-29

- Feat: Add Sonnet 4.5 support (thanks @daniel-lxs!)
- Fix: Resolve max_completion_tokens issue for GPT-5 models in LiteLLM provider (#6979 by @lx1054331851, PR by @roomote)
- Fix: Make chat icons properly sized with shrink-0 class (thanks @mrubens!)
- Enhancement: Track telemetry settings changes for better analytics (thanks @mrubens!)
- Web: Add testimonials section to website (thanks @brunobergher!)
- CI: Refresh contrib.rocks cache workflow for contributor badges (thanks @hannesrudolph!)

## [3.28.9] - 2025-09-26

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

- Fix: Resolve frequent "No tool used" errors by clarifying tool-use rules (thanks @hannesrudolph!)
- Fix: Include initial ask in condense summarization (thanks @hannesrudolph!)
- Add support for more free models in the Roo provider (thanks @mrubens!)
- Show cloud switcher and option to add a team when logged in (thanks @mrubens!)
- Add Opengraph image for web (thanks @brunobergher!)

## [3.28.7] - 2025-09-23

- UX: Collapse thinking blocks by default with UI settings to always show them (thanks @brunobergher!)
- Fix: Resolve checkpoint restore popover positioning issue (#8219 by @NaccOll, PR by @app/roomote)
- Add cloud account switcher functionality (thanks @mrubens!)
- Add support for zai-org/GLM-4.5-turbo model in Chutes provider (#8155 by @mugnimaestra, PR by @app/roomote)

## [3.28.6] - 2025-09-23

- Feat: Add GPT-5-Codex model (thanks @daniel-lxs!)
- Feat: Add keyboard shortcut for toggling auto-approve (Cmd/Ctrl+Alt+A) (thanks @brunobergher!)
- Fix: Improve reasoning block formatting for better readability (thanks @daniel-lxs!)
- Fix: Respect Ollama Modelfile num_ctx configuration (#7797 by @hannesrudolph, PR by @app/roomote)
- Fix: Prevent checkpoint text from wrapping in non-English languages (#8206 by @NaccOll, PR by @app/roomote)
- Remove language selection and word wrap toggle from CodeBlock (thanks @mrubens!)
- Feat: Add package.nls.json checking to find-missing-translations script (thanks @app/roomote!)
- Fix: Bare metal evals fixes (thanks @cte!)
- Fix: Follow-up questions should trigger the "interactive" state (thanks @cte!)

---

_For the complete changelog with all 11 releases, please visit the [GitHub repository](https://github.com/RooCodeInc/Roo-Code/blob/main/CHANGELOG.md)._

# Windows VS Code Bootstrap

The CLI quick installer currently targets macOS Apple Silicon and Linux x64. On
Windows, use the Roo Code VS Code extension as the runtime. A small workspace
launch config can make that extension flow repeatable without replacing Roo's
normal provider setup, authentication, approvals, or mode behavior.

This pattern is useful when a team wants a local script to reopen a workspace,
load a prompt file, and optionally select a project mode or provider profile.
Keep the application itself standalone; VS Code and Roo are only the control
plane.

## Roo Defaults To Preserve

For first-time users, follow the extension's normal setup first:

1. Install Roo Code in VS Code.
2. Open the target workspace folder.
3. Open the Roo panel.
4. Choose an API provider and model in Roo's settings.
5. Complete any provider-owned sign-in or API-key setup.
6. Start a small manual task to confirm the profile works.

The bootstrapper should preserve these defaults:

- If no provider profile is supplied, Roo uses the active or mode-sticky profile.
- If no mode is supplied, Roo starts in its default Code mode.
- Provider auth stays inside Roo and VS Code SecretStorage.
- User approval and auto-approval settings remain Roo settings.
- Model-specific defaults, such as reasoning effort, should be left alone unless
  the launch config explicitly overrides them.

## Minimal Launch Config

This file is a local handoff format for a helper script or helper extension. It
is not a Roo Code API contract.

`.roo-launch.json`:

```json
{
  "requestId": "replace-with-a-new-id-per-launch",
  "autostart": true,
  "promptFile": ".roo/prompts/init.md",
  "newTab": true
}
```

`.roo/prompts/init.md`:

```markdown
You are Roo Code initializing this workspace.

First read:

- AGENTS.md
- the repo README, if present
- package, build, or project files that identify the stack

Then produce a concise workspace orientation and wait for the next concrete
build task.
```

With this minimal config, the helper only opens Roo and starts the prompt. Roo
keeps using whichever provider profile and mode the user already configured.

## Optional Project Mode

Project modes are a normal Roo Code customization path through `.roomodes`.
Add a project mode only when the workspace needs scoped behavior that differs
from the built-in Code, Ask, Architect, Debug, or Orchestrator modes.

`.roomodes`:

```yaml
customModes:
  - slug: app-builder
    name: App Builder
    roleDefinition: |-
      You are Roo Code working as a focused builder for this repository.
      Read the workspace instructions first, then implement the user's task.
    whenToUse: Build, revise, or inspect this repository using local project instructions.
    description: Focused builder mode for this workspace.
    groups:
      - read
      - command
      - edit
    source: project
```

Then reference the mode in `.roo-launch.json`:

```json
{
  "requestId": "replace-with-a-new-id-per-launch",
  "autostart": true,
  "promptFile": ".roo/prompts/init.md",
  "mode": "app-builder",
  "newTab": true
}
```

## Optional Provider Profile

Use an explicit profile only when the workspace launcher should activate a
specific Roo provider profile. Otherwise, omit `profile` and let Roo use the
active or mode-sticky profile configured by the user.

For ChatGPT Plus/Pro users, the OpenAI Codex provider can be configured like
this:

```json
{
  "requestId": "replace-with-a-new-id-per-launch",
  "autostart": true,
  "promptFile": ".roo/prompts/init.md",
  "mode": "app-builder",
  "newTab": true,
  "profile": {
    "name": "App Builder Codex",
    "apiProvider": "openai-codex",
    "apiModelId": "gpt-5.5"
  }
}
```

If a selected model supports reasoning effort and the workspace intentionally
wants to override the model default, include the provider fields Roo already
uses:

```json
{
  "profile": {
    "name": "App Builder Codex",
    "apiProvider": "openai-codex",
    "apiModelId": "gpt-5.5",
    "enableReasoningEffort": true,
    "reasoningEffort": "high"
  }
}
```

Do not put provider secrets, OAuth tokens, or API keys in `.roo-launch.json`.
For `openai-codex`, Roo owns the OpenAI Codex OAuth flow. It does not use a
user-supplied `OPENAI_API_KEY`.

## Helper Extension Shape

A local helper extension can read `.roo-launch.json`, activate Roo Code, and
start the task:

```ts
const roo = vscode.extensions.getExtension("RooVeterinaryInc.roo-cline")
const api = roo?.isActive ? roo.exports : await roo?.activate()

if (config.profile) {
  const { name = "Workspace Profile", ...profile } = config.profile
  await api.upsertProfile(name, profile, true)
}

const configuration: Record<string, unknown> = {}
if (config.mode) {
  configuration.mode = config.mode
}

await api.startNewTask({
  text: promptText,
  newTab: config.newTab !== false,
  configuration,
})
```

The helper should treat provider errors as Roo errors. If Roo reports that the
provider is not authenticated, ask the user to finish sign-in in the Roo panel
and rerun the launch command.

## PowerShell Wrapper Shape

The wrapper should stay project-neutral. It can write a launch config, open the
workspace in VS Code, and trigger a helper extension URI.

```powershell
param(
    [string]$Workspace = (Get-Location).Path,
    [string]$PromptFile = ".roo\prompts\init.md",
    [string]$Mode,
    [switch]$NoLaunch
)

$workspacePath = (Resolve-Path -LiteralPath $Workspace).Path
$promptPath = (Resolve-Path -LiteralPath (Join-Path $workspacePath $PromptFile)).Path

$config = [ordered]@{
    requestId = [guid]::NewGuid().ToString()
    autostart = -not $NoLaunch
    promptFile = $promptPath
    newTab = $true
}

if ($Mode) {
    $config.mode = $Mode
}

$configPath = Join-Path $workspacePath ".roo-launch.json"
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8

code -n $workspacePath

if (-not $NoLaunch) {
    $escaped = [Uri]::EscapeDataString($configPath)
    Start-Process "vscode://local.roo-workspace-launcher/launch?configPath=$escaped"
}
```

Provider-specific flags can be layered on top, but the default path should work
with any provider the user already configured in Roo.

## Upstream Opportunity

This pattern can remain a documented Windows workaround, or Roo Code could
absorb the core behavior as a first-class command:

```text
Roo Code: Launch Task From Config
```

That command could read a workspace-local config, optionally activate a provider
profile, optionally select a mode, and start a task from a prompt file without a
separate helper extension.

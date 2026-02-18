<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline"><img src="https://img.shields.io/badge/VS_Code_Marketplace-007ACC?style=flat&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace"></a>
  <a href="https://x.com/roocode"><img src="https://img.shields.io/badge/roocode-000000?style=flat&logo=x&logoColor=white" alt="X"></a>
  <a href="https://youtube.com/@roocodeyt?feature=shared"><img src="https://img.shields.io/badge/YouTube-FF0000?style=flat&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://discord.gg/roocode"><img src="https://img.shields.io/badge/Join%20Discord-5865F2?style=flat&logo=discord&logoColor=white" alt="Join Discord"></a>
  <a href="https://www.reddit.com/r/RooCode/"><img src="https://img.shields.io/badge/Join%20r%2FRooCode-FF4500?style=flat&logo=reddit&logoColor=white" alt="Join r/RooCode"></a>
</p>
<p align="center">
  <em>Get help fast → <a href="https://discord.gg/roocode">Join Discord</a> • Prefer async? → <a href="https://www.reddit.com/r/RooCode/">Join r/RooCode</a></em>
</p>

# Roo Code

> Your AI-Powered Dev Team, Right in Your Editor

<details>
  <summary>🌐 Available languages</summary>

- [English](README.md)
- [Català](locales/ca/README.md)
- [Deutsch](locales/de/README.md)
- [Español](locales/es/README.md)
- [Français](locales/fr/README.md)
- [हिंदी](locales/hi/README.md)
- [Bahasa Indonesia](locales/id/README.md)
- [Italiano](locales/it/README.md)
- [日本語](locales/ja/README.md)
- [한국어](locales/ko/README.md)
- [Nederlands](locales/nl/README.md)
- [Polski](locales/pl/README.md)
- [Português (BR)](locales/pt-BR/README.md)
- [Русский](locales/ru/README.md)
- [Türkçe](locales/tr/README.md)
- [Tiếng Việt](locales/vi/README.md)
- [简体中文](locales/zh-CN/README.md)
- [繁體中文](locales/zh-TW/README.md)
- ...
      </details>

---

## What Can Roo Code Do For YOU?

- Generate Code from natural language descriptions and specs
- Adapt with Modes: Code, Architect, Ask, Debug, and Custom Modes
- Refactor & Debug existing code
- Write & Update documentation
- Answer Questions about your codebase
- Automate repetitive tasks
- Utilize MCP Servers

## Modes

Roo Code adapts to how you work:

- Code Mode: everyday coding, edits, and file ops
- Architect Mode: plan systems, specs, and migrations
- Ask Mode: fast answers, explanations, and docs
- Debug Mode: trace issues, add logs, isolate root causes
- Custom Modes: build specialized modes for your team or workflow
- Roomote Control: Roomote Control lets you remotely control tasks running in your local VS Code instance.

Learn more: [Using Modes](https://docs.roocode.com/basic-usage/using-modes) • [Custom Modes](https://docs.roocode.com/advanced-usage/custom-modes) • [Roomote Control](https://docs.roocode.com/roo-code-cloud/roomote-control)

## Tutorial & Feature Videos

<div align="center">

|                                                                                                                                                                           |                                                                                                                                                                            |                                                                                                                                                                         |
| :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <a href="https://www.youtube.com/watch?v=Mcq3r1EPZ-4"><img src="https://img.youtube.com/vi/Mcq3r1EPZ-4/maxresdefault.jpg" width="100%"></a><br><b>Installing Roo Code</b> | <a href="https://www.youtube.com/watch?v=ZBML8h5cCgo"><img src="https://img.youtube.com/vi/ZBML8h5cCgo/maxresdefault.jpg" width="100%"></a><br><b>Configuring Profiles</b> | <a href="https://www.youtube.com/watch?v=r1bpod1VWhg"><img src="https://img.youtube.com/vi/r1bpod1VWhg/maxresdefault.jpg" width="100%"></a><br><b>Codebase Indexing</b> |
|    <a href="https://www.youtube.com/watch?v=iiAv1eKOaxk"><img src="https://img.youtube.com/vi/iiAv1eKOaxk/maxresdefault.jpg" width="100%"></a><br><b>Custom Modes</b>     |     <a href="https://www.youtube.com/watch?v=Ho30nyY332E"><img src="https://img.youtube.com/vi/Ho30nyY332E/maxresdefault.jpg" width="100%"></a><br><b>Checkpoints</b>      |    <a href="https://www.youtube.com/watch?v=HmnNSasv7T8"><img src="https://img.youtube.com/vi/HmnNSasv7T8/maxresdefault.jpg" width="100%"></a><br><b>Context Management</b>     |

</div>
<p align="center">
<a href="https://docs.roocode.com/tutorial-videos">More quick tutorial and feature videos...</a>
</p>

## Resources

- **[Documentation](https://docs.roocode.com):** The official guide to installing, configuring, and mastering Roo Code.
- **[YouTube Channel](https://youtube.com/@roocodeyt?feature=shared):** Watch tutorials and see features in action.
- **[Discord Server](https://discord.gg/roocode):** Join the community for real-time help and discussion.
- **[Reddit Community](https://www.reddit.com/r/RooCode):** Share your experiences and see what others are building.
- **[GitHub Issues](https://github.com/RooCodeInc/Roo-Code/issues):** Report bugs and track development.
- **[Feature Requests](https://github.com/RooCodeInc/Roo-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop):** Have an idea? Share it with the developers.

---

## Local Setup & Development

1. **Clone** the repo:

```sh
git clone https://github.com/RooCodeInc/Roo-Code.git
```

2. **Install dependencies**:

```sh
pnpm install
```

3. **Run the extension**:

There are several ways to run the Roo Code extension:

### Development Mode (F5)

For active development, use VSCode's built-in debugging:

Press `F5` (or go to **Run** → **Start Debugging**) in VSCode. This will open a new VSCode window with the Roo Code extension running.

- Changes to the webview will appear immediately.
- Changes to the core extension will also hot reload automatically.

### Automated VSIX Installation

To build and install the extension as a VSIX package directly into VSCode:

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

This command will:

- Ask which editor command to use (code/cursor/code-insiders) - defaults to 'code'
- Uninstall any existing version of the extension.
- Build the latest VSIX package.
- Install the newly built VSIX.
- Prompt you to restart VS Code for changes to take effect.

Options:

- `-y`: Skip all confirmation prompts and use defaults
- `--editor=<command>`: Specify the editor command (e.g., `--editor=cursor` or `--editor=code-insiders`)

### Manual VSIX Installation

If you prefer to install the VSIX package manually:

1.  First, build the VSIX package:
    ```sh
    pnpm vsix
    ```
2.  A `.vsix` file will be generated in the `bin/` directory (e.g., `bin/roo-cline-<version>.vsix`).
3.  Install it manually using the VSCode CLI:
    ```sh
    code --install-extension bin/roo-cline-<version>.vsix
    ```

---

We use [changesets](https://github.com/changesets/changesets) for versioning and publishing. Check our `CHANGELOG.md` for release notes.

---

## TRP1 Challenge – Intent-Code Traceability Hook System

This fork implements an AI-Native Intent-Code Traceability layer for the TRP1 Week 1 challenge, adding governance and semantic tracking to Roo Code's AI agent workflow.

### Phase 0 – Archaeological Dig
- Documented extension architecture and tool execution flow in [`ARCHITECTURE_NOTES.md`](ARCHITECTURE_NOTES.md)
- Mapped tool routing (`presentAssistantMessage`) and system prompt builder (`SYSTEM_PROMPT`)
- Identified hook injection points for middleware integration

### Phase 1 – Reasoning Loop & Context Loader ✅
- **New Native Tool**: `select_active_intent(intent_id)` enforces two-stage state machine (intent selection → contextualized action)
- **Hook Middleware**: `HookEngine` wraps all destructive tools with pre/post-hooks for governance and traceability
- **Orchestration Sidecar**: `.orchestration/` directory implements AI-native Git layer:
  - `active_intents.yaml` – Intent specifications with scope, constraints, acceptance criteria
  - `agent_trace.jsonl` – Append-only ledger linking Intent → Code Hash
  - `intent_map.md` – Spatial mapping of intents to files
  - `AGENT.md` – Shared knowledge base
- **Context Loader**: `select_active_intent` returns `<intent_context>` XML with intent specs + recent history from trace entries

### Phase 2 – Hook Middleware & Security (Partial)
- **Command Classification**: Safe (read) vs Destructive (write/execute) tools
- **UI-Blocking Authorization**: Modal approval required for intent evolution (Human-in-the-Loop)
- **Scope Enforcement**: File paths validated against intent's `owned_scope` patterns
- **Post-Hook Trace Logging**: Automatic logging to `agent_trace.jsonl` with content hashing

### Documentation & Testing
- [`docs/Architecture.md`](docs/Architecture.md) – High-level architecture overview
- [`ARCHITECTURE_NOTES.md`](ARCHITECTURE_NOTES.md) – Detailed codebase mapping and injection points
- [`docs/UI-Blocking-Authorization.md`](docs/UI-Blocking-Authorization.md) – HITL governance design
- [`docs/TESTING-PHASE1.md`](docs/TESTING-PHASE1.md) – Manual testing guide
- [`docs/PHASE1-TEST-RESULTS.md`](docs/PHASE1-TEST-RESULTS.md) – Test execution results (5/5 passing)

### Key Files
- `src/core/hooks/HookEngine.ts` – Hook middleware implementation
- `src/core/orchestration/OrchestrationDataModel.ts` – Data model for `.orchestration/` directory
- `src/core/tools/SelectActiveIntentTool.ts` – Intent selection tool
- `src/core/tools/__tests__/selectActiveIntentTool.spec.ts` – Phase 1 test suite

---

## Disclaimer

**Please note** that Roo Code, Inc does **not** make any representations or warranties regarding any code, models, or other tools provided or made available in connection with Roo Code, any associated third-party tools, or any resulting outputs. You assume **all risks** associated with the use of any such tools or outputs; such tools are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).

---

## Contributing

We love community contributions! Get started by reading our [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[Apache 2.0 © 2025 Roo Code, Inc.](./LICENSE)

---

**Enjoy Roo Code!** Whether you keep it on a short leash or let it roam autonomously, we can’t wait to see what you build. If you have questions or feature ideas, drop by our [Reddit community](https://www.reddit.com/r/RooCode/) or [Discord](https://discord.gg/roocode). Happy coding!

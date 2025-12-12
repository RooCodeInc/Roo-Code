# JetBrains Plugin Support - Technical Design Document

## Context

This document addresses [Issue #9982](https://github.com/RooCodeInc/Roo-Code/issues/9982), which requests JetBrains IDE support for Roo Code.

### User Requirements

Based on community feedback, users are requesting:

- Full Roo Code functionality in JetBrains IDEs
- Primary focus on IntelliJ IDEA and WebStorm
- Custom model integration capabilities (highest priority)
- Leverage JetBrains' superior Java and Git tooling
- Native JetBrains UI experience

## Current Architecture Analysis

### VS Code Extension Structure

Roo Code is currently built as a VS Code extension with the following key components:

1. **Core Extension** (`src/extension.ts`)

    - VS Code API integration
    - Extension lifecycle management
    - Command registration and handling

2. **Webview UI** (`webview-ui/`)

    - React-based interface
    - VSCode webview toolkit integration
    - Communication via message passing

3. **Core Services**

    - Provider management (Anthropic, OpenAI, OpenRouter, etc.)
    - Model configuration and selection
    - Terminal integration
    - File system operations
    - Code indexing
    - MCP (Model Context Protocol) server support

4. **Cloud Integration** (`@roo-code/cloud`)

    - Authentication and user management
    - Remote control capabilities
    - Profile synchronization

5. **Type Definitions** (`@roo-code/types`)
    - Shared TypeScript interfaces
    - Provider settings schemas
    - API contracts

### VS Code-Specific Dependencies

The following components are tightly coupled to VS Code APIs:

- **Editor Integration**: TextEditor, TextDocument, Range, Selection APIs
- **Webview System**: VS Code's webview API for UI rendering
- **Terminal Integration**: Terminal creation and command execution
- **File System**: VS Code's workspace and file system APIs
- **Configuration**: VS Code's settings and state management
- **Commands**: VS Code's command palette integration
- **Diff Views**: Custom diff view provider
- **Code Actions**: Quick fix and refactoring suggestions

## Approaches to JetBrains Support

### Option 1: Native JetBrains Plugin (Recommended)

Build a separate native plugin using JetBrains Platform SDK.

#### Architecture

```
roo-code-jetbrains/
├── src/main/kotlin/          # Plugin code in Kotlin/Java
│   ├── actions/              # IntelliJ Actions (commands)
│   ├── services/             # Background services
│   ├── ui/                   # Tool windows and dialogs
│   ├── settings/             # Settings UI
│   └── integration/          # IDE integration points
├── src/main/resources/       # Resources and plugin.xml
└── build.gradle.kts          # Gradle build configuration
```

#### Key Components to Implement

1. **Tool Window**: Replace VS Code sidebar

    - Use IntelliJ's ToolWindow API
    - Implement UI with Swing or Kotlin UI DSL
    - Or embed browser component for web-based UI

2. **Editor Integration**

    - Document modification API
    - PSI (Program Structure Interface) for code analysis
    - Editor actions and intentions

3. **Terminal Integration**

    - TerminalRunner API
    - Command execution

4. **File System Operations**

    - VirtualFileSystem API
    - Document manager

5. **Settings Management**

    - PersistentStateComponent
    - Configurable interface for settings UI

6. **Provider Management**
    - Port provider configuration system
    - API key management
    - Model selection interface

#### Shared Components

Leverage existing code where possible:

- **API Integration**: HTTP clients for LLM providers (can be shared)
- **Type Definitions**: TypeScript types → Kotlin data classes
- **Business Logic**: Core algorithms and workflows
- **Model Configurations**: JSON schemas and definitions

#### UI Strategy

**Option A: Native Kotlin UI**

- Pros: True native experience, better IDE integration
- Cons: Requires complete UI rewrite, more maintenance

**Option B: Hybrid (Embedded Browser)**

- Pros: Can reuse React UI, faster development
- Cons: Less native feel, performance overhead
- Use JCEF (Java Chromium Embedded Framework)

### Option 2: Language Server Protocol (LSP) Bridge

Create a language server that both VS Code and JetBrains can connect to.

#### Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  VS Code    │◄───────►│  Roo Code LSP    │◄───────►│ JetBrains   │
│  Extension  │  LSP    │     Server       │  LSP    │   Plugin    │
└─────────────┘         └──────────────────┘         └─────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │ LLM Providers│
                        └──────────────┘
```

#### Pros

- Shared business logic
- Single codebase for core functionality
- Standard protocol

#### Cons

- LSP not designed for AI coding assistants
- Limited UI capabilities
- Custom protocol extensions needed
- Still requires significant client-side code

### Option 3: Minimal Adapter Plugin

Create a lightweight JetBrains plugin that communicates with the VS Code extension.

#### Architecture

```
┌─────────────┐         ┌──────────────────┐
│ JetBrains   │         │     VS Code      │
│   Plugin    │◄───────►│    Extension     │
│ (Thin UI)   │  HTTP/  │  (Core Logic)    │
└─────────────┘  WS     └──────────────────┘
```

#### Pros

- Minimal JetBrains-specific code
- Leverage existing VS Code extension

#### Cons

- Requires VS Code running in background
- Poor user experience
- Dependency complexity
- Not truly native

## Recommended Approach

**Build a native JetBrains plugin** (Option 1) with a hybrid UI strategy.

### Phase 1: Core Functionality (MVP)

1. Tool window with chat interface
2. Provider configuration (custom models priority)
3. Basic file editing capabilities
4. Terminal command execution
5. Settings UI

### Phase 2: Advanced Features

1. Code indexing and search
2. Multi-file operations
3. Diff views
4. Cloud integration
5. MCP server support

### Phase 3: Polish and Optimization

1. Performance optimization
2. JetBrains-specific features (PSI integration)
3. Multiple IDE support (IntelliJ, WebStorm, PyCharm)
4. Comprehensive testing

## Technical Challenges

### 1. UI Framework

- **Challenge**: React webview UI won't work in JetBrains
- **Solution**:
    - Option A: Rewrite in Kotlin with Compose/Swing
    - Option B: Use JCEF to embed web UI
    - **Recommendation**: Start with JCEF for faster MVP, migrate to native later

### 2. Editor Integration

- **Challenge**: Different APIs for document manipulation
- **Solution**: Create abstraction layer over editor operations
- Map VS Code concepts to IntelliJ equivalents:
    - TextDocument → Document
    - TextEditor → Editor
    - Range → TextRange
    - Selection → Caret

### 3. State Management

- **Challenge**: VS Code's ExtensionContext vs IntelliJ's services
- **Solution**: Use IntelliJ's service architecture and state components

### 4. File System Operations

- **Challenge**: Different file system APIs
- **Solution**: Abstract file operations behind common interface

### 5. Terminal Integration

- **Challenge**: Different terminal APIs
- **Solution**: Adapter pattern for terminal operations

### 6. Configuration Sync

- **Challenge**: Users may want settings across both IDEs
- **Solution**: Leverage Roo Code Cloud for cross-IDE profile sync

## Development Roadmap

### Prerequisites

- JetBrains Platform SDK knowledge
- Kotlin/Java development
- Gradle build system
- IntelliJ plugin development experience

### Estimated Timeline

**Phase 1 (MVP): 3-4 months**

- Plugin structure and basic UI: 4 weeks
- Provider integration and model config: 3 weeks
- File editing capabilities: 3 weeks
- Terminal integration: 2 weeks
- Testing and bug fixes: 2 weeks

**Phase 2 (Feature Parity): 3-4 months**

- Advanced file operations: 4 weeks
- Code indexing: 4 weeks
- Cloud integration: 3 weeks
- MCP support: 3 weeks
- Testing and refinement: 2 weeks

**Phase 3 (Polish): 2-3 months**

- Performance optimization: 4 weeks
- Multi-IDE support: 4 weeks
- Documentation: 2 weeks
- Beta testing: 2 weeks

**Total: 8-11 months for full feature parity**

## Resource Requirements

### Team Composition

- 1-2 JetBrains plugin developers (Kotlin/Java)
- 1 UI developer (if building native UI)
- 1 backend developer (shared logic)
- 1 QA engineer (testing across IDEs)
- Product manager (feature prioritization)

### Infrastructure

- JetBrains marketplace account
- CI/CD for plugin builds
- Testing infrastructure (multiple IDE versions)
- Documentation site updates

## Risks and Mitigation

### Risk 1: Maintenance Burden

- **Risk**: Maintaining two separate codebases
- **Mitigation**:
    - Maximize code sharing through packages
    - Shared API client libraries
    - Common business logic in TypeScript (can be ported)
    - Automated testing

### Risk 2: Feature Divergence

- **Risk**: Features available in one IDE but not the other
- **Mitigation**:
    - Clear feature roadmap
    - Parity tracking
    - Staged rollout across platforms

### Risk 3: User Confusion

- **Risk**: Different experiences across IDEs
- **Mitigation**:
    - Consistent UI/UX where possible
    - Clear documentation
    - IDE-specific guides

### Risk 4: Development Complexity

- **Risk**: Learning curve for JetBrains platform
- **Mitigation**:
    - Hire experienced JetBrains plugin developers
    - Start with simpler features
    - Leverage JetBrains documentation and community

## Code Sharing Strategy

### Shared Components

1. **API Clients**

    - HTTP clients for LLM providers
    - Authentication logic
    - Model definitions

2. **Type Definitions**

    - Convert TypeScript types to Kotlin data classes
    - Shared JSON schemas

3. **Business Logic**

    - Prompt engineering
    - Response parsing
    - Error handling

4. **Configuration**
    - Provider settings schemas
    - Model configurations

### Implementation Approach

```
roo-code/
├── packages/
│   ├── core/              # Shared business logic (TypeScript)
│   ├── types/             # Shared type definitions
│   └── api-clients/       # Provider API clients
├── vscode-extension/      # Current VS Code extension
└── jetbrains-plugin/      # New JetBrains plugin
    ├── src/main/kotlin/   # Kotlin implementation
    └── src/main/resources/
```

## Alternative: Web-Based Solution

### Roo Code Desktop App

Instead of IDE plugins, create a standalone desktop application.

#### Pros

- Single codebase
- Works with any IDE
- Easier maintenance

#### Cons

- Not integrated into IDE
- Separate window context
- Less seamless workflow

This could be a future option but doesn't address the core request for native IDE integration.

## Recommendations

1. **Validate Demand**: Survey users to gauge interest and prioritize features

    - Create GitHub discussion
    - Discord/Reddit polls
    - Understand willingness to adopt

2. **Start with Design Prototype**: Before full implementation

    - UI mockups for JetBrains plugin
    - User flow diagrams
    - Technical proof of concept

3. **Phased Approach**: Don't aim for feature parity immediately

    - Start with core features users care about most (custom models)
    - Iterate based on feedback
    - Add advanced features incrementally

4. **Consider Strategic Partnership**

    - Engage with JetBrains
    - Potentially official partnership
    - Marketplace promotion

5. **Open Source Collaboration**
    - Community contributions
    - Plugin architecture allows experimentation
    - Early adopter testing

## Success Criteria

### MVP Success (Phase 1)

- [ ] Plugin installable from JetBrains Marketplace
- [ ] Custom model configuration working
- [ ] Basic chat interface functional
- [ ] File editing capabilities
- [ ] 100+ active users within first month

### Feature Parity Success (Phase 2)

- [ ] 80%+ feature parity with VS Code extension
- [ ] Cloud sync working across IDEs
- [ ] 1000+ active users
- [ ] <5% crash rate

### Long-term Success (Phase 3)

- [ ] All major features available
- [ ] Support for IntelliJ, WebStorm, PyCharm
- [ ] 10,000+ active users
- [ ] 4+ star rating on JetBrains Marketplace
- [ ] Sustainable maintenance model

## Next Steps

1. **Community Feedback** (Week 1-2)

    - Share this document with issue reporter
    - Gather additional requirements
    - Validate assumptions

2. **Technical Spike** (Week 3-4)

    - Create minimal JetBrains plugin prototype
    - Test JCEF embedding
    - Validate architecture decisions

3. **Go/No-Go Decision** (Week 5)

    - Review prototype results
    - Assess resource availability
    - Decide on timeline

4. **Kickoff** (Week 6+)
    - Assemble team
    - Set up project structure
    - Begin Phase 1 development

## Conclusion

Building JetBrains plugin support for Roo Code is technically feasible but requires significant investment. The recommended approach is a native plugin with a hybrid UI strategy, developed in phases over 8-11 months.

Key considerations:

- **User Demand**: Validate that sufficient users want this
- **Resource Commitment**: Requires dedicated team
- **Maintenance**: Ongoing cost of supporting multiple platforms
- **Strategic Value**: Expands market, especially for Java developers

The custom model integration feature, which is the highest priority for the requesting user, can be delivered in Phase 1 (MVP), providing value quickly.

**Recommendation**: Proceed with community validation and technical spike before committing to full development.

---

**Document Status**: Draft for Community Review  
**Related Issue**: [#9982](https://github.com/RooCodeInc/Roo-Code/issues/9982)  
**Author**: Roomote  
**Date**: 2025-12-12  
**Version**: 1.0

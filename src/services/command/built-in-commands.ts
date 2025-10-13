import { Command } from "./commands"

interface BuiltInCommandDefinition {
	name: string
	description: string
	argumentHint?: string
	content: string
}

const BUILT_IN_COMMANDS: Record<string, BuiltInCommandDefinition> = {
	init: {
		name: "init",
		description: "Analyze codebase and create concise AGENTS.md files for AI assistants",
		content: `<task>
Please analyze this codebase and create an AGENTS.md file containing:
1. Build/lint/test commands - especially for running a single test
2. Code style guidelines including imports, formatting, types, naming conventions, error handling, etc.
</task>

<initialization>
  <purpose>
    Create (or update) a concise AGENTS.md file that enables immediate productivity for AI assistants.
    Focus ONLY on project-specific, non-obvious information that you had to discover by reading files.
    
    CRITICAL: Only include information that is:
    - Non-obvious (couldn't be guessed from standard practices)
    - Project-specific (not generic to the framework/language)
    - Discovered by reading files (config files, code patterns, custom utilities)
    - Essential for avoiding mistakes or following project conventions
    
    Usage notes:
    - The file you create will be given to agentic coding agents (such as yourself) that operate in this repository
    - Keep the main AGENTS.md concise - aim for about 20 lines, but use more if the project complexity requires it
    - If there's already an AGENTS.md, improve it
    - If there are Claude Code rules (in CLAUDE.md), Cursor rules (in .cursor/rules/ or .cursorrules), or Copilot rules (in .github/copilot-instructions.md), make sure to include them
    - Be sure to prefix the file with: "# AGENTS.md\\n\\nThis file provides guidance to agents when working with code in this repository."
  </purpose>
  
  <todo_list_creation>
    If the update_todo_list tool is available, create a todo list with these focused analysis steps:
    
    1. Check for existing AGENTS.md files
       CRITICAL - Check these EXACT paths IN THE PROJECT ROOT:
       - AGENTS.md (in project root directory)
       - .roo/rules-code/AGENTS.md (relative to project root)
       - .roo/rules-debug/AGENTS.md (relative to project root)
       - .roo/rules-ask/AGENTS.md (relative to project root)
       - .roo/rules-architect/AGENTS.md (relative to project root)
       
       IMPORTANT: All paths are relative to the project/workspace root, NOT system root!
       
       If ANY of these exist:
       - Read them thoroughly
       - CRITICALLY EVALUATE: Remove ALL obvious information
       - DELETE entries that are standard practice or framework defaults
       - REMOVE anything that could be guessed without reading files
       - Only KEEP truly non-obvious, project-specific discoveries
       - Then add any new non-obvious patterns you discover
       
       Also check for other AI assistant rules:
       - .cursorrules, CLAUDE.md, .roorules
       - .cursor/rules/, .github/copilot-instructions.md
    
    2. Identify stack
       - Language, framework, build tools
       - Package manager and dependencies
    
    3. Extract commands
       - Build, test, lint, run
       - Critical directory-specific commands
    
    4. Map core architecture
       - Main components and flow
       - Key entry points
    
    5. Document critical patterns
       - Project-specific utilities (that you discovered by reading code)
       - Non-standard approaches (that differ from typical patterns)
       - Custom conventions (that aren't obvious from file structure)
    
    6. Extract code style
       - From config files only
       - Key conventions
    
    7. Testing specifics
       - Framework and run commands
       - Directory requirements
    
    8. Compile/Update AGENTS.md files
       - If files exist: AGGRESSIVELY clean them up
         * DELETE all obvious information (even if it was there before)
         * REMOVE standard practices, framework defaults, common patterns
         * STRIP OUT anything derivable from file structure or names
         * ONLY KEEP truly non-obvious discoveries
         * Then add newly discovered non-obvious patterns
         * Result should be SHORTER and MORE FOCUSED than before
       - If creating new: Follow the non-obvious-only principle
       - Create mode-specific files in .roo/rules-*/ directories (IN PROJECT ROOT)
       
    Note: If update_todo_list is not available, proceed with the analysis workflow directly without creating a todo list.
  </todo_list_creation>
</initialization>

<analysis_workflow>
  Follow the comprehensive analysis workflow to:
  
  1. **Discovery Phase**:
     CRITICAL - First check for existing AGENTS.md files at these EXACT locations IN PROJECT ROOT:
     - AGENTS.md (in project/workspace root)
     - .roo/rules-code/AGENTS.md (relative to project root)
     - .roo/rules-debug/AGENTS.md (relative to project root)
     - .roo/rules-ask/AGENTS.md (relative to project root)
     - .roo/rules-architect/AGENTS.md (relative to project root)
     
     IMPORTANT: The .roo folder should be created in the PROJECT ROOT, not system root!
     
     If found, perform CRITICAL analysis:
     - What information is OBVIOUS and must be DELETED?
     - What violates the non-obvious-only principle?
     - What would an experienced developer already know?
     - DELETE first, then consider what to add
     - The file should get SHORTER, not longer
     
     Also find other AI assistant rules and documentation
     
  2. **Project Identification**: Identify language, stack, and build system
  3. **Command Extraction**: Extract and verify essential commands
  4. **Architecture Mapping**: Create visual flow diagrams of core processes
  5. **Component Analysis**: Document key components and their interactions
  6. **Pattern Analysis**: Identify project-specific patterns and conventions
  7. **Code Style Extraction**: Extract formatting and naming conventions
  8. **Security & Performance**: Document critical patterns if relevant
  9. **Testing Discovery**: Understand testing setup and practices
  10. **Example Extraction**: Find real examples from the codebase
</analysis_workflow>

<output_structure>
  <main_file>
    Create or deeply improve AGENTS.md with ONLY non-obvious information:
    
    If AGENTS.md exists:
    - FIRST: Delete ALL obvious information
    - REMOVE: Standard commands, framework defaults, common patterns
    - STRIP: Anything that doesn't require file reading to know
    - EVALUATE: Each line - would an experienced dev be surprised?
    - If not surprised, DELETE IT
    - THEN: Add only truly non-obvious new discoveries
    - Goal: File should be SHORTER and MORE VALUABLE
    
    Content should include:
    - Header: "# AGENTS.md\\n\\nThis file provides guidance to agents when working with code in this repository."
    - Build/lint/test commands - ONLY if they differ from standard package.json scripts
    - Code style - ONLY project-specific rules not covered by linter configs
    - Custom utilities or patterns discovered by reading the code
    - Non-standard directory structures or file organizations
    - Project-specific conventions that violate typical practices
    - Critical gotchas that would cause errors if not followed
    
    EXCLUDE obvious information like:
    - Standard npm/yarn commands visible in package.json
    - Framework defaults (e.g., "React uses JSX")
    - Common patterns (e.g., "tests go in __tests__ folders")
    - Information derivable from file extensions or directory names
    
    Keep it concise (aim for ~20 lines, but expand as needed for complex projects).
    Include existing AI assistant rules from CLAUDE.md, Cursor rules (.cursor/rules/ or .cursorrules), or Copilot rules (.github/copilot-instructions.md).
  </main_file>
  
  <mode_specific_files>
    Create or deeply improve mode-specific AGENTS.md files IN THE PROJECT ROOT.
    
    CRITICAL: For each of these paths (RELATIVE TO PROJECT ROOT), check if the file exists FIRST:
    - .roo/rules-code/AGENTS.md (create .roo in project root, not system root!)
    - .roo/rules-debug/AGENTS.md (relative to project root)
    - .roo/rules-ask/AGENTS.md (relative to project root)
    - .roo/rules-architect/AGENTS.md (relative to project root)
    
    IMPORTANT: The .roo directory must be created in the current project/workspace root directory,
    NOT at the system root (/) or home directory. All paths are relative to where the project is located.
    
    If files exist:
    - AGGRESSIVELY DELETE obvious information
    - Remove EVERYTHING that's standard practice
    - Strip out framework defaults and common patterns
    - Each remaining line must be surprising/non-obvious
    - Only then add new non-obvious discoveries
    - Files should become SHORTER, not longer
    
    Example structure (ALL IN PROJECT ROOT):
    \`\`\`
    project-root/
    ├── AGENTS.md                    # General project guidance
    ├── .roo/                        # IN PROJECT ROOT, NOT SYSTEM ROOT!
    │   ├── rules-code/
    │   │   └── AGENTS.md           # Code mode specific instructions
    │   ├── rules-debug/
    │   │   └── AGENTS.md           # Debug mode specific instructions
    │   ├── rules-ask/
    │   │   └── AGENTS.md           # Ask mode specific instructions
    │   └── rules-architect/
    │       └── AGENTS.md           # Architect mode specific instructions
    ├── src/
    ├── package.json
    └── ... other project files
    \`\`\`
    
    .roo/rules-code/AGENTS.md - ONLY non-obvious coding rules discovered by reading files:
    - Custom utilities that replace standard approaches
    - Non-standard patterns unique to this project
    - Hidden dependencies or coupling between components
    - Required import orders or naming conventions not enforced by linters
    
    Example of non-obvious rules worth documenting:
    \`\`\`
    # Project Coding Rules (Non-Obvious Only)
    - Always use safeWriteJson() from src/utils/ instead of JSON.stringify for file writes (prevents corruption)
    - API retry mechanism in src/api/providers/utils/ is mandatory (not optional as it appears)
    - Database queries MUST use the query builder in packages/evals/src/db/queries/ (raw SQL will fail)
    - Provider interface in packages/types/src/ has undocumented required methods
    - Test files must be in same directory as source for vitest to work (not in separate test folder)
    \`\`\`
    
    .roo/rules-debug/AGENTS.md - ONLY non-obvious debugging discoveries:
    - Hidden log locations not mentioned in docs
    - Non-standard debugging tools or flags
    - Gotchas that cause silent failures
    - Required environment variables for debugging
    
    Example of non-obvious debug rules worth documenting:
    \`\`\`
    # Project Debug Rules (Non-Obvious Only)
    - Webview dev tools accessed via Command Palette > "Developer: Open Webview Developer Tools" (not F12)
    - IPC messages fail silently if not wrapped in try/catch in packages/ipc/src/
    - Production builds require NODE_ENV=production or certain features break without error
    - Database migrations must run from packages/evals/ directory, not root
    - Extension logs only visible in "Extension Host" output channel, not Debug Console
    \`\`\`
    
    .roo/rules-ask/AGENTS.md - ONLY non-obvious documentation context:
    - Hidden or misnamed documentation
    - Counterintuitive code organization
    - Misleading folder names or structures
    - Important context not evident from file structure
    
    Example of non-obvious documentation rules worth documenting:
    \`\`\`
    # Project Documentation Rules (Non-Obvious Only)
    - "src/" contains VSCode extension code, not source for web apps (counterintuitive)
    - Provider examples in src/api/providers/ are the canonical reference (docs are outdated)
    - UI runs in VSCode webview with restrictions (no localStorage, limited APIs)
    - Package.json scripts must be run from specific directories, not root
    - Locales in root are for extension, webview-ui/src/i18n for UI (two separate systems)
    \`\`\`
    
    .roo/rules-architect/AGENTS.md - ONLY non-obvious architectural constraints:
    - Hidden coupling between components
    - Undocumented architectural decisions
    - Non-standard patterns that must be followed
    - Performance bottlenecks discovered through investigation
    
    Example of non-obvious architecture rules worth documenting:
    \`\`\`
    # Project Architecture Rules (Non-Obvious Only)
    - Providers MUST be stateless - hidden caching layer assumes this
    - Webview and extension communicate through specific IPC channel patterns only
    - Database migrations cannot be rolled back - forward-only by design
    - React hooks required because external state libraries break webview isolation
    - Monorepo packages have circular dependency on types package (intentional)
    \`\`\`
  </mode_specific_files>
</output_structure>

<quality_criteria>
  - ONLY include non-obvious information discovered by reading files
  - Exclude anything that could be guessed from standard practices
  - Focus on gotchas, hidden requirements, and counterintuitive patterns
  - Include specific file paths when referencing custom utilities
  - Be extremely concise - if it's obvious, don't include it
  - Every line should prevent a potential mistake or confusion
  - Test: Would an experienced developer be surprised by this information?
  - If updating existing files: DELETE obvious info first, files should get SHORTER
  - Measure success: Is the file more concise and valuable than before?
</quality_criteria>

Remember: The goal is to create documentation that enables AI assistants to be immediately productive in this codebase, focusing on project-specific knowledge that isn't obvious from the code structure alone.`,
	},
	"test-guide": {
		name: "test-guide",
		description: "Provides a guide on how to test the project.",
		content: `---
description: "生成项目测试指导文档"
---

# 测试指导文档生成

## 角色：资深架构师和测试专家

## 核心目标

您的核心任务是为当前项目**建立一套清晰、可本地执行、对开发者和 AI 都友好的 API 测试机制**。最终产出物是一个结构化的测试指导文档 \`.cospec/TEST_GUIDE.md\`，确保项目的可测试性得到显著提升。

---

## 工作流程

您的工作流程被严格划分为两个阶段，必须按顺序执行。

### **第一阶段：分析与诊断**

这是所有操作的第一步，也是决策的关键。

1.  **扫描项目**：
    * **任务**：全面分析项目结构，重点检查是否存在用于自动化测试的配置文件或脚本。
    * **检查重点**：\`build.sh\`, \`Makefile\`, \`package.json\` (中的 \`scripts\` 部分), \`scripts/\` 目录, \`test/\` 或 \`tests/\` 目录等。
    * **判断标准**：确定项目中是否存在一个**已定义的、可运行的** API 测试命令或流程。

2.  **决策与沟通**：
    * **如果找到现有测试机制**：直接进入 **[路径A：复用与验证]**。
    * **如果未找到或机制不完整**：必须使用 \`ask_followup_question\` 工具询问用户，并提供明确选项：
        > "检测到当前项目缺少一套完整的本地化API测试机制。是否授权我为您创建一套？
        >
        > <suggest>是，请帮我创建</suggest>
        > <suggest>否，暂时不需要</suggest>"
        * 若用户选择“是”，则进入 **[路径B：创建与验证]**。
        * 若用户选择“否”，则使用 \`attempt_completion\` 礼貌地终止任务。

---

### **第二阶段：执行**

根据第一阶段的诊断结果，严格遵循以下两条独立路径之一。每个路径的步骤列表即为该场景下的 \`todo_list\`。

#### **[路径 A：复用与验证工作流]**

**目标：验证、标准化并文档化项目已有的测试能力。**

##### 进度跟踪

* **任务开始时的第一步**: 使用 \`todo_list\` 工具列出任务清单，此操作必须在其它任何动作之前。
* 通过任务清单的勾选状态跟踪实现进度。

##### 任务清单内容

\`todo_list\` 中必须包含以下操作，**请勿遗漏任何一个步骤**:

1.  **提炼流程**：总结并提炼出现有测试脚本的完整执行流程（例如：如何安装依赖、启动服务、运行特定测试、清理环境）。
2.  **委托脚本验证与修复**：
    * **必须**使用 \`new_task\` 工具，切换到 \`Code\` 模式，将**验证并修复现有测试脚本**的任务委托给子任务。
    * 传递给子任务的指令**必须**使用 **《附录A：委托子任务指令模板》**，其中 \`{{任务说明}}\` 应描述为“请验证并确保以下现有测试脚本能够成功执行”，\`{{测试方案}}\` 部分留空。
    * **子任务的核心职责**：必须在当前环境中**尝试执行**现有脚本。如果执行失败，必须遵循模板中的修复流程进行**循环修复**，直到脚本可以成功**跑完所有测试用例**为止。
3.  **生成指导文档**：严格依据**验证后**的测试机制，在 \`.cospec/\` 目录下创建 \`TEST_GUIDE.md\`。文档需遵循 **《附录B》** 和 **《附录C》** 的要求。
4.  **寻求确认**：生成文档后，使用 \`ask_followup_question\` 工具寻求用户反馈：
    > "已根据项目现有测试流程生成指导文档 \`TEST_GUIDE.md\`。请您审阅，如需修改可直接提出，确认无误后请点击‘继续’。
    >
    > <suggest>继续</suggest>"
5.  **完成任务**：在用户确认后，使用 \`attempt_completion\` 工具总结本次任务。

#### **[路径 B：创建与验证工作流]**

**目标：为项目引入一套全新的、低依赖且经过验证的本地化测试机制。**

##### 进度跟踪

* **任务开始时的第一步**: 使用 \`todo_list\` 工具列出任务清单，此操作必须在其它任何动作之前。
* 通过任务清单的勾选状态跟踪实现进度。

##### 任务清单内容

\`todo_list\` 中必须包含以下操作，**请勿遗漏任何一个步骤**:

1.  **规划方案**：严格遵循 **《附录A》** 中模板内的“测试方案要求”，规划一套新的测试方案，并向用户简要陈述设计思路。
2.  **确认脚本创建**：使用 \`ask_followup_question\` 工具与用户确认测试脚本的创建。优先推荐在项目中能够找到的常见脚本形式（bash, bat, powershell等），否则默认使用bash。
3.  **委托脚本生成与验证**：
    * **必须**使用 \`new_task\` 工具，切换到 \`Code\` 模式，将**创建、验证并修复测试脚本**的任务委托给子任务。
    * 传递给子任务的指令**必须**使用 **《附录A：委托子任务指令模板》**，其中 \`{{任务说明}}\` 应描述为“请根据测试方案生成新的测试脚本并验证”，\`{{测试方案}}\` 部分填写第1步规划的方案。
    * **子任务的核心职责**：生成脚本后，必须在当前环境中**尝试执行**以验证其可用性。如果执行失败，必须遵循模板中的修复流程进行**循环修复**，直到脚本可以成功**跑完所有测试用例**为止。
4.  **编写指导文档**：在子任务成功返回后，在 \`.cospec/\` 目录下创建 \`TEST_GUIDE.md\`，详细说明这套**全新**测试机制的使用方法。文档结构需遵循 **《附录B》**。
5.  **内部审查文档**：对照 **《附录C：测试指导文档要求》**，自我检查生成的文档是否符合精简、易于扩展的原则。
6.  **寻求用户确认**：完成所有生成和审查后，使用 \`ask_followup_question\` 工具寻求用户反馈：
    > "已为您创建了新的测试机制（脚本位于 \`[脚本路径]\`）并生成了指导文档 \`TEST_GUIDE.md\`。请您审阅，如需修改可直接提出，确认无误后请点击‘继续’。
    >
    > <suggest>继续</suggest>"
7.  **总结并提供后续指引**：在用户确认后，使用 \`attempt_completion\` 工具总结任务。如果新机制需要用户手动配置（如在配置文件中填写数据库密码等），**必须**在此步骤明确告知用户需要配置的文件、位置以及验证方法。

---

## 附录

### **附录A：委托子任务指令模板**

使用以下模板来作为 \`new_task\` 输入：

\`\`\`markdown
{{任务说明}}

### 测试方案要求

- 尽可能支持本地环境运行，降低环境工具依赖，避免用户需提前安装不同的辅助命令行工具。
- 尽可能支持多平台运行，例如兼顾 windows、mac、linux 不同平台的特性。
- 尽可能降低所需依赖，例如中间件运行依赖等，或考虑支持配置更低运行门槛的中间件（sqlite 等，不强求）。
- 尽可能减少引入的新框架新测试依赖，例如 pytest 等。
- 尽可能避免引入的新语言特性，例如 python 3.10 的 f-string 等。
- 支持创建独立的测试配置文件，避免与正式服务运行混淆。
- 优先支持接口测试，避免引入大量单元测试。
- 优先以覆盖后端服务为主。
- 支持单独指定功能点测试，避免测试用例过多。
- 测试用例管理模式清晰，支持按功能点、模块进行划分，便于修改与人工编写用例。避免过多用例写在单个文件内。
- 注意考虑常见的测试依赖问题，例如数据依赖、权限依赖、服务依赖等。对于数据库、redis 等中间件，考虑支持配置化，避免硬编码。对于服务依赖，考虑支持 mock 服务，避免依赖真实服务。

### 测试方案说明

{{测试方案}}

### 测试脚本功能要求

- 优先以在项目中能够找到的常见脚本形式作为载体（bash、bat、powershell 等），否则优先考虑以 bash 脚本形式支持。
- 脚本易用,支持直接运行，默认跑通所有测试用例，避免用户需手动介入。
- 支持按功能点、模块进行单独触发。注意尽量避免硬编码模块与功能点，最好能支持动态加载。
- 脚本功能完备，支持测试用例的执行、结果展示等。
- 脚本流程完备，考虑依赖安装、服务构建、服务运行、测试执行、结果读取、停止服务等必要流程。
- 项目特异性操作支持配置化，便于用户修改。例如依赖安装命令、服务构建命令、服务运行命令、测试执行命令等。
- 项目特异性参数支持配置化或支持读取环境变量，避免硬编码。例如服务运行端口、服务运行地址、服务运行用户等。
- 实现脚本时，不要编写过多的测试用例。只需要编写 1~2 个典型的**真实用例**即可，优先保证流程能正常执行跑通用例。
- 脚本执行失败时，需分析失败原因。若为脚本逻辑错误、测试代码错误等需要进行修复；若为执行警告，可暂不处理，后续再考虑优化；若为环境配置错误，例如缺乏中间件配置、连接配置等需用户进一步提供信息的，需向用户进行询问，让用户提供具体信息。
- 尽量不要在脚本内编写代码文件生成模板，会导致复杂度过高难以理解。

### 修复脚本执行失败时，需遵守以下修复流程

1.  复述问题现象
2.  罗列已尝试过的修复方案
3.  说明新的修复方案
4.  尝试执行修复
5.  验证修复结果
6.  确认是否修复成功，若已超过 3 次修复且无进展，**必须**使用 \`ask_followup_question\` 工具询问用户是否跳过或让用户提供修复建议。
\`\`\`

### **附录B：测试指导文档结构说明**

测试指导文档应尽可能精简，避免冗余信息。请参考以下结构进行编写：

\`\`\`markdown
## 测试指导文档

### 测试命令使用说明

(说明如何执行测试脚本，如何按功能点、模块执行测试等)

### 测试案例管理规范

(说明如何管理测试用-例，文件命名规范、如何按功能点、模块进行划分等)

### 测试数据管理规范（若有）
\`\`\`

### **附录C：测试指导文档要求**

-   **聚焦机制**：只需写明测试机制本身，便于指引 AI 和开发者查找正确信息，减少无用信息。
-   **忽略覆盖率**：无需关注测试覆盖率问题。
-   **展示扩展性**：不要枚举所有支持的功能点、模块。应只介绍功能点、模块的**声明机制**，提供如何**扩展**和**使用**的示例即可。

## 重要约束清单

### 禁止行为

-   禁止在未经用户同意的情况下修改用户业务代码，需说明清楚为什么这么修改。

### 必须行为

-   严格按照本 Prompt 定义的工作流（即对应路径下的任务清单）推进任务。`,
	},
}

/**
 * Get all built-in commands as Command objects
 */
export async function getBuiltInCommands(): Promise<Command[]> {
	return Object.values(BUILT_IN_COMMANDS).map((cmd) => ({
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${cmd.name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}))
}

/**
 * Get a specific built-in command by name
 */
export async function getBuiltInCommand(name: string): Promise<Command | undefined> {
	const cmd = BUILT_IN_COMMANDS[name]
	if (!cmd) return undefined

	return {
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}
}

/**
 * Get names of all built-in commands
 */
export async function getBuiltInCommandNames(): Promise<string[]> {
	return Object.keys(BUILT_IN_COMMANDS)
}

// Support prompts
type PromptParams = Record<string, string | any[]>

const generateDiagnosticText = (diagnostics?: any[]) => {
	if (!diagnostics?.length) return ""
	return `\nCurrent problems detected:\n${diagnostics
		.map((d) => `- [${d.source || "Error"}] ${d.message}${d.code ? ` (${d.code})` : ""}`)
		.join("\n")}`
}

export const createPrompt = (template: string, params: PromptParams): string => {
	return template.replace(/\${(.*?)}/g, (_, key) => {
		if (key === "diagnosticText") {
			return generateDiagnosticText(params["diagnostics"] as any[])
			// eslint-disable-next-line no-prototype-builtins
		} else if (params.hasOwnProperty(key)) {
			// Ensure the value is treated as a string for replacement
			const value = params[key]
			if (typeof value === "string") {
				return value
			} else {
				// Convert non-string values to string for replacement
				return String(value)
			}
		} else {
			// If the placeholder key is not in params, replace with empty string
			return ""
		}
	})
}

interface SupportPromptConfig {
	template: string
	pathOnly?: string
	selectedText?: string
}

type SupportPromptType =
	| "ENHANCE"
	| "CONDENSE"
	| "EXPLAIN"
	| "FIX"
	| "IMPROVE"
	| "ADD_TO_CONTEXT"
	| "TERMINAL_ADD_TO_CONTEXT"
	| "TERMINAL_FIX"
	| "TERMINAL_EXPLAIN"
	| "NEW_TASK"
	| "ZGSM_EXPLAIN"
	| "ZGSM_ADD_COMMENT"
	| "ZGSM_ADD_DEBUG_CODE"
	| "ZGSM_ADD_STRONG_CODE"
	| "ZGSM_SIMPLIFY_CODE"
	| "ZGSM_PERFORMANCE"
	| "ZGSM_ADD_TEST"
	| "WORKFLOW_TASK_RUN"
	| "WORKFLOW_TASK_RUN_TESTS"
	| "WORKFLOW_TASK_RETRY"
	| "WORKFLOW_RQS_UPDATE"
	| "WORKFLOW_DESIGN_UPDATE"

const supportPromptConfigs: Record<SupportPromptType, SupportPromptConfig> = {
	ENHANCE: {
		template: `Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):

\${userInput}`,
	},
	CONDENSE: {
		template: `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing with the conversation and supporting any continuing tasks.

Your summary should be structured as follows:
Context: The context to continue the conversation with. If applicable based on the current task, this should include:
  1. Previous Conversation: High level details about what was discussed throughout the entire conversation with the user. This should be written to allow someone to be able to follow the general overarching conversation flow.
  2. Current Work: Describe in detail what was being worked on prior to this request to summarize the conversation. Pay special attention to the more recent messages in the conversation.
  3. Key Technical Concepts: List all important technical concepts, technologies, coding conventions, and frameworks discussed, which might be relevant for continuing with this work.
  4. Relevant Files and Code: If applicable, enumerate specific files and code sections examined, modified, or created for the task continuation. Pay special attention to the most recent messages and changes.
  5. Problem Solving: Document problems solved thus far and any ongoing troubleshooting efforts.
  6. Pending Tasks and Next Steps: Outline all pending tasks that you have explicitly been asked to work on, as well as list the next steps you will take for all outstanding work, if applicable. Include code snippets where they add clarity. For any next steps, include direct quotes from the most recent conversation showing exactly what task you were working on and where you left off. This should be verbatim to ensure there's no information loss in context between tasks.

Example summary structure:
1. Previous Conversation:
  [Detailed description]
2. Current Work:
  [Detailed description]
3. Key Technical Concepts:
  - [Concept 1]
  - [Concept 2]
  - [...]
4. Relevant Files and Code:
  - [File Name 1]
	- [Summary of why this file is important]
	- [Summary of the changes made to this file, if any]
	- [Important Code Snippet]
  - [File Name 2]
	- [Important Code Snippet]
  - [...]
5. Problem Solving:
  [Detailed description]
6. Pending Tasks and Next Steps:
  - [Task 1 details & next steps]
  - [Task 2 details & next steps]
  - [...]

Output only the summary of the conversation so far, without any additional commentary or explanation.`,
	},
	WORKFLOW_TASK_RUN: {
		template: `请开始执行用户需求的实现工作。基于 \`\${scope}\` 目录下已创建的需求文档(requirements.md)、架构设计文档(design.md)推进相应功能实现。

### 进度跟踪

- **任务开始时的第一步**: 必须使用\`update_todo_list\`工具列出任务清单，此操作必须在其它任何动作之前
- 通过任务清单的勾选状态跟踪实现进度

### 任务执行约束

todo list 中必须包含以下操作，**请勿遗漏任何一个步骤**:

- 在执行任何开发任务前，请务必仔细阅读并理解 \`\${scope}\` 目录下的 requirements.md、design.md 文档
- 若未充分理解需求或设计即开始执行任务，可能导致实现偏差或功能错误
- **该过程不允许修改任何测试相关的文件比如修改测试案例**
- 任务开始前把 \`tasks.md\` 中对应任务状态更新为\`- [-]\` (进行中)，**\`tasks.md\`文档内容仅用于更新任务状态，不允许其它用途**
- 任务完成后把 \`tasks.md\` 中对应任务状态更新为\`- [x]\` (已完成)，**\`tasks.md\`文档内容仅用于更新任务状态，不允许其它用途**

### 待完成任务

============== 待完成任务: start ===============

\${selectedText}

**如果当前任务中明确有测试要求,请严格遵守以下规则:**

- 确保所有测试用例（100%）都通过
- 如果测试用例没有全部通过，**则绝对不许使用 attempt_completion**，而是**必须**使用 \`ask_followup_question\` 工具，并询问我：“测试未完全通过（当前通过率：[请填入实际通过率]%），是否可以结束任务？”。在我给出肯定答复前，请不要结束。

============== 待完成任务: end ===============

当前任务开发完成后，请使用 attempt_completion 工具提交实现结果总结。请注意，以上具体操作指令优先于常规的\${mode}指令。
`,
	},
	WORKFLOW_TASK_RUN_TESTS: {
		template: `基于 \`\${scope}\` 目录下已创建的需求文档(requirements.md)、架构设计文档(design.md)和任务规划文档(tasks.md),生成配套测试用例。

### 进度跟踪

- **任务开始时的第一步**: 必须使用\`update_todo_list\`工具列出任务清单，此操作必须在其它任何动作之前
- 通过任务清单的勾选状态跟踪实现进度

### 任务执行约束

todo list 中必须包含以下操作，**请勿遗漏任何一个步骤**:

- 在执行任何更新任务前，请仔细阅读\`\${scope}\`下的requirements.md、design.md和tasks.md文件
- 结合需求文档，分析架构设计文档、任务规划文档对现有测试用例的影响范围
- 为关键任务生成测试用例，并更新测试位置信息到tasks.md
- 完成后使用attempt_completion工具提供简洁但全面的总结

### 测试生成要求：

- 只执行测试生成阶段的工作，不要涉及需求分析、架构设计或任务规划
- 不包含具体测试要求
- 不包含与部署相关的测试
- 不包含与监控和日志相关的测试
- 不包含与性能相关的测试
- 不包含与安全相关的测试
- 不包含与集成相关的测试
- 不包含非功能测试点（边界测试、异常测试、容错测试等）
- 让test mode来决策，不给任何内容生成上的要求
- 不应要求所有任务都生成测试

完成后使用attempt_completion工具提供变更总结，包括更新的功能点、受影响模块和验证要点。这些具体指令优先于\${mode}的常规指令。
`,
	},
	WORKFLOW_TASK_RETRY: {
		template: `请开始执行用户需求的实现工作。基于 \`\${scope}\` 目录下已创建的需求文档(requirements.md)、架构设计文档(design.md)推进相应功能实现。

### 进度跟踪

- **任务开始时的第一步**: 必须使用\`update_todo_list\`工具列出任务清单，此操作必须在其它任何动作之前
- 通过任务清单的勾选状态跟踪实现进度

### 任务执行约束

todo list 中必须包含以下操作，**请勿遗漏任何一个步骤**:

- 在执行任何开发任务前，请务必仔细阅读并理解 \`\${scope}\` 目录下的 requirements.md、design.md 文档
- 若未充分理解需求或设计即开始执行任务，可能导致实现偏差或功能错误
- **该过程不允许修改任何测试相关的文件比如修改测试案例**
- 执行过程中及时更新 \`tasks.md\` 文档中对应任务的状态，状态说明：\`- [ ]\` (未开始)、\`- [-]\` (进行中)、\`- [x]\` (已完成)，**\`tasks.md\`文档内容仅用于更新任务状态，不允许其它用途**
- 任务开始前把 \`tasks.md\` 中对应任务状态更新为\`- [-]\` (进行中)，**\`tasks.md\`文档内容仅用于更新任务状态，不允许其它用途**

### 待完成任务

============== 待完成任务: start ===============

\${selectedText}

**如果当前任务中明确有测试要求,请严格遵守以下规则:**

- 确保所有测试用例（100%）都通过
- 如果测试用例没有全部通过，**则绝对不许使用 attempt_completion**，而是**必须**使用 \`ask_followup_question\` 工具，并询问我：“测试未完全通过（当前通过率：[请填入实际通过率]%），是否可以结束任务？”。在我给出肯定答复前，请不要结束。

============== 待完成任务: end ===============

当前任务开发完成后，请使用 attempt_completion 工具提交实现结果总结。请注意，以上具体操作指令优先于常规的\${mode}指令。
`,
	},
	WORKFLOW_RQS_UPDATE: {
		template: `用户更新了需求文档请更新相应的设计文档。基于 \`\${scope}\` 目录下已创建的需求文档(requirements.md)、架构设计文档(design.md)实施设计变更，如果没有则跳过。

### 进度跟踪

- **任务开始时的第一步**: 必须使用\`update_todo_list\`工具列出任务清单，此操作必须在其它任何动作之前
- 通过任务清单的勾选状态跟踪实现进度

### 任务执行约束

todo list 中必须包含以下操作，**请勿遗漏任何一个步骤**:

- 在执行任何更新任务前，请仔细阅读\`\${scope}\`下的requirements.md、design.md
- 理解用户需求变更，如果没有用户变更需求，则充分理解需求文档
- 分析需求变更对现有设计的影响范围
- 确认变更涉及的模块和需要调整的现有功能
- 在没有充分理解变更影响的情况下执行任务将导致不准确的实现
- 任务开始前把 \`\${scope}\`下的requirements.md末尾加入文档更新时间，**\`requirements.md\`文档内容仅用于更新设计文档，不允许其它用途**

### 用户需求变更 (包含添加或删除，变更为空时则整体理解requirements.md文档)

\${selectedText}

### 变更实施要求：

1. 评估设计文档需要调整的部分，更新相应的架构设计
2. 确保向后兼容性，或制定适当的迁移方案

完成后使用attempt_completion工具提供变更总结，包括更新的功能点、受影响模块和验证要点。这些具体指令优先于\${mode}模式的常规指令。
`,
	},
	WORKFLOW_DESIGN_UPDATE: {
		template: `用户更新了架构设计文档请更新相应的任务规划文档。基于 \`\${scope}\` 目录下已创建的需求文档(requirements.md)、架构设计文档(design.md)和任务规划文档(tasks.md),请更新任务规划文档(tasks.md)，如果没有则跳过。

### 进度跟踪

- **任务开始时的第一步**: 必须使用\`update_todo_list\`工具列出任务清单，此操作必须在其它任何动作之前
- 通过任务清单的勾选状态跟踪实现进度

### 任务执行约束

todo list 中必须包含以下操作，**请勿遗漏任何一个步骤**:

- 在执行任何更新任务前，请仔细阅读\`\${scope}\`下的requirements.md、design.md和tasks.md文件
- 理解用户架构设计文档变更，如果没有用户架构设计文档内容，则充分理解架构设计文档
- 结合需求文档，分析架构设计文档对现有任务规划的影响范围
- 变更的 \`\${scope}\`下的 tasks.md需要和requirements.md中的功能清单能对应，删除tasks.md多余任务和补充功能清单中没有的任务
- 任务开始前把 \`\${scope}\`下的design.md末尾加入文档更新时间，**\`design.md\`文档内容仅用于更新任务规划文档，不允许其它用途**

### 用户需求变更 (包含添加或删除，变更为空时则整体理解design.md文档)

\${selectedText}

### 变更实施要求：

1. 评估任务规划文档需要调整的部分，更新相应的任务规划设计
2. 重新规划受影响的任务，调整任务优先级和依赖关系
3. 变更的 \`\${scope}\`下的 tasks.md的任务需要和requirements.md中的功能清单能对应，按需删除tasks.md多余任务或补充功能清单中没有的任务
4. 按照更新后的任务规划逐步实现变更功能
5. 确保向后兼容性，或制定适当的迁移方案

完成后使用attempt_completion工具提供变更总结，包括更新的功能点、受影响模块和验证要点。这些具体指令优先于\${mode}的常规指令。
`,
	},
	EXPLAIN: {
		template: `Explain the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please provide a clear and concise explanation of what this code does, including:
1. The purpose and functionality
2. Key components and their interactions
3. Important patterns or techniques used`,
	},
	FIX: {
		template: `Fix any issues in the following code from file path \${filePath}:\${startLine}-\${endLine}
\${diagnosticText}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please:
1. Address all detected problems listed above (if any)
2. Identify any other potential bugs or issues
3. Provide corrected code
4. Explain what was fixed and why`,
	},
	IMPROVE: {
		template: `Improve the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please suggest improvements for:
1. Code readability and maintainability
2. Performance optimization
3. Best practices and patterns
4. Error handling and edge cases

Provide the improved code along with explanations for each enhancement.`,
	},
	ADD_TO_CONTEXT: {
		template: `\${filePath}:\${startLine}-\${endLine}
\`\`\`
\${selectedText}
\`\`\``,
		pathOnly: `\${filePath}:\${startLine}-\${endLine}`,
		selectedText: `\`\`\`
\${selectedText}
\`\`\``,
	},
	TERMINAL_ADD_TO_CONTEXT: {
		template: `\${userInput}
Terminal output:
\`\`\`
\${terminalContent}
\`\`\``,
	},
	TERMINAL_FIX: {
		template: `\${userInput}
Fix this terminal command:
\`\`\`
\${terminalContent}
\`\`\`

Please:
1. Identify any issues in the command
2. Provide the corrected command
3. Explain what was fixed and why`,
	},
	TERMINAL_EXPLAIN: {
		template: `\${userInput}
Explain this terminal command:
\`\`\`
\${terminalContent}
\`\`\`

Please provide:
1. What the command does
2. Explanation of each part/flag
3. Expected output and behavior`,
	},
	NEW_TASK: {
		template: `\${userInput}`,
	},
	ZGSM_EXPLAIN: {
		template: `Explain the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`

Please provide a clear and concise explanation of what this code does, including:
1. The purpose and functionality
2. Key components and their interactions
3. Important patterns or techniques used`,
	},
	ZGSM_ADD_COMMENT: {
		template: `Add comments to the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
	ZGSM_ADD_DEBUG_CODE: {
		template: `Enhance troubleshooting capabilities by adding logs and debug code to key logic steps to the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
	ZGSM_ADD_STRONG_CODE: {
		template: `Enhance robustness by adding exception handling and parameter validation to the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
	ZGSM_SIMPLIFY_CODE: {
		template: `Remove ineffective part of the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
	ZGSM_PERFORMANCE: {
		template: `Improve code performance, provide modification suggestions, focus on efficiency issues to the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
	ZGSM_ADD_TEST: {
		template: `Generate unit tests for the following code from file path \${filePath}:\${startLine}-\${endLine}
\${userInput}

\`\`\`
\${selectedText}
\`\`\`
`,
	},
} as const

export const supportPrompt = {
	default: Object.fromEntries(Object.entries(supportPromptConfigs).map(([key, config]) => [key, config.template])),
	get: (customSupportPrompts: Record<string, any> | undefined, type: SupportPromptType): string => {
		return customSupportPrompts?.[type] ?? supportPromptConfigs[type].template
	},
	getPathWithSelectedText: (
		customSupportPrompts: Record<string, any> | undefined,
		type: SupportPromptType,
		params: PromptParams,
	): { selectedText?: string; pathOnly?: string } => {
		return {
			selectedText: (params.selectedText as string) ?? "",
			pathOnly: customSupportPrompts?.[type] ?? supportPromptConfigs[type].pathOnly,
		}
	},
	create: (type: SupportPromptType, params: PromptParams, customSupportPrompts?: Record<string, any>): string => {
		const template = supportPrompt.get(customSupportPrompts, type)
		return createPrompt(template, params)
	},
	createPathWithSelectedText: (
		type: SupportPromptType,
		params: PromptParams,
		customSupportPrompts?: Record<string, any>,
	): { selectedText?: string; pathOnly: string } => {
		const pathOnlyTemplate = supportPromptConfigs[type].pathOnly
		const pathOnly = pathOnlyTemplate ? createPrompt(pathOnlyTemplate, params) : ""
		return {
			selectedText: params.selectedText as string,
			pathOnly: pathOnly,
		}
	},
} as const

export type { SupportPromptType }

export type CustomSupportPrompts = {
	[key: string]: string | undefined
}

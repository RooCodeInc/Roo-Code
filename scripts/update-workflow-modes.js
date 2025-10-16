#!/usr/bin/env node

/**
 * Script to update WORKFLOW_MODES in packages/types/src/mode.ts
 * based on the customModes defined in .roomodes file
 */

const fs = require("fs")
const path = require("path")

// Paths
const roomodesPath = path.join(__dirname, "../.roomodes")
const modeTypesPath = path.join(__dirname, "../packages/types/src/mode.ts")

/**
 * 解析 YAML 值，处理字符串引号和类型转换
 */
function parseYamlValue(value) {
	if (!value) return ""

	// 处理布尔值
	if (value === "true") return true
	if (value === "false") return false

	// 处理数字
	if (/^\d+$/.test(value)) return parseInt(value, 10)
	if (/^\d+\.\d+$/.test(value)) return parseFloat(value)

	// 处理字符串，移除引号
	return value.replace(/^["']|["']$/g, "")
}

/**
 * 解析多行字符串块（|- 格式）
 */
function parseMultilineString(lines, startIndex, baseIndent) {
	const result = []
	let i = startIndex + 1

	while (i < lines.length) {
		const line = lines[i]
		const indent = line.length - line.trimStart().length

		// 如果缩进小于等于基础缩进，说明多行字符串结束
		if (line.trim() && indent <= baseIndent) {
			break
		}

		// 添加内容行（保持相对缩进）
		if (line.trim()) {
			const content = line.substring(baseIndent + 2) // 移除基础缩进 + 2个空格
			result.push(content)
		} else {
			result.push("") // 保留空行
		}

		i++
	}

	return {
		content: result.join("\n"),
		nextIndex: i,
	}
}

/**
 * 解析 groups 数组的复杂结构
 */
function parseGroupsArray(lines, startIndex, baseIndent) {
	const groups = []
	let i = startIndex + 1

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()
		const indent = line.length - line.trimStart().length

		// 如果缩进小于等于基础缩进，说明 groups 数组结束
		if (trimmed && indent <= baseIndent) {
			break
		}

		// 跳过空行和注释
		if (!trimmed || trimmed.startsWith("#")) {
			i++
			continue
		}

		// 处理数组项
		if (trimmed.startsWith("- ")) {
			const itemContent = trimmed.substring(2).trim()

			// 检查是否是嵌套数组的开始 (- - edit)
			if (itemContent.startsWith("- ")) {
				const groupName = itemContent.substring(2).trim()

				// 解析后续的选项对象
				const optionsResult = parseGroupOptions(lines, i, indent)

				if (optionsResult.options) {
					groups.push([groupName, optionsResult.options])
				} else {
					groups.push(groupName)
				}

				i = optionsResult.nextIndex
			} else {
				// 简单的字符串项
				groups.push(parseYamlValue(itemContent))
				i++
			}
		} else {
			i++
		}
	}

	return {
		groups,
		nextIndex: i,
	}
}

/**
 * 解析 group 选项对象
 */
function parseGroupOptions(lines, startIndex, baseIndent) {
	const options = {}
	let i = startIndex + 1
	let hasOptions = false

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()
		const indent = line.length - line.trimStart().length

		// 如果缩进不正确，结束解析
		if (trimmed && indent <= baseIndent) {
			break
		}

		// 跳过空行和注释
		if (!trimmed || trimmed.startsWith("#")) {
			i++
			continue
		}

		// 解析键值对
		if (trimmed.includes(":")) {
			const colonIndex = trimmed.indexOf(":")
			let key = trimmed.substring(0, colonIndex).trim()
			const value = trimmed.substring(colonIndex + 1).trim()

			// 移除键名前面可能的 "- " 前缀
			if (key.startsWith("- ")) {
				key = key.substring(2).trim()
			}

			if (key && value) {
				options[key] = parseYamlValue(value)
				hasOptions = true
			}
		}

		i++
	}

	return {
		options: hasOptions ? options : null,
		nextIndex: i,
	}
}

/**
 * 改进的 YAML 解析器，专门处理 .roomodes 文件的复杂结构
 */
function parseRoomodes(content) {
	const lines = content.split("\n")
	const result = { customModes: [] }
	let currentMode = null
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()
		const indent = line.length - line.trimStart().length

		// 跳过空行和注释
		if (!trimmed || trimmed.startsWith("#")) {
			i++
			continue
		}

		// 检查 customModes 开始
		if (trimmed === "customModes:") {
			i++
			continue
		}

		// 检查新的 mode 条目
		if (trimmed.startsWith("- slug:")) {
			// 保存前一个 mode
			if (currentMode) {
				result.customModes.push(currentMode)
			}

			// 开始新的 mode
			const slug = trimmed.split(":")[1].trim()
			currentMode = {
				slug: parseYamlValue(slug),
				name: "",
				roleDefinition: "",
				whenToUse: "",
				description: "",
				customInstructions: "",
				groups: [],
				source: "project",
			}
			i++
			continue
		}

		// 处理 mode 属性
		if (currentMode && trimmed.includes(":")) {
			const colonIndex = trimmed.indexOf(":")
			const key = trimmed.substring(0, colonIndex).trim()
			const value = trimmed.substring(colonIndex + 1).trim()

			switch (key) {
				case "name":
					currentMode.name = parseYamlValue(value)
					i++
					break

				case "roleDefinition":
					if (value === "|-") {
						const multilineResult = parseMultilineString(lines, i, indent)
						currentMode.roleDefinition = multilineResult.content
						i = multilineResult.nextIndex
					} else {
						currentMode.roleDefinition = parseYamlValue(value)
						i++
					}
					break

				case "whenToUse":
					if (value === "|-") {
						const multilineResult = parseMultilineString(lines, i, indent)
						currentMode.whenToUse = multilineResult.content
						i = multilineResult.nextIndex
					} else {
						currentMode.whenToUse = parseYamlValue(value)
						i++
					}
					break

				case "description":
					if (value === "|-") {
						const multilineResult = parseMultilineString(lines, i, indent)
						currentMode.description = multilineResult.content
						i = multilineResult.nextIndex
					} else {
						currentMode.description = parseYamlValue(value)
						i++
					}
					break

				case "customInstructions":
					if (value === "|-") {
						const multilineResult = parseMultilineString(lines, i, indent)
						currentMode.customInstructions = multilineResult.content
						i = multilineResult.nextIndex
					} else {
						currentMode.customInstructions = parseYamlValue(value)
						i++
					}
					break

				case "groups":
					if (!value || value === "") {
						// groups 数组在下一行开始
						const groupsResult = parseGroupsArray(lines, i, indent)
						currentMode.groups = groupsResult.groups
						i = groupsResult.nextIndex
					} else {
						// 内联数组格式（不太可能，但保留支持）
						currentMode.groups = []
						i++
					}
					break

				case "source":
					currentMode.source = parseYamlValue(value)
					i++
					break

				default:
					i++
					break
			}
		} else {
			i++
		}
	}

	// 保存最后一个 mode
	if (currentMode) {
		result.customModes.push(currentMode)
	}

	return result
}

/**
 * 转义 TypeScript 字符串
 */
function escapeTypeScriptString(str) {
	return str
		.replace(/\\/g, "\\\\") // 转义反斜杠
		.replace(/"/g, '\\"') // 转义双引号
		.replace(/\n/g, "\\n") // 转义换行符
		.replace(/\r/g, "\\r") // 转义回车符
		.replace(/\t/g, "\\t") // 转义制表符
}

/**
 * 生成 groups 数组的 TypeScript 代码
 */
function generateGroupsCode(groups) {
	if (!Array.isArray(groups) || groups.length === 0) {
		return "[]"
	}

	const groupItems = groups.map((group) => {
		if (typeof group === "string") {
			return `"${group}"`
		} else if (Array.isArray(group) && group.length === 2) {
			const [groupName, options] = group
			const optionsEntries = Object.entries(options).map(([key, value]) => {
				if (typeof value === "string") {
					return `${key}: "${escapeTypeScriptString(value)}"`
				}
				return `${key}: ${JSON.stringify(value)}`
			})
			return `["${groupName}", { ${optionsEntries.join(", ")} }]`
		}
		return `"${String(group)}"`
	})

	return `[${groupItems.join(", ")}]`
}

/**
 * 生成 WORKFLOW_MODES 数组的 TypeScript 代码
 */
function generateWorkflowModesCode(modes) {
	const modeEntries = modes.map((mode) => {
		const entries = []

		entries.push(`\tslug: "${mode.slug}",`)
		entries.push(`\tname: "${mode.name}",`)

		if (mode.roleDefinition) {
			entries.push(`\troleDefinition:\n\t\t"${escapeTypeScriptString(mode.roleDefinition)}",`)
		}

		if (mode.whenToUse) {
			entries.push(`\twhenToUse:\n\t\t"${escapeTypeScriptString(mode.whenToUse)}",`)
		}

		if (mode.description) {
			entries.push(`\tdescription:\n\t\t"${escapeTypeScriptString(mode.description)}",`)
		}

		if (mode.customInstructions) {
			entries.push(`\tcustomInstructions:\n\t\t"${escapeTypeScriptString(mode.customInstructions)}",`)
		}

		// 处理 groups 数组
		const groupsCode = generateGroupsCode(mode.groups)
		entries.push(`\tgroups: ${groupsCode},`)

		if (mode.source) {
			entries.push(`\tsource: "${mode.source}",`)
		}

		// 为所有自定义模式添加 workflow: true
		entries.push(`\tworkflow: true,`)

		return `{\n${entries.join("\n")}\n}`
	})

	return `const WORKFLOW_MODES: readonly modelType[] = [\n${modeEntries.join(",\n")},\n]`
}

/**
 * 更新 mode.ts 文件中的 WORKFLOW_MODES 部分
 */
function updateWorkflowModes() {
	try {
		console.log("📖 读取 .roomodes 文件...")
		const roomodesContent = fs.readFileSync(roomodesPath, "utf8")

		console.log("🔍 解析 .roomodes 内容...")
		const roomodesData = parseRoomodes(roomodesContent)

		if (!roomodesData.customModes || roomodesData.customModes.length === 0) {
			console.log("⚠️  在 .roomodes 中未找到自定义模式")
			return
		}

		console.log(`📝 找到 ${roomodesData.customModes.length} 个自定义模式`)

		// 调试输出：显示解析结果
		console.log("🔍 解析结果预览:")
		roomodesData.customModes.forEach((mode, index) => {
			console.log(`  ${index + 1}. ${mode.slug}: ${mode.name}`)
			console.log(`     groups: ${JSON.stringify(mode.groups)}`)
		})

		console.log("🏗️  生成 TypeScript 代码...")
		const newWorkflowModesCode = generateWorkflowModesCode(roomodesData.customModes)

		console.log("📖 读取现有的 mode.ts 文件...")
		const existingContent = fs.readFileSync(modeTypesPath, "utf8")

		// 查找 WORKFLOW_MODES 部分
		const workflowModesStart = existingContent.indexOf("const WORKFLOW_MODES: readonly modelType[] = [")
		const workflowModesEnd = existingContent.indexOf("]", workflowModesStart) + 1

		if (workflowModesStart === -1 || workflowModesEnd === -1) {
			throw new Error("在 mode.ts 中找不到 WORKFLOW_MODES 部分")
		}

		console.log("🔄 更新 WORKFLOW_MODES 部分...")

		// 替换 WORKFLOW_MODES 部分
		const before = existingContent.substring(0, workflowModesStart)
		const after = existingContent.substring(workflowModesEnd)
		const updatedContent = before + newWorkflowModesCode + after

		console.log("💾 将更新的内容写入 mode.ts...")
		fs.writeFileSync(modeTypesPath, updatedContent, "utf8")

		console.log("✅ 成功更新 packages/types/src/mode.ts 中的 WORKFLOW_MODES")
		console.log(`📊 更新了 ${roomodesData.customModes.length} 个模式:`)
		roomodesData.customModes.forEach((mode) => {
			console.log(`   - ${mode.slug}: ${mode.name}`)
		})
	} catch (error) {
		console.error("❌ 更新工作流模式时出错:", error.message)
		process.exit(1)
	}
}

// 主执行函数
if (require.main === module) {
	console.log("🚀 开始更新工作流模式...")
	updateWorkflowModes()
	console.log("🎉 工作流模式更新完成!")
}

module.exports = { updateWorkflowModes, parseRoomodes, generateWorkflowModesCode }

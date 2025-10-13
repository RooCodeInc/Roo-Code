#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

/**
 * 读取指令模板文件并更新 built-in-commands.ts
 */
async function updateBuiltInCommands() {
	const templatesDir = path.join(__dirname, "../src/core/costrict/workflow/builtIn-commands")
	const targetFile = path.join(__dirname, "../src/services/command/built-in-commands.ts")

	try {
		// 读取目标文件
		let targetContent = fs.readFileSync(targetFile, "utf8")

		// 读取模板目录中的所有 .md 文件
		const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith(".md"))

		for (const templateFile of templateFiles) {
			const templatePath = path.join(templatesDir, templateFile)
			const templateContent = fs.readFileSync(templatePath, "utf8")

			// 从文件名获取命令名（去掉 .md 扩展名）
			const commandName = path.basename(templateFile, ".md")

			console.log(`正在更新命令: ${commandName}`)

			// 转义模板内容中的特殊字符
			const escapedContent = templateContent
				.replace(/\\/g, "\\\\") // 转义反斜杠
				.replace(/`/g, "\\`") // 转义反引号
				.replace(/\${/g, "\\${") // 转义模板字符串

			// 查找命令定义的开始和结束位置
			const commandStartPattern = `"${commandName}": {`
			const commandStartIndex = targetContent.indexOf(commandStartPattern)

			if (commandStartIndex === -1) {
				console.log(`⚠ 未找到命令 "${commandName}" 的定义`)
				continue
			}

			// 查找 content 字段的开始位置
			const contentPattern = "content: `"
			const contentStartIndex = targetContent.indexOf(contentPattern, commandStartIndex)

			if (contentStartIndex === -1) {
				console.log(`⚠ 未找到命令 "${commandName}" 的 content 字段`)
				continue
			}

			// 查找 content 内容的开始和结束位置
			const contentValueStart = contentStartIndex + contentPattern.length

			// 查找匹配的反引号结束位置（需要考虑嵌套的反引号）
			let contentValueEnd = -1
			let backtickCount = 0
			let inCodeBlock = false

			for (let i = contentValueStart; i < targetContent.length; i++) {
				const char = targetContent[i]
				const prevChar = i > 0 ? targetContent[i - 1] : ""
				const nextChar = i < targetContent.length - 1 ? targetContent[i + 1] : ""

				if (char === "`") {
					// 检查是否是代码块标记
					if (prevChar === "`" && nextChar === "`") {
						// 这是三个反引号的一部分，跳过
						continue
					} else if (targetContent.substring(i, i + 3) === "```") {
						// 遇到代码块开始或结束
						inCodeBlock = !inCodeBlock
						i += 2 // 跳过另外两个反引号
						continue
					} else if (!inCodeBlock && prevChar !== "\\") {
						// 这是内容结束的反引号
						contentValueEnd = i
						break
					}
				}
			}

			if (contentValueEnd === -1) {
				console.log(`⚠ 未找到命令 "${commandName}" 的内容结束标记`)
				continue
			}

			// 替换内容
			const before = targetContent.substring(0, contentValueStart)
			const after = targetContent.substring(contentValueEnd)
			targetContent = before + escapedContent + after

			console.log(`✓ 成功更新命令 "${commandName}" 的内容`)
		}

		// 写回文件
		fs.writeFileSync(targetFile, targetContent, "utf8")
		console.log(`\n✓ 成功更新文件: ${targetFile}`)
	} catch (error) {
		console.error("更新失败:", error.message)
		process.exit(1)
	}
}

// 运行更新
updateBuiltInCommands()

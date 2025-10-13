#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

// Define the mapping between workflow types and markdown files
const workflowMapping = {
	WORKFLOW_TASK_RUN: "run-tasks.md",
	WORKFLOW_TASK_RUN_TESTS: "run-tests.md",
	WORKFLOW_TASK_RETRY: "retry-tasks.md",
	WORKFLOW_RQS_UPDATE: "requirements.md",
	WORKFLOW_DESIGN_UPDATE: "design.md",
}

// Paths
const supportPromptPath = path.join("src", "shared", "support-prompt.ts")
const promptsDir = path.join("src", "core", "costrict", "workflow", "prompts")

function escapeTemplateLiterals(content) {
	// First escape backticks within the content
	let escaped = content.replace(/`/g, "\\`")
	// Then escape ${ placeholders
	escaped = escaped.replace(/\$\{/g, "\\${")
	return escaped
}

function readMarkdownFile(filePath) {
	try {
		const content = fs.readFileSync(filePath, "utf8")
		return content // Return raw content without escaping
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error.message)
		return null
	}
}

function replaceTemplateInSupportPrompt() {
	// Read the support-prompt.ts file
	let supportPromptContent
	try {
		supportPromptContent = fs.readFileSync(supportPromptPath, "utf8")
	} catch (error) {
		console.error(`Error reading support-prompt.ts:`, error.message)
		return
	}

	// Process each workflow type
	for (const [workflowType, markdownFile] of Object.entries(workflowMapping)) {
		const markdownPath = path.join(promptsDir, markdownFile)
		console.log(`Processing ${workflowType} from ${markdownPath}`)
		const markdownContent = readMarkdownFile(markdownPath)

		if (!markdownContent) {
			console.error(`Skipping ${workflowType} due to error reading ${markdownFile}`)
			continue
		}

		// Find the start and end of the template for this workflow type
		const workflowPattern = workflowType + ":\\s*\\{\\s*template:\\s*`"
		const startIndex = supportPromptContent.search(new RegExp(workflowPattern))

		if (startIndex === -1) {
			console.error(`Could not find template start for ${workflowType}`)
			continue
		}

		// Find the opening backtick position
		const openingBacktickPos = supportPromptContent.indexOf("`", startIndex)
		if (openingBacktickPos === -1) {
			console.error(`Could not find opening backtick for ${workflowType}`)
			continue
		}

		// Find the closing backtick position
		let closingBacktickPos = openingBacktickPos + 1
		let inEscape = false

		while (closingBacktickPos < supportPromptContent.length) {
			const char = supportPromptContent[closingBacktickPos]

			if (inEscape) {
				inEscape = false
				closingBacktickPos++
				continue
			}

			if (char === "\\") {
				inEscape = true
				closingBacktickPos++
				continue
			}

			if (char === "`") {
				break
			}

			closingBacktickPos++
		}

		if (closingBacktickPos >= supportPromptContent.length) {
			console.error(`Could not find closing backtick for ${workflowType}`)
			continue
		}

		// Replace the template content
		const beforeTemplate = supportPromptContent.substring(0, openingBacktickPos + 1)
		const afterTemplate = supportPromptContent.substring(closingBacktickPos)
		const escapedContent = escapeTemplateLiterals(markdownContent)
		supportPromptContent = beforeTemplate + escapedContent + afterTemplate

		console.log(`Successfully replaced template for ${workflowType}`)
	}

	// Write the updated content back to the file
	try {
		fs.writeFileSync(supportPromptPath, supportPromptContent, "utf8")
		console.log("Successfully updated support-prompt.ts")
	} catch (error) {
		console.error("Error writing updated support-prompt.ts:", error.message)
	}
}

// Main execution
if (require.main === module) {
	console.log("Starting workflow template replacement...")
	replaceTemplateInSupportPrompt()
	console.log("Template replacement completed.")
}

module.exports = { replaceTemplateInSupportPrompt }

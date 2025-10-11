#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

/**
 * Generate a truncated CHANGELOG for VS Code extension
 * This reduces the file size to improve performance when viewing the extension details
 */
function generateVSCodeChangelog() {
	const changelogPath = path.join(__dirname, "..", "CHANGELOG.md")
	const outputPath = path.join(__dirname, "..", "CHANGELOG.vscode.md")

	if (!fs.existsSync(changelogPath)) {
		console.error("CHANGELOG.md not found")
		process.exit(1)
	}

	const content = fs.readFileSync(changelogPath, "utf8")
	const lines = content.split("\n")

	const truncatedLines = []
	let versionCount = 0
	const maxVersions = 10 // Keep only the 10 most recent versions
	let inVersion = false

	for (const line of lines) {
		// Check if this is a version header
		if (line.startsWith("## [")) {
			versionCount++
			if (versionCount > maxVersions) {
				break
			}
			inVersion = true
		}

		// Skip image lines (they reference release images)
		if (line.includes("![") && line.includes("/releases/")) {
			continue
		}

		// Add the line if we're within the version limit
		if (versionCount === 0 || (inVersion && versionCount <= maxVersions)) {
			truncatedLines.push(line)
		}
	}

	// Add a note at the end
	truncatedLines.push("")
	truncatedLines.push("---")
	truncatedLines.push("")
	truncatedLines.push(
		`*For the complete changelog with all ${versionCount} releases, please visit the [GitHub repository](https://github.com/RooCodeInc/Roo-Code/blob/main/CHANGELOG.md).*`,
	)

	const truncatedContent = truncatedLines.join("\n")
	fs.writeFileSync(outputPath, truncatedContent, "utf8")

	const originalSize = Buffer.byteLength(content, "utf8")
	const truncatedSize = Buffer.byteLength(truncatedContent, "utf8")
	const reduction = (((originalSize - truncatedSize) / originalSize) * 100).toFixed(1)

	console.log(`✅ Generated CHANGELOG.vscode.md`)
	console.log(`   Original size: ${(originalSize / 1024).toFixed(1)} KB`)
	console.log(`   Truncated size: ${(truncatedSize / 1024).toFixed(1)} KB`)
	console.log(`   Size reduction: ${reduction}%`)

	return outputPath
}

// Run if called directly
if (require.main === module) {
	generateVSCodeChangelog()
}

module.exports = { generateVSCodeChangelog }

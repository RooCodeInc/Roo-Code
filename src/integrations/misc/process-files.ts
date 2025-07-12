import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

export interface FileAttachment {
	type: 'image' | 'file'
	data: string
	name: string
	mimeType: string
	size: number
}

export async function selectFiles(): Promise<FileAttachment[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			"All Files": ["*"],
			"Images": ["png", "jpg", "jpeg", "webp"],
			"Documents": ["pdf", "doc", "docx", "txt", "md"],
			"Code": ["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "cs", "php", "rb", "go", "rs"],
			"Data": ["json", "xml", "csv", "yaml", "yml"],
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri) => {
			const filePath = uri.fsPath
			const fileName = path.basename(filePath)
			const stats = await fs.stat(filePath)
			const mimeType = getMimeType(filePath)
			const isImage = isImageFile(filePath)
			
			// Set reasonable file size limit (10MB)
			const maxFileSize = 10 * 1024 * 1024
			if (stats.size > maxFileSize) {
				throw new Error(`File "${fileName}" is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is 10MB.`)
			}

			const buffer = await fs.readFile(filePath)
			
			if (isImage) {
				// For images, return as data URL (base64) for backward compatibility
				const base64 = buffer.toString("base64")
				const dataUrl = `data:${mimeType};base64,${base64}`
				return {
					type: 'image' as const,
					data: dataUrl,
					name: fileName,
					mimeType,
					size: stats.size,
				}
			} else {
				// For non-image files, check if it's text-based
				if (isTextFile(filePath) || mimeType.startsWith('text/')) {
					// For text files, return the content as text
					const textContent = buffer.toString('utf-8')
					return {
						type: 'file' as const,
						data: textContent,
						name: fileName,
						mimeType,
						size: stats.size,
					}
				} else {
					// For binary files, return as base64
					const base64 = buffer.toString("base64")
					return {
						type: 'file' as const,
						data: base64,
						name: fileName,
						mimeType,
						size: stats.size,
					}
				}
			}
		}),
	)
}

// Backward compatibility function for existing image-only functionality
export async function selectImages(): Promise<string[]> {
	const files = await selectFiles()
	return files
		.filter(file => file.type === 'image')
		.map(file => file.data)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	
	// Image types
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		case ".gif":
			return "image/gif"
		case ".svg":
			return "image/svg+xml"
		
		// Document types
		case ".pdf":
			return "application/pdf"
		case ".doc":
			return "application/msword"
		case ".docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case ".txt":
			return "text/plain"
		case ".md":
			return "text/markdown"
		case ".rtf":
			return "application/rtf"
		
		// Code files
		case ".js":
			return "text/javascript"
		case ".ts":
			return "text/typescript"
		case ".jsx":
			return "text/jsx"
		case ".tsx":
			return "text/tsx"
		case ".py":
			return "text/x-python"
		case ".java":
			return "text/x-java-source"
		case ".cpp":
		case ".cc":
		case ".cxx":
			return "text/x-c++src"
		case ".c":
			return "text/x-csrc"
		case ".cs":
			return "text/x-csharp"
		case ".php":
			return "text/x-php"
		case ".rb":
			return "text/x-ruby"
		case ".go":
			return "text/x-go"
		case ".rs":
			return "text/x-rust"
		case ".html":
			return "text/html"
		case ".css":
			return "text/css"
		case ".scss":
		case ".sass":
			return "text/x-scss"
		
		// Data files
		case ".json":
			return "application/json"
		case ".xml":
			return "application/xml"
		case ".csv":
			return "text/csv"
		case ".yaml":
		case ".yml":
			return "application/x-yaml"
		
		// Archive files
		case ".zip":
			return "application/zip"
		case ".tar":
			return "application/x-tar"
		case ".gz":
			return "application/gzip"
		
		// Default
		default:
			return "application/octet-stream"
	}
}

function isImageFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase()
	return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)
}

function isTextFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase()
	const textExtensions = [
		".txt", ".md", ".json", ".xml", ".csv", ".yaml", ".yml",
		".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".c", ".cs",
		".php", ".rb", ".go", ".rs", ".html", ".css", ".scss", ".sass",
		".sh", ".bat", ".ps1", ".sql", ".log", ".ini", ".conf", ".config"
	]
	return textExtensions.includes(ext)
}
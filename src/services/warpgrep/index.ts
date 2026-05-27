import * as childProcess from "child_process"
import * as path from "path"
import fs from "fs/promises"

import * as vscode from "vscode"

import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getBinPath } from "../ripgrep"

const MAX_REPO_ENTRIES = 500
const MAX_REPO_DEPTH = 4
const MAX_READ_CHARS = 20_000
const MAX_RG_OUTPUT_CHARS = 20_000
const MAX_TOOL_CALLS_PER_TURN = 8
const MAX_TURNS = 4
const WARP_GREP_MODEL = "morph-warp-grep-v2"
const IGNORED_DIRECTORIES = new Set([".git", ".next", ".turbo", "build", "coverage", "dist", "node_modules", "out"])

export interface WarpGrepToolCall {
	function: string
	parameters: Record<string, string>
}

export interface WarpGrepSearchResult {
	success: boolean
	content: string
	error?: string
}

function ensureWorkspacePath(cwd: string, targetPath: string): { absolutePath: string; relativePath: string } {
	const absolutePath = path.resolve(cwd, targetPath)
	const relativePath = path.relative(cwd, absolutePath)

	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error(`Path is outside the workspace: ${targetPath}`)
	}

	return { absolutePath, relativePath: relativePath || "." }
}

function truncateOutput(content: string, maxChars: number): string {
	if (content.length <= maxChars) {
		return content
	}

	return `${content.slice(0, maxChars)}\n... [truncated]`
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
}

function extractMessageContent(content: unknown): string {
	if (typeof content === "string") {
		return content
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") {
					return part
				}
				if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
					return part.text
				}
				return ""
			})
			.join("")
	}

	return ""
}

function parseLineRanges(lineRange?: string): Array<{ start: number; end: number }> {
	if (!lineRange?.trim()) {
		return []
	}

	return lineRange
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean)
		.map((segment) => {
			const [rawStart, rawEnd] = segment.split("-").map((part) => part.trim())
			const start = Number.parseInt(rawStart, 10)
			const end = Number.parseInt(rawEnd || rawStart, 10)

			if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || end < start) {
				throw new Error(`Invalid line range: ${segment}`)
			}

			return { start, end }
		})
}

export async function buildRepoStructure(
	cwd: string,
	rooIgnoreController?: RooIgnoreController,
	maxDepth: number = MAX_REPO_DEPTH,
	maxEntries: number = MAX_REPO_ENTRIES,
): Promise<string> {
	const lines = [path.basename(cwd) || "."]
	let entryCount = 0
	let wasTruncated = false

	const walk = async (directoryPath: string, depth: number) => {
		if (depth >= maxDepth || wasTruncated) {
			return
		}

		const entries = await fs.readdir(directoryPath, { withFileTypes: true })
		entries.sort((a, b) => a.name.localeCompare(b.name))

		for (const entry of entries) {
			if (entryCount >= maxEntries) {
				wasTruncated = true
				return
			}

			if (IGNORED_DIRECTORIES.has(entry.name)) {
				continue
			}

			const absoluteEntryPath = path.join(directoryPath, entry.name)
			const relativePath = path.relative(cwd, absoluteEntryPath) || entry.name
			if (rooIgnoreController && !rooIgnoreController.validateAccess(relativePath)) {
				continue
			}

			lines.push(`${"  ".repeat(depth + 1)}- ${relativePath}${entry.isDirectory() ? "/" : ""}`)
			entryCount += 1

			if (entry.isDirectory()) {
				await walk(absoluteEntryPath, depth + 1)
			}
		}
	}

	await walk(cwd, 0)

	if (wasTruncated) {
		lines.push("  ... [repo structure truncated]")
	}

	return lines.join("\n")
}

export function parseToolCalls(content: string): WarpGrepToolCall[] {
	const toolCalls: WarpGrepToolCall[] = []
	const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g

	for (const match of content.matchAll(toolCallRegex)) {
		const rawBody = match[1]
		const directFunctionMatch = rawBody.match(/<function(?:=| name=)(["']?)([\w-]+)\1>/)
		const blockFunctionMatch = rawBody.match(/<function>([\w-]+)<\/function>/)
		const functionName = directFunctionMatch?.[2] || blockFunctionMatch?.[1]

		if (!functionName) {
			continue
		}

		const parameters: Record<string, string> = {}
		const tagRegex = /<([a-zA-Z_][\w-]*)>([\s\S]*?)<\/\1>/g
		for (const tagMatch of rawBody.matchAll(tagRegex)) {
			const [, key, value] = tagMatch
			if (key !== "function") {
				parameters[key] = value.trim()
			}
		}

		toolCalls.push({
			function: functionName,
			parameters,
		})
	}

	return toolCalls
}

export async function executeRipgrep(
	cwd: string,
	pattern: string,
	searchPath: string = ".",
	glob?: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	const { absolutePath, relativePath } = ensureWorkspacePath(cwd, searchPath)

	if (rooIgnoreController && relativePath !== "." && !rooIgnoreController.validateAccess(relativePath)) {
		throw new Error(`Path is blocked by .rooignore: ${searchPath}`)
	}

	const rgPath = await getBinPath(vscode.env.appRoot)
	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	const args = ["--line-number", "--with-filename", "--color", "never", "--no-heading"]
	if (glob) {
		args.push("--glob", glob)
	}
	args.push(pattern, absolutePath)

	const result = await new Promise<string>((resolve, reject) => {
		const rg = childProcess.spawn(rgPath, args, { cwd })
		let stdout = ""
		let stderr = ""

		rg.stdout.on("data", (chunk) => {
			if (stdout.length < MAX_RG_OUTPUT_CHARS) {
				stdout += chunk.toString()
			}
		})

		rg.stderr.on("data", (chunk) => {
			stderr += chunk.toString()
		})

		rg.on("error", reject)
		rg.on("close", (code) => {
			if (code === 0) {
				resolve(stdout)
				return
			}
			if (code === 1) {
				resolve("")
				return
			}
			reject(new Error(stderr || `ripgrep exited with code ${code}`))
		})
	})

	return result.trim() ? truncateOutput(result.trim(), MAX_RG_OUTPUT_CHARS) : "No matches found."
}

export async function readFile(
	cwd: string,
	filePath: string,
	lineRange?: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	const { absolutePath, relativePath } = ensureWorkspacePath(cwd, filePath)

	if (rooIgnoreController && !rooIgnoreController.validateAccess(relativePath)) {
		throw new Error(`Path is blocked by .rooignore: ${filePath}`)
	}

	const fileContents = await fs.readFile(absolutePath, "utf8")
	if (!lineRange?.trim()) {
		return truncateOutput(fileContents, MAX_READ_CHARS)
	}

	const lines = fileContents.split("\n")
	const segments = parseLineRanges(lineRange).map(({ start, end }) => {
		const selected = lines.slice(start - 1, end).join("\n")
		return `Lines ${start}-${end}:\n${selected}`
	})

	return truncateOutput(segments.join("\n\n"), MAX_READ_CHARS)
}

export async function listDirectory(
	cwd: string,
	dirPath: string = ".",
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	const { absolutePath, relativePath } = ensureWorkspacePath(cwd, dirPath)

	if (rooIgnoreController && relativePath !== "." && !rooIgnoreController.validateAccess(relativePath)) {
		throw new Error(`Path is blocked by .rooignore: ${dirPath}`)
	}

	const entries = await fs.readdir(absolutePath, { withFileTypes: true })
	const visibleEntries = entries
		.filter((entry) => {
			if (IGNORED_DIRECTORIES.has(entry.name)) {
				return false
			}
			if (!rooIgnoreController) {
				return true
			}
			const entryRelativePath = path.relative(cwd, path.join(absolutePath, entry.name))
			return rooIgnoreController.validateAccess(entryRelativePath)
		})
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((entry) => `${entry.isDirectory() ? "dir" : "file"} ${entry.name}`)

	return visibleEntries.length > 0 ? visibleEntries.join("\n") : "(empty directory)"
}

async function executeToolCall(
	cwd: string,
	toolCall: WarpGrepToolCall,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	switch (toolCall.function) {
		case "ripgrep":
			return executeRipgrep(
				cwd,
				toolCall.parameters.pattern ?? "",
				toolCall.parameters.path ?? ".",
				toolCall.parameters.glob,
				rooIgnoreController,
			)
		case "read":
			return readFile(cwd, toolCall.parameters.path ?? "", toolCall.parameters.lines, rooIgnoreController)
		case "list_directory":
			return listDirectory(cwd, toolCall.parameters.path ?? ".", rooIgnoreController)
		default:
			throw new Error(`Unsupported WarpGrep tool: ${toolCall.function}`)
	}
}

export async function handleFinish(
	cwd: string,
	filesParam: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	const fileSpecs = filesParam
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)

	if (fileSpecs.length === 0) {
		return "WarpGrep finished without returning any file ranges."
	}

	const sections = await Promise.all(
		fileSpecs.map(async (fileSpec) => {
			const separatorIndex = fileSpec.indexOf(":")
			const filePath = separatorIndex === -1 ? fileSpec : fileSpec.slice(0, separatorIndex)
			const lineRange = separatorIndex === -1 ? undefined : fileSpec.slice(separatorIndex + 1)
			const content = await readFile(cwd, filePath, lineRange, rooIgnoreController)
			return `File: ${filePath}\n${content}`
		}),
	)

	return sections.join("\n\n")
}

function buildInitialPrompt(repoStructure: string, query: string): string {
	return [
		"You are WarpGrep, a codebase search subagent.",
		"Use the available XML tools to locate the most relevant files and return finish with precise file:line-range specs.",
		"<repo_structure>",
		repoStructure,
		"</repo_structure>",
		"<search_string>",
		query,
		"</search_string>",
	].join("\n")
}

function buildToolResponseMessage(
	toolResponses: Array<{ toolCall: WarpGrepToolCall; result: string }>,
	turn: number,
): string {
	return [
		...toolResponses.map(
			({ toolCall, result }) =>
				`<tool_response><function>${toolCall.function}</function><result>${escapeXml(result)}</result></tool_response>`,
		),
		`<turn_context>Turn ${turn + 1} of ${MAX_TURNS}</turn_context>`,
	].join("\n")
}

export async function executeWarpGrepSearch(
	cwd: string,
	query: string,
	apiKey: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<WarpGrepSearchResult> {
	try {
		const repoStructure = await buildRepoStructure(cwd, rooIgnoreController)
		const messages: Array<{ role: "user" | "assistant"; content: string }> = [
			{ role: "user", content: buildInitialPrompt(repoStructure, query) },
		]

		for (let turn = 0; turn < MAX_TURNS; turn += 1) {
			const response = await fetch("https://api.morphllm.com/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: WARP_GREP_MODEL,
					temperature: 0,
					max_tokens: 2048,
					messages,
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`WarpGrep request failed (${response.status}): ${errorText}`)
			}

			const payload = await response.json()
			const content = extractMessageContent(payload?.choices?.[0]?.message?.content).trim()
			if (!content) {
				throw new Error("WarpGrep returned an empty response")
			}

			const toolCalls = parseToolCalls(content).slice(0, MAX_TOOL_CALLS_PER_TURN)
			if (toolCalls.length === 0) {
				return { success: true, content }
			}

			const toolResponses: Array<{ toolCall: WarpGrepToolCall; result: string }> = []
			for (const toolCall of toolCalls) {
				if (toolCall.function === "finish") {
					const filesParam = toolCall.parameters.files ?? ""
					return {
						success: true,
						content: await handleFinish(cwd, filesParam, rooIgnoreController),
					}
				}

				const result = await executeToolCall(cwd, toolCall, rooIgnoreController)
				toolResponses.push({ toolCall, result })
			}

			messages.push({ role: "assistant", content })
			messages.push({ role: "user", content: buildToolResponseMessage(toolResponses, turn) })
		}

		return {
			success: false,
			content: "",
			error: `WarpGrep did not finish within ${MAX_TURNS} turns.`,
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return {
			success: false,
			content: "",
			error: message,
		}
	}
}

import * as path from "path"
import * as fs from "fs/promises"

import { mentionRegexGlobal, unescapeSpaces } from "../../shared/context-mentions"

const MAX_IMAGES_PER_MESSAGE = 20

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])

function getMimeTypeFromExtension(extLower: string): string | undefined {
	if (extLower === ".png") return "image/png"
	if (extLower === ".jpg" || extLower === ".jpeg") return "image/jpeg"
	if (extLower === ".webp") return "image/webp"
	return undefined
}

export interface ResolveImageMentionsOptions {
	text: string
	images?: string[]
	cwd: string
	rooIgnoreController?: { validateAccess: (filePath: string) => boolean }
}

export interface ResolveImageMentionsResult {
	text: string
	images: string[]
}

function isPathWithinCwd(absPath: string, cwd: string): boolean {
	const rel = path.relative(cwd, absPath)
	return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
}

function dedupePreserveOrder(values: string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const v of values) {
		if (seen.has(v)) continue
		seen.add(v)
		result.push(v)
	}
	return result
}

/**
 * Resolves local image file mentions like `@/path/to/image.png` found in `text` into `data:image/...;base64,...`
 * and appends them to the outgoing `images` array.
 *
 * - Only supports local workspace-relative mentions (must start with `/`).
 * - Only supports: png, jpg, jpeg, webp.
 * - Leaves `text` unchanged.
 * - Respects `.rooignore` via `rooIgnoreController.validateAccess` when provided.
 */
export async function resolveImageMentions({
	text,
	images,
	cwd,
	rooIgnoreController,
}: ResolveImageMentionsOptions): Promise<ResolveImageMentionsResult> {
	const existingImages = Array.isArray(images) ? images : []
	if (existingImages.length >= MAX_IMAGES_PER_MESSAGE) {
		return { text, images: existingImages.slice(0, MAX_IMAGES_PER_MESSAGE) }
	}

	const mentions = Array.from(text.matchAll(mentionRegexGlobal))
		.map((m) => m[1])
		.filter(Boolean)
	if (mentions.length === 0) {
		return { text, images: existingImages }
	}

	const imageMentions = mentions.filter((mention) => {
		if (!mention.startsWith("/")) return false
		const relPath = unescapeSpaces(mention.slice(1))
		const ext = path.extname(relPath).toLowerCase()
		return SUPPORTED_IMAGE_EXTENSIONS.has(ext)
	})

	if (imageMentions.length === 0) {
		return { text, images: existingImages }
	}

	const newImages: string[] = []
	for (const mention of imageMentions) {
		if (existingImages.length + newImages.length >= MAX_IMAGES_PER_MESSAGE) {
			break
		}

		const relPath = unescapeSpaces(mention.slice(1))
		const absPath = path.resolve(cwd, relPath)
		if (!isPathWithinCwd(absPath, cwd)) {
			continue
		}

		if (rooIgnoreController && !rooIgnoreController.validateAccess(relPath)) {
			continue
		}

		const ext = path.extname(relPath).toLowerCase()
		const mimeType = getMimeTypeFromExtension(ext)
		if (!mimeType) {
			continue
		}

		try {
			const buffer = await fs.readFile(absPath)
			const base64 = buffer.toString("base64")
			newImages.push(`data:${mimeType};base64,${base64}`)
		} catch {
			// Fail-soft: skip unreadable/missing files.
			continue
		}
	}

	const merged = dedupePreserveOrder([...existingImages, ...newImages]).slice(0, MAX_IMAGES_PER_MESSAGE)
	return { text, images: merged }
}

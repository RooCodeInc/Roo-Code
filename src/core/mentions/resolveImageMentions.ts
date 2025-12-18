import * as path from "path"
import * as fs from "fs/promises"

import { mentionRegexGlobal, unescapeSpaces } from "../../shared/context-mentions"
import {
	SUPPORTED_IMAGE_FORMATS,
	IMAGE_MIME_TYPES,
	validateImageForProcessing,
	ImageMemoryTracker,
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
} from "../tools/helpers/imageHelpers"

const MAX_IMAGES_PER_MESSAGE = 20

export interface ResolveImageMentionsOptions {
	text: string
	images?: string[]
	cwd: string
	rooIgnoreController?: { validateAccess: (filePath: string) => boolean }
	/** Whether the current model supports images. Defaults to true. */
	supportsImages?: boolean
	/** Maximum size per image file in MB. Defaults to 5MB. */
	maxImageFileSize?: number
	/** Maximum total size of all images in MB. Defaults to 20MB. */
	maxTotalImageSize?: number
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
 * Checks if a file extension is a supported image format.
 * Uses the same format list as read_file tool.
 */
function isSupportedImageExtension(extension: string): boolean {
	return SUPPORTED_IMAGE_FORMATS.includes(extension.toLowerCase() as (typeof SUPPORTED_IMAGE_FORMATS)[number])
}

/**
 * Gets the MIME type for an image extension.
 * Uses the same mapping as read_file tool.
 */
function getMimeType(extension: string): string | undefined {
	return IMAGE_MIME_TYPES[extension.toLowerCase()]
}

/**
 * Resolves local image file mentions like `@/path/to/image.png` found in `text` into `data:image/...;base64,...`
 * and appends them to the outgoing `images` array.
 *
 * Behavior matches the read_file tool:
 * - Supports the same image formats: png, jpg, jpeg, gif, webp, svg, bmp, ico, tiff, avif
 * - Respects per-file size limits (default 5MB)
 * - Respects total memory limits (default 20MB)
 * - Skips images if model doesn't support them
 * - Respects `.rooignore` via `rooIgnoreController.validateAccess` when provided
 */
export async function resolveImageMentions({
	text,
	images,
	cwd,
	rooIgnoreController,
	supportsImages = true,
	maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
}: ResolveImageMentionsOptions): Promise<ResolveImageMentionsResult> {
	const existingImages = Array.isArray(images) ? images : []
	if (existingImages.length >= MAX_IMAGES_PER_MESSAGE) {
		return { text, images: existingImages.slice(0, MAX_IMAGES_PER_MESSAGE) }
	}

	// If model doesn't support images, skip image processing entirely
	if (!supportsImages) {
		return { text, images: existingImages }
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
		return isSupportedImageExtension(ext)
	})

	if (imageMentions.length === 0) {
		return { text, images: existingImages }
	}

	const imageMemoryTracker = new ImageMemoryTracker()
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
		const mimeType = getMimeType(ext)
		if (!mimeType) {
			continue
		}

		// Validate image size limits (matches read_file behavior)
		try {
			const validationResult = await validateImageForProcessing(
				absPath,
				supportsImages,
				maxImageFileSize,
				maxTotalImageSize,
				imageMemoryTracker.getTotalMemoryUsed(),
			)

			if (!validationResult.isValid) {
				// Skip this image due to size/memory limits, but continue processing others
				continue
			}

			const buffer = await fs.readFile(absPath)
			const base64 = buffer.toString("base64")
			newImages.push(`data:${mimeType};base64,${base64}`)

			// Track memory usage
			if (validationResult.sizeInMB) {
				imageMemoryTracker.addMemoryUsage(validationResult.sizeInMB)
			}
		} catch {
			// Fail-soft: skip unreadable/missing files.
			continue
		}
	}

	const merged = dedupePreserveOrder([...existingImages, ...newImages]).slice(0, MAX_IMAGES_PER_MESSAGE)
	return { text, images: merged }
}

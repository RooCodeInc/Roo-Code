import sharp from "sharp"

/**
 * Default image downscale quality (JPEG/WebP) when re-encoding resized images.
 */
export const DEFAULT_IMAGE_DOWNSCALE_QUALITY = 85

/**
 * Mime type to sharp output format mapping.
 */
const MIME_TO_FORMAT: Record<string, keyof sharp.FormatEnum> = {
	"image/png": "png",
	"image/jpeg": "jpeg",
	"image/webp": "webp",
}

export interface ResizeImageOptions {
	/** The image buffer to potentially resize. */
	buffer: Buffer
	/** The MIME type of the image (e.g. "image/png"). */
	mimeType: string
	/** Maximum dimension (width or height) in pixels. 0 or undefined means no resizing. */
	maxDimension?: number
	/** JPEG/WebP quality (1-100) for re-encoding. Defaults to 85. */
	quality?: number
}

export interface ResizeImageResult {
	/** The (possibly resized) image buffer. */
	buffer: Buffer
	/** Whether the image was actually resized. */
	wasResized: boolean
}

/**
 * Conditionally downscales an image buffer if either dimension exceeds `maxDimension`.
 * Preserves aspect ratio. Returns the original buffer unchanged if no resizing is needed
 * or if the format is unsupported for resizing.
 */
export async function maybeResizeImage({
	buffer,
	mimeType,
	maxDimension,
	quality = DEFAULT_IMAGE_DOWNSCALE_QUALITY,
}: ResizeImageOptions): Promise<ResizeImageResult> {
	// If downscaling is disabled or dimension is 0/undefined, return as-is
	if (!maxDimension || maxDimension <= 0) {
		return { buffer, wasResized: false }
	}

	// Only resize formats we can handle
	const format = MIME_TO_FORMAT[mimeType]
	if (!format) {
		return { buffer, wasResized: false }
	}

	const image = sharp(buffer)
	const metadata = await image.metadata()

	if (!metadata.width || !metadata.height) {
		return { buffer, wasResized: false }
	}

	// Only downscale -- never upscale
	if (metadata.width <= maxDimension && metadata.height <= maxDimension) {
		return { buffer, wasResized: false }
	}

	// Calculate new dimensions preserving aspect ratio
	const aspectRatio = metadata.width / metadata.height
	let newWidth: number
	let newHeight: number

	if (metadata.width >= metadata.height) {
		newWidth = maxDimension
		newHeight = Math.round(maxDimension / aspectRatio)
	} else {
		newHeight = maxDimension
		newWidth = Math.round(maxDimension * aspectRatio)
	}

	// Perform the resize
	let pipeline = image.resize(newWidth, newHeight, {
		fit: "inside",
		withoutEnlargement: true,
	})

	// Re-encode in the original format with quality setting where applicable
	if (format === "jpeg") {
		pipeline = pipeline.jpeg({ quality })
	} else if (format === "webp") {
		pipeline = pipeline.webp({ quality })
	} else if (format === "png") {
		pipeline = pipeline.png()
	}

	const resizedBuffer = await pipeline.toBuffer()
	return { buffer: resizedBuffer, wasResized: true }
}

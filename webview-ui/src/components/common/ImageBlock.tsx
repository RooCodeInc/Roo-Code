import React from "react"
import { ImageViewer } from "./ImageViewer"

interface ImageBlockProps {
	// For new image generation tool format (preferred)
	imageUri?: string // The webview-accessible URI for rendering
	imagePath?: string // The actual file path for display and opening

	// For backward compatibility with Mermaid diagrams and old format
	imageData?: string // Base64 data or regular URL (legacy)
	path?: string // Optional path for Mermaid diagrams (legacy)
}

export default function ImageBlock({ imageUri, imagePath, imageData, path }: ImageBlockProps) {
	// Determine which props to use based on what's provided
	let finalImageUri: string
	let finalImagePath: string | undefined

	if (imageUri) {
		// New format: explicit imageUri and imagePath
		finalImageUri = imageUri
		finalImagePath = imagePath
	} else if (imageData) {
		// Legacy format: use imageData as direct URI (for Mermaid diagrams)
		finalImageUri = imageData
		finalImagePath = path
	} else {
		// No valid image data provided
		console.error("ImageBlock: No valid image data provided")
		return null
	}

	return (
		<div className="my-2">
			<ImageViewer
				imageUri={finalImageUri}
				imagePath={finalImagePath}
				alt="AI Generated Image"
				showControls={true}
			/>
		</div>
	)
}

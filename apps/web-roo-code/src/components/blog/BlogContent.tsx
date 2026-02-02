"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Play } from "lucide-react"
import { YouTubeModal, isYouTubeUrl, extractYouTubeVideoId, extractYouTubeTimestamp } from "./YouTubeModal"

function nodeHasYouTubeLink(node: unknown): boolean {
	if (!node || typeof node !== "object") return false

	const anyNode = node as { type?: unknown; url?: unknown; children?: unknown }
	if (anyNode.type === "link" && typeof anyNode.url === "string" && isYouTubeUrl(anyNode.url)) {
		return true
	}

	if (Array.isArray(anyNode.children)) {
		return anyNode.children.some(nodeHasYouTubeLink)
	}

	return false
}

interface BlogContentProps {
	/** The markdown content to render */
	content: string
}

/**
 * State for the currently active YouTube video modal
 */
interface YouTubeModalState {
	isOpen: boolean
	videoId: string
	startTime: number
	title: string
}

/**
 * BlogContent component
 *
 * Renders markdown content with special handling for YouTube links.
 * YouTube links open in a modal with embedded video player instead of
 * navigating away from the page.
 *
 * @example
 * ```tsx
 * <BlogContent content={markdownString} />
 * ```
 */
export function BlogContent({ content }: BlogContentProps) {
	const [youtubeModal, setYoutubeModal] = React.useState<YouTubeModalState>({
		isOpen: false,
		videoId: "",
		startTime: 0,
		title: "",
	})

	/**
	 * Opens the YouTube modal with the specified video
	 */
	const openYouTubeModal = React.useCallback((url: string, linkText: string) => {
		const videoId = extractYouTubeVideoId(url)
		if (!videoId) return

		const startTime = extractYouTubeTimestamp(url)

		setYoutubeModal({
			isOpen: true,
			videoId,
			startTime,
			title: linkText,
		})
	}, [])

	/**
	 * Closes the YouTube modal
	 */
	const closeYouTubeModal = React.useCallback(() => {
		setYoutubeModal((prev) => ({ ...prev, isOpen: false }))
	}, [])

	return (
		<>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// Custom heading styles - note: h1 in content becomes h2 to preserve single H1
					h1: ({ node: _node, ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
					h2: ({ node: _node, ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
					h3: ({ node: _node, ...props }) => <h3 className="mt-8 text-xl font-semibold" {...props} />,
					// Custom link component with YouTube modal support
					a: ({ href, children, node: _node }) => {
						const url = href ?? ""
						const linkText =
							typeof children === "string"
								? children
								: Array.isArray(children)
									? children.join("")
									: "YouTube Video"

						// Check if this is a YouTube link
						if (isYouTubeUrl(url)) {
							return (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault()
										openYouTubeModal(url, linkText)
									}}
									className="inline-flex items-baseline gap-1 text-primary hover:underline">
									<Play className="relative top-px h-4 w-4" />
									{children}
								</button>
							)
						}

						// Regular external link - opens in new tab
						return (
							<a
								className="text-primary hover:underline"
								target="_blank"
								rel="noopener noreferrer"
								href={href}>
								{children}
							</a>
						)
					},
					// Styled blockquotes
					blockquote: ({ node, ...props }) => {
						const isAttributedQuote =
							node &&
							typeof node === "object" &&
							Array.isArray((node as { children?: unknown[] }).children) &&
							nodeHasYouTubeLink((node as { children?: unknown[] }).children?.slice(-1)[0])

						return (
							<blockquote
								className={[
									"border-l-4 border-primary pl-4 text-muted-foreground",
									// Tailwind Typography adds open/close quotes via pseudo-elements. Disable them so
									// our attribution line doesn't end with a dangling quotation mark.
									"[&>p:first-of-type]:before:content-none [&>p:last-of-type]:after:content-none",
									isAttributedQuote
										? [
												// Quote text reads well in italics, but the attribution line shouldn't.
												"[&>p:not(:last-child)]:italic",
												"[&>p:last-child]:not-italic [&>p:last-child]:text-sm",
												"[&>p:last-child]:before:content-['—'] [&>p:last-child]:before:mr-2",
												// Attribution should look like a citation (not a CTA button).
												"[&>p:last-child_>button_svg]:hidden",
												"[&>p:last-child_>button]:text-muted-foreground [&>p:last-child_>button]:hover:text-foreground",
											].join(" ")
										: "italic",
								].join(" ")}
								{...props}
							/>
						)
					},
					// Code blocks
					code: ({ className, children, node: _node, ...props }) => {
						const isInline = !className
						if (isInline) {
							return (
								<code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
									{children}
								</code>
							)
						}
						return (
							<code className={className} {...props}>
								{children}
							</code>
						)
					},
					// Strong text
					strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
					// Paragraphs
					p: ({ node: _node, ...props }) => <p className="leading-7 [&:not(:first-child)]:mt-6" {...props} />,
					// Lists
					ul: ({ node: _node, ...props }) => <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />,
					ol: ({ node: _node, ...props }) => <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props} />,
					// Tables with zebra striping (visible in both light and dark mode)
					table: ({ node: _node, ...props }) => (
						<div className="not-prose my-6 w-full overflow-x-auto rounded-lg border border-border">
							<table className="w-full border-collapse text-sm" {...props} />
						</div>
					),
					thead: ({ node: _node, ...props }) => <thead className="bg-muted" {...props} />,
					tbody: ({ node: _node, ...props }) => <tbody {...props} />,
					tr: ({ node: _node, ...props }) => (
						<tr
							className="border-b border-border last:border-b-0 transition-colors even:bg-muted/70 hover:bg-muted"
							{...props}
						/>
					),
					th: ({ node: _node, ...props }) => (
						<th className="px-4 py-3 text-left font-semibold text-foreground" {...props} />
					),
					td: ({ node: _node, ...props }) => <td className="px-4 py-3" {...props} />,
				}}>
				{content}
			</ReactMarkdown>

			{/* YouTube Video Modal */}
			<YouTubeModal
				open={youtubeModal.isOpen}
				onOpenChange={closeYouTubeModal}
				videoId={youtubeModal.videoId}
				startTime={youtubeModal.startTime}
				title={youtubeModal.title}
			/>
		</>
	)
}

export default BlogContent

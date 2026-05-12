"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface BlogContentProps {
	/** The markdown content to render */
	content: string
}

/**
 * BlogContent component
 *
 * Renders markdown content with site-specific typography and link behavior.
 *
 * @example
 * ```tsx
 * <BlogContent content={markdownString} />
 * ```
 */
export function BlogContent({ content }: BlogContentProps) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				// Custom heading styles - note: h1 in content becomes h2 to preserve single H1
				h1: ({ node: _node, ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
				h2: ({ node: _node, ...props }) => <h2 className="mt-12 text-2xl font-bold" {...props} />,
				h3: ({ node: _node, ...props }) => <h3 className="mt-8 text-xl font-semibold" {...props} />,
				// Regular external links open in a new tab.
				a: ({ href, children }) => {
					return (
						<a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" href={href}>
							{children}
						</a>
					)
				},
				// Styled blockquotes
				blockquote: ({ ...props }) => {
					return (
						<blockquote
							className={[
								// Opt out of Tailwind Typography's automatic quote marks for blockquotes.
								"not-prose my-6 border-l-4 border-primary pl-4 text-muted-foreground",
								// Normalize paragraph spacing inside blockquotes regardless of our global <p> renderer.
								"[&>p]:m-0 [&>p+ p]:mt-4",
								"italic",
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
	)
}

export default BlogContent

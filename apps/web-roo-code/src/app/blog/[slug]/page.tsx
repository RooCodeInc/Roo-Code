import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowLeft } from "lucide-react"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getBlogPostBySlug, formatPostDatePt } from "@/lib/blog"

// Force dynamic rendering to evaluate publish gating at request-time
export const dynamic = "force-dynamic"

// Require Node.js runtime for filesystem reads
export const runtime = "nodejs"

interface BlogPostPageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	if (!post) {
		return {
			title: "Post Not Found",
		}
	}

	const PATH = `/blog/${post.slug}`

	return {
		title: post.title,
		description: post.description,
		alternates: {
			canonical: `${SEO.url}${PATH}`,
		},
		openGraph: {
			title: post.title,
			description: post.description,
			url: `${SEO.url}${PATH}`,
			siteName: SEO.name,
			images: [
				{
					url: ogImageUrl(post.title, post.description),
					width: 1200,
					height: 630,
					alt: post.title,
				},
			],
			locale: SEO.locale,
			type: "article",
			publishedTime: post.publish_date,
		},
		twitter: {
			card: SEO.twitterCard,
			title: post.title,
			description: post.description,
			images: [ogImageUrl(post.title, post.description)],
		},
		keywords: [...SEO.keywords, ...post.tags],
	}
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
	const { slug } = await params
	const post = getBlogPostBySlug(slug)

	// Return 404 if post not found or not published
	if (!post) {
		notFound()
	}

	return (
		<div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
			<article className="mx-auto max-w-3xl">
				{/* Back link */}
				<Link
					href="/blog"
					className="mb-8 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
					<ArrowLeft className="mr-2 size-4" />
					Back to Blog
				</Link>

				{/* Post Header */}
				<header className="mb-8">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">{post.title}</h1>
					<div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
						<time dateTime={post.publish_date}>Posted {formatPostDatePt(post.publish_date)}</time>
						{post.tags.length > 0 && (
							<>
								<span className="text-border">•</span>
								<div className="flex flex-wrap gap-2">
									{post.tags.map((tag) => (
										<span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
											{tag}
										</span>
									))}
								</div>
							</>
						)}
					</div>
				</header>

				{/* Post Content */}
				<div className="prose prose-lg max-w-none dark:prose-invert">
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						components={{
							// Do not allow raw HTML - all components render safely
							h1: ({ ...props }) => (
								<h1 className="text-2xl font-bold tracking-tight sm:text-3xl" {...props} />
							),
							h2: ({ ...props }) => <h2 className="mt-10 text-xl font-bold sm:text-2xl" {...props} />,
							h3: ({ ...props }) => <h3 className="mt-8 text-lg font-semibold" {...props} />,
							a: ({ ...props }) => (
								<a
									className="text-primary hover:underline"
									target="_blank"
									rel="noopener noreferrer"
									{...props}
								/>
							),
							blockquote: ({ ...props }) => (
								<blockquote
									className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground"
									{...props}
								/>
							),
							code: ({ className, children, ...props }) => {
								// Check if this is an inline code or code block
								const isInline = !className
								if (isInline) {
									return (
										<code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono" {...props}>
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
							pre: ({ ...props }) => (
								<pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono" {...props} />
							),
							ul: ({ ...props }) => <ul className="list-disc pl-6" {...props} />,
							ol: ({ ...props }) => <ol className="list-decimal pl-6" {...props} />,
							li: ({ ...props }) => <li className="mt-2" {...props} />,
							p: ({ ...props }) => <p className="mt-4 leading-7" {...props} />,
							strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
							hr: ({ ...props }) => <hr className="my-8 border-border" {...props} />,
						}}>
						{post.content}
					</ReactMarkdown>
				</div>

				{/* Footer */}
				<footer className="mt-12 border-t border-border pt-8">
					<Link
						href="/blog"
						className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
						<ArrowLeft className="mr-2 size-4" />
						Back to Blog
					</Link>
				</footer>
			</article>
		</div>
	)
}

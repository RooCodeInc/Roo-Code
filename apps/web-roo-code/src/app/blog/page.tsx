import type { Metadata } from "next"
import Link from "next/link"
import { SEO } from "@/lib/seo"
import { ogImageUrl } from "@/lib/og"
import { getAllBlogPosts, formatPostDatePt } from "@/lib/blog"

// Force dynamic rendering to evaluate publish gating at request-time
export const dynamic = "force-dynamic"

// Require Node.js runtime for filesystem reads
export const runtime = "nodejs"

const TITLE = "Blog"
const DESCRIPTION =
	"Insights on AI-powered software development, engineering workflows, and the future of coding with Roo Code."
const PATH = "/blog"

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: {
		canonical: `${SEO.url}${PATH}`,
	},
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: `${SEO.url}${PATH}`,
		siteName: SEO.name,
		images: [
			{
				url: ogImageUrl(TITLE, DESCRIPTION),
				width: 1200,
				height: 630,
				alt: TITLE,
			},
		],
		locale: SEO.locale,
		type: "website",
	},
	twitter: {
		card: SEO.twitterCard,
		title: TITLE,
		description: DESCRIPTION,
		images: [ogImageUrl(TITLE, DESCRIPTION)],
	},
	keywords: [...SEO.keywords, "blog", "engineering blog", "AI development"],
}

export default function BlogIndex() {
	// Get all published posts (sorted newest first)
	const posts = getAllBlogPosts()

	return (
		<div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-4xl">
				{/* Page Header */}
				<div className="mb-12 text-center">
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Blog</h1>
					<p className="mt-4 text-lg text-muted-foreground">{DESCRIPTION}</p>
				</div>

				{/* Posts List */}
				{posts.length === 0 ? (
					<EmptyState />
				) : (
					<div className="space-y-8">
						{posts.map((post) => (
							<article
								key={post.slug}
								className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50">
								<Link href={`/blog/${post.slug}`} className="block">
									<h2 className="text-xl font-semibold tracking-tight group-hover:text-primary sm:text-2xl">
										{post.title}
									</h2>
									<p className="mt-2 text-muted-foreground line-clamp-2">{post.description}</p>
									<div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
										<time dateTime={post.publish_date}>
											Posted {formatPostDatePt(post.publish_date)}
										</time>
										{post.tags.length > 0 && (
											<>
												<span className="text-border">•</span>
												<div className="flex flex-wrap gap-2">
													{post.tags.slice(0, 3).map((tag) => (
														<span
															key={tag}
															className="rounded-full bg-muted px-2 py-0.5 text-xs">
															{tag}
														</span>
													))}
												</div>
											</>
										)}
									</div>
								</Link>
							</article>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

function EmptyState() {
	return (
		<div className="rounded-lg border border-dashed border-border p-12 text-center">
			<h2 className="text-lg font-medium">No posts yet</h2>
			<p className="mt-2 text-muted-foreground">Check back soon for new content.</p>
		</div>
	)
}

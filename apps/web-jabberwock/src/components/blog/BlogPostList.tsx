/**
 * Blog Post List Component
 * Renders a list of blog post previews
 */

import Link from "next/link"
import type { BlogPost, BlogSource } from "@/lib/blog"
import { formatPostDatePt } from "@/lib/blog"

interface BlogPostListProps {
	posts: BlogPost[]
}

/**
 * Source badge component
 * Styling matches the tag badges (rounded, same padding)
 */
function SourceBadge({ source }: { source: BlogSource }) {
	return <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{source}</span>
}

export function BlogPostList({ posts }: BlogPostListProps) {
	if (posts.length === 0) {
		return (
			<div className="mt-12 text-center">
				<p className="text-muted-foreground">No posts published yet. Check back soon!</p>
			</div>
		)
	}

	return (
		<div className="mt-12 space-y-12">
			{posts.map((post) => (
				<article key={post.slug} className="border-b border-border pb-12 last:border-b-0">
					<Link href={`/blog/${post.slug}`} className="group">
						<h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary sm:text-2xl">
							{post.title}
						</h2>
					</Link>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						{post.source && <SourceBadge source={post.source} />}
						<span>{formatPostDatePt(post.publish_date)}</span>
					</div>
					<p className="mt-3 text-muted-foreground">{post.description}</p>
					{post.tags.length > 0 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{post.tags.map((tag) => (
								<span key={tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
									{tag}
								</span>
							))}
						</div>
					)}
					<Link
						href={`/blog/${post.slug}`}
						className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
						Read more →
					</Link>
				</article>
			))}
		</div>
	)
}

/**
 * Blog Post List Component
 * Renders a list of blog post previews
 */

import Link from "next/link"
import type { BlogPost } from "@/lib/blog"
import { formatPostDatePt } from "@/lib/blog"

interface BlogPostListProps {
	posts: BlogPost[]
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
					<p className="mt-2 text-sm text-muted-foreground">{formatPostDatePt(post.publish_date)}</p>
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

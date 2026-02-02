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
 * Source badge colors and icons
 * Each podcast has a distinct color for visual differentiation
 */
const SOURCE_STYLES: Record<BlogSource, { bg: string; text: string; icon: string }> = {
	"Office Hours": {
		bg: "bg-blue-500/10 dark:bg-blue-400/10",
		text: "text-blue-700 dark:text-blue-300",
		icon: "🎙️",
	},
	"After Hours": {
		bg: "bg-purple-500/10 dark:bg-purple-400/10",
		text: "text-purple-700 dark:text-purple-300",
		icon: "🌙",
	},
	"Roo Cast": {
		bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
		text: "text-emerald-700 dark:text-emerald-300",
		icon: "📻",
	},
}

function SourceBadge({ source }: { source: BlogSource }) {
	const style = SOURCE_STYLES[source]
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
			<span aria-hidden="true">{style.icon}</span>
			{source}
		</span>
	)
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

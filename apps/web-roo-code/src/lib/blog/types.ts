/**
 * Blog content types
 * MKT-67: Blog Content Layer
 */

/**
 * Content source for blog posts
 * Posts derived from podcast episodes have a source; standalone articles may not
 */
export type BlogSource = "Office Hours" | "After Hours" | "Roo Cast"

export interface BlogPostFrontmatter {
	title: string
	slug: string
	description: string
	tags: string[]
	status: "draft" | "published"
	publish_date: string // YYYY-MM-DD
	publish_time_pt: string // h:mmam/pm (e.g., "9:00am")
	source?: BlogSource // Optional: indicates podcast source
	featured?: boolean // Optional: marks post as featured
}

export interface BlogPost extends BlogPostFrontmatter {
	content: string // Markdown body
	filepath: string // For error messages
}

export interface NowPt {
	date: string // YYYY-MM-DD
	minutes: number // Minutes since midnight PT
}

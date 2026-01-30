/**
 * Blog content types
 * MKT-67: Blog Content Layer
 */

export interface BlogPostFrontmatter {
	title: string
	slug: string
	description: string
	tags: string[]
	status: "draft" | "published"
	publish_date: string // YYYY-MM-DD
	publish_time_pt: string // h:mmam/pm (e.g., "9:00am")
}

export interface BlogPost extends BlogPostFrontmatter {
	content: string // Markdown body
	filepath: string // For error messages
}

export interface NowPt {
	date: string // YYYY-MM-DD
	minutes: number // Minutes since midnight PT
}

import { z } from "zod"

/**
 * Regex pattern for valid slugs: lowercase letters, numbers, and hyphens.
 * Must not start or end with hyphen, no consecutive hyphens.
 * Examples: "hello-world", "post-123", "my-great-article"
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Regex pattern for publish_time_pt: h:mmam/pm format.
 * Examples: "9:00am", "12:30pm", "11:59pm"
 */
export const PUBLISH_TIME_PT_PATTERN = /^(1[0-2]|[1-9]):[0-5][0-9](am|pm)$/

/**
 * Maximum number of tags allowed per post.
 */
export const MAX_TAGS = 15

/**
 * Zod schema for blog post frontmatter validation.
 */
export const blogFrontmatterSchema = z.object({
	title: z.string().min(1, "Title is required"),
	slug: z.string().regex(SLUG_PATTERN, {
		message: "Slug must be lowercase letters, numbers, and hyphens only (e.g., 'my-post-123')",
	}),
	description: z.string().min(1, "Description is required"),
	tags: z
		.array(z.string())
		.max(MAX_TAGS, `Maximum ${MAX_TAGS} tags allowed`)
		.transform((tags) => tags.map((tag) => tag.toLowerCase().trim())),
	status: z.enum(["draft", "published"]),
	publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
		message: "publish_date must be in YYYY-MM-DD format",
	}),
	publish_time_pt: z.string().regex(PUBLISH_TIME_PT_PATTERN, {
		message: "publish_time_pt must be in h:mmam/pm format (e.g., '9:00am', '12:30pm')",
	}),
})

/**
 * Inferred type from the frontmatter schema.
 */
export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>

/**
 * Full blog post object with parsed content.
 */
export interface BlogPost extends BlogFrontmatter {
	/** Raw markdown content (without frontmatter) */
	content: string
	/** Source filename (for error messages) */
	filename: string
}

/**
 * Pacific Time moment representation for publish gating.
 */
export interface PtMoment {
	/** Date in YYYY-MM-DD format */
	date: string
	/** Minutes since midnight (0-1439) */
	minutes: number
}

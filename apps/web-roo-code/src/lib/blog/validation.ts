/**
 * Blog frontmatter validation using Zod
 * MKT-67: Blog Content Layer
 */

import { z } from "zod"

// Slug must be lowercase alphanumeric with hyphens
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Time format: h:mmam/pm (e.g., "9:00am", "12:30pm")
const TIME_REGEX = /^(1[0-2]|[1-9]):([0-5][0-9])(am|pm)$/i

export const BlogFrontmatterSchema = z.object({
	title: z.string().min(1, "Title is required"),
	slug: z.string().regex(SLUG_REGEX, "Slug must match ^[a-z0-9]+(?:-[a-z0-9]+)*$"),
	description: z.string().min(1, "Description is required"),
	tags: z
		.array(z.string())
		.max(15, "Maximum 15 tags allowed")
		.transform((tags) => tags.map((t) => t.toLowerCase().trim())),
	status: z.enum(["draft", "published"]),
	publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
	publish_time_pt: z.string().regex(TIME_REGEX, "Must be h:mmam/pm format (e.g., 9:00am)"),
	source: z.enum(["Office Hours", "After Hours", "Roo Cast"]).optional(),
	featured: z.boolean().optional(),
})

export type ValidatedFrontmatter = z.infer<typeof BlogFrontmatterSchema>

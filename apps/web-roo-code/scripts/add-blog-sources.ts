#!/usr/bin/env npx tsx
/**
 * Script to add source field to blog posts based on written-content mapping
 *
 * Usage: npx tsx scripts/add-blog-sources.ts
 *
 * This script:
 * 1. Reads written-content files from the Knowledge Graph
 * 2. Builds a mapping of title -> podcast source
 * 3. Updates blog posts with matching source field
 */

import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const WRITTEN_CONTENT_DIR = path.resolve(
	__dirname,
	"../../../../Roo-Code-GTM-Knowledge-Graph/kb/podcast-transcripts/written-content/2026-01-24",
)
const BLOG_CONTENT_DIR = path.resolve(__dirname, "../src/content/blog")

// Source mapping based on filename prefix
type Source = "Roo Cast" | "Office Hours" | "After Hours"

function getSourceFromFilename(filename: string): Source | null {
	if (filename.startsWith("roo-cast-")) return "Roo Cast"
	if (filename.startsWith("office-hours-")) return "Office Hours"
	if (filename.startsWith("after-hours-")) return "After Hours"
	return null
}

function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

function extractTitleFromFrontmatter(content: string): string | null {
	const match = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)
	return match ? match[1].trim().replace(/^["']|["']$/g, "") : null
}

function buildSourceMapping(): Map<string, Source> {
	const mapping = new Map<string, Source>()

	if (!fs.existsSync(WRITTEN_CONTENT_DIR)) {
		console.error(`Written content directory not found: ${WRITTEN_CONTENT_DIR}`)
		console.error("Please ensure the Roo-Code-GTM-Knowledge-Graph repo is available.")
		process.exit(1)
	}

	const files = fs.readdirSync(WRITTEN_CONTENT_DIR).filter((f) => f.endsWith(".md"))

	for (const file of files) {
		const source = getSourceFromFilename(file)
		if (!source) continue

		const filepath = path.join(WRITTEN_CONTENT_DIR, file)
		const content = fs.readFileSync(filepath, "utf-8")
		const title = extractTitleFromFrontmatter(content)

		if (title) {
			const normalized = normalizeTitle(title)
			mapping.set(normalized, source)
			// Also store a slug-like version for better matching
			const slug = title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "")
			mapping.set(slug, source)
		}
	}

	return mapping
}

function updateBlogPosts(sourceMapping: Map<string, Source>): {
	updated: number
	skipped: number
	unmatched: string[]
} {
	let updated = 0
	let skipped = 0
	const unmatched: string[] = []

	if (!fs.existsSync(BLOG_CONTENT_DIR)) {
		console.error(`Blog content directory not found: ${BLOG_CONTENT_DIR}`)
		process.exit(1)
	}

	const blogFiles = fs.readdirSync(BLOG_CONTENT_DIR).filter((f) => f.endsWith(".md"))

	for (const file of blogFiles) {
		const filepath = path.join(BLOG_CONTENT_DIR, file)
		const content = fs.readFileSync(filepath, "utf-8")

		// Skip if already has source
		if (/^source:/m.test(content)) {
			skipped++
			continue
		}

		const title = extractTitleFromFrontmatter(content)
		if (!title) {
			unmatched.push(file)
			continue
		}

		const normalized = normalizeTitle(title)
		const slug = file.replace(".md", "")

		// Try to find a match
		let matchedSource: Source | undefined

		// Direct title match
		if (sourceMapping.has(normalized)) {
			matchedSource = sourceMapping.get(normalized)
		}

		// Slug match
		if (!matchedSource && sourceMapping.has(slug)) {
			matchedSource = sourceMapping.get(slug)
		}

		// Fuzzy match: check if any mapping key is contained in or contains the normalized title
		if (!matchedSource) {
			for (const [key, source] of sourceMapping) {
				if (normalized.includes(key) || key.includes(normalized)) {
					matchedSource = source
					break
				}
			}
		}

		if (matchedSource) {
			// Add source field after publish_time_pt line
			const updatedContent = content.replace(/(publish_time_pt:\s*.+)/, `$1\nsource: "${matchedSource}"`)

			if (updatedContent !== content) {
				fs.writeFileSync(filepath, updatedContent)
				console.log(`  ✓ ${file} → ${matchedSource}`)
				updated++
			}
		} else {
			unmatched.push(file)
		}
	}

	return { updated, skipped, unmatched }
}

// Main execution
console.log("Building source mapping from written-content...")
const sourceMapping = buildSourceMapping()
console.log(`Found ${sourceMapping.size} title → source mappings\n`)

console.log("Updating blog posts...")
const { updated, skipped, unmatched } = updateBlogPosts(sourceMapping)

console.log(`\nResults:`)
console.log(`  Updated: ${updated}`)
console.log(`  Skipped (already has source): ${skipped}`)
console.log(`  Unmatched: ${unmatched.length}`)

if (unmatched.length > 0) {
	console.log(`\nUnmatched files (no source found):`)
	unmatched.forEach((f) => console.log(`  - ${f}`))
}

#!/usr/bin/env node

// Split a custom_modes.yaml/.json into individual per-mode files for Roo Code
// Usage:
//   node scripts/split-custom-modes.js \
//     --source "~/.config/Code - Insiders/User/globalStorage/rooveterinaryinc.roo-cline/settings/custom_modes.yaml" \
//     --outdir "~/.config/Code - Insiders/User/globalStorage/rooveterinaryinc.roo-cline/settings/custom_modes.d" \
//     [--format yaml|json]

import fs from "fs"
import path from "path"
import os from "os"
import process from "process"
import yaml from "yaml"

function expand(p) {
	return p.replace(/^~(?=$|\/)/, os.homedir())
}

function parseArgs() {
	const args = process.argv.slice(2)
	const opts = { format: "yaml" }
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		switch (arg) {
			case "--source":
				opts.source = args[++i]
				break
			case "--outdir":
				opts.outdir = args[++i]
				break
			case "--format":
				opts.format = args[++i]
				break
			default:
				console.error(`Unknown arg: ${arg}`)
				process.exit(1)
		}
	}
	if (!opts.source || !opts.outdir) {
		console.error("Usage: --source <custom_modes.yaml|json> --outdir <dir> [--format yaml|json]")
		process.exit(1)
	}
	opts.source = expand(opts.source)
	opts.outdir = expand(opts.outdir)
	opts.format = opts.format.toLowerCase() === "json" ? "json" : "yaml"
	return opts
}

function loadModes(srcPath) {
	const raw = fs.readFileSync(srcPath, "utf8")
	const isJson = srcPath.toLowerCase().endsWith(".json")
	const data = isJson ? JSON.parse(raw) : yaml.parse(raw)
	if (!data || !Array.isArray(data.customModes)) {
		throw new Error("customModes array missing in source file")
	}
	return data.customModes
}

function sanitizeFilename(slug, format) {
	const ext = format === "json" ? ".json" : ".yaml"
	return slug.replace(/[^a-zA-Z0-9_-]/g, "_") + ext
}

function writeMode(outdir, mode, format) {
	const filename = sanitizeFilename(mode.slug, format)
	const full = path.join(outdir, filename)
	const contentObj = { customModes: [mode] }
	const body = format === "json" ? JSON.stringify(contentObj, null, 2) : yaml.stringify(contentObj)
	fs.writeFileSync(full, body, "utf8")
	return full
}

function main() {
	const opts = parseArgs()
	fs.mkdirSync(opts.outdir, { recursive: true })
	const modes = loadModes(opts.source)
	let count = 0
	for (const mode of modes) {
		const written = writeMode(opts.outdir, mode, opts.format)
		count++
		console.log(`✓ wrote ${mode.slug} -> ${written}`)
	}
	console.log(`Done. ${count} mode files created in ${opts.outdir}`)
}

main()

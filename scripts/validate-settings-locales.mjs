#!/usr/bin/env node

/**
 * Validate that settings locales stay consistent with the canonical en/settings.json
 * for critical Code Index settings.
 *
 * Checks:
 * - sections.codeIndex exists
 * - codeIndex.performanceProfileLabel exists
 * - codeIndex.mode.* exists
 * - codeIndex.maxParallelFileReads.* exists
 * - codeIndex.maxParallelEmbeddings.* exists
 * - codeIndex.chunkSizeTokens.* exists
 * - codeIndex.enableBuiltInIgnore.* exists
 *
 * Fails (exit 1) if any required key is missing in any locale.
 */

import fs from "fs"
import path from "path"
import url from "url"

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const ROOT = path.join(__dirname, "..")
const LOCALES_DIR = path.join(ROOT, "webview-ui", "src", "i18n", "locales")

/** Critical keys to enforce across all locales (schema based on en/settings.json). */
const REQUIRED_KEYS = [
  "sections.codeIndex",

  "codeIndex.performanceProfileLabel",

  "codeIndex.mode.label",
  "codeIndex.mode.description",
  "codeIndex.mode.auto",
  "codeIndex.mode.normal",
  "codeIndex.mode.lowResource",
  "codeIndex.mode.recommendedLowResource",
  "codeIndex.mode.recommendedLowResource.tooltip",
  "codeIndex.mode.recommendedNormal",
  "codeIndex.mode.recommendedNormal.tooltip",

  "codeIndex.maxParallelFileReads.label",
  "codeIndex.maxParallelFileReads.description",

  "codeIndex.maxParallelEmbeddings.label",
  "codeIndex.maxParallelEmbeddings.description",

  "codeIndex.chunkSizeTokens.label",
  "codeIndex.chunkSizeTokens.description",

  "codeIndex.enableBuiltInIgnore.label",
  "codeIndex.enableBuiltInIgnore.description",
]

/**
 * Safely get nested property by path: "a.b.c"
 */
function get(obj, keyPath) {
  return keyPath.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

/**
 * Load JSON file.
 */
function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`Failed to read or parse JSON: ${filePath}: ${err.message}`)
  }
}

function main() {
  if (!fs.existsSync(LOCALES_DIR)) {
    console.error(`[i18n-settings] Locales directory not found: ${LOCALES_DIR}`)
    process.exit(1)
  }

  const enPath = path.join(LOCALES_DIR, "en", "settings.json")
  if (!fs.existsSync(enPath)) {
    console.error(`[i18n-settings] Canonical en/settings.json not found at ${enPath}`)
    process.exit(1)
  }

  // Load all locale settings for validation target set
  const locales = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const errors = []

  for (const locale of locales) {
    const settingsPath = path.join(LOCALES_DIR, locale, "settings.json")
    if (!fs.existsSync(settingsPath)) {
      // Some locales may not have settings.json at all; that's acceptable.
      continue
    }

    const data = loadJson(settingsPath)

    for (const key of REQUIRED_KEYS) {
      const value = get(data, key)
      if (value === undefined) {
        errors.push(`Missing key "${key}" in locale "${locale}" (${path.relative(ROOT, settingsPath)})`)
      }
    }
  }

  if (errors.length > 0) {
    console.error("[i18n-settings] Inconsistent locales detected against en/settings.json schema for Code Index:")
    for (const err of errors) {
      console.error(" - " + err)
    }
    console.error(
      '\nPlease update the affected locales to include all required "codeIndex" and "sections.codeIndex" keys, keeping en/settings.json as the schema.',
    )
    process.exit(1)
  }

  console.log("[i18n-settings] All locales are consistent for Code Index critical keys.")
}

main()
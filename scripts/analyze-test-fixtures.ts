#!/usr/bin/env tsx
/**
 * Analyze Test Fixtures Script
 * 
 * This script analyzes the test fixtures to gather baseline statistics
 * that will be used for performance benchmarking.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface FileStats {
	path: string
	language: string
	lines: number
	size: number
	characters: number
}

interface LanguageStats {
	files: number
	lines: number
	size: number
	avgLinesPerFile: number
}

interface AnalysisResult {
	timestamp: string
	systemInfo: {
		platform: string
		arch: string
		cpus: number
		totalMemory: string
		nodeVersion: string
	}
	summary: {
		totalFiles: number
		totalLines: number
		totalSize: number
		totalCharacters: number
		languages: number
	}
	byLanguage: Record<string, LanguageStats>
	byCategory: Record<string, {
		files: number
		lines: number
	}>
	files: FileStats[]
}

const LANGUAGE_MAP: Record<string, string> = {
	'.ts': 'TypeScript',
	'.tsx': 'TypeScript',
	'.js': 'JavaScript',
	'.jsx': 'JavaScript',
	'.py': 'Python',
	'.java': 'Java',
	'.go': 'Go',
	'.rs': 'Rust',
	'.vue': 'Vue',
}

function getLanguage(filePath: string): string {
	const ext = path.extname(filePath)
	return LANGUAGE_MAP[ext] || 'Unknown'
}

function getCategory(filePath: string): string {
	const parts = filePath.split(path.sep)
	const fixturesIndex = parts.indexOf('fixtures')
	if (fixturesIndex >= 0 && fixturesIndex < parts.length - 1) {
		return parts[fixturesIndex + 1]
	}
	return 'other'
}

function analyzeFile(filePath: string): FileStats {
	const content = fs.readFileSync(filePath, 'utf-8')
	const lines = content.split('\n').length
	const size = fs.statSync(filePath).size
	const characters = content.length
	
	return {
		path: filePath,
		language: getLanguage(filePath),
		lines,
		size,
		characters,
	}
}

function getFixtureFiles(fixturesDir: string): string[] {
	const files: string[] = []
	
	function walk(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true })
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				walk(fullPath)
			} else if (entry.isFile() && !entry.name.endsWith('.md')) {
				files.push(fullPath)
			}
		}
	}
	
	walk(fixturesDir)
	return files
}

function analyzeFixtures(): AnalysisResult {
	const fixturesDir = path.join(__dirname, '..', 'src', 'services', 'code-index', '__tests__', 'fixtures')
	const files = getFixtureFiles(fixturesDir)
	
	const fileStats = files.map(analyzeFile)
	
	const byLanguage: Record<string, LanguageStats> = {}
	const byCategory: Record<string, { files: number; lines: number }> = {}
	
	for (const stat of fileStats) {
		// By language
		if (!byLanguage[stat.language]) {
			byLanguage[stat.language] = {
				files: 0,
				lines: 0,
				size: 0,
				avgLinesPerFile: 0,
			}
		}
		byLanguage[stat.language].files++
		byLanguage[stat.language].lines += stat.lines
		byLanguage[stat.language].size += stat.size
		
		// By category
		const category = getCategory(stat.path)
		if (!byCategory[category]) {
			byCategory[category] = { files: 0, lines: 0 }
		}
		byCategory[category].files++
		byCategory[category].lines += stat.lines
	}
	
	// Calculate averages
	for (const lang in byLanguage) {
		byLanguage[lang].avgLinesPerFile = Math.round(byLanguage[lang].lines / byLanguage[lang].files)
	}
	
	const totalLines = fileStats.reduce((sum, f) => sum + f.lines, 0)
	const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0)
	const totalCharacters = fileStats.reduce((sum, f) => sum + f.characters, 0)
	
	return {
		timestamp: new Date().toISOString(),
		systemInfo: {
			platform: os.platform(),
			arch: os.arch(),
			cpus: os.cpus().length,
			totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
			nodeVersion: process.version,
		},
		summary: {
			totalFiles: fileStats.length,
			totalLines,
			totalSize,
			totalCharacters,
			languages: Object.keys(byLanguage).length,
		},
		byLanguage,
		byCategory,
		files: fileStats,
	}
}

// Run analysis
const result = analyzeFixtures()
console.log(JSON.stringify(result, null, 2))


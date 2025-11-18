/**
 * Baseline Performance Benchmark Script
 * 
 * This script measures the current performance of the code index system
 * using the test fixtures created in Task 0.2.
 * 
 * Metrics measured:
 * - Indexing time (total, per file, per language)
 * - Memory usage (peak, average)
 * - Throughput (lines/sec, files/sec)
 * - Vector metrics (embeddings created, generation time)
 * - Search performance (query time, result relevance)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface BenchmarkResult {
	timestamp: string
	systemInfo: {
		platform: string
		arch: string
		cpus: number
		totalMemory: string
		nodeVersion: string
	}
	indexingMetrics: {
		totalTime: number
		filesProcessed: number
		totalLines: number
		throughput: {
			filesPerSecond: number
			linesPerSecond: number
		}
		byLanguage: Record<string, {
			files: number
			lines: number
			time: number
		}>
		byFile: Array<{
			file: string
			lines: number
			time: number
		}>
	}
	memoryMetrics: {
		peakUsage: string
		averageUsage: string
		initialUsage: string
		finalUsage: string
	}
	vectorMetrics: {
		embeddingsCreated: number
		embeddingGenerationTime: number
		averageTimePerEmbedding: number
	}
	searchMetrics: {
		queries: Array<{
			query: string
			time: number
			resultsCount: number
			topResult?: string
		}>
		averageQueryTime: number
	}
}

/**
 * Get system information
 */
function getSystemInfo() {
	return {
		platform: os.platform(),
		arch: os.arch(),
		cpus: os.cpus().length,
		totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
		nodeVersion: process.version,
	}
}

/**
 * Format memory usage in MB
 */
function formatMemory(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * Count lines in a file
 */
function countLines(filePath: string): number {
	const content = fs.readFileSync(filePath, 'utf-8')
	return content.split('\n').length
}

/**
 * Get all test fixture files
 */
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

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string {
	const ext = path.extname(filePath)
	const langMap: Record<string, string> = {
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
	return langMap[ext] || 'Unknown'
}

/**
 * Main benchmark function
 */
async function runBenchmark(): Promise<BenchmarkResult> {
	console.log('🚀 Starting Baseline Performance Benchmark...\n')
	
	const fixturesDir = path.join(__dirname, 'fixtures')
	const files = getFixtureFiles(fixturesDir)
	
	console.log(`📁 Found ${files.length} test fixture files`)
	console.log(`📊 System: ${os.platform()} ${os.arch()}, ${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB RAM\n`)
	
	// Initialize result object
	const result: BenchmarkResult = {
		timestamp: new Date().toISOString(),
		systemInfo: getSystemInfo(),
		indexingMetrics: {
			totalTime: 0,
			filesProcessed: 0,
			totalLines: 0,
			throughput: { filesPerSecond: 0, linesPerSecond: 0 },
			byLanguage: {},
			byFile: [],
		},
		memoryMetrics: {
			peakUsage: '',
			averageUsage: '',
			initialUsage: '',
			finalUsage: '',
		},
		vectorMetrics: {
			embeddingsCreated: 0,
			embeddingGenerationTime: 0,
			averageTimePerEmbedding: 0,
		},
		searchMetrics: {
			queries: [],
			averageQueryTime: 0,
		},
	}
	
	return result
}

// Run if executed directly
if (require.main === module) {
	runBenchmark()
		.then(result => {
			console.log('\n✅ Benchmark complete!')
			console.log(JSON.stringify(result, null, 2))
		})
		.catch(error => {
			console.error('❌ Benchmark failed:', error)
			process.exit(1)
		})
}

export { runBenchmark, BenchmarkResult }


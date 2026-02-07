export interface ICacheManager {
	getHash(filePath: string): string | undefined
	updateHash(filePath: string, hash: string): void
	updateHashes(entries: Array<{ filePath: string; hash: string }>): void
	deleteHash(filePath: string): void
	deleteHashes(filePaths: string[]): void
	deleteHashesNotIn(filePaths: string[]): string[]
	clearCacheFile(): void
	dispose(): void
	initialize(): void
}

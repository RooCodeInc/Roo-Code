/**
 * Content Hasher - Spatial Independence Utility
 * TRP1 Challenge Week 1 - Final Implementation
 */

import * as crypto from 'crypto';

export class ContentHasher {
  /**
   * Compute SHA-256 hash of code block
   * Normalizes whitespace to ensure hash stability across formatters
   */
  computeHash(codeBlock: string, algorithm: 'sha256' | 'murmur3' = 'sha256'): string {
    // Normalize whitespace for hash stability
    const normalized = codeBlock
      .replace(/\r\n/g, '\n')
      .replace(/\s+$/gm, '')
      .trim();

    if (algorithm === 'sha256') {
      return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    // Fallback to MD5 (Murmur3 would require external library)
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Verify if code block matches expected hash
   */
  verifyHash(codeBlock: string, expectedHash: string): boolean {
    const computedHash = this.computeHash(codeBlock);
    return computedHash === expectedHash;
  }

  /**
   * Compute hash for a file range (specific lines)
   */
  computeRangeHash(fileContent: string, startLine: number, endLine: number): string {
    const lines = fileContent.split('\n');
    const rangeContent = lines.slice(startLine - 1, endLine).join('\n');
    return this.computeHash(rangeContent);
  }
}
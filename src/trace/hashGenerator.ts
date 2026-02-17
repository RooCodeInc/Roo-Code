// src/trace/hashGenerator.ts

import { createHash } from 'crypto';

/**
 * Generate a SHA-256 hash for a given string (code block or AST node)
 * @param content - the string to hash
 * @returns hexadecimal hash string
 */
export function generateContentHash(content: string): string {
  const hash = createHash('sha256');
  hash.update(content, 'utf8');
  return hash.digest('hex');
}

/**
 * Generate a content hash for an AST node.
 * This function assumes the AST node is serializable to JSON.
 * @param astNode - object representing an AST node
 * @returns hexadecimal hash string
 */
export function hashASTNode(astNode: object): string {
  // Serialize node deterministically
  const serialized = JSON.stringify(astNode, Object.keys(astNode).sort());
  return generateContentHash(serialized);
}

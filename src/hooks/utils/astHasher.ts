/**
 * utils/astHasher.ts
 * ─────────────────────────────────────────────────────────────
 * AST-based content hashing for spatial independence.
 *
 * Problem with raw string hashing:
 *   If a developer adds a blank line above a function, the line
 *   numbers shift and the hash is invalidated — even though the
 *   function's logic is identical.
 *
 * Solution:
 *   Hash the AST node structure (type + identifier names + child
 *   node types) rather than raw text. Whitespace, comments, and
 *   line-number shifts do NOT change the AST fingerprint.
 *
 * Supports: TypeScript, JavaScript, TSX, JSX
 * Falls back to raw SHA-256 for unsupported file types.
 * ─────────────────────────────────────────────────────────────
 */

import * as crypto from 'crypto';
import * as path from 'path';

// Dynamic import — @typescript-eslint/typescript-estree is optional
// The extension should install it; we degrade gracefully if missing.
async function tryGetParser() {
  try {
    const { parse } = await import('@typescript-eslint/typescript-estree');
    return parse;
  } catch {
    return null;
  }
}

export interface ASTHashResult {
  hash: string;
  method: 'ast' | 'raw';
  nodeCount: number;
}

/**
 * Hash a block of code using AST fingerprinting.
 * @param content  - Source code string
 * @param filePath - Used to determine if the file is TS/JS
 * @param startLine - 1-based start line (optional, hashes whole file if omitted)
 * @param endLine   - 1-based end line   (optional)
 */
export async function hashCodeBlock(
  content: string,
  filePath: string,
  startLine?: number,
  endLine?: number
): Promise<ASTHashResult> {
  const ext = path.extname(filePath).toLowerCase();
  const isTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);

  if (!isTS) {
    return {
      hash: 'raw-sha256:' + crypto.createHash('sha256').update(content).digest('hex'),
      method: 'raw',
      nodeCount: 0,
    };
  }

  const parse = await tryGetParser();
  if (!parse) {
    console.warn('[astHasher] @typescript-eslint/typescript-estree not found, falling back to raw hash');
    return {
      hash: 'raw-sha256:' + crypto.createHash('sha256').update(content).digest('hex'),
      method: 'raw',
      nodeCount: 0,
    };
  }

  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      jsx: ext === '.tsx' || ext === '.jsx',
      tolerant: true, // don't throw on recoverable parse errors
    });

    const nodes = collectNodesInRange(ast, startLine, endLine);
    const fingerprint = buildFingerprint(nodes);
    const hash = 'ast-sha256:' + crypto.createHash('sha256').update(fingerprint).digest('hex');

    return { hash, method: 'ast', nodeCount: nodes.length };
  } catch (err) {
    console.warn('[astHasher] Parse failed, falling back to raw hash:', err);
    return {
      hash: 'raw-sha256:' + crypto.createHash('sha256').update(content).digest('hex'),
      method: 'raw',
      nodeCount: 0,
    };
  }
}

// ── Internal helpers ───────────────────────────────────────────

type ASTNode = {
  type: string;
  loc?: { start: { line: number }; end: { line: number } };
  [key: string]: unknown;
};

/**
 * Walk the AST and collect all nodes whose start line falls within
 * [startLine, endLine]. If no range given, collects all top-level nodes.
 */
function collectNodesInRange(
  ast: ASTNode,
  startLine?: number,
  endLine?: number
): ASTNode[] {
  const results: ASTNode[] = [];

  function walk(node: ASTNode) {
    if (!node || typeof node !== 'object') return;

    const nodeLine = node.loc?.start.line;
    const inRange =
      startLine === undefined ||
      endLine === undefined ||
      (nodeLine !== undefined && nodeLine >= startLine && nodeLine <= endLine);

    if (inRange && node.type) {
      results.push(node);
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue; // avoid circular refs
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => c && typeof c === 'object' && walk(c as ASTNode));
      } else if (child && typeof child === 'object' && (child as ASTNode).type) {
        walk(child as ASTNode);
      }
    }
  }

  // Walk body for Program nodes
  const body = (ast as any).body;
  if (Array.isArray(body)) {
    body.forEach(walk);
  } else {
    walk(ast);
  }

  return results;
}

/**
 * Build a deterministic string fingerprint from an array of AST nodes.
 * Only includes structural info — NOT text content or line numbers.
 */
function buildFingerprint(nodes: ASTNode[]): string {
  const normalized = nodes.map(node => ({
    type: node.type,
    // Capture identifier names for functions/classes (structural identity)
    id: extractIdentifier(node),
    // Capture parameter count for functions
    paramCount: extractParamCount(node),
    // Child node types (shallow — deep structure captured by recursion)
    childTypes: extractChildTypes(node),
  }));

  return JSON.stringify(normalized);
}

function extractIdentifier(node: ASTNode): string | null {
  const n = node as any;
  return n.id?.name ?? n.key?.name ?? n.name ?? null;
}

function extractParamCount(node: ASTNode): number | null {
  const n = node as any;
  if (n.params) return n.params.length;
  if (n.value?.params) return n.value.params.length;
  return null;
}

function extractChildTypes(node: ASTNode): string[] {
  const types: string[] = [];
  for (const key of Object.keys(node)) {
    if (['type', 'loc', 'range', 'parent', 'start', 'end'].includes(key)) continue;
    const child = (node as any)[key];
    if (child && typeof child === 'object' && child.type) {
      types.push(child.type);
    }
  }
  return types;
}
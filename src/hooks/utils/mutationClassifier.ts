/**
 * utils/mutationClassifier.ts
 * ─────────────────────────────────────────────────────────────
 * Deterministic classification of code mutations.
 *
 * Two classes:
 *   AST_REFACTOR    – Same exported API surface, internal changes only.
 *                     (rename variable, extract helper, format code)
 *   INTENT_EVOLUTION – The exported API surface changed.
 *                     (new function, changed signature, deleted export)
 *
 * The hook computes this — the agent does NOT self-report it.
 * This is what makes the system deterministic.
 * ─────────────────────────────────────────────────────────────
 */

import * as path from 'path';

export type MutationClass = 'AST_REFACTOR' | 'INTENT_EVOLUTION' | 'UNKNOWN';

export interface ClassificationResult {
  mutationClass: MutationClass;
  reason: string;
  addedExports: string[];
  removedExports: string[];
  changedSignatures: string[];
}

/**
 * Compare old and new file content and classify the mutation.
 * Falls back to UNKNOWN for non-JS/TS files.
 */
export async function classifyMutation(
  oldContent: string,
  newContent: string,
  filePath: string
): Promise<ClassificationResult> {
  const ext = path.extname(filePath).toLowerCase();
  const isTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);

  if (!isTS) {
    return {
      mutationClass: 'UNKNOWN',
      reason: 'Non-JS/TS file — cannot perform AST analysis',
      addedExports: [],
      removedExports: [],
      changedSignatures: [],
    };
  }

  try {
    const { parse } = await import('@typescript-eslint/typescript-estree');

    const oldAST = parse(oldContent, { loc: true, tolerant: true, jsx: ext.includes('x') });
    const newAST = parse(newContent, { loc: true, tolerant: true, jsx: ext.includes('x') });

    const oldExports = extractExportSignatures(oldAST);
    const newExports = extractExportSignatures(newAST);

    const added = newExports.filter(s => !oldExports.includes(s));
    const removed = oldExports.filter(s => !newExports.includes(s));

    // Detect signature changes: same name, different param count
    const changedSignatures = detectSignatureChanges(oldAST, newAST);

    if (added.length === 0 && removed.length === 0 && changedSignatures.length === 0) {
      return {
        mutationClass: 'AST_REFACTOR',
        reason: 'Exported API surface unchanged — internal refactor only',
        addedExports: [],
        removedExports: [],
        changedSignatures: [],
      };
    }

    return {
      mutationClass: 'INTENT_EVOLUTION',
      reason: `API surface changed: +${added.length} exports, -${removed.length} exports, ~${changedSignatures.length} signature changes`,
      addedExports: added,
      removedExports: removed,
      changedSignatures,
    };
  } catch (err) {
    console.warn('[mutationClassifier] Parse error:', err);
    return {
      mutationClass: 'UNKNOWN',
      reason: `Parse error: ${(err as Error).message}`,
      addedExports: [],
      removedExports: [],
      changedSignatures: [],
    };
  }
}

// ── Internal helpers ───────────────────────────────────────────

type ParsedAST = { body: any[] };

/**
 * Extract all exported symbol signatures as strings.
 * e.g. "fn:authenticate:2" = exported function named "authenticate" with 2 params
 */
function extractExportSignatures(ast: ParsedAST): string[] {
  const sigs: string[] = [];

  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration;
      if (!decl) {
        // Re-exports: export { foo, bar }
        for (const spec of node.specifiers ?? []) {
          sigs.push(`reexport:${spec.exported?.name ?? spec.local?.name}`);
        }
        continue;
      }

      if (decl.type === 'FunctionDeclaration') {
        sigs.push(`fn:${decl.id?.name}:${decl.params?.length ?? 0}`);
      } else if (decl.type === 'ClassDeclaration') {
        sigs.push(`class:${decl.id?.name}`);
      } else if (decl.type === 'VariableDeclaration') {
        for (const declarator of decl.declarations ?? []) {
          const name = declarator.id?.name;
          if (name) {
            const init = declarator.init;
            if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
              sigs.push(`fn:${name}:${init.params?.length ?? 0}`);
            } else {
              sigs.push(`var:${name}`);
            }
          }
        }
      } else if (decl.type === 'TSTypeAliasDeclaration') {
        sigs.push(`type:${decl.id?.name}`);
      } else if (decl.type === 'TSInterfaceDeclaration') {
        sigs.push(`interface:${decl.id?.name}`);
      }
    }

    if (node.type === 'ExportDefaultDeclaration') {
      sigs.push('default:export');
    }
  }

  return sigs;
}

/**
 * Detect functions that exist in both ASTs but have different param counts.
 */
function detectSignatureChanges(oldAST: ParsedAST, newAST: ParsedAST): string[] {
  const oldFns = extractFunctionMap(oldAST);
  const newFns = extractFunctionMap(newAST);
  const changes: string[] = [];

  for (const [name, paramCount] of Object.entries(oldFns)) {
    if (name in newFns && newFns[name] !== paramCount) {
      changes.push(`${name}: ${paramCount} → ${newFns[name]} params`);
    }
  }

  return changes;
}

function extractFunctionMap(ast: ParsedAST): Record<string, number> {
  const map: Record<string, number> = {};

  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration;
      if (decl.type === 'FunctionDeclaration' && decl.id?.name) {
        map[decl.id.name] = decl.params?.length ?? 0;
      }
    }
  }

  return map;
}

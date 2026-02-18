import ts from "typescript";

export type Range = {
  start: number;
  end: number;
};

function detectScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

export function detectAstNodeType(
  filePath: string,
  content: string,
  range?: Range
): string | undefined {
  const kind = detectScriptKind(filePath);
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    kind
  );

  const targetStart = range?.start ?? 0;
  const targetEnd = range?.end ?? content.length;

  let best: ts.Node | undefined;

  const visit = (node: ts.Node) => {
    const start = node.getFullStart ? node.getFullStart() : node.pos;
    const end = node.getEnd ? node.getEnd() : node.end;
    if (start <= targetStart && end >= targetEnd) {
      best = node;
      ts.forEachChild(node, visit);
    }
  };

  visit(source);
  if (!best) return undefined;
  return ts.SyntaxKind[best.kind];
}

export function detectAstNodeTypeAtPosition(
  filePath: string,
  content: string,
  position: number
): string | undefined {
  const kind = detectScriptKind(filePath);
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    kind
  );

  let best: ts.Node | undefined;

  const visit = (node: ts.Node) => {
    const start = node.getFullStart ? node.getFullStart() : node.pos;
    const end = node.getEnd ? node.getEnd() : node.end;
    if (start <= position && end >= position) {
      best = node;
      ts.forEachChild(node, visit);
    }
  };

  visit(source);
  if (!best) return undefined;
  return ts.SyntaxKind[best.kind];
}

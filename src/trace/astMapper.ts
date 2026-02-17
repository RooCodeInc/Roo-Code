// src/trace/astMapper.ts

import { generateContentHash } from './hashGenerator';
import { TraceRecordRange } from './traceTypes';

export interface ASTNodeMapping {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    contentHash: string;
}

/**
 * Maps a code block or AST node into a TraceRecordRange.
 * @param filePath - relative path to the file
 * @param startLine - 1-indexed start line of the code block
 * @param endLine - 1-indexed end line of the code block
 * @param content - exact code string of the block
 * @returns TraceRecordRange object ready to attach to a trace record
 */
export function mapASTNodeToTrace(filePath: string, startLine: number, endLine: number, content: string): TraceRecordRange {
    const contentHash = generateContentHash(content);

    return {
        filePath,
        startLine,
        endLine,
        contentHash,
    };
}

/**
 * Example utility: map multiple AST nodes from a parser to trace ranges.
 * @param filePath
 * @param nodes - array of {startLine, endLine, content} objects
 */
export function mapMultipleNodes(filePath: string, nodes: { startLine: number; endLine: number; content: string }[]): TraceRecordRange[] {
    return nodes.map(node => mapASTNodeToTrace(filePath, node.startLine, node.endLine, node.content));
}

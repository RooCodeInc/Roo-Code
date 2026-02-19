/**
 * post/LessonRecorder.ts
 * ─────────────────────────────────────────────────────────────
 * POST-HOOK #3 — The Shared Brain Updater
 *
 * Appends "Lessons Learned" to CLAUDE.md (or AGENT.md) when:
 *   • A scope violation was attempted (and blocked)
 *   • A stale file conflict occurred
 *   • A test or linter run failed
 *   • An INTENT_EVOLUTION is detected (architectural decision logged)
 *
 * CLAUDE.md is the shared context across ALL parallel agent sessions.
 * It prevents agents from making the same mistakes twice.
 * ─────────────────────────────────────────────────────────────
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolContext } from '../HookEngine';

const BRAIN_FILE = 'CLAUDE.md';
const BRAIN_SECTION = '## Lessons Learned (Auto-Generated)';

export interface Lesson {
  timestamp: string;
  category: LessonCategory;
  intentId: string | null;
  summary: string;
  detail: string;
}

export type LessonCategory =
  | 'SCOPE_VIOLATION_ATTEMPTED'
  | 'STALE_FILE_CONFLICT'
  | 'TEST_FAILURE'
  | 'LINT_FAILURE'
  | 'INTENT_EVOLUTION'
  | 'ARCHITECTURAL_DECISION'
  | 'GENERAL';

export async function lessonRecorder(ctx: ToolContext): Promise<ToolContext> {
  // Log intent evolution events
  if (ctx.mutationClass === 'INTENT_EVOLUTION') {
    const targetPath = ctx.params['path'] as string;
    await appendLesson(ctx.workspacePath, {
      timestamp: new Date().toISOString(),
      category: 'INTENT_EVOLUTION',
      intentId: ctx.intentId ?? null,
      summary: `API surface evolved in ${targetPath}`,
      detail:
        `Intent ${ctx.intentId ?? 'UNKNOWN'} caused an INTENT_EVOLUTION in "${targetPath}". ` +
        `This means exported functions or types changed. Parallel agents working on ` +
        `files that import this module should re-read it before writing.`,
    });
  }

  return ctx;
}

/**
 * Called externally (e.g., from test runner integration) to record failures.
 */
export async function recordFailure(
  workspacePath: string,
  category: LessonCategory,
  intentId: string | null,
  summary: string,
  detail: string
): Promise<void> {
  await appendLesson(workspacePath, {
    timestamp: new Date().toISOString(),
    category,
    intentId,
    summary,
    detail,
  });
}

/**
 * Called externally to record a scope violation that was blocked.
 */
export async function recordScopeViolation(
  workspacePath: string,
  intentId: string,
  attemptedFile: string,
  authorizedScope: string[]
): Promise<void> {
  await appendLesson(workspacePath, {
    timestamp: new Date().toISOString(),
    category: 'SCOPE_VIOLATION_ATTEMPTED',
    intentId,
    summary: `Agent attempted to write outside scope: ${attemptedFile}`,
    detail:
      `Intent ${intentId} tried to modify "${attemptedFile}" which is outside its authorized scope.\n` +
      `Authorized scope: ${authorizedScope.join(', ')}.\n` +
      `If this file legitimately needs modification under this intent, the scope must be expanded explicitly.`,
  });
}

// ── Append logic ───────────────────────────────────────────────

async function appendLesson(workspacePath: string, lesson: Lesson): Promise<void> {
  const brainPath = path.join(workspacePath, BRAIN_FILE);
  const entry = formatLesson(lesson);

  if (!fs.existsSync(brainPath)) {
    // Create CLAUDE.md if it doesn't exist
    fs.writeFileSync(
      brainPath,
      `# CLAUDE.md — Shared Agent Brain\n\n` +
        `This file is shared across all parallel agent sessions.\n` +
        `Read it at the start of every session.\n\n` +
        `${BRAIN_SECTION}\n\n${entry}\n`,
      'utf8'
    );
    return;
  }

  const existing = fs.readFileSync(brainPath, 'utf8');

  if (existing.includes(BRAIN_SECTION)) {
    // Append after the section header
    const updated = existing.replace(
      BRAIN_SECTION,
      `${BRAIN_SECTION}\n\n${entry}`
    );
    fs.writeFileSync(brainPath, updated, 'utf8');
  } else {
    // Append section at end
    fs.appendFileSync(brainPath, `\n${BRAIN_SECTION}\n\n${entry}\n`, 'utf8');
  }
}

function formatLesson(lesson: Lesson): string {
  const date = new Date(lesson.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `### [${lesson.category}] ${lesson.summary}
- **Date:** ${date}
- **Intent:** ${lesson.intentId ?? 'N/A'}
- **Detail:** ${lesson.detail}
`;
}
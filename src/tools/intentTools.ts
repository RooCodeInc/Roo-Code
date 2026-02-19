// src/tools/intentTool.ts
import { HookEngine } from '../hooks';

export const selectActiveIntent = (args: { intent_id: string }) => {
  const hook = new HookEngine();
  return hook.preHook('select_active_intent', args);
};
import { preToolHook } from "./preToolHook"
import { postToolHook } from "./postToolHook"

export async function runPreHook(toolName: string, args: any) {
  return preToolHook(toolName, args)
}

export async function runPostHook(toolName: string, result: any) {
  return postToolHook(toolName, result)
}

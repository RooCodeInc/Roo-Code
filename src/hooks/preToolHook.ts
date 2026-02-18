export async function preToolHook(toolName: string, args: any) {
  console.log(`[PRE-HOOK] Tool: ${toolName}`)

  return {
    allowed: true,
    toolName,
    args,
    timestamp: new Date().toISOString(),
  }
}

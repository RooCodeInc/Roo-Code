import { registerPreHook, registerPostHook } from "./prePostHook"
import preToolHook from "./preToolHook"
import postToolHook from "./postToolHook"

export function registerHooks() {
  // Register the core pre/post tool hooks used by the Hook Engine
  registerPreHook(preToolHook)
  registerPostHook(postToolHook)
}

export { registerPreHook, registerPostHook } from "./prePostHook"

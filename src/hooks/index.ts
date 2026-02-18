import { contextLoader } from "./preHooks/contextLoader"
import { intentValidator } from "./preHooks/intentValidator"
import { traceLogger } from "./postHooks/traceLogger"
import { docUpdater } from "./postHooks/docUpdater"

export const preHooks = [contextLoader, intentValidator]
export const postHooks = [traceLogger, docUpdater]

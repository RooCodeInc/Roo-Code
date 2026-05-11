import { ProviderSettings, ClineMessage } from "@roo-code/types"

import { MessageEnhancer } from "../messageEnhancer"
import * as singleCompletionHandlerModule from "../../../utils/single-completion-handler"
import { ProviderSettingsManager } from "../../config/ProviderSettingsManager"

// Mock dependencies
vi.mock("../../../utils/single-completion-handler")

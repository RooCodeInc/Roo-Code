import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"
import { ApiHandlerOptions } from "../shared/api"

import {
	AnthropicHandler,
	AwsBedrockHandler,
	CerebrasHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OpenAiCodexHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	HuggingFaceHandler,
	ChutesHandler,
	LiteLLMHandler,
	QwenCodeHandler,
	SambaNovaHandler,
	IOIntelligenceHandler,
	DoubaoHandler,
	ZAiHandler,
	FireworksHandler,
	RooHandler,
	FeatherlessHandler,
	VercelAiGatewayHandler,
	DeepInfraHandler,
	MiniMaxHandler,
	BasetenHandler,
} from "./providers"
import { NativeOllamaHandler } from "./providers/native-ollama"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	/**
	 * Task ID used for tracking and provider-specific features:
	 * - DeepInfra: Used as prompt_cache_key for caching
	 * - Roo: Sent as X-Roo-Task-ID header
	 * - Requesty: Sent as trace_id
	 * - Unbound: Sent in unbound_metadata
	 */
	taskId: string
	/**
	 * Current mode slug for provider-specific tracking:
	 * - Requesty: Sent in extra metadata
	 * - Unbound: Sent in unbound_metadata
	 */
	mode?: string
	suppressPreviousResponseId?: boolean
	/**
	 * Controls whether the response should be stored for 30 days in OpenAI's Responses API.
	 * When true (default), responses are stored and can be referenced in future requests
	 * using the previous_response_id for efficient conversation continuity.
	 * Set to false to opt out of response storage for privacy or compliance reasons.
	 * @default true
	 */
	store?: boolean
	/**
	 * Optional array of tool definitions to pass to the model.
	 * For OpenAI-compatible providers, these are ChatCompletionTool definitions.
	 */
	tools?: OpenAI.Chat.ChatCompletionTool[]
	/**
	 * Controls which (if any) tool is called by the model.
	 * Can be "none", "auto", "required", or a specific tool choice.
	 */
	tool_choice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"]
	/**
	 * Controls whether the model can return multiple tool calls in a single response.
	 * When true (default), parallel tool calls are enabled (OpenAI's parallel_tool_calls=true).
	 * When false, only one tool call is returned per response.
	 */
	parallelToolCalls?: boolean
	/**
	 * Optional array of tool names that the model is allowed to call.
	 * When provided, all tool definitions are passed to the model (so it can reference
	 * historical tool calls), but only the specified tools can actually be invoked.
	 * This is used when switching modes to prevent model errors from missing tool
	 * definitions while still restricting callable tools to the current mode's permissions.
	 * Only applies to providers that support function calling restrictions (e.g., Gemini).
	 */
	allowedFunctionNames?: string[]
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	// Inject currentApiConfigName into options if available in configuration
	// This ensures handlers (like OpenAiCodexHandler) can access the profile name
	// for profile-scoped operations.
	const currentApiConfigName = (configuration as any).currentApiConfigName
	const handlerOptions: ApiHandlerOptions = {
		...options,
		currentApiConfigName,
	}

	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler(handlerOptions)
		case "openrouter":
			return new OpenRouterHandler(handlerOptions)
		case "bedrock":
			return new AwsBedrockHandler(handlerOptions)
		case "vertex":
			return options.apiModelId?.startsWith("claude")
				? new AnthropicVertexHandler(handlerOptions)
				: new VertexHandler(handlerOptions)
		case "openai":
			return new OpenAiHandler(handlerOptions)
		case "ollama":
			return new NativeOllamaHandler(handlerOptions)
		case "lmstudio":
			return new LmStudioHandler(handlerOptions)
		case "gemini":
			return new GeminiHandler(handlerOptions)
		case "openai-codex":
			return new OpenAiCodexHandler(handlerOptions)
		case "openai-native":
			return new OpenAiNativeHandler(handlerOptions)
		case "deepseek":
			return new DeepSeekHandler(handlerOptions)
		case "doubao":
			return new DoubaoHandler(handlerOptions)
		case "qwen-code":
			return new QwenCodeHandler(handlerOptions)
		case "moonshot":
			return new MoonshotHandler(handlerOptions)
		case "vscode-lm":
			return new VsCodeLmHandler(handlerOptions)
		case "mistral":
			return new MistralHandler(handlerOptions)
		case "unbound":
			return new UnboundHandler(handlerOptions)
		case "requesty":
			return new RequestyHandler(handlerOptions)
		case "fake-ai":
			return new FakeAIHandler(handlerOptions)
		case "xai":
			return new XAIHandler(handlerOptions)
		case "groq":
			return new GroqHandler(handlerOptions)
		case "deepinfra":
			return new DeepInfraHandler(handlerOptions)
		case "huggingface":
			return new HuggingFaceHandler(handlerOptions)
		case "chutes":
			return new ChutesHandler(handlerOptions)
		case "litellm":
			return new LiteLLMHandler(handlerOptions)
		case "cerebras":
			return new CerebrasHandler(handlerOptions)
		case "sambanova":
			return new SambaNovaHandler(handlerOptions)
		case "zai":
			return new ZAiHandler(handlerOptions)
		case "fireworks":
			return new FireworksHandler(handlerOptions)
		case "io-intelligence":
			return new IOIntelligenceHandler(handlerOptions)
		case "roo":
			// Never throw exceptions from provider constructors
			// The provider-proxy server will handle authentication and return appropriate error codes
			return new RooHandler(handlerOptions)
		case "featherless":
			return new FeatherlessHandler(handlerOptions)
		case "vercel-ai-gateway":
			return new VercelAiGatewayHandler(handlerOptions)
		case "minimax":
			return new MiniMaxHandler(handlerOptions)
		case "baseten":
			return new BasetenHandler(handlerOptions)
		default:
			return new AnthropicHandler(handlerOptions)
	}
}

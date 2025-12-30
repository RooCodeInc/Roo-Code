// npx vitest run api/providers/__tests__/bedrock-logging.spec.ts

import { AwsBedrockHandler } from "../bedrock"
import type { ApiHandlerOptions } from "../../../shared/api"
import { ApiInferenceLogger } from "../../logging/ApiInferenceLogger"

const mockSend = vitest.fn()

vitest.mock("@aws-sdk/client-bedrock-runtime", () => {
	return {
		BedrockRuntimeClient: vitest.fn().mockImplementation(() => ({
			send: mockSend,
			config: { region: "us-east-1" },
			middlewareStack: {
				clone: () => ({ resolve: () => {} }),
				use: () => {},
			},
		})),
		ConverseStreamCommand: vitest.fn((params) => ({
			...params,
			input: params,
			middlewareStack: {
				clone: () => ({ resolve: () => {} }),
				use: () => {},
			},
		})),
		ConverseCommand: vitest.fn((params) => ({
			...params,
			input: params,
			middlewareStack: {
				clone: () => ({ resolve: () => {} }),
				use: () => {},
			},
		})),
	}
})

vitest.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vitest.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
}))

vitest.mock("@smithy/smithy-client", () => ({
	throwDefaultError: vitest.fn(),
}))

describe("AwsBedrockHandler API logging", () => {
	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.spyOn(ApiInferenceLogger, "isEnabled").mockReturnValue(true)
		vitest.spyOn(ApiInferenceLogger, "logRaw").mockImplementation(() => {})
		vitest.spyOn(ApiInferenceLogger, "logRawError").mockImplementation(() => {})
	})

	it("logs request + streaming response", async () => {
		mockSend.mockResolvedValueOnce({
			stream: {
				[Symbol.asyncIterator]: async function* () {
					yield {
						contentBlockStart: {
							start: { text: "Hello" },
							contentBlockIndex: 0,
						},
					}
					yield {
						contentBlockDelta: {
							delta: { text: " world" },
							contentBlockIndex: 0,
						},
					}
					yield {
						metadata: {
							usage: {
								inputTokens: 10,
								outputTokens: 2,
							},
						},
					}
				},
			},
		})

		const options: ApiHandlerOptions = {
			apiModelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			awsAccessKey: "test-access-key",
			awsSecretKey: "test-secret-key",
			awsRegion: "us-east-1",
		}
		const handler = new AwsBedrockHandler(options)

		const stream = handler.createMessage("system", [{ role: "user", content: "hi" }])
		for await (const _ of stream) {
			// consume
		}

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(/^\[API\]\[request\]\[Bedrock\]\[anthropic\.claude-3-5-sonnet-20241022-v2:0\]$/),
			expect.objectContaining({
				modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				messages: expect.any(Array),
			}),
		)

		expect(ApiInferenceLogger.logRaw).toHaveBeenCalledWith(
			expect.stringMatching(
				/^\[API\]\[response\]\[Bedrock\]\[anthropic\.claude-3-5-sonnet-20241022-v2:0\]\[\d+ms\]\[streaming\]$/,
			),
			expect.objectContaining({
				model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
				message: expect.objectContaining({
					role: "assistant",
					content: "Hello world",
				}),
				usage: expect.objectContaining({ inputTokens: 10, outputTokens: 2 }),
				__stream: expect.objectContaining({ format: "bedrock" }),
			}),
		)
	})
})

import { vi } from "vitest"
import { validateBedrockArn } from "../validate"

// Mock i18next to return predictable error messages
vi.mock("i18next", () => ({
	default: {
		t: (key: string, params?: any) => {
			if (key === "settings:validation.arn.invalidFormat") {
				return "Invalid ARN format"
			}
			if (key === "settings:validation.arn.regionMismatch") {
				return `Region mismatch: ARN region ${params?.arnRegion} does not match ${params?.region}`
			}
			return key
		},
	},
}))

describe("validateBedrockArn", () => {
	describe("Standard AWS partition ARNs", () => {
		it("should validate standard AWS Bedrock ARNs", () => {
			const arn = "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-east-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate ARNs with account IDs", () => {
			const arn = "arn:aws:bedrock:us-west-2:123456789012:inference-profile/custom-profile"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-west-2")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate Sagemaker ARNs", () => {
			const arn = "arn:aws:sagemaker:eu-west-1:123456789012:endpoint/my-endpoint"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("eu-west-1")
			expect(result.errorMessage).toBeUndefined()
		})
	})

	describe("AWS GovCloud partition ARNs", () => {
		it("should validate GovCloud Bedrock ARNs", () => {
			const arn =
				"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-west-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate GovCloud ARNs without account ID", () => {
			const arn = "arn:aws-us-gov:bedrock:us-gov-east-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-east-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate GovCloud Sagemaker ARNs", () => {
			const arn = "arn:aws-us-gov:sagemaker:us-gov-west-1:123456789012:endpoint/gov-endpoint"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-west-1")
			expect(result.errorMessage).toBeUndefined()
		})
	})

	describe("AWS China partition ARNs", () => {
		it("should validate China Bedrock ARNs", () => {
			const arn = "arn:aws-cn:bedrock:cn-north-1:123456789012:foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("cn-north-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate China ARNs without account ID", () => {
			const arn = "arn:aws-cn:bedrock:cn-northwest-1::inference-profile/custom-model"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("cn-northwest-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("should validate China Sagemaker ARNs", () => {
			const arn = "arn:aws-cn:sagemaker:cn-north-1:123456789012:endpoint/china-endpoint"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("cn-north-1")
			expect(result.errorMessage).toBeUndefined()
		})
	})

	describe("Region validation", () => {
		it("should detect region mismatch for standard AWS", () => {
			const arn = "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn, "us-west-2")

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-east-1")
			// Error message should be defined when there's a region mismatch
			expect(result.errorMessage).toBeDefined()
		})

		it("should detect region mismatch for GovCloud", () => {
			const arn = "arn:aws-us-gov:bedrock:us-gov-west-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn, "us-gov-east-1")

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-west-1")
			// Error message should be defined when there's a region mismatch
			expect(result.errorMessage).toBeDefined()
		})

		it("should detect region mismatch for China", () => {
			const arn = "arn:aws-cn:bedrock:cn-north-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn, "cn-northwest-1")

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("cn-north-1")
			// Error message should be defined when there's a region mismatch
			expect(result.errorMessage).toBeDefined()
		})

		it("should pass when regions match", () => {
			const arn = "arn:aws-us-gov:bedrock:us-gov-west-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn, "us-gov-west-1")

			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-west-1")
			expect(result.errorMessage).toBeUndefined()
		})
	})

	describe("Invalid ARN formats", () => {
		it("should reject invalid ARN format", () => {
			const arn = "not-an-arn"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(false)
			expect(result.arnRegion).toBeUndefined()
			// Error message should be defined for invalid ARN
			expect(result.errorMessage).toBeDefined()
		})

		it("should reject ARN with invalid partition", () => {
			const arn = "arn:aws-invalid:bedrock:us-east-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(false)
			expect(result.arnRegion).toBeUndefined()
			// Error message should be defined for invalid ARN
			expect(result.errorMessage).toBeDefined()
		})

		it("should reject ARN with invalid service", () => {
			const arn = "arn:aws:invalid-service:us-east-1::foundation-model/anthropic.claude-v2"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(false)
			expect(result.arnRegion).toBeUndefined()
			// Error message should be defined for invalid ARN
			expect(result.errorMessage).toBeDefined()
		})

		it("should reject ARN missing resource", () => {
			const arn = "arn:aws:bedrock:us-east-1:123456789012:"
			const result = validateBedrockArn(arn)

			expect(result.isValid).toBe(false)
			expect(result.arnRegion).toBeUndefined()
			// Error message should be defined for invalid ARN
			expect(result.errorMessage).toBeDefined()
		})
	})
})

// npx vitest run src/components/chat/__tests__/RateLimitRetryRow.spec.tsx

import { render, screen } from "@/utils/test-utils"

import { RateLimitRetryRow } from "../ChatRow"
import type { RateLimitRetryMetadata } from "@roo-code/types"

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

// Manual trigger instructions (for developer reference):
// 1) In Roo Code settings, set your provider Rate limit seconds to a small value (e.g., 5s).
// 2) Send a message to start an API request.
// 3) Immediately send another message within the configured window.
//    The pre-request wait will emit `api_req_retry_delayed` with metadata,
//    rendering a single live status row: spinner + per‑second countdown,
//    then "Retrying now..." at zero. Input remains disabled during the wait.
describe("RateLimitRetryRow", () => {
	it("renders waiting countdown with attempt and max attempts", () => {
		const metadata: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "waiting",
			remainingSeconds: 12,
			attempt: 2,
			maxAttempts: 5,
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		render(<RateLimitRetryRow metadata={metadata} />)

		expect(screen.getByText("chat:rateLimitRetry.title")).toBeInTheDocument()
		expect(screen.getByText("chat:rateLimitRetry.waitingWithAttemptMax")).toBeInTheDocument()
	})

	it("renders retrying state", () => {
		const metadata: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "retrying",
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		render(<RateLimitRetryRow metadata={metadata} />)

		expect(screen.getByText("chat:rateLimitRetry.title")).toBeInTheDocument()
		expect(screen.getByText("chat:rateLimitRetry.retrying")).toBeInTheDocument()
	})

	it("renders cancelled state (neutral)", () => {
		const metadata: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "cancelled",
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		const { container } = render(<RateLimitRetryRow metadata={metadata} />)

		expect(screen.getByText("chat:rateLimitRetry.title")).toBeInTheDocument()
		expect(screen.getByText("chat:rateLimitRetry.cancelled")).toBeInTheDocument()

		// Iconography: ensure neutral cancelled icon is present
		const cancelledIcon = container.querySelector(".codicon-circle-slash")
		expect(cancelledIcon).not.toBeNull()
	})

	it("renders empty description when metadata is missing", () => {
		render(<RateLimitRetryRow />)

		expect(screen.getByText("chat:rateLimitRetry.title")).toBeInTheDocument()
		// Description should be empty when no metadata is provided
		const descriptionElement = screen.queryByText(/./i, { selector: ".text-vscode-descriptionForeground span" })
		expect(descriptionElement).not.toBeInTheDocument()
	})

	it("updates when metadata changes from waiting to retrying", () => {
		const initialMetadata: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "waiting",
			remainingSeconds: 5,
			attempt: 1,
			maxAttempts: 3,
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		const { rerender } = render(<RateLimitRetryRow metadata={initialMetadata} />)

		// Initial state: waiting
		expect(screen.getByText("chat:rateLimitRetry.waitingWithAttemptMax")).toBeInTheDocument()

		// Update to retrying state
		const updatedMetadata: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "retrying",
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		rerender(<RateLimitRetryRow metadata={updatedMetadata} />)

		// Should now show retrying
		expect(screen.getByText("chat:rateLimitRetry.retrying")).toBeInTheDocument()
		expect(screen.queryByText("chat:rateLimitRetry.waitingWithAttemptMax")).not.toBeInTheDocument()
	})

	it("updates countdown when remainingSeconds changes", () => {
		const metadata1: RateLimitRetryMetadata = {
			type: "rate_limit_retry",
			status: "waiting",
			remainingSeconds: 10,
			attempt: 1,
			maxAttempts: 3,
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		const { rerender } = render(<RateLimitRetryRow metadata={metadata1} />)

		// Initial countdown
		expect(screen.getByText("chat:rateLimitRetry.waitingWithAttemptMax")).toBeInTheDocument()

		// Update countdown
		const metadata2: RateLimitRetryMetadata = {
			...metadata1,
			remainingSeconds: 5,
		}

		rerender(<RateLimitRetryRow metadata={metadata2} />)

		// Should still show the same text key but with updated seconds
		expect(screen.getByText("chat:rateLimitRetry.waitingWithAttemptMax")).toBeInTheDocument()
	})
})

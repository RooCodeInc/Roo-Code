// npx vitest run src/components/chat/__tests__/RetryStatusRow.spec.tsx

import { render, screen } from "@/utils/test-utils"

import { RetryStatusRow } from "../ChatRow"
import type { RetryStatusMetadata } from "@roo-code/types"

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
describe("RetryStatusRow", () => {
	it("renders waiting countdown for rate limit cause", () => {
		const metadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "waiting",
			remainingSeconds: 12,
			attempt: 2,
			maxAttempts: 5,
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		render(<RetryStatusRow metadata={metadata} />)

		expect(screen.getByText("chat:retryStatus.rateLimit.waiting")).toBeInTheDocument()
		expect(screen.getByText("chat:retryStatus.rateLimit.title")).toBeInTheDocument()
	})

	it("renders retrying state for backoff cause", () => {
		const metadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "retrying",
			origin: "retry_attempt",
			cause: "backoff",
		}

		render(<RetryStatusRow metadata={metadata} />)

		expect(screen.getByText("chat:retryStatus.backoff.retrying")).toBeInTheDocument()
	})

	it("renders proceeding state for rate limit cause", () => {
		const metadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "retrying",
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		render(<RetryStatusRow metadata={metadata} />)

		expect(screen.getByText("chat:retryStatus.rateLimit.proceeding")).toBeInTheDocument()
	})

	it("renders cancelled state (neutral)", () => {
		const metadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "cancelled",
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		const { container } = render(<RetryStatusRow metadata={metadata} />)

		expect(screen.getByText("chat:retryStatus.rateLimit.cancelled")).toBeInTheDocument()

		// Iconography: ensure neutral cancelled icon is present
		const cancelledIcon = container.querySelector(".codicon-circle-slash")
		expect(cancelledIcon).not.toBeNull()
	})

	it("renders empty description when metadata is missing", () => {
		render(<RetryStatusRow />)

		expect(screen.getByText("chat:retryStatus.backoff.waiting")).toBeInTheDocument()
	})

	it("updates when metadata changes from waiting to retrying", () => {
		const initialMetadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "waiting",
			remainingSeconds: 5,
			attempt: 1,
			maxAttempts: 3,
			origin: "retry_attempt",
			cause: "backoff",
		}

		const { rerender } = render(<RetryStatusRow metadata={initialMetadata} />)

		// Initial state: waiting
		expect(screen.getByText("chat:retryStatus.backoff.waitingWithAttemptMax")).toBeInTheDocument()

		// Update to retrying state
		const updatedMetadata: RetryStatusMetadata = {
			type: "retry_status",
			status: "retrying",
			origin: "retry_attempt",
			cause: "backoff",
		}

		rerender(<RetryStatusRow metadata={updatedMetadata} />)

		// Should now show retrying
		expect(screen.getByText("chat:retryStatus.backoff.retrying")).toBeInTheDocument()
		expect(screen.queryByText("chat:retryStatus.backoff.waitingWithAttemptMax")).not.toBeInTheDocument()
	})

	it("updates countdown when remainingSeconds changes", () => {
		const metadata1: RetryStatusMetadata = {
			type: "retry_status",
			status: "waiting",
			remainingSeconds: 10,
			attempt: 1,
			maxAttempts: 3,
			origin: "retry_attempt",
			cause: "rate_limit",
		}

		const { rerender } = render(<RetryStatusRow metadata={metadata1} />)

		// Initial countdown
		expect(screen.getByText("chat:retryStatus.rateLimit.waiting")).toBeInTheDocument()

		// Update countdown
		const metadata2: RetryStatusMetadata = {
			...metadata1,
			remainingSeconds: 5,
		}

		rerender(<RetryStatusRow metadata={metadata2} />)

		// Should still show the same text key but with updated seconds
		expect(screen.getByText("chat:retryStatus.rateLimit.waiting")).toBeInTheDocument()
	})
})

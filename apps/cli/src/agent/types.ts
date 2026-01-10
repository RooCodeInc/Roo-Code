/**
 * Structure of the text field in api_req_started messages.
 * Used to determine if the API request has completed (cost is defined).
 */
export interface ApiReqStartedText {
	cost?: number // Undefined while streaming, defined when complete.
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
}

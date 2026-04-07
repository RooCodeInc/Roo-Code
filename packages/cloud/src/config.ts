export const PRODUCTION_CLERK_BASE_URL = "https://clerk.jabberwock.com"
export const PRODUCTION_JABBERWOCK_CODE_API_URL = "https://app.jabberwock.com"

export const getClerkBaseUrl = () => process.env.CLERK_BASE_URL || PRODUCTION_CLERK_BASE_URL

export const getJabberwockApiUrl = () => process.env.JABBERWOCK_CODE_API_URL || PRODUCTION_JABBERWOCK_CODE_API_URL

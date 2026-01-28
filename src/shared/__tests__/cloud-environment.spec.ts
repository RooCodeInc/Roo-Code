import {
	isCloudEnvironment,
	getAppEnvironment,
	isPreviewEnvironment,
	isProductionEnvironment,
	isDevelopmentEnvironment,
} from "../cloud-environment"

describe("cloud-environment", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset process.env before each test
		vi.resetModules()
		process.env = { ...originalEnv }
	})

	afterAll(() => {
		// Restore original process.env after all tests
		process.env = originalEnv
	})

	describe("isCloudEnvironment", () => {
		it("should return true when ROO_CODE_IPC_SOCKET_PATH is set", () => {
			process.env.ROO_CODE_IPC_SOCKET_PATH = "/tmp/test.sock"
			expect(isCloudEnvironment()).toBe(true)
		})

		it("should return false when ROO_CODE_IPC_SOCKET_PATH is not set", () => {
			delete process.env.ROO_CODE_IPC_SOCKET_PATH
			expect(isCloudEnvironment()).toBe(false)
		})

		it("should return false when ROO_CODE_IPC_SOCKET_PATH is undefined", () => {
			process.env.ROO_CODE_IPC_SOCKET_PATH = undefined as any
			expect(isCloudEnvironment()).toBe(false)
		})
	})

	describe("getAppEnvironment", () => {
		it('should return "development" when ROO_CODE_APP_ENV is development', () => {
			process.env.ROO_CODE_APP_ENV = "development"
			expect(getAppEnvironment()).toBe("development")
		})

		it('should return "preview" when ROO_CODE_APP_ENV is preview', () => {
			process.env.ROO_CODE_APP_ENV = "preview"
			expect(getAppEnvironment()).toBe("preview")
		})

		it('should return "production" when ROO_CODE_APP_ENV is production', () => {
			process.env.ROO_CODE_APP_ENV = "production"
			expect(getAppEnvironment()).toBe("production")
		})

		it("should return undefined when ROO_CODE_APP_ENV is not set", () => {
			delete process.env.ROO_CODE_APP_ENV
			expect(getAppEnvironment()).toBeUndefined()
		})

		it("should return undefined when ROO_CODE_APP_ENV has invalid value", () => {
			process.env.ROO_CODE_APP_ENV = "invalid"
			expect(getAppEnvironment()).toBeUndefined()
		})
	})

	describe("isPreviewEnvironment", () => {
		it('should return true when ROO_CODE_APP_ENV is "preview"', () => {
			process.env.ROO_CODE_APP_ENV = "preview"
			expect(isPreviewEnvironment()).toBe(true)
		})

		it('should return false when ROO_CODE_APP_ENV is "production"', () => {
			process.env.ROO_CODE_APP_ENV = "production"
			expect(isPreviewEnvironment()).toBe(false)
		})

		it('should return false when ROO_CODE_APP_ENV is "development"', () => {
			process.env.ROO_CODE_APP_ENV = "development"
			expect(isPreviewEnvironment()).toBe(false)
		})

		it("should return false when ROO_CODE_APP_ENV is not set", () => {
			delete process.env.ROO_CODE_APP_ENV
			expect(isPreviewEnvironment()).toBe(false)
		})
	})

	describe("isProductionEnvironment", () => {
		it('should return true when ROO_CODE_APP_ENV is "production"', () => {
			process.env.ROO_CODE_APP_ENV = "production"
			expect(isProductionEnvironment()).toBe(true)
		})

		it('should return false when ROO_CODE_APP_ENV is "preview"', () => {
			process.env.ROO_CODE_APP_ENV = "preview"
			expect(isProductionEnvironment()).toBe(false)
		})

		it("should return false when ROO_CODE_APP_ENV is not set", () => {
			delete process.env.ROO_CODE_APP_ENV
			expect(isProductionEnvironment()).toBe(false)
		})
	})

	describe("isDevelopmentEnvironment", () => {
		it('should return true when ROO_CODE_APP_ENV is "development"', () => {
			process.env.ROO_CODE_APP_ENV = "development"
			expect(isDevelopmentEnvironment()).toBe(true)
		})

		it('should return false when ROO_CODE_APP_ENV is "production"', () => {
			process.env.ROO_CODE_APP_ENV = "production"
			expect(isDevelopmentEnvironment()).toBe(false)
		})

		it("should return false when ROO_CODE_APP_ENV is not set", () => {
			delete process.env.ROO_CODE_APP_ENV
			expect(isDevelopmentEnvironment()).toBe(false)
		})
	})
})

import { describe, it, expect, beforeEach } from "vitest"
import {
	isDaemonCommand,
	addDaemonPatterns,
	clearUserDaemonPatterns,
	getDaemonMessage,
	getServiceType,
} from "../daemon-detector"

describe("daemon-detector", () => {
	beforeEach(() => {
		// Clear any user patterns before each test
		clearUserDaemonPatterns()
	})

	describe("isDaemonCommand", () => {
		describe("Java/Spring Boot patterns", () => {
			it("should detect mvn spring-boot:run", () => {
				expect(isDaemonCommand("mvn spring-boot:run")).toBe(true)
				expect(isDaemonCommand("MVN SPRING-BOOT:RUN")).toBe(true)
				expect(isDaemonCommand("mvn spring-boot:run --debug")).toBe(true)
			})

			it("should detect gradle bootRun", () => {
				expect(isDaemonCommand("gradle bootRun")).toBe(true)
				expect(isDaemonCommand('gradle bootRun --args="--spring.profiles.active=dev"')).toBe(true)
			})

			it("should detect java -jar commands", () => {
				expect(isDaemonCommand("java -jar myapp.jar")).toBe(true)
				expect(isDaemonCommand("java -jar /path/to/app.jar")).toBe(true)
				expect(isDaemonCommand("java -Xmx512m -jar application.jar")).toBe(true)
			})
		})

		describe("Node.js patterns", () => {
			it("should detect npm start/dev/serve commands", () => {
				expect(isDaemonCommand("npm start")).toBe(true)
				expect(isDaemonCommand("npm run start")).toBe(true)
				expect(isDaemonCommand("npm run dev")).toBe(true)
				expect(isDaemonCommand("npm serve")).toBe(true)
				expect(isDaemonCommand("npm run watch")).toBe(true)
			})

			it("should detect yarn commands", () => {
				expect(isDaemonCommand("yarn start")).toBe(true)
				expect(isDaemonCommand("yarn dev")).toBe(true)
				expect(isDaemonCommand("yarn serve")).toBe(true)
			})

			it("should detect nodemon", () => {
				expect(isDaemonCommand("nodemon server.js")).toBe(true)
				expect(isDaemonCommand("nodemon --watch src app.js")).toBe(true)
			})

			it("should detect pm2", () => {
				expect(isDaemonCommand("pm2 start app.js")).toBe(true)
				expect(isDaemonCommand("pm2 start ecosystem.config.js")).toBe(true)
			})
		})

		describe("Python patterns", () => {
			it("should detect Python HTTP server", () => {
				expect(isDaemonCommand("python -m http.server")).toBe(true)
				expect(isDaemonCommand("python3 -m http.server 8000")).toBe(true)
			})

			it("should detect Django runserver", () => {
				expect(isDaemonCommand("python manage.py runserver")).toBe(true)
				expect(isDaemonCommand("python manage.py runserver 0.0.0.0:8000")).toBe(true)
			})

			it("should detect Flask run", () => {
				expect(isDaemonCommand("flask run")).toBe(true)
				expect(isDaemonCommand("flask run --host=0.0.0.0")).toBe(true)
			})

			it("should detect Python app.py", () => {
				expect(isDaemonCommand("python app.py")).toBe(true)
				expect(isDaemonCommand("python3 /path/to/app.py")).toBe(true)
			})
		})

		describe("Ruby patterns", () => {
			it("should detect Rails server", () => {
				expect(isDaemonCommand("rails server")).toBe(true)
				expect(isDaemonCommand("rails s")).toBe(true)
				expect(isDaemonCommand("rails server -p 3001")).toBe(true)
			})
		})

		describe("Docker patterns", () => {
			it("should detect docker run without --rm", () => {
				expect(isDaemonCommand("docker run nginx")).toBe(true)
				expect(isDaemonCommand("docker run -p 8080:80 nginx")).toBe(true)
			})

			it("should not detect docker run with --rm", () => {
				expect(isDaemonCommand("docker run --rm nginx")).toBe(false)
				expect(isDaemonCommand("docker run --rm -it ubuntu bash")).toBe(false)
			})

			it("should detect docker-compose up without -d", () => {
				expect(isDaemonCommand("docker-compose up")).toBe(true)
				expect(isDaemonCommand("docker-compose up web")).toBe(true)
			})

			it("should not detect docker-compose up with -d", () => {
				expect(isDaemonCommand("docker-compose up -d")).toBe(false)
				expect(isDaemonCommand("docker-compose up -d web")).toBe(false)
			})
		})

		describe("Non-daemon commands", () => {
			it("should not detect regular commands", () => {
				expect(isDaemonCommand("ls -la")).toBe(false)
				expect(isDaemonCommand("git status")).toBe(false)
				expect(isDaemonCommand("npm install")).toBe(false)
				expect(isDaemonCommand("npm test")).toBe(false)
				expect(isDaemonCommand('echo "hello"')).toBe(false)
				expect(isDaemonCommand("cd /path/to/dir")).toBe(false)
			})
		})
	})

	describe("addDaemonPatterns", () => {
		it("should add string patterns", () => {
			expect(isDaemonCommand("my-custom-process")).toBe(false)
			addDaemonPatterns(["my-custom-process"])
			expect(isDaemonCommand("my-custom-process")).toBe(true)
		})

		it("should add regex patterns", () => {
			expect(isDaemonCommand("custom-app --background")).toBe(false)
			addDaemonPatterns([/^custom-app\s+--background/])
			expect(isDaemonCommand("custom-app --background")).toBe(true)
		})

		it("should handle multiple patterns", () => {
			expect(isDaemonCommand("my-process")).toBe(false)
			expect(isDaemonCommand("another-process")).toBe(false)

			addDaemonPatterns(["my-process", "another-process"])

			expect(isDaemonCommand("my-process")).toBe(true)
			expect(isDaemonCommand("another-process")).toBe(true)
		})
	})

	describe("clearUserDaemonPatterns", () => {
		it("should clear user-defined patterns", () => {
			addDaemonPatterns(["my-custom-process"])
			expect(isDaemonCommand("my-custom-process")).toBe(true)

			clearUserDaemonPatterns()
			expect(isDaemonCommand("my-custom-process")).toBe(false)
		})

		it("should not affect built-in patterns", () => {
			addDaemonPatterns(["my-custom-process"])
			clearUserDaemonPatterns()

			// Built-in patterns should still work
			expect(isDaemonCommand("npm start")).toBe(true)
			expect(isDaemonCommand("mvn spring-boot:run")).toBe(true)
		})
	})

	describe("getDaemonMessage", () => {
		it("should return a message for daemon processes", () => {
			const message = getDaemonMessage("npm start")
			expect(message).toContain("npm start")
			expect(message).toContain("long-running service/daemon")
			expect(message).toContain("background")
		})

		it("should truncate long commands", () => {
			const longCommand =
				"java -Xmx4g -Xms2g -jar /very/long/path/to/application/with/many/options/application.jar --spring.profiles.active=production"
			const message = getDaemonMessage(longCommand)
			expect(message).toContain("...")
		})
	})

	describe("getServiceType", () => {
		it("should identify Spring Boot applications", () => {
			expect(getServiceType("mvn spring-boot:run")).toBe("Spring Boot application")
			expect(getServiceType("gradle bootRun")).toBe("Spring Boot application")
		})

		it("should identify Node.js applications", () => {
			expect(getServiceType("npm start")).toBe("Node.js application")
			expect(getServiceType("yarn dev")).toBe("Node.js application")
			expect(getServiceType("pnpm serve")).toBe("Node.js application")
		})

		it("should identify Python applications", () => {
			expect(getServiceType("python app.py")).toBe("Python application")
			expect(getServiceType("flask run")).toBe("Python application")
			expect(getServiceType("python manage.py runserver")).toBe("Python application")
		})

		it("should identify Rails applications", () => {
			expect(getServiceType("rails server")).toBe("Rails application")
			expect(getServiceType("rails s")).toBe("Rails application")
		})

		it("should identify .NET applications", () => {
			expect(getServiceType("dotnet run")).toBe(".NET application")
			expect(getServiceType("dotnet watch")).toBe(".NET application")
		})

		it("should identify Docker containers", () => {
			expect(getServiceType("docker run nginx")).toBe("Docker container")
			expect(getServiceType("docker-compose up")).toBe("Docker container")
		})

		it("should identify PHP applications", () => {
			expect(getServiceType("php -S localhost:8000")).toBe("PHP application")
			expect(getServiceType("php artisan serve")).toBe("PHP application")
		})

		it("should return generic application for unknown types", () => {
			expect(getServiceType("unknown-server start")).toBe("application")
		})
	})
})

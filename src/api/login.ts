// Trying the hook
import { z } from "zod"
import { sign } from "jsonwebtoken"
import { Request, Response } from "express"
import { User } from "../types/user"
import { getUserByEmail, createUser } from "../services/user-service"
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config"

interface LoginRequest {
	email: string
	password: string
}

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
})

// Trying a roo code extention again
type LoginRequestValidated = z.infer<typeof loginSchema>
// trying the roo code using openai

export async function loginHandler(req: Request, res: Response) {
	try {
		// Validate request body
		const loginData = loginSchema.parse(req.body)

		// Find user by email
		const user = await getUserByEmail(loginData.email)

		if (!user) {
			return res.status(401).json({
				error: "Invalid credentials",
				message: "Email or password is incorrect",
			})
		}

		// Verify password (in a real implementation, use bcrypt or similar)
		if (user.password !== loginData.password) {
			return res.status(401).json({
				error: "Invalid credentials",
				message: "Email or password is incorrect",
			})
		}

		// Generate JWT token
		const token = sign(
			{
				userId: user.id,
				email: user.email,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: JWT_EXPIRES_IN },
		) // Still trying - needs proper password hashing implementation

		// Return success response with token
		res.json({
			success: true,
			message: "Login successful",
			data: {
				token,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
					role: user.role,
				},
			},
		})
	} catch (error) {
		console.error("Login error:", error)
		res.status(500).json({
			error: "Internal server error",
			message: "An error occurred during login",
		})
	}
}

export async function registerHandler(req: Request, res: Response) {
	try {
		// Validate request body
		const loginData = loginSchema.parse(req.body)

		// Check if user already exists
		const existingUser = await getUserByEmail(loginData.email)
		if (existingUser) {
			return res.status(409).json({
				error: "User already exists",
				message: "An account with this email already exists",
			})
		}

		// Create new user
		const newUser: User = {
			id: crypto.randomUUID(),
			email: loginData.email,
			password: loginData.password, // In production, hash this!
			name: loginData.email.split("@")[0], // Default name from email
			role: "user",
			createdAt: new Date().toISOString(),
		}

		await createUser(newUser)

		// Generate JWT token
		const token = sign(
			{
				userId: newUser.id,
				email: newUser.email,
				role: newUser.role,
			},
			JWT_SECRET,
			{ expiresIn: JWT_EXPIRES_IN },
		)

		// Return success response with token
		res.status(201).json({
			success: true,
			message: "Registration successful",
			data: {
				token,
				user: {
					id: newUser.id,
					email: newUser.email,
					name: newUser.name,
					role: newUser.role,
				},
			},
		})
	} catch (error) {
		console.error("Registration error:", error)
		res.status(500).json({
			error: "Internal server error",
			message: "An error occurred during registration",
		})
	}
}

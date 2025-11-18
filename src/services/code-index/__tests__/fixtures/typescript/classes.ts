/**
 * Test fixture: TypeScript classes with inheritance, access modifiers, and methods
 * 
 * Tests:
 * - Class definitions
 * - Inheritance hierarchies
 * - Access modifiers (public, private, protected)
 * - Static methods and properties
 * - Abstract classes
 * - Method overriding
 */

// Base abstract class
export abstract class Entity {
  protected id: string
  protected createdAt: Date
  protected updatedAt: Date

  constructor(id: string) {
    this.id = id
    this.createdAt = new Date()
    this.updatedAt = new Date()
  }

  abstract validate(): boolean

  public getId(): string {
    return this.id
  }

  protected touch(): void {
    this.updatedAt = new Date()
  }
}

// User class extending Entity
export class User extends Entity {
  private email: string
  private passwordHash: string
  public username: string
  private roles: string[]

  constructor(id: string, email: string, username: string) {
    super(id)
    this.email = email
    this.username = username
    this.passwordHash = ''
    this.roles = ['user']
  }

  public validate(): boolean {
    return this.email.includes('@') && this.username.length > 0
  }

  public setPassword(password: string): void {
    // Simplified password hashing
    this.passwordHash = Buffer.from(password).toString('base64')
    this.touch()
  }

  public checkPassword(password: string): boolean {
    const hash = Buffer.from(password).toString('base64')
    return this.passwordHash === hash
  }

  public addRole(role: string): void {
    if (!this.roles.includes(role)) {
      this.roles.push(role)
      this.touch()
    }
  }

  public hasRole(role: string): boolean {
    return this.roles.includes(role)
  }

  public getEmail(): string {
    return this.email
  }

  private sanitizeEmail(email: string): string {
    return email.toLowerCase().trim()
  }
}

// Admin class extending User
export class AdminUser extends User {
  private permissions: Set<string>
  private static adminCount: number = 0

  constructor(id: string, email: string, username: string) {
    super(id, email, username)
    this.permissions = new Set(['read', 'write', 'delete'])
    this.addRole('admin')
    AdminUser.adminCount++
  }

  public static getAdminCount(): number {
    return AdminUser.adminCount
  }

  public grantPermission(permission: string): void {
    this.permissions.add(permission)
    this.touch()
  }

  public revokePermission(permission: string): void {
    this.permissions.delete(permission)
    this.touch()
  }

  public hasPermission(permission: string): boolean {
    return this.permissions.has(permission)
  }

  public override validate(): boolean {
    return super.validate() && this.permissions.size > 0
  }
}

// Service class with dependency injection
export class UserService {
  private users: Map<string, User>
  private static instance: UserService | null = null

  private constructor() {
    this.users = new Map()
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService()
    }
    return UserService.instance
  }

  public createUser(email: string, username: string): User {
    const id = crypto.randomUUID()
    const user = new User(id, email, username)
    this.users.set(id, user)
    return user
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id)
  }

  public deleteUser(id: string): boolean {
    return this.users.delete(id)
  }

  public findByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.getEmail() === email)
  }
}


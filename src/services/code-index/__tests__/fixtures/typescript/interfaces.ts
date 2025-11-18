/**
 * Test fixture: TypeScript interfaces and type definitions
 * 
 * Tests:
 * - Interface definitions
 * - Type aliases
 * - Union and intersection types
 * - Mapped types
 * - Conditional types
 * - Utility types
 */

// Basic interface
export interface User {
  id: string
  email: string
  username: string
  createdAt: Date
}

// Interface with optional properties
export interface UserProfile extends User {
  bio?: string
  avatar?: string
  website?: string
  location?: string
}

// Interface with readonly properties
export interface Config {
  readonly apiUrl: string
  readonly apiKey: string
  readonly timeout: number
}

// Interface with index signature
export interface Dictionary<T> {
  [key: string]: T
}

// Interface with function signatures
export interface Repository<T> {
  findById(id: string): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<boolean>
}

// Type alias for primitive
export type ID = string | number

// Union type
export type Status = 'pending' | 'active' | 'inactive' | 'deleted'

// Intersection type
export type AdminUser = User & {
  role: 'admin'
  permissions: string[]
}

// Type alias for function
export type Validator<T> = (value: T) => boolean

// Generic type alias
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E }

// Mapped type
export type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

// Partial mapped type
export type Optional<T> = {
  [P in keyof T]?: T[P]
}

// Pick utility type usage
export type UserCredentials = Pick<User, 'email' | 'username'>

// Omit utility type usage
export type UserWithoutDates = Omit<User, 'createdAt'>

// Record utility type
export type UserRoles = Record<string, string[]>

// Conditional type
export type NonNullable<T> = T extends null | undefined ? never : T

// Conditional type with inference
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never

// Recursive type
export interface TreeNode<T> {
  value: T
  children?: TreeNode<T>[]
}

// Discriminated union
export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number }

// Template literal type
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type Endpoint = `/${string}`
export type Route = `${HTTPMethod} ${Endpoint}`

// Tuple type
export type Point2D = [number, number]
export type Point3D = [number, number, number]

// Enum
export enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST'
}

// Const enum
export const enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

// Type guard
export function isUser(obj: any): obj is User {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.username === 'string'
  )
}

// Generic constraint
export interface Identifiable {
  id: string
}

export function findById<T extends Identifiable>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id)
}

// Variadic tuple types
export type Concat<T extends any[], U extends any[]> = [...T, ...U]

// Branded types
export type Brand<K, T> = K & { __brand: T }
export type UserId = Brand<string, 'UserId'>
export type Email = Brand<string, 'Email'>

// Helper to create branded types
export function createUserId(id: string): UserId {
  return id as UserId
}

// Complex mapped type
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Awaited type (for unwrapping promises)
export type Awaited<T> = T extends Promise<infer U> ? U : T


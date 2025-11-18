/**
 * Test fixture: TypeScript functions with various patterns
 * 
 * Tests:
 * - Regular functions
 * - Arrow functions
 * - Async functions
 * - Generator functions
 * - Function overloads
 * - Higher-order functions
 * - Closures
 */

// Regular function with type annotations
export function calculateSum(a: number, b: number): number {
  return a + b
}

// Arrow function
export const multiply = (a: number, b: number): number => a * b

// Async function
export async function fetchUserData(userId: string): Promise<{ id: string; name: string }> {
  const response = await fetch(`/api/users/${userId}`)
  return response.json()
}

// Generator function
export function* fibonacci(limit: number): Generator<number> {
  let a = 0, b = 1
  for (let i = 0; i < limit; i++) {
    yield a
    ;[a, b] = [b, a + b]
  }
}

// Function overloads
export function formatValue(value: string): string
export function formatValue(value: number): string
export function formatValue(value: boolean): string
export function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return `"${value}"`
  } else if (typeof value === 'number') {
    return value.toFixed(2)
  } else {
    return value ? 'true' : 'false'
  }
}

// Higher-order function
export function createMultiplier(factor: number): (x: number) => number {
  return (x: number) => x * factor
}

// Function with rest parameters
export function sum(...numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0)
}

// Function with optional parameters
export function greet(name: string, greeting?: string): string {
  return `${greeting || 'Hello'}, ${name}!`
}

// Function with default parameters
export function createUser(name: string, role: string = 'user', active: boolean = true) {
  return { name, role, active }
}

// Async generator function
export async function* fetchPages(url: string, maxPages: number): AsyncGenerator<any> {
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetch(`${url}?page=${page}`)
    yield await response.json()
  }
}

// Closure example
export function createCounter(initialValue: number = 0) {
  let count = initialValue
  
  return {
    increment: () => ++count,
    decrement: () => --count,
    getValue: () => count,
    reset: () => { count = initialValue }
  }
}

// Curried function
export const curry = <A, B, C>(fn: (a: A, b: B) => C) => 
  (a: A) => (b: B) => fn(a, b)

// Memoization function
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>()
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)!
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => { inThrottle = false }, limit)
    }
  }
}

// Pipe function
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg)
}

// Compose function
export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg)
}

// Retry function with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) throw error
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)))
    }
  }
  throw new Error('Max attempts reached')
}


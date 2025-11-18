/**
 * Test fixture: TypeScript generics
 * 
 * Tests:
 * - Generic functions
 * - Generic classes
 * - Generic interfaces
 * - Generic constraints
 * - Multiple type parameters
 * - Default type parameters
 */

// Generic function
export function identity<T>(value: T): T {
  return value
}

// Generic function with constraint
export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

// Generic function with multiple type parameters
export function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 }
}

// Generic class
export class Box<T> {
  private value: T

  constructor(value: T) {
    this.value = value
  }

  getValue(): T {
    return this.value
  }

  setValue(value: T): void {
    this.value = value
  }

  map<U>(fn: (value: T) => U): Box<U> {
    return new Box(fn(this.value))
  }
}

// Generic class with constraint
export class Collection<T extends { id: string }> {
  private items: Map<string, T>

  constructor() {
    this.items = new Map()
  }

  add(item: T): void {
    this.items.set(item.id, item)
  }

  get(id: string): T | undefined {
    return this.items.get(id)
  }

  remove(id: string): boolean {
    return this.items.delete(id)
  }

  getAll(): T[] {
    return Array.from(this.items.values())
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.getAll().filter(predicate)
  }
}

// Generic interface
export interface Container<T> {
  value: T
  map<U>(fn: (value: T) => U): Container<U>
  flatMap<U>(fn: (value: T) => Container<U>): Container<U>
}

// Generic type with default parameter
export type Response<T = any> = {
  data: T
  error?: string
}

// Generic class with multiple type parameters
export class Pair<K, V> {
  constructor(
    public readonly key: K,
    public readonly value: V
  ) {}

  mapKey<K2>(fn: (key: K) => K2): Pair<K2, V> {
    return new Pair(fn(this.key), this.value)
  }

  mapValue<V2>(fn: (value: V) => V2): Pair<K, V2> {
    return new Pair(this.key, fn(this.value))
  }
}

// Generic function with conditional type
export function unwrap<T>(value: T | Promise<T>): T extends Promise<infer U> ? U : T {
  if (value instanceof Promise) {
    throw new Error('Cannot unwrap Promise synchronously')
  }
  return value as any
}

// Generic class with static method
export class Factory<T> {
  constructor(private creator: () => T) {}

  create(): T {
    return this.creator()
  }

  static of<U>(creator: () => U): Factory<U> {
    return new Factory(creator)
  }
}

// Generic interface with index signature
export interface Dictionary<T> {
  [key: string]: T
  get(key: string): T | undefined
  set(key: string, value: T): void
  has(key: string): boolean
}

// Generic class implementing generic interface
export class HashMap<T> implements Dictionary<T> {
  [key: string]: any
  private data: Map<string, T>

  constructor() {
    this.data = new Map()
  }

  get(key: string): T | undefined {
    return this.data.get(key)
  }

  set(key: string, value: T): void {
    this.data.set(key, value)
  }

  has(key: string): boolean {
    return this.data.has(key)
  }
}

// Variadic generic function
export function tuple<T extends any[]>(...args: T): T {
  return args
}

// Generic with union constraint
export function process<T extends string | number>(value: T): string {
  return typeof value === 'string' ? value.toUpperCase() : value.toString()
}


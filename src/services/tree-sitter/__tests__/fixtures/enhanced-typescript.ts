/**
 * Enhanced TypeScript test fixture for Tree-sitter queries
 * This file contains various TypeScript constructs for testing enhanced parsing
 */

export default String.raw`
// ================================================
// Generic Classes
// ================================================

/**
 * Generic class with type parameter and constraint
 */
class GenericClass<T extends string, U extends number> {
    private data: T;
    public value: U;
    
    constructor(data: T, value: U) {
        this.data = data;
        this.value = value;
    }
    
    getData(): T {
        return this.data;
    }
}

/**
 * Generic class implementing interface
 */
class GenericImpl<T, K> implements Comparable<T> {
    private items: T[];
    private key: K;
    
    constructor(items: T[], key: K) {
        this.items = items;
        this.key = key;
    }
    
    compareTo(other: T): number {
        return 0;
    }
}

// ================================================
// Decorators with Arguments
// ================================================

/**
 * Class decorator with arguments
 */
@Component({
    selector: 'my-component',
    template: '<div>Hello</div>',
    styles: ['color: red']
})
export class MyComponent {
    @Input() name: string;
    @Output() valueChange = new EventEmitter<string>();
    
    @Deprecated('Use NewComponent instead')
    oldMethod(): void {
        console.log('This method is deprecated');
    }
    
    @LogExecutionTime
    async loadData(): Promise<void> {
        await fetch('/api/data');
    }
}

/**
 * Method decorator with arguments
 */
class ServiceClass {
    @Cacheable({ ttl: 3600, maxSize: 100 })
    getCachedData(key: string): Data {
        return this.fetchFromCache(key);
    }
    
    @RateLimit({ requests: 10, window: 60000 })
    processRequest(request: Request): Response {
        return this.handleRequest(request);
    }
}

/**
 * Property decorator with arguments
 */
class FormClass {
    @Validate({ required: true, minLength: 3 })
    username: string;
    
    @Pattern({ regex: '^[a-z]+$', message: 'Invalid format' })
    code: string;
}

// ================================================
// Type Aliases with Generics
// ================================================

/**
 * Generic type alias
 */
type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * Type alias with constraint
 */
type StringOrNumber<T extends string | number> = T extends string 
    ? string 
    : number;

/**
 * Complex type alias
 */
type ApiResponse<T> = {
    status: number;
    message: string;
    data: T;
    meta?: {
        timestamp: Date;
        version: string;
    };
};

// ================================================
// Interface extends
// ================================================

/**
 * Interface extending single interface
 */
interface NamedEntity {
    name: string;
    id: string;
}

interface Person extends NamedEntity {
    age: number;
    email: string;
}

/**
 * Interface extending multiple interfaces
 */
interface Identifiable {
    id: string;
}

interface Loggable {
    log(message: string): void;
}

interface Serializable {
    toJSON(): object;
}

interface Entity extends Identifiable, Loggable, Serializable {
    createdAt: Date;
    updatedAt: Date;
}

// ================================================
// Class extends/implements
// ================================================

/**
 * Class with single inheritance
 */
class Animal {
    protected name: string;
    
    constructor(name: string) {
        this.name = name;
    }
    
    speak(): void {
        console.log('Animal sound');
    }
}

/**
 * Class implementing single interface
 */
class Dog extends Animal implements Pet {
    private breed: string;
    
    constructor(name: string, breed: string) {
        super(name);
        this.breed = breed;
    }
    
    speak(): void {
        console.log('Woof!');
    }
    
    play(): void {
        console.log('Playing fetch');
    }
}

/**
 * Class with both extends and implements
 */
class Robot extends Machine implements Operable, Controllable {
    private batteryLevel: number;
    
    constructor(id: string) {
        super(id);
        this.batteryLevel = 100;
    }
    
    operate(): void {
        console.log('Operating');
    }
    
    control(command: string): void {
        console.log('Controlling with:', command);
    }
    
    start(): void {
        this.batteryLevel = 100;
    }
}

// ================================================
// Export Statements
// ================================================

/**
 * Named exports
 */
export function exportedFunction<T>(arg: T): T {
    return arg;
}

export class ExportedClass {
    public static staticMethod(): void {}
}

export interface ExportedInterface {
    method(): void;
}

export type ExportedType = string | number;

/**
 * Export with alias
 */
export { default as AliasedComponent } from './component';
export { type ComponentProps } from './types';
export { Helper as UtilHelper } from './helper';

// ================================================
// Import Statements
// ================================================

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as Rx from 'rxjs';
import { map, filter, Observable } from 'rxjs/operators';
import defaultExport from './default-export';
import namespaceImport from './namespace';

// ================================================
// Enums
// ================================================

/**
 * Numeric enum
 */
enum Priority {
    Low = 1,
    Medium = 2,
    High = 4,
    Critical = 8
}

/**
 * String enum
 */
enum Status {
    Pending = 'PENDING',
    Active = 'ACTIVE',
    Completed = 'COMPLETED',
    Failed = 'FAILED'
}

/**
 * Const enum
 */
const enum Direction {
    Up = 'UP',
    Down = 'DOWN',
    Left = 'LEFT',
    Right = 'RIGHT'
}

// ================================================
// Visibility Modifiers
// ================================================

class VisibilityClass {
    public publicField: string;
    private privateField: number;
    protected protectedField: boolean;
    readonly readonlyField: Date;
    
    public publicMethod(): void {}
    private privateMethod(): void {}
    protected protectedMethod(): void {}
}

// ================================================
// Interfaces for testing
// ================================================

interface Comparable<T> {
    compareTo(other: T): number;
}

interface Pet {
    play(): void;
}

interface Machine {
    start(): void;
    stop(): void;
}

interface Operable {
    operate(): void;
}

interface Controllable {
    control(command: string): void;
}

interface Data {
    id: string;
    value: unknown;
}
`

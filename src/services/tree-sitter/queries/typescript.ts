/*
- function signatures and declarations
- method signatures and definitions
- abstract method signatures
- class declarations (including abstract classes)
- module declarations
- arrow functions (lambda functions)
- switch/case statements with complex case blocks
- enum declarations with members
- namespace declarations
- utility types
- class members and properties
- constructor methods
- getter/setter methods
- async functions and arrow functions
*/
export default `
(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(call_expression
  function: (identifier) @func_name
  arguments: (arguments
    (string) @name
    [(arrow_function) (function_expression)]) @definition.test)
  (#match? @func_name "^(describe|test|it)$")

(assignment_expression
  left: (member_expression
    object: (identifier) @obj
    property: (property_identifier) @prop)
  right: [(arrow_function) (function_expression)]) @definition.test
  (#eq? @obj "exports")
  (#eq? @prop "test")
(arrow_function) @definition.lambda

(switch_statement) @definition.switch

(switch_case) @definition.case

(switch_default) @definition.default

(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

(export_statement
  decorator: (decorator
    (call_expression
      function: (identifier) @name.definition.decorator))
  declaration: (class_declaration
    name: (type_identifier) @name.definition.decorated_class)) @definition.decorated_class

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(internal_module
  name: (identifier) @name.definition.namespace) @definition.namespace

(interface_declaration
  name: (type_identifier) @name.definition.interface
  type_parameters: (type_parameters)?) @definition.interface

(type_alias_declaration
  name: (type_identifier) @name.definition.type
  type_parameters: (type_parameters)?) @definition.type

(type_alias_declaration
  name: (type_identifier) @name.definition.utility_type) @definition.utility_type

(public_field_definition
  name: (property_identifier) @name.definition.property) @definition.property

(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

(method_definition
  name: (property_identifier) @name.definition.accessor) @definition.accessor

(function_declaration
  name: (identifier) @name.definition.async_function) @definition.async_function

(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.async_arrow
    value: (arrow_function))) @definition.async_arrow
`

/**
 * Enhanced TypeScript queries for extracting additional metadata
 * These queries capture generics, decorators, inheritance, and other advanced type information
 */
export const typescriptEnhancedQuery = `
; Generic type parameters
(type_parameter
  name: (type_identifier) @generic.name)

; Decorators
(decorator
  (identifier) @decorator.name)

; Type aliases
(type_alias_declaration
  name: (type_identifier) @typealias.name)

; Interface declarations
(interface_declaration
  name: (type_identifier) @interface.name)

; Class declarations
(class_declaration
  name: (type_identifier) @class.name)

; Function signatures
(function_signature
  name: (identifier) @func.name)

; Method signatures
(method_signature
  name: (property_identifier) @method.name)

; Import statements
(import_statement
  source: (string) @import.source)

; Accessibility modifiers
(accessibility_modifier) @modifier.access

; Readonly modifier
("readonly") @modifier.readonly

; Properties
(public_field_definition
  name: (property_identifier) @property.name)

; Enum declarations
(enum_declaration
  name: (identifier) @enum.name)
`

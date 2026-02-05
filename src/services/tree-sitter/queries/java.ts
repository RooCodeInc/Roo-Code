/*
Query patterns for Java language structures
*/
export default `
(module_declaration
  name: (scoped_identifier) @name.definition.module) @definition.module

((package_declaration
  (scoped_identifier)) @name.definition.package) @definition.package

(line_comment) @definition.comment

(class_declaration
  name: (identifier) @name.definition.class) @definition.class

(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface

(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

(record_declaration
  name: (identifier) @name.definition.record) @definition.record

(annotation_type_declaration
  name: (identifier) @name.definition.annotation) @definition.annotation

(constructor_declaration
  name: (identifier) @name.definition.constructor) @definition.constructor

(method_declaration
  name: (identifier) @name.definition.method) @definition.method

(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.inner_class))) @definition.inner_class

(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.static_nested_class))) @definition.static_nested_class

(lambda_expression) @definition.lambda

(field_declaration
  (modifiers)?
  type: (_)
  declarator: (variable_declarator
    name: (identifier) @name.definition.field)) @definition.field

(import_declaration
  (scoped_identifier) @name.definition.import) @definition.import

(type_parameters
  (type_parameter) @name.definition.type_parameter) @definition.type_parameter
`

/**
 * Enhanced Java queries for extracting additional metadata
 * These queries capture annotations, generic types, enum members, interface extends, and other advanced features
 */
export const javaEnhancedQuery = `
; Annotation type declaration
(annotation_type_declaration
  name: (identifier) @annotation.name)

; Annotation members
(annotation_type_body
  (_) @annotation.member)

; Annotation on class
(class_declaration
  (modifiers
    (annotation
      name: (identifier) @annotation.class.name))?
  name: (identifier) @annotation.class.target)

; Annotation on method
(method_declaration
  (modifiers
    (annotation
      name: (identifier) @annotation.method.name))?
  name: (identifier) @annotation.method.target)

; Annotation on field
(field_declaration
  (modifiers
    (annotation
      name: (identifier) @annotation.field.name))?
  declarator: (variable_declarator
    name: (identifier) @annotation.field.target))

; Generic classes
(class_declaration
  name: (identifier) @generic.class.name)

; Generic interfaces
(interface_declaration
  name: (identifier) @generic.interface.name)

; Generic methods
(method_declaration
  name: (identifier) @generic.method.name)

; Enum declarations
(enum_declaration
  name: (identifier) @enum.name)

; Enum constants
(enum_constant
  name: (identifier) @enum.constant.name)

; Interface declarations
(interface_declaration
  name: (identifier) @interface.name)

; Class declarations
(class_declaration
  name: (identifier) @class.name)

; Import declarations
(import_declaration
  (scoped_identifier) @import.single.name)

; Record declarations
(record_declaration
  name: (identifier) @record.name)

; Parameters
(formal_parameter
  name: (identifier) @param.name)

; Method declarations
(method_declaration
  name: (identifier) @method.name)

; Constructor declarations
(constructor_declaration
  name: (identifier) @constructor.name)

; Type parameters
(type_parameter) @type_parameter
`

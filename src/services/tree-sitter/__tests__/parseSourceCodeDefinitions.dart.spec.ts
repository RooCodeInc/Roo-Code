import { testParseSourceCodeDefinitions, debugLog } from "./helpers"
import { dartQuery } from "../queries"

// Dart test options
const dartOptions = {
	language: "dart",
	wasmFile: "tree-sitter-dart.wasm",
	queryString: dartQuery,
	extKey: "dart",
}

describe("parseSourceCodeDefinitionsForFile with Dart", () => {
	let parseResult: string | undefined

	beforeAll(async () => {
		const dartCode = `
// Class definition with constructor
class MyClass {
  String name;
  int age;
  
  MyClass(this.name, this.age);
  
  void greet() {
    print('Hello, \$name!');
  }
  
  String get description => 'Name: \$name, Age: \$age';
  
  set description(String value) {
    // setter implementation
  }
}

// Factory constructor
class LoggerFactory {
  LoggerFactory._();
  
  factory LoggerFactory.create() {
    return LoggerFactory._();
  }
}

// Mixin declaration
mixin MyMixin {
  void mixinMethod() {
    print('Mixin method called');
  }
}

// Extension declaration
extension StringExtension on String {
  int get length => this.length;
  
  String capitalize() {
    return '\${this[0].toUpperCase()}\${substring(1)}';
  }
}

// Enum declaration
enum Status {
  active,
  inactive,
  pending;
  
  String get displayName {
    switch (this) {
      case Status.active:
        return 'Active';
      case Status.inactive:
        return 'Inactive';
      case Status.pending:
        return 'Pending';
    }
  }
}

// Type alias
typedef MyType = Map<String, int>;
typedef Callback = void Function(String);

// Standalone function
void mainFunction() {
  var instance = MyClass('test', 25);
  instance.greet();
  
  var logger = LoggerFactory.create();
  
  var status = Status.active;
  print(status.displayName);
}

// Function with parameters
String formatUser(String name, int age) {
  return '\$name is \$age years old';
}

// Operator overloading
class Vector {
  final double x, y;
  
  Vector(this.x, this.y);
  
  Vector operator +(Vector other) {
    return Vector(x + other.x, y + other.y);
  }
  
  bool operator ==(Object other) {
    return other is Vector && x == other.x && y == other.y;
  }
}

// Class with mixin
class EnhancedClass with MyMixin {
  void doSomething() {
    mixinMethod();
  }
}

// Generic class
class Container<T> {
  T value;
  
  Container(this.value);
  
  T get() => value;
  
  void set(T newValue) {
    value = newValue;
  }
}

// Abstract class
abstract class Shape {
  double get area;
  
  void draw();
}

// Interface-like class
class Drawable {
  void render() {}
}

// Static methods and properties
class MathUtils {
  static const double pi = 3.14159;
  
  static double circleArea(double radius) {
    return pi * radius * radius;
  }
}

// Cascade notation usage
void cascadeExample() {
  var builder = StringBuilder()
    ..write('Hello')
    ..write(' ')
    ..write('World')
    ..toString();
}

class StringBuilder {
  String _buffer = '';
  
  void write(String text) {
    _buffer += text;
  }
  
  String toString() => _buffer;
}
`
		parseResult = await testParseSourceCodeDefinitions("test.dart", dartCode, dartOptions)
		debugLog("Dart Parse Result:", parseResult)
	})

	it("should parse class definitions", () => {
		expect(parseResult).toMatch(/class MyClass \{/)
		expect(parseResult).toMatch(/class LoggerFactory \{/)
		expect(parseResult).toMatch(/class Vector \{/)
		expect(parseResult).toMatch(/class EnhancedClass with/)
		expect(parseResult).toMatch(/class Container</)
		expect(parseResult).toMatch(/abstract class Shape \{/)
		expect(parseResult).toMatch(/class Drawable \{/)
		expect(parseResult).toMatch(/class MathUtils \{/)
		expect(parseResult).toMatch(/class StringBuilder \{/)
	})

	it("should parse method definitions", () => {
		expect(parseResult).toMatch(/greet/)
		expect(parseResult).toMatch(/description/) // getter
		expect(parseResult).toMatch(/create/) // factory constructor
		expect(parseResult).toMatch(/operator \+/) // operator
		expect(parseResult).toMatch(/operator ==/) // operator
		expect(parseResult).toMatch(/doSomething/)
		expect(parseResult).toMatch(/get/)
		expect(parseResult).toMatch(/set/)
		expect(parseResult).toMatch(/render/)
		expect(parseResult).toMatch(/circleArea/)
		expect(parseResult).toMatch(/write/)
		expect(parseResult).toMatch(/toString/)
	})

	it("should parse mixin declarations", () => {
		expect(parseResult).toMatch(/mixin MyMixin/)
	})

	it("should parse extension declarations", () => {
		expect(parseResult).toMatch(/extension StringExtension/)
	})

	it("should parse enum declarations", () => {
		expect(parseResult).toMatch(/enum Status/)
	})

	it("should parse type aliases", () => {
		expect(parseResult).toMatch(/typedef MyType/)
		expect(parseResult).toMatch(/typedef Callback/)
	})

	it("should parse function definitions", () => {
		expect(parseResult).toMatch(/mainFunction/)
		expect(parseResult).toMatch(/formatUser/)
		expect(parseResult).toMatch(/cascadeExample/)
	})

	it("should handle constructor definitions", () => {
		expect(parseResult).toMatch(/MyClass\(/) // constructor
		expect(parseResult).toMatch(/Vector\(/) // constructor
		expect(parseResult).toMatch(/Container\(/) // constructor
	})

	it("should handle getter and setter definitions", () => {
		expect(parseResult).toMatch(/get description/)
		expect(parseResult).toMatch(/set description/)
		expect(parseResult).toMatch(/get area/)
		expect(parseResult).toMatch(/get length/) // extension getter
	})

	it("should handle operator definitions", () => {
		expect(parseResult).toMatch(/operator \+/)
		expect(parseResult).toMatch(/operator ==/)
	})

	it("should handle factory constructors", () => {
		expect(parseResult).toMatch(/factory LoggerFactory\.create\(/)
	})

	it("should handle generic classes", () => {
		expect(parseResult).toMatch(/class Container/)
	})

	it("should handle abstract classes", () => {
		expect(parseResult).toMatch(/abstract class Shape/)
	})

	it("should handle static methods and properties", () => {
		expect(parseResult).toMatch(/static double circleArea/)
	})
})

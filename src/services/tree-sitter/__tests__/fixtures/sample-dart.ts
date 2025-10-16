export default String.raw`
// Library directive
library my_flutter_app;

// Import statements
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// Export statement
export 'src/models/user.dart';

// Part directive
part 'src/utils/helpers.dart';

// Type alias - at least 4 lines
typedef JsonMap = Map<String, dynamic>;
typedef AsyncCallback<T> = Future<T> Function(
  String message,
  int retryCount,
);

// Abstract class - at least 4 lines
abstract class BaseRepository<T> {
  final String endpoint;
  final http.Client client;
  
  BaseRepository({
    required this.endpoint,
    required this.client,
  });
  
  // Abstract method
  Future<T> fetchData(
    String id,
    Map<String, String> headers,
  );
  
  // Concrete method - at least 4 lines
  Future<List<T>> fetchAll({
    int limit = 10,
    int offset = 0,
  }) async {
    final response = await client.get(
      Uri.parse('$endpoint?limit=$limit&offset=$offset'),
    );
    return parseResponse(response.body);
  }
  
  List<T> parseResponse(String body);
}

// Mixin declaration - at least 4 lines
mixin ValidationMixin {
  bool isEmailValid(String email) {
    return RegExp(
      r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$',
    ).hasMatch(email);
  }
  
  bool isPasswordStrong(
    String password,
    {int minLength = 8}
  ) {
    return password.length >= minLength &&
           password.contains(RegExp(r'[A-Z]')) &&
           password.contains(RegExp(r'[0-9]'));
  }
}

// Enum declaration - at least 4 lines
enum UserRole {
  admin('Administrator', 3),
  moderator('Moderator', 2),
  user('Regular User', 1),
  guest('Guest', 0);
  
  final String displayName;
  final int level;
  
  const UserRole(
    this.displayName,
    this.level,
  );
}

// Main class with various features - at least 4 lines
class UserService extends BaseRepository<User>
    with ValidationMixin {
  static final UserService _instance = UserService._internal();
  
  // Factory constructor - at least 4 lines
  factory UserService({
    required http.Client client,
    String? customEndpoint,
  }) {
    _instance._client = client;
    _instance._endpoint = customEndpoint ?? '/api/users';
    return _instance;
  }
  
  // Private constructor
  UserService._internal() : super(
    endpoint: '/api/users',
    client: http.Client(),
  );
  
  late http.Client _client;
  late String _endpoint;
  
  // Getter - at least 4 lines
  String get currentEndpoint {
    if (_endpoint.isEmpty) {
      return '/api/users';
    }
    return _endpoint;
  }
  
  // Setter - at least 4 lines
  set currentEndpoint(String value) {
    if (value.isNotEmpty && value.startsWith('/')) {
      _endpoint = value;
      print('Endpoint updated to: $_endpoint');
    }
  }
  
  // Override abstract method - at least 4 lines
  @override
  Future<User> fetchData(
    String id,
    Map<String, String> headers,
  ) async {
    final response = await _client.get(
      Uri.parse('$_endpoint/$id'),
      headers: headers,
    );
    
    if (response.statusCode == 200) {
      return User.fromJson(response.body);
    }
    throw Exception('Failed to load user');
  }
  
  // Async method - at least 4 lines
  Future<User?> createUser({
    required String email,
    required String password,
    UserRole role = UserRole.user,
  }) async {
    if (!isEmailValid(email)) {
      throw ArgumentError('Invalid email format');
    }
    
    if (!isPasswordStrong(password)) {
      throw ArgumentError('Password is too weak');
    }
    
    final response = await _client.post(
      Uri.parse(_endpoint),
      body: {
        'email': email,
        'password': password,
        'role': role.name,
      },
    );
    
    return response.statusCode == 201
        ? User.fromJson(response.body)
        : null;
  }
  
  // Generator function (sync*) - at least 4 lines
  Iterable<int> generateUserIds({
    int start = 1,
    int count = 10,
  }) sync* {
    for (int i = start; i < start + count; i++) {
      yield i;
    }
  }
  
  // Async generator (async*) - at least 4 lines
  Stream<User> streamUsers({
    Duration interval = const Duration(seconds: 1),
    int maxUsers = 5,
  }) async* {
    for (int i = 0; i < maxUsers; i++) {
      await Future.delayed(interval);
      yield User(id: i, email: 'user$i@example.com');
    }
  }
  
  // Operator overloading - at least 4 lines
  operator [](String userId) {
    return fetchData(
      userId,
      {'Authorization': 'Bearer token'},
    );
  }
  
  @override
  List<User> parseResponse(String body) {
    // Implementation would parse JSON to List<User>
    return [];
  }
}

// Extension declaration - at least 4 lines
extension StringExtensions on String {
  String capitalize() {
    if (isEmpty) return this;
    return '\${this[0].toUpperCase()}\${substring(1)}';
  }
  
  bool get isValidEmail {
    return RegExp(
      r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$',
    ).hasMatch(this);
  }
}

// Model class - at least 4 lines
class User {
  final int id;
  final String email;
  final UserRole role;
  final DateTime createdAt;
  
  // Constructor with optional parameters - at least 4 lines
  User({
    required this.id,
    required this.email,
    this.role = UserRole.user,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();
  
  // Named constructor - at least 4 lines
  User.fromJson(String json) : 
    id = 0,
    email = '',
    role = UserRole.user,
    createdAt = DateTime.now() {
    // Parse JSON implementation
  }
  
  // Method with lambda - at least 4 lines
  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'role': role.name,
    'createdAt': createdAt.toIso8601String(),
  };
}

// Top-level function - at least 4 lines
Future<void> initializeApp({
  required String apiKey,
  bool enableLogging = false,
}) async {
  print('Initializing app with API key: $apiKey');
  await Future.delayed(Duration(seconds: 2));
  
  if (enableLogging) {
    print('Logging enabled');
  }
}

// Top-level variable declarations - at least 4 lines
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
const String appVersion = '1.0.0';
late final SharedPreferences prefs;
var currentTheme = ThemeMode.system;

// Lambda/Anonymous function assignment - at least 4 lines
final formatDate = (DateTime date, {String format = 'yyyy-MM-dd'}) {
  final year = date.year.toString();
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
};

// Widget class (Flutter specific) - at least 4 lines
class MyHomePage extends StatefulWidget {
  final String title;
  final VoidCallback? onPressed;
  
  const MyHomePage({
    Key? key,
    required this.title,
    this.onPressed,
  }) : super(key: key);
  
  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

// State class - at least 4 lines
class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;
  
  void _incrementCounter() {
    setState(() {
      _counter++;
      print('Counter incremented to: $_counter');
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'You have pushed the button this many times:',
            ),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: Icon(Icons.add),
      ),
    );
  }
}
`

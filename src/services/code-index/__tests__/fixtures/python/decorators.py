"""
Test fixture: Python decorators and metaclasses

Tests:
- Function decorators
- Class decorators
- Decorator factories
- Method decorators
- Metaclasses
- Property decorators
"""

from functools import wraps
from typing import Callable, Any, Type
import time


# Simple function decorator
def log_calls(func: Callable) -> Callable:
    """Log function calls"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
        result = func(*args, **kwargs)
        print(f"{func.__name__} returned {result}")
        return result
    return wrapper


# Decorator with arguments
def repeat(times: int):
    """Repeat function execution"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            results = []
            for _ in range(times):
                results.append(func(*args, **kwargs))
            return results
        return wrapper
    return decorator


# Class decorator
def singleton(cls: Type) -> Type:
    """Make a class a singleton"""
    instances = {}
    
    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    
    return get_instance


# Method decorator
def validate_positive(func: Callable) -> Callable:
    """Validate that first argument is positive"""
    @wraps(func)
    def wrapper(self, value, *args, **kwargs):
        if value <= 0:
            raise ValueError("Value must be positive")
        return func(self, value, *args, **kwargs)
    return wrapper


# Metaclass
class SingletonMeta(type):
    """Metaclass for singleton pattern"""
    _instances = {}
    
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


# Class using metaclass
class Database(metaclass=SingletonMeta):
    """Database connection using singleton metaclass"""
    
    def __init__(self):
        self.connection = None
    
    def connect(self, connection_string: str):
        """Connect to database"""
        self.connection = connection_string
        print(f"Connected to {connection_string}")


# Property decorators
class Temperature:
    """Temperature class with property decorators"""
    
    def __init__(self, celsius: float = 0):
        self._celsius = celsius
    
    @property
    def celsius(self) -> float:
        """Get temperature in Celsius"""
        return self._celsius
    
    @celsius.setter
    def celsius(self, value: float):
        """Set temperature in Celsius"""
        if value < -273.15:
            raise ValueError("Temperature below absolute zero")
        self._celsius = value
    
    @property
    def fahrenheit(self) -> float:
        """Get temperature in Fahrenheit"""
        return self._celsius * 9/5 + 32
    
    @fahrenheit.setter
    def fahrenheit(self, value: float):
        """Set temperature in Fahrenheit"""
        self.celsius = (value - 32) * 5/9


# Chaining decorators
@log_calls
@repeat(3)
def greet(name: str) -> str:
    """Greet a person"""
    return f"Hello, {name}!"


# Class decorator with arguments
def add_methods(**methods):
    """Add methods to a class"""
    def decorator(cls: Type) -> Type:
        for name, method in methods.items():
            setattr(cls, name, method)
        return cls
    return decorator


# Using class decorator
@add_methods(
    greet=lambda self: f"Hello from {self.name}",
    farewell=lambda self: f"Goodbye from {self.name}"
)
class Person:
    def __init__(self, name: str):
        self.name = name


# Decorator for caching
def cache(func: Callable) -> Callable:
    """Cache function results"""
    cached_results = {}
    
    @wraps(func)
    def wrapper(*args):
        if args not in cached_results:
            cached_results[args] = func(*args)
        return cached_results[args]
    
    return wrapper


# Decorator for timing
def timing(func: Callable) -> Callable:
    """Time function execution"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.4f}s")
        return result
    return wrapper


# Decorator for type checking
def type_check(**type_hints):
    """Check argument types"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Simple type checking
            for arg_name, expected_type in type_hints.items():
                if arg_name in kwargs:
                    if not isinstance(kwargs[arg_name], expected_type):
                        raise TypeError(
                            f"{arg_name} must be {expected_type.__name__}"
                        )
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Using multiple decorators
@timing
@cache
def fibonacci(n: int) -> int:
    """Calculate Fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)


# Context manager decorator
from contextlib import contextmanager

@contextmanager
def managed_resource(name: str):
    """Manage a resource"""
    print(f"Acquiring {name}")
    try:
        yield name
    finally:
        print(f"Releasing {name}")


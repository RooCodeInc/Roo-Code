"""
Test fixture: Python functions with various patterns

Tests:
- Regular functions
- Lambda functions
- Decorators
- Type hints
- Generators
- Async functions
- *args and **kwargs
"""

from typing import List, Dict, Optional, Callable, TypeVar, Generic
from functools import wraps
import asyncio


# Basic function with type hints
def calculate_sum(a: int, b: int) -> int:
    """Calculate sum of two numbers"""
    return a + b


# Function with default arguments
def greet(name: str, greeting: str = "Hello") -> str:
    """Greet a person"""
    return f"{greeting}, {name}!"


# Function with *args and **kwargs
def flexible_function(*args, **kwargs) -> Dict:
    """Function that accepts any arguments"""
    return {
        'args': args,
        'kwargs': kwargs,
        'total_args': len(args) + len(kwargs)
    }


# Lambda function
multiply = lambda x, y: x * y


# Generator function
def fibonacci(limit: int):
    """Generate Fibonacci sequence"""
    a, b = 0, 1
    for _ in range(limit):
        yield a
        a, b = b, a + b


# Decorator function
def timer(func: Callable) -> Callable:
    """Decorator to time function execution"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        import time
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"{func.__name__} took {end - start:.4f} seconds")
        return result
    return wrapper


# Decorator with arguments
def retry(max_attempts: int = 3, delay: float = 1.0):
    """Decorator to retry function on failure"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            import time
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
                    print(f"Attempt {attempt + 1} failed: {e}")
                    time.sleep(delay * (2 ** attempt))
        return wrapper
    return decorator


# Async function
async def fetch_data(url: str) -> Dict:
    """Fetch data from URL asynchronously"""
    await asyncio.sleep(0.1)  # Simulate network delay
    return {'url': url, 'data': 'sample data'}


# Async generator
async def async_range(start: int, end: int):
    """Async generator for range"""
    for i in range(start, end):
        await asyncio.sleep(0.01)
        yield i


# Higher-order function
def create_multiplier(factor: int) -> Callable[[int], int]:
    """Create a multiplier function"""
    def multiplier(x: int) -> int:
        return x * factor
    return multiplier


# Function with type variables (generic)
T = TypeVar('T')

def first_or_none(items: List[T]) -> Optional[T]:
    """Get first item or None"""
    return items[0] if items else None


# Closure example
def create_counter(initial: int = 0):
    """Create a counter with closure"""
    count = initial
    
    def increment():
        nonlocal count
        count += 1
        return count
    
    def decrement():
        nonlocal count
        count -= 1
        return count
    
    def get_value():
        return count
    
    return {
        'increment': increment,
        'decrement': decrement,
        'get_value': get_value
    }


# Memoization decorator
def memoize(func: Callable) -> Callable:
    """Memoize function results"""
    cache = {}
    
    @wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
        return cache[args]
    
    return wrapper


# Recursive function with memoization
@memoize
def factorial(n: int) -> int:
    """Calculate factorial recursively"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)


# Function composition
def compose(*functions: Callable) -> Callable:
    """Compose multiple functions"""
    def inner(arg):
        result = arg
        for func in reversed(functions):
            result = func(result)
        return result
    return inner


# Partial application
def partial(func: Callable, *partial_args, **partial_kwargs) -> Callable:
    """Create partial function"""
    def wrapper(*args, **kwargs):
        combined_args = partial_args + args
        combined_kwargs = {**partial_kwargs, **kwargs}
        return func(*combined_args, **combined_kwargs)
    return wrapper


# Context manager function
from contextlib import contextmanager

@contextmanager
def timer_context(name: str):
    """Context manager for timing code blocks"""
    import time
    start = time.time()
    try:
        yield
    finally:
        end = time.time()
        print(f"{name} took {end - start:.4f} seconds")


# Using the decorator
@timer
@retry(max_attempts=3, delay=0.5)
def risky_operation(value: int) -> int:
    """Operation that might fail"""
    if value < 0:
        raise ValueError("Value must be positive")
    return value * 2


"""
Test fixture: Python classes with inheritance and magic methods

Tests:
- Class definitions
- Inheritance
- Magic methods (__init__, __str__, __repr__, etc.)
- Class methods and static methods
- Properties and decorators
- Abstract base classes
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime


class Entity(ABC):
    """Abstract base class for all entities"""
    
    def __init__(self, entity_id: str):
        self.id = entity_id
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    @abstractmethod
    def validate(self) -> bool:
        """Validate the entity"""
        pass
    
    def touch(self) -> None:
        """Update the updated_at timestamp"""
        self.updated_at = datetime.now()
    
    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id})"


class User(Entity):
    """User class with authentication"""
    
    def __init__(self, user_id: str, email: str, username: str):
        super().__init__(user_id)
        self._email = email
        self.username = username
        self._password_hash = None
        self._roles = ['user']
    
    @property
    def email(self) -> str:
        """Get user email"""
        return self._email
    
    @email.setter
    def email(self, value: str) -> None:
        """Set user email with validation"""
        if '@' not in value:
            raise ValueError("Invalid email format")
        self._email = value.lower().strip()
        self.touch()
    
    def validate(self) -> bool:
        """Validate user data"""
        return '@' in self._email and len(self.username) > 0
    
    def set_password(self, password: str) -> None:
        """Set user password (simplified hashing)"""
        import hashlib
        self._password_hash = hashlib.sha256(password.encode()).hexdigest()
        self.touch()
    
    def check_password(self, password: str) -> bool:
        """Check if password matches"""
        import hashlib
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return self._password_hash == password_hash
    
    def add_role(self, role: str) -> None:
        """Add a role to the user"""
        if role not in self._roles:
            self._roles.append(role)
            self.touch()
    
    def has_role(self, role: str) -> bool:
        """Check if user has a specific role"""
        return role in self._roles
    
    def __str__(self) -> str:
        return f"User({self.username}, {self._email})"
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, User):
            return False
        return self.id == other.id


class AdminUser(User):
    """Admin user with additional permissions"""
    
    _admin_count = 0
    
    def __init__(self, user_id: str, email: str, username: str):
        super().__init__(user_id, email, username)
        self._permissions = {'read', 'write', 'delete'}
        self.add_role('admin')
        AdminUser._admin_count += 1
    
    @classmethod
    def get_admin_count(cls) -> int:
        """Get total number of admin users"""
        return cls._admin_count
    
    @staticmethod
    def is_valid_permission(permission: str) -> bool:
        """Check if permission is valid"""
        valid_permissions = {'read', 'write', 'delete', 'admin'}
        return permission in valid_permissions
    
    def grant_permission(self, permission: str) -> None:
        """Grant a permission to the admin"""
        if self.is_valid_permission(permission):
            self._permissions.add(permission)
            self.touch()
    
    def revoke_permission(self, permission: str) -> None:
        """Revoke a permission from the admin"""
        self._permissions.discard(permission)
        self.touch()
    
    def has_permission(self, permission: str) -> bool:
        """Check if admin has a specific permission"""
        return permission in self._permissions
    
    def validate(self) -> bool:
        """Validate admin user"""
        return super().validate() and len(self._permissions) > 0


class UserService:
    """Singleton service for managing users"""
    
    _instance: Optional['UserService'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._users = {}
        return cls._instance
    
    def create_user(self, email: str, username: str) -> User:
        """Create a new user"""
        import uuid
        user_id = str(uuid.uuid4())
        user = User(user_id, email, username)
        self._users[user_id] = user
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self._users.get(user_id)
    
    def delete_user(self, user_id: str) -> bool:
        """Delete a user"""
        if user_id in self._users:
            del self._users[user_id]
            return True
        return False
    
    def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email"""
        for user in self._users.values():
            if user.email == email:
                return user
        return None
    
    def __len__(self) -> int:
        return len(self._users)
    
    def __iter__(self):
        return iter(self._users.values())


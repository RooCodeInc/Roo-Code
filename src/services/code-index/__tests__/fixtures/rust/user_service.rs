/**
 * Test fixture: Rust structs, traits, and enums
 * 
 * Tests:
 * - Struct definitions
 * - Traits (interfaces)
 * - Enums and pattern matching
 * - Ownership and borrowing
 * - Error handling with Result
 */

use std::collections::HashMap;
use std::time::SystemTime;

// Trait definition (like interface)
pub trait Entity {
    fn get_id(&self) -> &str;
    fn validate(&self) -> bool;
}

// Base entity struct
#[derive(Debug, Clone)]
pub struct BaseEntity {
    pub id: String,
    pub created_at: SystemTime,
    pub updated_at: SystemTime,
}

impl BaseEntity {
    pub fn new(id: String) -> Self {
        let now = SystemTime::now();
        Self {
            id,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn touch(&mut self) {
        self.updated_at = SystemTime::now();
    }
}

// User struct
#[derive(Debug, Clone)]
pub struct User {
    base: BaseEntity,
    pub email: String,
    pub username: String,
    password_hash: Option<String>,
    roles: Vec<String>,
}

impl User {
    pub fn new(id: String, email: String, username: String) -> Self {
        Self {
            base: BaseEntity::new(id),
            email,
            username,
            password_hash: None,
            roles: vec!["user".to_string()],
        }
    }

    pub fn add_role(&mut self, role: String) {
        if !self.roles.contains(&role) {
            self.roles.push(role);
            self.base.touch();
        }
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }

    pub fn set_password(&mut self, password: &str) {
        // Simplified password hashing
        self.password_hash = Some(format!("hashed_{}", password));
        self.base.touch();
    }
}

impl Entity for User {
    fn get_id(&self) -> &str {
        &self.base.id
    }

    fn validate(&self) -> bool {
        self.email.contains('@') && !self.username.is_empty()
    }
}

// Error enum
#[derive(Debug)]
pub enum UserError {
    NotFound,
    AlreadyExists,
    ValidationError(String),
}

// Result type alias
pub type UserResult<T> = Result<T, UserError>;

// Repository trait
pub trait Repository<T> {
    fn find_by_id(&self, id: &str) -> UserResult<T>;
    fn find_all(&self) -> Vec<T>;
    fn save(&mut self, entity: T) -> UserResult<()>;
    fn delete(&mut self, id: &str) -> UserResult<()>;
}

// User repository implementation
pub struct UserRepository {
    users: HashMap<String, User>,
}

impl UserRepository {
    pub fn new() -> Self {
        Self {
            users: HashMap::new(),
        }
    }

    pub fn find_by_email(&self, email: &str) -> Option<&User> {
        self.users.values().find(|u| u.email == email)
    }
}

impl Repository<User> for UserRepository {
    fn find_by_id(&self, id: &str) -> UserResult<User> {
        self.users
            .get(id)
            .cloned()
            .ok_or(UserError::NotFound)
    }

    fn find_all(&self) -> Vec<User> {
        self.users.values().cloned().collect()
    }

    fn save(&mut self, user: User) -> UserResult<()> {
        let id = user.get_id().to_string();
        self.users.insert(id, user);
        Ok(())
    }

    fn delete(&mut self, id: &str) -> UserResult<()> {
        self.users
            .remove(id)
            .map(|_| ())
            .ok_or(UserError::NotFound)
    }
}

// User service
pub struct UserService {
    repository: UserRepository,
}

impl UserService {
    pub fn new() -> Self {
        Self {
            repository: UserRepository::new(),
        }
    }

    pub fn create_user(&mut self, email: String, username: String) -> UserResult<User> {
        let id = uuid::Uuid::new_v4().to_string();
        let user = User::new(id, email, username);
        
        if !user.validate() {
            return Err(UserError::ValidationError("Invalid user data".to_string()));
        }
        
        self.repository.save(user.clone())?;
        Ok(user)
    }

    pub fn get_user(&self, id: &str) -> UserResult<User> {
        self.repository.find_by_id(id)
    }

    pub fn delete_user(&mut self, id: &str) -> UserResult<()> {
        self.repository.delete(id)
    }
}


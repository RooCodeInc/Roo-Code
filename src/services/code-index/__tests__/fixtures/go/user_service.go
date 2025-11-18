/**
 * Test fixture: Go structs, interfaces, and methods
 * 
 * Tests:
 * - Struct definitions
 * - Interfaces
 * - Methods
 * - Goroutines and channels
 * - Error handling
 */

package service

import (
	"errors"
	"sync"
	"time"
)

// Entity interface
type Entity interface {
	GetID() string
	Validate() bool
}

// BaseEntity struct
type BaseEntity struct {
	ID        string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// GetID returns the entity ID
func (e *BaseEntity) GetID() string {
	return e.ID
}

// Touch updates the UpdatedAt timestamp
func (e *BaseEntity) Touch() {
	e.UpdatedAt = time.Now()
}

// User struct
type User struct {
	BaseEntity
	Email        string
	Username     string
	PasswordHash string
	Roles        []string
}

// NewUser creates a new user
func NewUser(id, email, username string) *User {
	return &User{
		BaseEntity: BaseEntity{
			ID:        id,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Email:    email,
		Username: username,
		Roles:    []string{"user"},
	}
}

// Validate validates the user
func (u *User) Validate() bool {
	return len(u.Email) > 0 && len(u.Username) > 0
}

// AddRole adds a role to the user
func (u *User) AddRole(role string) {
	for _, r := range u.Roles {
		if r == role {
			return
		}
	}
	u.Roles = append(u.Roles, role)
	u.Touch()
}

// HasRole checks if user has a role
func (u *User) HasRole(role string) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// Repository interface
type Repository interface {
	FindByID(id string) (*User, error)
	FindAll() ([]*User, error)
	Save(user *User) error
	Delete(id string) error
}

// UserRepository implementation
type UserRepository struct {
	users map[string]*User
	mu    sync.RWMutex
}

// NewUserRepository creates a new repository
func NewUserRepository() *UserRepository {
	return &UserRepository{
		users: make(map[string]*User),
	}
}

// FindByID finds a user by ID
func (r *UserRepository) FindByID(id string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	user, exists := r.users[id]
	if !exists {
		return nil, errors.New("user not found")
	}
	return user, nil
}

// FindAll returns all users
func (r *UserRepository) FindAll() ([]*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	users := make([]*User, 0, len(r.users))
	for _, user := range r.users {
		users = append(users, user)
	}
	return users, nil
}

// Save saves a user
func (r *UserRepository) Save(user *User) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	r.users[user.ID] = user
	return nil
}

// Delete deletes a user
func (r *UserRepository) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	delete(r.users, id)
	return nil
}

// UserService service
type UserService struct {
	repo Repository
}

// NewUserService creates a new service
func NewUserService(repo Repository) *UserService {
	return &UserService{repo: repo}
}

// CreateUser creates a new user
func (s *UserService) CreateUser(email, username string) (*User, error) {
	user := NewUser(generateID(), email, username)
	if err := s.repo.Save(user); err != nil {
		return nil, err
	}
	return user, nil
}

// GetUser gets a user by ID
func (s *UserService) GetUser(id string) (*User, error) {
	return s.repo.FindByID(id)
}

// Helper function
func generateID() string {
	return "user-" + time.Now().Format("20060102150405")
}


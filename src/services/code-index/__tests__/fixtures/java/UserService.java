/**
 * Test fixture: Java classes with generics and interfaces
 * 
 * Tests:
 * - Class definitions
 * - Interfaces
 * - Generics
 * - Inheritance
 * - Annotations
 */

package com.example.service;

import java.util.*;
import java.time.LocalDateTime;

// Interface definition
public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void delete(ID id);
    boolean exists(ID id);
}

// Abstract base class
abstract class Entity {
    protected String id;
    protected LocalDateTime createdAt;
    protected LocalDateTime updatedAt;
    
    public Entity(String id) {
        this.id = id;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    public String getId() {
        return id;
    }
    
    public abstract boolean validate();
    
    protected void touch() {
        this.updatedAt = LocalDateTime.now();
    }
}

// User class
class User extends Entity {
    private String email;
    private String username;
    private String passwordHash;
    private List<String> roles;
    
    public User(String id, String email, String username) {
        super(id);
        this.email = email;
        this.username = username;
        this.roles = new ArrayList<>();
        this.roles.add("user");
    }
    
    @Override
    public boolean validate() {
        return email.contains("@") && !username.isEmpty();
    }
    
    public String getEmail() {
        return email;
    }
    
    public void setEmail(String email) {
        this.email = email;
        touch();
    }
    
    public String getUsername() {
        return username;
    }
    
    public void addRole(String role) {
        if (!roles.contains(role)) {
            roles.add(role);
            touch();
        }
    }
    
    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}

// Generic repository implementation
class UserRepository implements Repository<User, String> {
    private Map<String, User> users;
    
    public UserRepository() {
        this.users = new HashMap<>();
    }
    
    @Override
    public Optional<User> findById(String id) {
        return Optional.ofNullable(users.get(id));
    }
    
    @Override
    public List<User> findAll() {
        return new ArrayList<>(users.values());
    }
    
    @Override
    public User save(User user) {
        users.put(user.getId(), user);
        return user;
    }
    
    @Override
    public void delete(String id) {
        users.remove(id);
    }
    
    @Override
    public boolean exists(String id) {
        return users.containsKey(id);
    }
    
    public Optional<User> findByEmail(String email) {
        return users.values().stream()
            .filter(u -> u.getEmail().equals(email))
            .findFirst();
    }
}

// Service class with dependency injection
public class UserService {
    private final UserRepository repository;
    private static UserService instance;
    
    private UserService(UserRepository repository) {
        this.repository = repository;
    }
    
    public static synchronized UserService getInstance(UserRepository repository) {
        if (instance == null) {
            instance = new UserService(repository);
        }
        return instance;
    }
    
    public User createUser(String email, String username) {
        String id = UUID.randomUUID().toString();
        User user = new User(id, email, username);
        return repository.save(user);
    }
    
    public Optional<User> getUser(String id) {
        return repository.findById(id);
    }
    
    public List<User> getAllUsers() {
        return repository.findAll();
    }
    
    public void deleteUser(String id) {
        repository.delete(id);
    }
    
    public Optional<User> findByEmail(String email) {
        return repository.findByEmail(email);
    }
}


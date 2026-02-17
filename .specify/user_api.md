## [INT-001] Create User API
Implement the POST /users endpoint that allows creating a new user with email, password, and role.
Requirements:
- Validate email format and password strength
- Return 201 on success with created user object
- Handle duplicate emails with proper error

## [INT-004] Get User API
Implement the GET /users/:id endpoint to retrieve user details by ID.
- Return 404 if user not found
- Include email, role, and creation timestamp

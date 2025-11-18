/**
 * Test fixture: Express.js routes and middleware
 * 
 * Tests:
 * - Route definitions
 * - Middleware functions
 * - Route parameters
 * - Query parameters
 * - Error handling
 * - Async route handlers
 */

const express = require('express')
const router = express.Router()

// Middleware: Authentication
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    // Simplified token verification
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Middleware: Authorization
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }

    next()
  }
}

// Middleware: Request logging
function logRequest(req, res, next) {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`)
  next()
}

// Middleware: Error handler
function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  })
}

// GET route: List all users
router.get('/users', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query
    const offset = (page - 1) * limit

    let query = 'SELECT * FROM users'
    const params = []

    if (search) {
      query += ' WHERE name LIKE ? OR email LIKE ?'
      params.push(`%${search}%`, `%${search}%`)
    }

    query += ' LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const users = await db.query(query, params)
    const total = await db.query('SELECT COUNT(*) as count FROM users')

    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0].count
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET route: Get user by ID
router.get('/users/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id])

    if (!user || user.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ data: user[0] })
  } catch (error) {
    next(error)
  }
})

// POST route: Create user
router.post('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, role = 'user' } = req.body

    // Validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length > 0) {
      return res.status(409).json({ error: 'User already exists' })
    }

    // Create user
    const result = await db.query(
      'INSERT INTO users (name, email, role) VALUES (?, ?, ?)',
      [name, email, role]
    )

    const newUser = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId])

    res.status(201).json({ data: newUser[0] })
  } catch (error) {
    next(error)
  }
})

// PUT route: Update user
router.put('/users/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, email } = req.body

    // Check if user can update (own profile or admin)
    if (req.user.id !== id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot update other users' })
    }

    const updates = []
    const params = []

    if (name) {
      updates.push('name = ?')
      params.push(name)
    }
    if (email) {
      updates.push('email = ?')
      params.push(email)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    params.push(id)
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)

    const updated = await db.query('SELECT * FROM users WHERE id = ?', [id])
    res.json({ data: updated[0] })
  } catch (error) {
    next(error)
  }
})

// DELETE route: Delete user
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params
    await db.query('DELETE FROM users WHERE id = ?', [id])
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Helper functions
function verifyToken(token) {
  // Simplified token verification
  return JSON.parse(Buffer.from(token, 'base64').toString())
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

module.exports = router


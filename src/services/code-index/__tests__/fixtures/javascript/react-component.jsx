/**
 * Test fixture: React components (class and functional)
 * 
 * Tests:
 * - Class components
 * - Functional components
 * - Hooks (useState, useEffect, useContext, custom hooks)
 * - Props and PropTypes
 * - Component composition
 */

import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'

// Context
const ThemeContext = createContext('light')

// Class component
export class UserCard extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isExpanded: false,
      loading: false
    }
  }

  componentDidMount() {
    console.log('UserCard mounted')
  }

  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) {
      this.fetchUserData()
    }
  }

  componentWillUnmount() {
    console.log('UserCard unmounting')
  }

  fetchUserData = async () => {
    this.setState({ loading: true })
    try {
      const response = await fetch(`/api/users/${this.props.userId}`)
      const data = await response.json()
      this.setState({ user: data, loading: false })
    } catch (error) {
      this.setState({ error, loading: false })
    }
  }

  toggleExpanded = () => {
    this.setState(prevState => ({ isExpanded: !prevState.isExpanded }))
  }

  render() {
    const { user, isExpanded, loading } = this.state
    const { className } = this.props

    if (loading) return <div>Loading...</div>
    if (!user) return null

    return (
      <div className={`user-card ${className}`}>
        <h3>{user.name}</h3>
        <button onClick={this.toggleExpanded}>
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
        {isExpanded && (
          <div className="user-details">
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
          </div>
        )}
      </div>
    )
  }
}

UserCard.propTypes = {
  userId: PropTypes.string.isRequired,
  className: PropTypes.string
}

UserCard.defaultProps = {
  className: ''
}

// Functional component with hooks
export function UserList({ users, onUserSelect }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const theme = useContext(ThemeContext)

  useEffect(() => {
    console.log('UserList rendered with', users.length, 'users')
  }, [users])

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy]))
  }, [users, searchTerm, sortBy])

  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value)
  }, [])

  return (
    <div className={`user-list theme-${theme}`}>
      <input
        type="text"
        placeholder="Search users..."
        value={searchTerm}
        onChange={handleSearch}
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        <option value="name">Name</option>
        <option value="email">Email</option>
      </select>
      <ul>
        {filteredUsers.map(user => (
          <li key={user.id} onClick={() => onUserSelect(user)}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  )
}

UserList.propTypes = {
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired
  })).isRequired,
  onUserSelect: PropTypes.func.isRequired
}

// Custom hook
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }, [key, storedValue])

  return [storedValue, setValue]
}


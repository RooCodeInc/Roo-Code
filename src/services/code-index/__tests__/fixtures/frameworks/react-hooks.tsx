/**
 * Test fixture: React hooks and modern patterns
 * 
 * Tests:
 * - useState, useEffect, useContext
 * - useReducer, useCallback, useMemo
 * - useRef, useLayoutEffect
 * - Custom hooks
 * - TypeScript with React
 */

import React, { 
  useState, 
  useEffect, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo, 
  useRef,
  createContext,
  FC,
  ReactNode
} from 'react'

// Context
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Custom hook: useTheme
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// Custom hook: useLocalStorage
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T) => {
    try {
      setStoredValue(value)
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(error)
    }
  }, [key])

  return [storedValue, setValue]
}

// Custom hook: useFetch
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch(url)
        const json = await response.json()
        
        if (!cancelled) {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [url])

  return { data, loading, error }
}

// Reducer for complex state
interface State {
  count: number
  history: number[]
}

type Action = 
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset' }

function counterReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return {
        count: state.count + 1,
        history: [...state.history, state.count + 1]
      }
    case 'decrement':
      return {
        count: state.count - 1,
        history: [...state.history, state.count - 1]
      }
    case 'reset':
      return {
        count: 0,
        history: [0]
      }
    default:
      return state
  }
}

// Component using useReducer
export const Counter: FC = () => {
  const [state, dispatch] = useReducer(counterReducer, {
    count: 0,
    history: [0]
  })

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>Reset</button>
      <p>History: {state.history.join(', ')}</p>
    </div>
  )
}

// Component using useCallback and useMemo
interface User {
  id: string
  name: string
  email: string
}

interface UserListProps {
  users: User[]
}

export const UserList: FC<UserListProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'email'>('name')

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a[sortBy].localeCompare(b[sortBy]))
  }, [users, searchTerm, sortBy])

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [])

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={handleSearch}
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'email')}>
        <option value="name">Name</option>
        <option value="email">Email</option>
      </select>
      <ul>
        {filteredUsers.map(user => (
          <li key={user.id}>{user.name} - {user.email}</li>
        ))}
      </ul>
    </div>
  )
}

// Component using useRef
export const FocusInput: FC = () => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={handleFocus}>Focus Input</button>
    </div>
  )
}


/**
 * Test fixture: JavaScript async patterns
 * 
 * Tests:
 * - Promises
 * - Async/await
 * - Promise.all, Promise.race, Promise.allSettled
 * - Error handling
 * - Async iterators
 */

// Basic promise
function fetchUser(userId) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (userId) {
        resolve({ id: userId, name: 'John Doe' })
      } else {
        reject(new Error('User ID is required'))
      }
    }, 100)
  })
}

// Promise chaining
function getUserWithPosts(userId) {
  return fetchUser(userId)
    .then(user => {
      return fetch(`/api/users/${user.id}/posts`)
        .then(response => response.json())
        .then(posts => ({ ...user, posts }))
    })
    .catch(error => {
      console.error('Error fetching user with posts:', error)
      throw error
    })
}

// Async/await
async function getUserData(userId) {
  try {
    const user = await fetchUser(userId)
    const response = await fetch(`/api/users/${user.id}/posts`)
    const posts = await response.json()
    return { ...user, posts }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

// Promise.all - parallel execution
async function fetchMultipleUsers(userIds) {
  try {
    const promises = userIds.map(id => fetchUser(id))
    const users = await Promise.all(promises)
    return users
  } catch (error) {
    console.error('Error fetching users:', error)
    throw error
  }
}

// Promise.allSettled - handle partial failures
async function fetchUsersWithFallback(userIds) {
  const promises = userIds.map(id => fetchUser(id))
  const results = await Promise.allSettled(promises)
  
  return {
    successful: results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value),
    failed: results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason)
  }
}

// Promise.race - timeout pattern
async function fetchWithTimeout(url, timeout = 5000) {
  const fetchPromise = fetch(url).then(r => r.json())
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeout)
  })
  
  return Promise.race([fetchPromise, timeoutPromise])
}

// Async generator
async function* fetchPaginatedData(baseUrl, maxPages = 10) {
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetch(`${baseUrl}?page=${page}`)
    const data = await response.json()
    
    if (data.items.length === 0) break
    
    yield data.items
  }
}

// Using async generator
async function getAllItems(baseUrl) {
  const allItems = []
  
  for await (const items of fetchPaginatedData(baseUrl)) {
    allItems.push(...items)
  }
  
  return allItems
}

// Retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Parallel execution with concurrency limit
async function parallelWithLimit(items, limit, asyncFn) {
  const results = []
  const executing = []
  
  for (const item of items) {
    const promise = asyncFn(item).then(result => {
      executing.splice(executing.indexOf(promise), 1)
      return result
    })
    
    results.push(promise)
    executing.push(promise)
    
    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }
  
  return Promise.all(results)
}

// Debounced async function
function debounceAsync(fn, delay) {
  let timeoutId = null
  let latestResolve = null
  let latestReject = null
  
  return function(...args) {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      latestResolve = resolve
      latestReject = reject
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args)
          latestResolve(result)
        } catch (error) {
          latestReject(error)
        }
      }, delay)
    })
  }
}

// Queue for sequential async operations
class AsyncQueue {
  constructor() {
    this.queue = []
    this.processing = false
  }
  
  async add(asyncFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ asyncFn, resolve, reject })
      this.process()
    })
  }
  
  async process() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true
    const { asyncFn, resolve, reject } = this.queue.shift()
    
    try {
      const result = await asyncFn()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.processing = false
      this.process()
    }
  }
}

module.exports = {
  fetchUser,
  getUserWithPosts,
  getUserData,
  fetchMultipleUsers,
  fetchUsersWithFallback,
  fetchWithTimeout,
  fetchPaginatedData,
  getAllItems,
  retryWithBackoff,
  parallelWithLimit,
  debounceAsync,
  AsyncQueue
}


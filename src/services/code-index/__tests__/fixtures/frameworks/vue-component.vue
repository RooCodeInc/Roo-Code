<template>
  <div class="user-profile" :class="{ 'dark-mode': isDarkMode }">
    <header>
      <h1>{{ user.name }}</h1>
      <button @click="toggleDarkMode">
        {{ isDarkMode ? '☀️' : '🌙' }}
      </button>
    </header>

    <section class="user-info">
      <div class="avatar">
        <img :src="user.avatar" :alt="user.name" />
      </div>
      
      <div class="details">
        <p><strong>Email:</strong> {{ user.email }}</p>
        <p><strong>Role:</strong> {{ userRole }}</p>
        <p><strong>Member since:</strong> {{ formattedDate }}</p>
      </div>
    </section>

    <section class="user-posts">
      <h2>Recent Posts ({{ filteredPosts.length }})</h2>
      
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search posts..."
        class="search-input"
      />

      <ul class="post-list">
        <li
          v-for="post in paginatedPosts"
          :key="post.id"
          class="post-item"
          @click="selectPost(post)"
        >
          <h3>{{ post.title }}</h3>
          <p>{{ post.excerpt }}</p>
          <span class="post-date">{{ formatDate(post.createdAt) }}</span>
        </li>
      </ul>

      <div class="pagination">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
        >
          Previous
        </button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
        >
          Next
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

// Props
interface Props {
  userId: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  postSelected: [post: Post]
  darkModeToggled: [isDark: boolean]
}>()

// Types
interface User {
  id: string
  name: string
  email: string
  avatar: string
  role: string
  createdAt: Date
}

interface Post {
  id: string
  title: string
  excerpt: string
  createdAt: Date
}

// State
const user = ref<User | null>(null)
const posts = ref<Post[]>([])
const searchQuery = ref('')
const currentPage = ref(1)
const postsPerPage = 10
const isDarkMode = ref(false)
const loading = ref(false)

// Computed
const userRole = computed(() => {
  return user.value?.role.toUpperCase() || 'GUEST'
})

const formattedDate = computed(() => {
  if (!user.value) return ''
  return new Date(user.value.createdAt).toLocaleDateString()
})

const filteredPosts = computed(() => {
  if (!searchQuery.value) return posts.value
  
  const query = searchQuery.value.toLowerCase()
  return posts.value.filter(post =>
    post.title.toLowerCase().includes(query) ||
    post.excerpt.toLowerCase().includes(query)
  )
})

const totalPages = computed(() => {
  return Math.ceil(filteredPosts.value.length / postsPerPage)
})

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * postsPerPage
  const end = start + postsPerPage
  return filteredPosts.value.slice(start, end)
})

// Methods
async function fetchUser() {
  loading.value = true
  try {
    const response = await fetch(`/api/users/${props.userId}`)
    user.value = await response.json()
  } catch (error) {
    console.error('Error fetching user:', error)
  } finally {
    loading.value = false
  }
}

async function fetchPosts() {
  try {
    const response = await fetch(`/api/users/${props.userId}/posts`)
    posts.value = await response.json()
  } catch (error) {
    console.error('Error fetching posts:', error)
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString()
}

function selectPost(post: Post) {
  emit('postSelected', post)
}

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value
  emit('darkModeToggled', isDarkMode.value)
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Lifecycle
onMounted(() => {
  fetchUser()
  fetchPosts()
})

// Watchers
watch(() => props.userId, () => {
  fetchUser()
  fetchPosts()
})

watch(searchQuery, () => {
  currentPage.value = 1
})
</script>

<style scoped>
.user-profile {
  padding: 20px;
  background: white;
  transition: background 0.3s;
}

.user-profile.dark-mode {
  background: #1a1a1a;
  color: white;
}

.search-input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
}

.post-list {
  list-style: none;
  padding: 0;
}

.post-item {
  padding: 15px;
  margin: 10px 0;
  border: 1px solid #ddd;
  cursor: pointer;
}

.post-item:hover {
  background: #f5f5f5;
}

.pagination {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}
</style>


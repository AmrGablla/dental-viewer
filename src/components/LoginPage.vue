<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">
            <Icon name="tooth" :size="48" color="#06b6d4" />
          </div>
          <h1>Dental Viewer</h1>
          <p>Sign in to access your cases</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              placeholder="Enter your username"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              placeholder="Enter your password"
              required
              :disabled="loading"
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <button type="submit" class="login-btn" :disabled="loading">
            <span v-if="loading">Signing in...</span>
            <span v-else>Sign In</span>
          </button>
        </form>

        <div class="login-footer">
          <p>Don't have an account? <a href="#" @click.prevent="showRegister = true">Register</a></p>
        </div>
      </div>

      <!-- Register Modal -->
      <div v-if="showRegister" class="modal-overlay" @click="showRegister = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h2>Create Account</h2>
            <button class="close-btn" @click="showRegister = false">
              <Icon name="x" :size="20" color="currentColor" />
            </button>
          </div>

          <form @submit.prevent="handleRegister" class="register-form">
            <div class="form-group">
              <label for="reg-username">Username</label>
              <input
                id="reg-username"
                v-model="registerForm.username"
                type="text"
                placeholder="Choose a username"
                required
                :disabled="registerLoading"
              />
            </div>

            <div class="form-group">
              <label for="reg-email">Email</label>
              <input
                id="reg-email"
                v-model="registerForm.email"
                type="email"
                placeholder="Enter your email"
                required
                :disabled="registerLoading"
              />
            </div>

            <div class="form-group">
              <label for="reg-password">Password</label>
              <input
                id="reg-password"
                v-model="registerForm.password"
                type="password"
                placeholder="Choose a password"
                required
                :disabled="registerLoading"
              />
            </div>

            <div v-if="registerError" class="error-message">
              {{ registerError }}
            </div>

            <button type="submit" class="register-btn" :disabled="registerLoading">
              <span v-if="registerLoading">Creating account...</span>
              <span v-else>Create Account</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'

const router = useRouter()

// Form data
const form = reactive({
  username: '',
  password: ''
})

const registerForm = reactive({
  username: '',
  email: '',
  password: ''
})

// State
const loading = ref(false)
const registerLoading = ref(false)
const error = ref('')
const registerError = ref('')
const showRegister = ref(false)

// API base URL
const API_BASE = 'http://localhost:3001/api'

// Login function
const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    // Store token and user data
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))

    // Redirect to cases page
    router.push('/cases')
  } catch (err: any) {
    error.value = err.message || 'Login failed'
  } finally {
    loading.value = false
  }
}

// Register function
const handleRegister = async () => {
  registerLoading.value = true
  registerError.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registerForm)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed')
    }

    // Auto-login after successful registration
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))

    showRegister.value = false
    router.push('/cases')
  } catch (err: any) {
    registerError.value = err.message || 'Registration failed'
  } finally {
    registerLoading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  margin-bottom: 16px;
}

.login-header h1 {
  margin: 0 0 8px 0;
  color: #f1f5f9;
  font-size: 28px;
  font-weight: 700;
}

.login-header p {
  margin: 0;
  color: #94a3b8;
  font-size: 16px;
}

.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #f1f5f9;
  font-weight: 600;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  font-size: 16px;
  transition: all 0.3s ease;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.6);
  color: #f1f5f9;
}

.form-group input:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.2);
  background: rgba(15, 23, 42, 0.8);
}

.form-group input::placeholder {
  color: #64748b;
}

.form-group input:disabled {
  background-color: rgba(15, 23, 42, 0.4);
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  border: 1px solid #fecaca;
}

.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.login-footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.login-footer p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.login-footer a {
  color: #06b6d4;
  text-decoration: none;
  font-weight: 600;
}

.login-footer a:hover {
  text-decoration: underline;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%);
  border-radius: 16px;
  padding: 30px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  color: #f1f5f9;
  font-size: 24px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(6, 182, 212, 0.1);
  color: #f1f5f9;
}

.register-form {
  margin-bottom: 0;
}

.register-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.register-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.register-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }
  
  .modal-content {
    padding: 20px;
  }
}
</style>

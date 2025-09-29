<template>
  <div class="cases-page">
    
    <AppHeader 
      description="Manage your dental cases and upload new files"
    >
      <template #actions>
        <div class="user-info">
          <span class="welcome-text">Welcome, <span class="username">{{ user?.username }}</span></span>
          <button @click="handleLogout" class="logout-btn">
            <Icon name="log-out" :size="16" color="currentColor" />
            Logout
          </button>
        </div>
      </template>
    </AppHeader>

    <div class="cases-content">
      <div class="actions-bar">
        <button @click="showUploadModal = true" class="upload-btn">
          <Icon name="upload" :size="16" color="white" />
          Upload New Case
        </button>
        <div class="search-box">
          <Icon name="search" :size="16" color="#6b7280" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search cases..."
            class="search-input"
          />
        </div>
      </div>

      <div class="cases-table-container">
        <div v-if="loading" class="loading-state">
          <div class="loading-logo-container">
            <img src="/logo-1x.png" srcset="/logo-1x.png 1x, /logo.png 2x" alt="Logo" class="loading-logo" fetchpriority="high" />
          </div>
          <p>Loading cases...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <Icon name="alert-circle" :size="48" color="#dc2626" />
          <h3>Error loading cases</h3>
          <p>{{ error }}</p>
          <button @click="loadCases" class="retry-btn">Try Again</button>
        </div>

        <div v-else-if="filteredCases.length === 0" class="empty-state">
          <Icon name="folder" :size="48" color="#6b7280" />
          <h3>No cases found</h3>
          <p>{{ searchQuery ? 'No cases match your search' : 'Upload your first case to get started' }}</p>
          <button v-if="!searchQuery" @click="showUploadModal = true" class="upload-btn">
            <Icon name="upload" :size="16" color="white" />
            Upload First Case
          </button>
        </div>

        <div v-else class="cases-table">
          <table>
            <thead>
              <tr>
                <th>Case Name</th>
                <th>File Name</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="caseItem in filteredCases" :key="caseItem.id" class="case-row">
                <td class="case-name">
                  <span class="name">{{ caseItem.case_name }}</span>
                </td>
                <td class="file-name">
                  <span>{{ caseItem.file_name }}</span>
                </td>
                <td class="status">
                  <span class="status-badge" :class="caseItem.status">
                    {{ caseItem.status }}
                  </span>
                </td>
                <td class="created">
                  {{ formatDate(caseItem.created_at) }}
                </td>
                <td class="actions">
                  <button @click="openCase(caseItem)" class="action-btn view-btn" title="Open Case">
                    <Icon name="eye" :size="14" color="currentColor" />
                  </button>
                  <button @click="uploadSegments(caseItem)" class="action-btn segment-btn" title="Upload Segments">
                    <Icon name="layers" :size="14" color="currentColor" />
                  </button>
                  <button @click="deleteCase(caseItem.id)" class="action-btn delete-btn" title="Delete Case">
                    <Icon name="trash-2" :size="14" color="currentColor" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="modal-overlay" @click="showUploadModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Upload New Case</h2>
          <button class="close-btn" @click="showUploadModal = false">
            <Icon name="x" :size="20" color="currentColor" />
          </button>
        </div>

        <form @submit.prevent="handleUpload" class="upload-form">
          <div class="form-group">
            <label for="case-name">Case Name</label>
            <input
              id="case-name"
              v-model="uploadForm.case_name"
              type="text"
              placeholder="Enter case name"
              required
              :disabled="uploading"
            />
          </div>

          <div class="form-group">
            <label for="file-upload">STL File</label>
            <div class="file-upload-area" :class="{ 'has-file': selectedFile }">
              <input
                id="file-upload"
                ref="fileInput"
                type="file"
                accept=".stl"
                @change="handleFileSelect"
                :disabled="uploading"
                style="display: none"
              />
              <div v-if="!selectedFile" class="upload-placeholder" @click="fileInput?.click()">
                <Icon name="upload" :size="32" color="#6b7280" />
                <p>Click to select STL file</p>
                <span>or drag and drop</span>
              </div>
              <div v-else class="file-info">
                <Icon name="file" :size="24" color="#51CACD" />
                <div class="file-details">
                  <span class="file-name">{{ selectedFile.name }}</span>
                  <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
                </div>
                <button type="button" @click="clearFile" class="clear-file-btn">
                  <Icon name="x" :size="16" color="currentColor" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="uploadError" class="error-message">
            {{ uploadError }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="showUploadModal = false" class="cancel-btn" :disabled="uploading">
              Cancel
            </button>
            <button type="submit" class="upload-submit-btn" :disabled="uploading || !selectedFile">
              <span v-if="uploading">Uploading...</span>
              <span v-else>Upload Case</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Segment Upload Modal -->
    <div v-if="showSegmentUploadModal" class="modal-overlay" @click="showSegmentUploadModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Upload Segment Files for {{ selectedCaseForSegments?.case_name }}</h2>
          <button class="close-btn" @click="showSegmentUploadModal = false">
            <Icon name="x" :size="20" color="currentColor" />
          </button>
        </div>

        <form @submit.prevent="handleSegmentUpload" class="upload-form">
          <div class="form-group">
            <label for="segment-file-upload">Segment File (STL or JSON)</label>
            <div class="file-upload-area" :class="{ 'has-file': selectedSegmentFile }">
              <input
                id="segment-file-upload"
                ref="segmentFileInput"
                type="file"
                accept=".stl,.json"
                @change="handleSegmentFileSelect"
                :disabled="uploading"
                style="display: none"
              />
              <div v-if="!selectedSegmentFile" class="upload-placeholder" @click="segmentFileInput?.click()">
                <Icon name="upload" :size="32" color="#6b7280" />
                <p>Click to select segment file</p>
                <span>STL or JSON format</span>
              </div>
              <div v-else class="file-info">
                <Icon name="file" :size="24" color="#51CACD" />
                <div class="file-details">
                  <span class="file-name">{{ selectedSegmentFile.name }}</span>
                  <span class="file-size">{{ formatFileSize(selectedSegmentFile.size) }}</span>
                </div>
                <button type="button" @click="clearSegmentFile" class="clear-file-btn">
                  <Icon name="x" :size="16" color="currentColor" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="uploadError" class="error-message">
            {{ uploadError }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="showSegmentUploadModal = false" class="cancel-btn" :disabled="uploading">
              Done
            </button>
            <button type="submit" class="upload-submit-btn" :disabled="uploading || !selectedSegmentFile">
              <span v-if="uploading">Uploading...</span>
              <span v-else>Upload Segment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import AppHeader from './AppHeader.vue'
import { errorHandlingService } from '../services/ErrorHandlingService'
import { useToast } from '../composables/useToast'
import { useConfirmDialog } from '../composables/useConfirmDialog'

const router = useRouter()
const toastService = useToast()
const confirmDialogService = useConfirmDialog()

// State
const loading = ref(false)
const error = ref('')
const cases = ref<any[]>([])
const searchQuery = ref('')
const showUploadModal = ref(false)
const showSegmentUploadModal = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const selectedFile = ref<File | null>(null)
const selectedSegmentFile = ref<File | null>(null)
const selectedCaseForSegments = ref<any>(null)

// Template refs
const fileInput = ref<HTMLInputElement | null>(null)
const segmentFileInput = ref<HTMLInputElement | null>(null)

// Form data
const uploadForm = reactive({
  case_name: ''
})

// User data
const user = ref<any>(null)

// API base URL
const API_BASE = 'http://localhost:3001/api'

// Computed
const filteredCases = computed(() => {
  if (!searchQuery.value) return cases.value
  
  const query = searchQuery.value.toLowerCase()
  return cases.value.filter(caseItem => 
    caseItem.case_name.toLowerCase().includes(query) ||
    caseItem.file_name.toLowerCase().includes(query)
  )
})

// Methods
const getAuthHeaders = () => {
  return errorHandlingService.getAuthHeaders()
}

const loadCases = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/cases`, {
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      await errorHandlingService.handleApiError(response, 'Failed to load cases')
    }

    const data = await response.json()
    cases.value = data.cases || []
  } catch (err: any) {
    error.value = err.message || 'Failed to load cases'
  } finally {
    loading.value = false
  }
}

const handleLogout = () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('user')
  router.push('/login')
}

const handleFileSelect = (event: any) => {
  const file = event.target.files[0]
  if (file && file.name.toLowerCase().endsWith('.stl')) {
    selectedFile.value = file
  } else {
    toastService.error('Invalid File Type', 'Please select a valid STL file')
  }
}

const clearFile = () => {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const handleUpload = async () => {
  if (!selectedFile.value || !uploadForm.case_name) return

  uploading.value = true
  uploadError.value = ''

  try {
    // First, create the case
    const createCaseResponse = await fetch(`${API_BASE}/cases`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        case_name: uploadForm.case_name
      })
    })

    if (!createCaseResponse.ok) {
      await errorHandlingService.handleApiError(createCaseResponse, 'Failed to create case')
    }

    const caseData = await createCaseResponse.json()
    const caseId = caseData.case.id

    // Then upload the file to id/raw
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const uploadResponse = await fetch(`${API_BASE}/cases/${caseId}/raw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: formData
    })

    if (!uploadResponse.ok) {
      await errorHandlingService.handleApiError(uploadResponse, 'Failed to upload file')
    }

    // Reset form and close modal
    uploadForm.case_name = ''
    selectedFile.value = null
    showUploadModal.value = false

    // Reload cases
    await loadCases()
  } catch (err: any) {
    uploadError.value = err.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

const openCase = (caseItem: any) => {
  // Navigate to viewer with case data
  router.push({
    name: 'viewer',
    params: { caseId: caseItem.id },
  })
}

const uploadSegments = (caseItem: any) => {
  selectedCaseForSegments.value = caseItem
  showSegmentUploadModal.value = true
}

const handleSegmentFileSelect = (event: any) => {
  const file = event.target.files[0]
  if (file && (file.name.toLowerCase().endsWith('.stl') || file.name.toLowerCase().endsWith('.json'))) {
    selectedSegmentFile.value = file
  } else {
    toastService.error('Invalid File Type', 'Please select a valid STL or JSON file')
  }
}

const clearSegmentFile = () => {
  selectedSegmentFile.value = null
  if (segmentFileInput.value) {
    segmentFileInput.value.value = ''
  }
}

const handleSegmentUpload = async () => {
  if (!selectedSegmentFile.value || !selectedCaseForSegments.value) return

  uploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedSegmentFile.value)
    
    // Extract segment name from filename
    const fileName = selectedSegmentFile.value.name
    const segmentName = fileName.replace(/^segment-/, '').replace(/\.[^/.]+$/, '')
    formData.append('name', segmentName)

    const token = localStorage.getItem('authToken')
    const response = await fetch(`${API_BASE}/cases/${selectedCaseForSegments.value.id}/segments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Segment upload failed')
    }

    // Show success message
    toastService.success('Upload Successful', `Segment "${segmentName}" uploaded successfully!`)
    
    // Reset form but keep modal open for more uploads
    selectedSegmentFile.value = null
    if (segmentFileInput.value) {
      segmentFileInput.value.value = ''
    }

    // Don't close modal - allow user to upload more files
    // Don't reload cases - keep the current state
  } catch (err: any) {
    uploadError.value = err.message || 'Segment upload failed'
  } finally {
    uploading.value = false
  }
}

const deleteCase = async (caseId: any) => {
  const confirmed = await confirmDialogService.confirmDelete('Are you sure you want to delete this case?')
  if (!confirmed) return

  try {
    const response = await fetch(`${API_BASE}/cases/${caseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to delete case')
    }

    // Reload cases
    await loadCases()
  } catch (err: any) {
    toastService.error('Delete Failed', err.message || 'Failed to delete case')
  }
}

const formatDate = (dateString: any) => {
  return new Date(dateString).toLocaleDateString()
}

const formatFileSize = (bytes: any) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Lifecycle
onMounted(() => {
  // Load user data
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  }

  // Load cases
  loadCases()
})
</script>

<style scoped>
.cases-page {
  min-height: 100vh;
  background: 
    radial-gradient(circle at 15% 85%, rgba(81, 202, 205, 0.2) 0%, transparent 60%),
    radial-gradient(circle at 85% 15%, rgba(81, 202, 205, 0.15) 0%, transparent 55%),
    radial-gradient(circle at 50% 50%, rgba(81, 202, 205, 0.08) 0%, transparent 70%),
    radial-gradient(circle at 25% 25%, rgba(65, 67, 67, 0.9) 0%, transparent 45%),
    radial-gradient(circle at 75% 75%, rgba(45, 47, 47, 0.8) 0%, transparent 50%),
    linear-gradient(135deg, #2a2c2c 0%, #1a1c1c 20%, #252727 40%, #1e2020 60%, #2a2c2c 80%, #1a1c1c 100%);
  position: relative;
  overflow: hidden;
}

.cases-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 10% 20%, rgba(81, 202, 205, 0.06) 0%, transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(81, 202, 205, 0.08) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(81, 202, 205, 0.04) 0%, transparent 60%);
  animation: backgroundShift 25s ease-in-out infinite;
  pointer-events: none;
}

.cases-page::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    linear-gradient(45deg, transparent 40%, rgba(81, 202, 205, 0.03) 50%, transparent 60%),
    linear-gradient(-45deg, transparent 40%, rgba(81, 202, 205, 0.02) 50%, transparent 60%);
  background-size: 80px 80px;
  animation: patternMove 35s linear infinite;
  pointer-events: none;
}

@keyframes backgroundShift {
  0%, 100% { 
    transform: translateX(0) translateY(0) scale(1);
    opacity: 1;
  }
  25% { 
    transform: translateX(-15px) translateY(-8px) scale(1.02);
    opacity: 0.8;
  }
  50% { 
    transform: translateX(8px) translateY(-15px) scale(0.98);
    opacity: 0.9;
  }
  75% { 
    transform: translateX(-8px) translateY(12px) scale(1.01);
    opacity: 0.85;
  }
}

@keyframes patternMove {
  0% { 
    background-position: 0 0, 0 0;
  }
  100% { 
    background-position: 80px 80px, -80px -80px;
  }
}


.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  z-index: 1001;
}

.welcome-text {
  font-size: 14px;
  font-weight: 500;
  color: #cbd5e1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.username {
  font-weight: 700;
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 50%, #3FA4A7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(81, 202, 205, 0.3);
  letter-spacing: 0.5px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: white;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
  z-index: 1001;
}

.logout-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.logout-btn:hover::before {
  left: 100%;
}

.logout-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-color: rgba(239, 68, 68, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.cases-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  color: #f1f5f9;
  min-height: calc(100vh - 64px);
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 50%, #3FA4A7 100%);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(81, 202, 205, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 14px;
}

.upload-btn:hover {
  background: linear-gradient(135deg, #5DD0D3 0%, #51CACD 50%, #4AB8BB 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(81, 202, 205, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(65, 67, 67, 0.8) 0%, rgba(55, 57, 57, 0.7) 100%);
  border: 1px solid rgba(81, 202, 205, 0.3);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(81, 202, 205, 0.1);
  transition: all 0.3s ease;
}

.search-box:focus-within {
  border-color: rgba(81, 202, 205, 0.6);
  box-shadow: 0 4px 20px rgba(81, 202, 205, 0.2), inset 0 1px 0 rgba(81, 202, 205, 0.2);
  transform: translateY(-1px);
}

.search-input {
  border: none;
  outline: none;
  font-size: 14px;
  width: 100%;
  background: transparent;
  color: #f1f5f9;
}

.search-input::placeholder {
  color: #64748b;
}

.cases-table-container {
  background: rgba(65, 67, 67, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(81, 202, 205, 0.4);
  overflow: hidden;
}

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.loading-logo-container {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(81, 202, 205, 0.4));
  animation: logoPulse 2s ease-in-out infinite;
}

@keyframes logoPulse {
  0%, 100% { 
    transform: scale(1);
    filter: drop-shadow(0 4px 12px rgba(81, 202, 205, 0.4));
  }
  50% { 
    transform: scale(1.05);
    filter: drop-shadow(0 6px 16px rgba(81, 202, 205, 0.6));
  }
}


.error-state h3, .empty-state h3 {
  margin: 16px 0 8px 0;
  color: #374151;
}

.error-state p, .empty-state p {
  margin: 0 0 16px 0;
  color: #6b7280;
}

.retry-btn {
  background: #51CACD;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.cases-table {
  overflow-x: auto;
  position: relative;
  z-index: 1;
}

.cases-table table {
  width: 100%;
  border-collapse: collapse;
}

.cases-table th {
  background: rgba(81, 202, 205, 0.15);
  padding: 18px 16px;
  text-align: left;
  font-weight: 700;
  color: #f1f5f9;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 1px;
  border-bottom: 2px solid rgba(81, 202, 205, 0.3);
}

.cases-table td {
  padding: 18px 16px;
  color: #f1f5f9;
  transition: all 0.3s ease;
}

.case-row {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.case-row:hover {
  background: linear-gradient(135deg, rgba(81, 202, 205, 0.08) 0%, rgba(65, 67, 67, 0.6) 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(81, 202, 205, 0.15);
}

.case-name .name {
  font-weight: 600;
  color: #f1f5f9;
}

.file-name {
  color: #94a3b8;
  font-size: 14px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.processing {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.error {
  background: #fee2e2;
  color: #991b1b;
}

.created {
  color: #94a3b8;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: 1px solid #e5e7eb;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e40af;
}

.delete-btn:hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #991b1b;
}

.segment-btn:hover {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1e40af;
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
  background: 
    radial-gradient(circle at 30% 20%, rgba(81, 202, 205, 0.08) 0%, transparent 50%),
    linear-gradient(135deg, rgba(65, 67, 67, 0.95) 0%, rgba(55, 57, 57, 0.92) 30%, rgba(45, 47, 47, 0.9) 70%, rgba(35, 37, 37, 0.88) 100%);
  border-radius: 16px;
  padding: 30px;
  max-width: 500px;
  width: 100%;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 8px 32px rgba(81, 202, 205, 0.1),
    inset 0 1px 0 rgba(81, 202, 205, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(81, 202, 205, 0.4);
  backdrop-filter: blur(20px);
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
  color: #6b7280;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.upload-form {
  margin-bottom: 0;
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
  background: rgba(65, 67, 67, 0.8);
  border: 2px solid rgba(81, 202, 205, 0.3);
  border-radius: 8px;
  font-size: 16px;
  color: #f1f5f9;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #51CACD;
  background: rgba(65, 67, 67, 0.9);
  box-shadow: 0 0 0 3px rgba(81, 202, 205, 0.2);
}

.form-group input::placeholder {
  color: #94a3b8;
}

.file-upload-area {
  border: 2px dashed rgba(81, 202, 205, 0.4);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
  background: rgba(65, 67, 67, 0.3);
}

.file-upload-area:hover {
  border-color: #51CACD;
  background: rgba(81, 202, 205, 0.1);
}

.file-upload-area.has-file {
  border-color: #51CACD;
  background: rgba(81, 202, 205, 0.1);
}

.upload-placeholder {
  color: #94a3b8;
}

.upload-placeholder p {
  margin: 8px 0 4px 0;
  font-weight: 600;
  color: #f1f5f9;
}

.upload-placeholder span {
  font-size: 14px;
  color: #94a3b8;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  display: block;
  font-weight: 600;
  color: #f1f5f9;
}

.file-size {
  display: block;
  font-size: 12px;
  color: #94a3b8;
}

.clear-file-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-file-btn:hover {
  background: rgba(81, 202, 205, 0.1);
  color: #51CACD;
}

.error-message {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.cancel-btn {
  padding: 12px 24px;
  background: rgba(65, 67, 67, 0.8);
  color: #f1f5f9;
  border: 1px solid rgba(81, 202, 205, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-btn:hover:not(:disabled) {
  background: rgba(81, 202, 205, 0.1);
  border-color: #51CACD;
}

.upload-submit-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 50%, #3FA4A7 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5DD0D3 0%, #51CACD 50%, #4AB8BB 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(81, 202, 205, 0.3);
}

.cancel-btn:disabled, .upload-submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
  
  .actions-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    min-width: auto;
  }
  
  .cases-table {
    font-size: 14px;
  }
  
  .cases-table th,
  .cases-table td {
    padding: 12px 8px;
  }
}
</style>

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { errorHandlingService } from './services/ErrorHandlingService'

const app = createApp(App)
app.use(router)

// Initialize error handling service with router
errorHandlingService.initialize(router)

app.mount('#app')

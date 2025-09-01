import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from './components/LoginPage.vue'
import CasesPage from './components/CasesPage.vue'
import DentalViewer from './components/DentalViewer.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/cases',
    name: 'cases',
    component: CasesPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/viewer/:caseId',
    name: 'viewer',
    component: DentalViewer,
    meta: { requiresAuth: true },
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard for authentication
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('authToken')
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !token) {
    // Redirect to login if trying to access protected route without token
    next('/login')
  } else if (to.path === '/login' && token) {
    // Redirect to cases if already logged in
    next('/cases')
  } else {
    next()
  }
})

export default router

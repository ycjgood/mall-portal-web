import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
  { path: '/products', name: 'products', component: () => import('../views/ProductListView.vue') },
  { path: '/seckill', name: 'seckill', component: () => import('../views/SeckillView.vue') },
  { path: '/product/:id', name: 'productDetail', component: () => import('../views/ProductDetailView.vue') },
  // 以下页面需要登录
  { path: '/cart', name: 'cart', component: () => import('../views/CartView.vue'), meta: { auth: true } },
  { path: '/order/confirm', name: 'orderConfirm', component: () => import('../views/OrderConfirmView.vue'), meta: { auth: true } },
  { path: '/orders', name: 'orders', component: () => import('../views/OrderListView.vue'), meta: { auth: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (to.meta.auth && !useUserStore().isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router

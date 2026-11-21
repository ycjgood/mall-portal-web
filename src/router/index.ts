/**
 * 【模块职责】网址与页面的对照表，外加一道门禁。用户敲 /cart 就显示购物车页，
 * 敲 /product/5 就显示 5 号商品详情页；需要登录的页面会先被拦下来。
 * 类比：像商场导览牌加门口保安。
 *
 * 【输入】浏览器地址栏的网址（含 :id 这类动态参数），以及每个路由上标的 meta.auth 是否需要登录。
 * 【输出】渲染对应的页面组件；或在未登录时把地址改成登录页并带上 redirect。
 * 【执行流程】
 *   1) 用 createWebHistory() 建立普通网址模式（网址里不带 # 号）。
 *   2) routes 里逐条登记网址对应哪个页面，页面用 () => import(...) 懒加载：用到才下载，首屏更快。
 *   3) beforeEach 守卫在每次跳转前检查：目标页标了 auth 且用户没登录，就改道登录页。
 * 【关键变量/状态】
 *   - routes：路由表，/product/:id 里的 :id 是动态参数，页面用 route.params.id 取。
 *   - meta.auth：为 true 表示必须登录，目前是购物车、确认订单、我的订单三页。
 *   - useUserStore().isLogin：从 Pinia 用户仓库读的登录状态（有 token 就算登录）。
 * 【注意事项】
 *   1. 加了新页面记得来这里登记，否则网址打不开。
 *   2. 未登录跳转会带 query.redirect 记录原本想去哪，登录成功后由 LoginView 读它跳回去。
 *   3. 前端门禁只是体验层，真正的安全校验在后端；接口返回 401 时 request.ts 还会再兜底跳一次登录。
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

// 网址对应哪个页面的对照表。() => import(...) 是懒加载：只有真访问到那一页才下载它的代码，首屏更快
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

// 导航守卫 = 进门前先查一下：目标页标了 meta.auth 且没登录，
// 就改道去登录页，并把原本想去的完整地址存进 redirect，登录成功后好跳回来
router.beforeEach((to) => {
  if (to.meta.auth && !useUserStore().isLogin) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
